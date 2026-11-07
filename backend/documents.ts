import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { supportsDate, supportsEntity } from "./evidence.js";
import { q, pool, id, enqueue, vector } from "./db.js";
import { generate, embed, DATA_RULES, configured } from "./ai.js";
import {
  driveConfigured,
  driveUpload,
  driveOrganize,
  driveListFolder,
  driveDownload,
  pinecone,
  validateURL,
  allowedPhone,
} from "./integrations.js";
const exec = promisify(execFile);
export function chunkPages(pages: string[], size = 1500, overlap = 200) {
  if (size < 10 || overlap < 0 || overlap >= size)
    throw new Error("Invalid chunk bounds");
  const chunks: { page: number; ordinal: number; text: string }[] = [];
  pages.forEach((page, p) => {
    for (let i = 0; i < page.length; i += size - overlap) {
      const text = page.slice(i, i + size).trim();
      if (text) chunks.push({ page: p + 1, ordinal: chunks.length, text });
      if (i + size >= page.length) break;
    }
  });
  return chunks;
}
export async function extract(
  bytes: Buffer,
  mime: string,
  name = "document",
): Promise<string[]> {
  if (bytes.length > 25000000) throw new Error("Maximum file size is 25 MB");
  const dir = await mkdtemp(path.join(tmpdir(), "sabeel-"));
  const file = path.join(dir, "input");
  try {
    await writeFile(file, bytes);
    if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
      await exec("pdftotext", ["-layout", file, path.join(dir, "text.txt")], {
        timeout: 90000,
        maxBuffer: 2000000,
      });
      let pages = (await readFile(path.join(dir, "text.txt"), "utf8")).split(
        "\f",
      );
      if (!pages.at(-1)?.trim()) pages.pop();
      if (!pages.length) throw new Error("PDF has no readable pages");
      const empty = pages
        .map((t, i) => (t.trim().length < 30 ? i + 1 : 0))
        .filter(Boolean);
      if (empty.length && process.env.OCR_ENABLED !== "false") {
        for (const p of empty) {
          const prefix = path.join(dir, "page" + p);
          await exec(
            "pdftoppm",
            [
              "-f",
              String(p),
              "-l",
              String(p),
              "-scale-to",
              "2200",
              "-png",
              "-singlefile",
              file,
              prefix,
            ],
            { timeout: 90000, maxBuffer: 2000000 },
          );
          const { stdout } = await exec(
            "tesseract",
            [
              prefix + ".png",
              "stdout",
              "-l",
              process.env.OCR_LANGUAGES || "eng",
            ],
            { timeout: 120000, maxBuffer: 16000000 },
          );
          pages[p - 1] = stdout;
        }
      }
      return pages;
    }
    if (mime.startsWith("image/") || /\.(tiff?|png|jpe?g|webp)$/i.test(name)) {
      const { stdout } = await exec(
        "tesseract",
        [file, "stdout", "-l", process.env.OCR_LANGUAGES || "eng"],
        { timeout: 120000, maxBuffer: 16000000 },
      );
      return stdout.split("\f");
    }
    if (/\.xlsx$/i.test(name) || mime.includes("spreadsheetml")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as any);
      return workbook.worksheets.map((sheet) => {
        const lines = ["Worksheet: " + sheet.name];
        sheet.eachRow((row, index) =>
          lines.push(
            "Row " +
              index +
              ": " +
              (row.values as any[])
                .slice(1)
                .map((value: any) =>
                  value == null
                    ? ""
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value),
                )
                .join(" | "),
          ),
        );
        return lines.join("\n");
      });
    }
    if (/\.docx$/i.test(name) || mime.includes("wordprocessingml"))
      return [(await mammoth.extractRawText({ buffer: bytes })).value];
    if (/\.doc$/i.test(name) || mime === "application/msword")
      return [
        (
          await exec("antiword", [file], {
            timeout: 60000,
            maxBuffer: 16000000,
          })
        ).stdout,
      ];
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      /\.(txt|md|csv|json)$/i.test(name)
    )
      return [bytes.toString("utf8")];
    throw new Error(
      "Supported files: PDF, DOCX, DOC, XLSX, TXT, MD, CSV, JSON, PNG, JPG, TIFF, WEBP",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export function viewDoc(d: any) {
  return {
    id: d.id,
    title: d.title,
    mime: d.mime,
    status: d.status,
    error: d.error,
    driveId: d.drive_id,
    driveUrl: d.drive_url,
    createdAt: d.created_at,
    ...d.metadata,
    downloadUrl: "/api/documents/" + d.id + "/download",
  };
}
export async function addDocument(
  bytes: Buffer,
  mime: string,
  title: string,
  drive?: any,
  uniqueTag?: string,
) {
  if (!bytes.length) throw new Error("Empty document");
  if (bytes.length > 25000000) throw new Error("Maximum file size is 25 MB");
  title =
    path
      .basename(title)
      .replace(/[\r\n\x00-\x1f]/g, "")
      .slice(0, 240) || "document.txt";
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  const key = id(),
    jobId = id();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const added = await client.query(
      `INSERT INTO documents(id,title,sha,mime,bytes,drive_id,drive_url,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(sha) DO NOTHING RETURNING *`,
      [
        key,
        title,
        sha,
        mime,
        bytes,
        drive?.id || null,
        drive?.webViewLink || null,
        {
          ...(drive ? { driveModified: drive.modifiedTime } : {}),
          ...(uniqueTag ? { uniqueTag: uniqueTag.trim() } : {}),
        },
      ],
    );
    if (!added.rows.length) {
      const prior = (
        await client.query("SELECT * FROM documents WHERE sha=$1", [sha])
      ).rows[0];
      await client.query("COMMIT");
      return { document: viewDoc(prior), duplicate: true };
    }
    await client.query("INSERT INTO jobs(id,kind,payload) VALUES($1,$2,$3)", [
      jobId,
      "ingest",
      { documentId: key },
    ]);
    await client.query("COMMIT");
    return { document: viewDoc(added.rows[0]), jobId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function ingest(documentId: string) {
  const d = (await q("SELECT * FROM documents WHERE id=$1", [documentId]))[0];
  if (!d) return;
  await q(`UPDATE documents SET status='processing',error=NULL WHERE id=$1`, [
    documentId,
  ]);
  try {
    const pages = await extract(d.bytes, d.mime, d.title);
    const text = pages.join("\n\f\n");
    if (text.trim().length < 20)
      throw new Error(
        "No readable document text. Check OCR languages and scan quality.",
      );
    const chunks = chunkPages(pages);
    const summaries: string[] = [];
    if (!configured())
      throw new Error(
        "Set AI provider credentials, then retry indexing this document.",
      );
    // Every page is represented in the document summary; do not truncate to a first-page sample.
    for (let i = 0; i < text.length; i += 24000) {
      summaries.push(
        await generate(
          DATA_RULES,
          "Summarize this document segment factually, preserving all case numbers, names, land identifiers, dates, deadlines and explicit cross-references. Do not infer missing facts.\n" +
            text.slice(i, i + 24000),
        ),
      );
    }
    const raw = await generate(
      DATA_RULES,
      `Return JSON {"summary":string,"category":string,"village":string,"surveyNumber":string,"caseNumber":string,"assignedLawyer":string,"nextHearingDate":string|null,"dateEvidence":string,"parties":string[],"actions":[{"description":string,"date":string|null,"evidence":string}],"entities":[{"type":"case"|"person"|"village"|"survey"|"reference"|"authority","value":string,"evidence":string}]}. Unknown values must be empty, not invented. Hearing date ISO YYYY-MM-DD only when clearly stated. Every entity/date evidence must be an exact quote from raw text. Category can be Revenue, Court H.C., Court S.C., Court L.C., Police, HMDA, A.D., General.\nSUMMARIES:\n${summaries.join("\n").slice(0, 65000)}\nRAW QUOTE REFERENCE:\n${text.slice(0, 45000)}\n${text.slice(-10000)}`,
      true,
    );
    const meta = JSON.parse(raw);
    const normalized = text.replace(/\s+/g, " ").toLowerCase();
    const evidenceOK = (s: any) =>
      typeof s === "string" &&
      s.trim().length > 2 &&
      normalized.includes(s.replace(/\s+/g, " ").trim().toLowerCase());
    meta.entities = (Array.isArray(meta.entities) ? meta.entities : []).filter(
      (e: any) =>
        [
          "case",
          "person",
          "village",
          "survey",
          "reference",
          "authority",
        ].includes(e.type) &&
        typeof e.value === "string" &&
        e.value.length < 300 &&
        evidenceOK(e.evidence) &&
        supportsEntity(e.value, e.evidence),
    );
    meta.actions = (Array.isArray(meta.actions) ? meta.actions : []).filter(
      (a: any) => evidenceOK(a.evidence),
    );
    if (
      !supportsDate(meta.nextHearingDate, meta.dateEvidence) ||
      !evidenceOK(meta.dateEvidence)
    )
      meta.nextHearingDate = null;
    meta.parties = Array.isArray(meta.parties) ? meta.parties : [];
    meta.uniqueTag =
      d.metadata.uniqueTag || "SAB-" + documentId.slice(0, 8).toUpperCase();
    meta.pages = pages.length;
    meta.summary = meta.summary || summaries.join("\n");
    const vectors = await embed(chunks.map((c) => c.text));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM chunks WHERE document_id=$1", [
        documentId,
      ]);
      await client.query("DELETE FROM entities WHERE document_id=$1", [
        documentId,
      ]);
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        await client.query(
          "INSERT INTO chunks(id,document_id,page,ordinal,text,embedding) VALUES($1,$2,$3,$4,$5,$6)",
          [id(), documentId, c.page, c.ordinal, c.text, vector(vectors[i])],
        );
      }
      for (const e of meta.entities)
        await client.query(
          "INSERT INTO entities(document_id,type,value,evidence) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [
            documentId,
            e.type,
            e.value.toLowerCase().trim().replace(/\s+/g, " "),
            e.evidence,
          ],
        );
      await client.query(
        `UPDATE documents SET text=$2,metadata=(metadata||$3::jsonb)||CASE WHEN metadata ? 'uniqueTag' THEN jsonb_build_object('uniqueTag',metadata->'uniqueTag') ELSE '{}'::jsonb END,status='ready',error=NULL,updated_at=now() WHERE id=$1`,
        [documentId, text, { ...d.metadata, ...meta }],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    if (process.env.VECTOR_BACKEND === "pinecone")
      await enqueue("pinecone", { documentId });
    if (driveConfigured() && !d.drive_id)
      await enqueue("drive_upload", { documentId });
    if (meta.nextHearingDate) {
      const dup = await q("SELECT 1 FROM reminders WHERE title=$1", [
        "Hearing: " + d.title,
      ]);
      if (!dup.length)
        await q(
          "INSERT INTO reminders(id,title,due_at,phone,owner) VALUES($1,$2,$3,$4,$5)",
          [
            id(),
            "Hearing: " + d.title,
            meta.nextHearingDate + "T09:00:00+05:30",
            process.env.WHATSAPP_DEFAULT_RECIPIENT || null,
            "practice",
          ],
        );
    }
    // Once source mappings are configured, matching uploads create daily monitors without a per-document setup step.
    for (const source of JSON.parse(process.env.MONITOR_SOURCES_JSON || "[]")) {
      if (source.category && source.category !== meta.category) continue;
      const matchText = String(meta[source.matchField || "caseNumber"] || "");
      if (matchText.length < 3) continue;
      if (
        (source.matchField || "caseNumber") === "caseNumber" &&
        !meta.entities.some((e: any) => e.type === "case")
      )
        continue;
      const exists = await q(
        "SELECT 1 FROM monitors WHERE document_id=$1 AND url=$2",
        [documentId, source.url],
      );
      if (exists.length) continue;
      try {
        await validateURL(
          source.url
            .replaceAll("{date}", "2026-01-01")
            .replaceAll("{YYYY}", "2026")
            .replaceAll("{MM}", "01")
            .replaceAll("{DD}", "01"),
        );
        const phone =
          source.phone || process.env.WHATSAPP_DEFAULT_RECIPIENT || null;
        if (phone && !allowedPhone(phone))
          throw new Error("Monitor recipient is not allowed");
        await q(
          "INSERT INTO monitors(id,document_id,title,url,match_text,date_pattern,timezone,local_time,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            id(),
            documentId,
            d.title,
            source.url,
            matchText,
            source.datePattern || "DD.MM.YYYY",
            source.timezone || process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
            source.localTime || "19:00",
            phone,
          ],
        );
      } catch (e: any) {
        await q("INSERT INTO audit(actor,action,details) VALUES($1,$2,$3)", [
          "system",
          "auto_monitor_configuration_error",
          { documentId, error: e.message },
        ]);
      }
    }
  } catch (e: any) {
    await q(`UPDATE documents SET status='failed',error=$2 WHERE id=$1`, [
      documentId,
      e.message,
    ]);
    throw e;
  }
}
export async function mirrorDrive(documentId: string) {
  const d = (await q("SELECT * FROM documents WHERE id=$1", [documentId]))[0];
  if (!d || d.drive_id) return;
  const folder = await driveOrganize(d.metadata);
  const file = await driveUpload(d.title, d.mime, d.bytes, folder);
  await q("UPDATE documents SET drive_id=$2,drive_url=$3 WHERE id=$1", [
    documentId,
    file.id,
    file.webViewLink,
  ]);
}
export async function mirrorPinecone(documentId: string) {
  const rows = await q(
    "SELECT id,text,page,embedding::text AS vector FROM chunks WHERE document_id=$1 ORDER BY ordinal",
    [documentId],
  );
  for (let i = 0; i < rows.length; i += 50)
    await pinecone("/vectors/upsert", {
      vectors: rows.slice(i, i + 50).map((c) => ({
        id: c.id,
        values: JSON.parse(c.vector),
        metadata: { documentId, page: c.page },
      })),
    });
}
export async function syncDrive() {
  if (!driveConfigured())
    throw new Error("Google Drive credentials and root folder are required");
  const folders = [process.env.GOOGLE_DRIVE_FOLDER_ID!];
  let imported = 0;
  let unchanged = 0;
  const visited = new Set<string>();
  const errors: any[] = [];
  while (folders.length) {
    const folder = folders.shift()!;
    if (visited.has(folder)) continue;
    visited.add(folder);
    let page = "";
    do {
      const listing = await driveListFolder(folder, page);
      for (const f of listing.files || []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          folders.push(f.id);
          continue;
        }
        try {
          const existing = (
            await q(
              "SELECT id,metadata,status FROM documents WHERE drive_id=$1",
              [f.id],
            )
          )[0];
          if (existing && existing.metadata.driveModified === f.modifiedTime) {
            unchanged++;
            continue;
          }
          if (/google-apps\.(shortcut|form|site)/.test(f.mimeType)) continue;
          const downloaded = await driveDownload(f);
          if (existing) {
            const sha = crypto
              .createHash("sha256")
              .update(downloaded.bytes)
              .digest("hex");
            const dup = await q(
              "SELECT id FROM documents WHERE sha=$1 AND id<>$2",
              [sha, existing.id],
            );
            if (dup.length) {
              unchanged++;
              continue;
            }
            await q(
              `UPDATE documents SET bytes=$2,mime=$3,sha=$4,title=$5,metadata=metadata||$6::jsonb,status='queued' WHERE id=$1`,
              [
                existing.id,
                downloaded.bytes,
                downloaded.mime,
                sha,
                f.name,
                JSON.stringify({ driveModified: f.modifiedTime }),
              ],
            );
            await enqueue("ingest", { documentId: existing.id });
          } else
            await addDocument(downloaded.bytes, downloaded.mime, f.name, f);
          imported++;
        } catch (e: any) {
          errors.push({ file: f.name, error: e.message });
        }
      }
      page = listing.nextPageToken || "";
    } while (page);
  }
  return { imported, unchanged, errors };
}
