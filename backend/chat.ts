import { q, id, vector, enqueue } from "./db.ts";
import {
  generate,
  embed,
  configured,
  DATA_RULES,
  jsonFetch,
  transcribe,
} from "./ai.ts";
import { answer, internetAnswer } from "./research.ts";
import { addDocument } from "./documents.ts";
import {
  allowedPhone,
  waSend,
  waDocument,
  connectedTool,
} from "./integrations.ts";
import { localSlot } from "./monitor.ts";
import { fuzzyMatchDocument } from "./matcher.ts";
export async function remember(owner: string, text: string) {
  const [embedding] = await embed([text]);
  await q("INSERT INTO memories(id,owner,text,embedding) VALUES($1,$2,$3,$4)", [
    id(),
    owner,
    text,
    vector(embedding),
  ]);
}
export async function chat(
  owner: string,
  message: string,
  channel = "web",
  dialect = "English",
) {
  if (!message.trim() || message.length > 12000)
    throw new Error("Message must be between 1 and 12,000 characters");
  await q(
    "INSERT INTO conversations(id,channel,owner,role,content) VALUES($1,$2,$3,$4,$5)",
    [id(), channel, owner, "user", message],
  );
  let reply = "";
  let citations: any[] = [];
  let attachment: any;
  let coverage: any;
  const day = localSlot(process.env.DEFAULT_TIMEZONE || "Asia/Kolkata").day;
  const welcome = await q(
    `INSERT INTO settings(key,value) VALUES($1,'true') ON CONFLICT DO NOTHING RETURNING key`,
    ["greet:" + owner + ":" + day],
  );
  const cmd = message.trim();
  if (/^\/?(list documents|show documents)$/i.test(cmd)) {
    const docs = await q(
      `SELECT title,metadata->>'uniqueTag' tag,status FROM documents ORDER BY created_at DESC LIMIT 80`,
    );
    reply = docs.length
      ? docs
          .map((d) => `${d.tag || "Indexing"} • ${d.title} (${d.status})`)
          .join("\n")
      : "No documents stored yet. Send a document here or upload it in Document Vault.";
  } else if (/^\/remember\s+/i.test(cmd)) {
    await remember(owner, cmd.replace(/^\/remember\s+/i, ""));
    reply = "Saved to your long-term memory.";
  } else if (/^\/web\s+/i.test(cmd)) {
    const r = await internetAnswer(cmd.replace(/^\/web\s+/i, ""));
    reply = r.synthesis;
  } else if (/^\/tool\s+/i.test(cmd)) {
    const match = cmd.match(/^\/tool\s+(\w+)\s+([\s\S]+)$/);
    if (!match) throw new Error('Use /tool tool_name {"key":"value"}');
    const result = await connectedTool(match[1], JSON.parse(match[2]));
    reply = "Tool result:\n" + result;
  } else if (/^\/remind\s+/i.test(cmd)) {
    const match = cmd.match(/^\/remind\s+(\S+)\s+([\s\S]+)$/);
    if (
      !match ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(match[1]) ||
      !Number.isFinite(Date.parse(match[1]))
    )
      throw new Error(
        "Use /remind 2026-12-01T09:00:00+05:30 Hearing preparation",
      );
    await q(
      "INSERT INTO reminders(id,title,due_at,owner,phone) VALUES($1,$2,$3,$4,$5)",
      [
        id(),
        match[2],
        match[1],
        owner,
        channel === "whatsapp" ? owner.slice(3) : null,
      ],
    );
    reply = "Reminder saved for " + match[1];
  } else if (/^(?:send|retrieve|download)\s+/i.test(cmd)) {
    const query = cmd
      .replace(/^(send|retrieve|download)\s+/i, "")
      .replace(/\b(document|please)\b/gi, "")
      .trim();
    const docs = await q(
      "SELECT id,title,mime,metadata FROM documents ORDER BY created_at DESC LIMIT 10000",
    );
    const match = fuzzyMatchDocument(
      query,
      docs.map(
        (d) =>
          ({
            id: d.id,
            title: d.title,
            pdfFileName: d.title,
            ...d.metadata,
          }) as any,
      ),
    );
    if (!match || match.score < 0.45)
      reply =
        "No sufficiently close document match. Send “list documents” or use the unique document tag.";
    else {
      const d = (
        await q("SELECT id,title,mime,bytes FROM documents WHERE id=$1", [
          match.document.id,
        ])
      )[0];
      attachment = {
        id: d.id,
        title: d.title,
        url: "/api/documents/" + d.id + "/download",
      };
      if (channel === "whatsapp") await waDocument(owner.slice(3), d);
      reply = `Retrieved ${d.title}. ${match.reason}`;
    }
  } else {
    const history = await q(
      "SELECT role,content FROM conversations WHERE owner=$1 ORDER BY created_at DESC LIMIT 16",
      [owner],
    );
    let memories: any[] = [];
    if (configured())
      try {
        const [v] = await embed([message]);
        memories = await q(
          "SELECT text FROM memories WHERE owner=$1 ORDER BY embedding<=>$2::vector LIMIT 8",
          [owner, vector(v)],
        );
      } catch {}
    const summary =
      (
        await q("SELECT value FROM settings WHERE key=$1", ["summary:" + owner])
      )[0]?.value || "";
    const extra = `User memories (not source evidence): ${JSON.stringify(memories)}\nEarlier conversation summary: ${summary}\nRecent conversation (not source evidence): ${JSON.stringify(history.reverse())}`;
    const result = await answer(message, { dialect }, extra);
    reply = result.synthesis;
    citations = result.citations;
    coverage = result.coverage;
    // A general assistant remains useful before the first document is uploaded.
    if (!result.citations.length && configured())
      reply = await generate(
        DATA_RULES,
        `Reply to the user. There are no relevant indexed document passages; do not claim knowledge of their documents. Current date ${day}. Dialect ${dialect}.\n${extra}\nUser: ${message}`,
      );
  }
  if (welcome.length) {
    const reminders = await q(
      `SELECT title,due_at FROM reminders WHERE done=false AND (owner=$1 OR owner='practice') ORDER BY due_at LIMIT 10`,
      [owner],
    );
    reply +=
      "\n\n" +
      (reminders.length
        ? "Upcoming reminders:\n" +
          reminders
            .map((r) => r.title + " — " + new Date(r.due_at).toISOString())
            .join("\n")
        : "No pending reminders.") +
      "\nAny new reminders or documents to add today?";
  }
  await q(
    "INSERT INTO conversations(id,channel,owner,role,content) VALUES($1,$2,$3,$4,$5)",
    [id(), channel, owner, "assistant", reply],
  );
  const count = (
    await q("SELECT count(*)::int n FROM conversations WHERE owner=$1", [owner])
  )[0].n;
  if (configured() && count % 20 === 0)
    await enqueue("memory_summary", { owner });
  return { reply, citations, attachment, coverage };
}
export async function summarizeMemory(owner: string) {
  const old =
    (
      await q("SELECT value FROM settings WHERE key=$1", ["summary:" + owner])
    )[0]?.value || "";
  const recent = await q(
    "SELECT role,content FROM conversations WHERE owner=$1 ORDER BY created_at DESC LIMIT 30",
    [owner],
  );
  const summary = await generate(
    DATA_RULES,
    `Update a concise persistent conversation summary. Preserve user preferences, tasks, commitments, people and unresolved questions. Do not treat assistant assertions as verified document evidence.\nPrevious: ${old}\nRecent: ${JSON.stringify(recent.reverse())}`,
  );
  await q(
    "INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
    ["summary:" + owner, JSON.stringify(summary)],
  );
}
export async function processWhatsApp(message: any) {
  const phone = message.from;
  if (!allowedPhone(phone)) return { ignored: true };
  try {
    let text = message.text?.body || "";
    const media = message.document || message.image || message.audio;
    if (media || !text)
      await q(
        "INSERT INTO conversations(id,channel,owner,role,content) VALUES($1,$2,$3,$4,$5)",
        [
          id(),
          "whatsapp",
          "wa:" + phone,
          "user",
          media?.caption || `[Incoming ${message.type || "media"}]`,
        ],
      );
    if (media?.id) {
      const meta = await jsonFetch(
        `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}/${media.id}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          },
        },
      );
      // Meta's short-lived download URL is issued by its authenticated API, not by an inbound message.
      const mediaURL = new URL(meta.url);
      if (
        mediaURL.protocol !== "https:" ||
        !(
          mediaURL.hostname.endsWith(".facebook.com") ||
          mediaURL.hostname.endsWith(".fbcdn.net") ||
          mediaURL.hostname.endsWith(".fbsbx.com")
        )
      )
        throw new Error("Unexpected WhatsApp media host");
      const r = await fetch(mediaURL, {
        redirect: "error",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error("Media download HTTP " + r.status);
      if (Number(r.headers.get("content-length") || 0) > 25000000)
        throw new Error("Maximum media size is 25 MB");
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length > 25000000)
        throw new Error("Maximum media size is 25 MB");
      const mime =
        meta.mime_type || media.mime_type || "application/octet-stream";
      if (message.audio) text = await transcribe(bytes, mime);
      else {
        const result = await addDocument(
          bytes,
          mime,
          media.filename ||
            `WhatsApp-${message.id}.${mime.includes("pdf") ? "pdf" : mime.split("/")[1] || "bin"}`,
        );
        await waSend(
          phone,
          `Stored ${result.document.title}. ${result.duplicate ? "Already in vault." : "Indexing is queued; use Document Vault to check progress."}`,
        );
        if (!media.caption) return result;
        text = media.caption;
      }
    }
    if (!text) {
      await waSend(
        phone,
        "Send text, a voice note, PDF, Word document, or image.",
      );
      return;
    }
    const result = await chat("wa:" + phone, text, "whatsapp");
    await waSend(phone, result.reply);
    return { sent: true };
  } catch (e: any) {
    await waSend(
      phone,
      "SABEEL could not complete this request: " + e.message.slice(0, 500),
    );
    throw e;
  }
}
