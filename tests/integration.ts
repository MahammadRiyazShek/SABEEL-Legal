import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { PDFDocument as ReadPDF } from "pdf-lib";
import bcrypt from "bcryptjs";

// The external AI endpoint is a local deterministic fixture, never a real provider.
// DATABASE_URL is deliberately NOT used: require an explicitly dedicated test DB.
const db = process.env.INTEGRATION_DATABASE_URL;
const port = Number(process.env.INTEGRATION_PORT || 3197);
const base = `http://127.0.0.1:${port}`;
const text =
  "Integration fixture: Case WP 1234/2026. Village: Example Village. Survey 626. Post on 14.11.2026 for hearing. Parties: Alice Example and Bob Example. This paragraph is test evidence, not a real case.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function pdfBytes() {
  return new Promise<Buffer>((resolve) => {
    const p = new PDFDocument();
    const chunks: Buffer[] = [];
    p.on("data", (c) => chunks.push(c));
    p.on("end", () => resolve(Buffer.concat(chunks)));
    p.text(text);
    p.addPage().text(
      "Second extracted page. Reference WP 1234/2026. Additional integration evidence.",
    );
    p.end();
  });
}

test(
  "real PostgreSQL + pgvector end-to-end workflow",
  {
    timeout: 180000,
    skip: !db
      ? "Set INTEGRATION_DATABASE_URL to a dedicated pgvector-enabled test database"
      : false,
  },
  async (t) => {
    let app: ChildProcess | undefined;
    let log = "";
    let cookie = "";
    let docId = "";
    let pdfId = "";
    const password = "integration-password-only-123";
    const fixture = http.createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const part of req) parts.push(Buffer.from(part));
      const body = JSON.parse(Buffer.concat(parts).toString() || "{}");
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/embeddings")
        return res.end(
          JSON.stringify({
            data: body.input.map((_s: string, index: number) => ({
              index,
              embedding: Array.from({ length: 1536 }, (_, i) =>
                i % 10 === 0 ? 0.2 : 0.01,
              ),
            })),
          }),
        );
      let content =
        "Fixture research result. WP 1234/2026 is referenced in the supplied evidence. [D1 p.1]";
      if (body.response_format)
        content = JSON.stringify({
          summary: "Fixture summary of WP 1234/2026.",
          category: "Court H.C.",
          village: "Example Village",
          surveyNumber: "626",
          caseNumber: "WP 1234/2026",
          assignedLawyer: "",
          nextHearingDate: "2026-11-14",
          dateEvidence: "Post on 14.11.2026 for hearing.",
          parties: ["Alice Example", "Bob Example"],
          actions: [],
          entities: [
            { type: "case", value: "WP 1234/2026", evidence: "WP 1234/2026" },
            {
              type: "village",
              value: "Example Village",
              evidence: "Example Village",
            },
            {
              type: "person",
              value: "Alice Example",
              evidence: "Alice Example",
            },
            { type: "survey", value: "626", evidence: "Survey 626" },
          ],
        });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const aiPort = (fixture.address() as any).port;
    const staffHash = await bcrypt.hash("staff-integration-password", 4);
    function start() {
      app = spawn(process.execPath, ["--import", "tsx", "backend/server.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: db,
          ADMIN_PASSWORD: password,
          ADMIN_USERNAME: "admin",
          STAFF_USERS_JSON: JSON.stringify([
            { username: "staff", passwordHash: staffHash, role: "staff" },
          ]),
          NODE_ENV: "production",
          PORT: String(port),
          APP_URL: base,
          AI_PROVIDER: "openai",
          OPENAI_API_KEY: "fixture-only-not-a-real-key",
          OPENAI_BASE_URL: `http://127.0.0.1:${aiPort}/v1`,
          META_APP_SECRET: "test-signing-secret",
          WHATSAPP_VERIFY_TOKEN: "test-verification-token",
          WHATSAPP_ALLOWED_NUMBERS: "",
          MONITOR_SOURCES_JSON: "[]",
          DRIVE_AUTO_SYNC: "false",
          GOOGLE_DRIVE_FOLDER_ID: "",
          VECTOR_BACKEND: "pgvector",
          WORKER_CONCURRENCY: "2",
        },
      });
      app.stdout?.on("data", (d) => {
        log += d;
      });
      app.stderr?.on("data", (d) => {
        log += d;
      });
    }
    async function ready() {
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(base + "/healthz")).ok) return;
        } catch {}
        if (app?.exitCode !== null && app?.exitCode !== undefined)
          throw new Error(log);
        await sleep(200);
      }
      throw new Error("Server did not start: " + log);
    }
    async function request(
      path: string,
      body?: any,
      method?: string,
      auth = cookie,
    ) {
      const r = await fetch(base + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          ...(auth ? { cookie: auth } : {}),
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      });
      return r;
    }
    async function json(path: string, body?: any, method?: string) {
      const r = await request(path, body, method);
      const d = await r.json();
      assert.ok(r.ok, JSON.stringify(d));
      return d;
    }
    async function jobDone(jobId: string) {
      for (let i = 0; i < 160; i++) {
        const j = await json("/api/jobs/" + jobId);
        if (j.status === "completed") return j;
        if (j.status === "failed" || j.error)
          throw new Error("Job failed: " + JSON.stringify(j));
        await sleep(250);
      }
      throw new Error("Job timed out: " + jobId + "\n" + log);
    }
    async function stop() {
      if (!app || app.exitCode !== null) return;
      const exited = new Promise<void>((r) => app!.once("exit", () => r()));
      app.kill("SIGTERM");
      await Promise.race([exited, sleep(25000)]);
      if (app.exitCode === null) app.kill("SIGKILL");
    }
    try {
      start();
      await ready();
      await t.test("private APIs require authentication", async () => {
        assert.equal((await request("/api/documents")).status, 401);
      });
      await t.test(
        "wrong login is rejected, valid login has HttpOnly cookie",
        async () => {
          assert.equal(
            (
              await request("/api/auth/login", {
                username: "admin",
                password: "wrong",
              })
            ).status,
            401,
          );
          const r = await request("/api/auth/login", {
            username: "admin",
            password,
          });
          assert.equal(r.status, 200);
          assert.ok(r.headers.get("set-cookie")?.includes("HttpOnly"));
          cookie = r.headers.get("set-cookie")!.split(";")[0];
        },
      );
      await t.test("cross-origin write is rejected", async () => {
        const r = await fetch(base + "/api/chat", {
          method: "POST",
          headers: {
            cookie,
            origin: "https://not-your-app.example",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: "hello" }),
        });
        assert.equal(r.status, 403);
      });
      await t.test("staff cannot access admin operations", async () => {
        const r = await request("/api/auth/login", {
          username: "staff",
          password: "staff-integration-password",
        });
        const staffCookie = r.headers.get("set-cookie")!.split(";")[0];
        assert.equal(
          (await request("/api/drive/sync", {}, "POST", staffCookie)).status,
          403,
        );
        assert.equal(
          (await request("/api/audit", undefined, "GET", staffCookie)).status,
          403,
        );
      });
      await t.test(
        "text document is queued and indexed with real pgvector",
        async () => {
          const d = await json("/api/documents/analyze", {
            title: "integration-" + Date.now(),
            text: text + " Unique run " + Date.now(),
          });
          docId = d.document.id;
          await jobDone(d.jobId);
          const listing = await json(
            "/api/documents?search=" + encodeURIComponent(d.document.title),
          );
          const found = listing.documents.find((d: any) => d.id === docId);
          assert.equal(found.status, "ready");
          assert.equal(found.nextHearingDate, "2026-11-14");
          assert.ok(found.uniqueTag.startsWith("SAB-"));
        },
      );
      let originalPDF: Buffer;
      await t.test(
        "PDF upload extracts both real pages and keeps original bytes",
        async () => {
          originalPDF = await pdfBytes();
          const f = new FormData();
          f.append(
            "files",
            new Blob([new Uint8Array(originalPDF)], {
              type: "application/pdf",
            }),
            "integration-original.pdf",
          );
          const d = await json("/api/documents/upload", f);
          pdfId = d.results[0].document.id;
          if (d.results[0].jobId) await jobDone(d.results[0].jobId);
          const listing = await json(
            "/api/documents?search=integration-original.pdf",
          );
          assert.equal(
            listing.documents.find((d: any) => d.id === pdfId).pages,
            2,
          );
          const r = await request("/api/documents/" + pdfId + "/download");
          assert.equal(r.headers.get("content-type"), "application/pdf");
          assert.deepEqual(Buffer.from(await r.arrayBuffer()), originalPDF);
        },
      );
      await t.test(
        "binary duplicate does not create another document",
        async () => {
          const f = new FormData();
          f.append(
            "files",
            new Blob([new Uint8Array(originalPDF)], {
              type: "application/pdf",
            }),
            "same-bytes.pdf",
          );
          const d = await json("/api/documents/upload", f);
          assert.equal(d.results[0].duplicate, true);
          assert.equal(d.results[0].document.id, pdfId);
        },
      );
      await t.test(
        "RAG returns source UUIDs and page-aware citations",
        async () => {
          const d = await json("/api/documents/rag-search", {
            query: "WP 1234/2026 hearing",
            documentIds: [docId, pdfId],
          });
          assert.ok(d.citations.length > 0);
          assert.ok(
            d.citations.every((c: any) =>
              [docId, pdfId].includes(c.documentId),
            ),
          );
          assert.ok(d.citations.every((c: any) => c.page > 0 && c.label));
          assert.equal(d.coverage.eligibleDocuments, 2);
        },
      );
      await t.test(
        "empty scoped result never falls back to unrelated documents",
        async () => {
          const d = await json("/api/documents/rag-search", {
            query: "hearing",
            village: "Village which does not exist",
          });
          assert.equal(d.citations.length, 0);
          assert.equal(d.coverage.eligibleDocuments, 0);
        },
      );
      await t.test(
        "graph links uploaded records using verified quote evidence",
        async () => {
          const d = await json("/api/documents/graph");
          assert.ok(d.nodes.some((n: any) => n.id === docId));
          assert.ok(
            d.edges.some(
              (e: any) =>
                [e.source, e.target].includes(docId) &&
                [e.source, e.target].includes(pdfId),
            ),
          );
          assert.ok(
            d.edges.every((e: any) => e.source_evidence && e.target_evidence),
          );
        },
      );
      await t.test(
        "full corpus job processes the selected records and persists its report",
        async () => {
          const j = await json("/api/research/deep-study", {
            query: "Compare both records",
            documentIds: [docId, pdfId],
          });
          const done = await jobDone(j.jobId);
          assert.equal(done.result.analyzedDocCount, 2);
          assert.equal(done.result.sources.length, 2);
          assert.ok(done.result.report);
        },
      );
      await t.test(
        "PDF export is a parseable PDF, not a placeholder",
        async () => {
          const r = await request("/api/export/pdf", {
            title: "Test report",
            text: "Source-backed report from the integration suite.",
          });
          assert.equal(r.status, 200);
          const p = await ReadPDF.load(await r.arrayBuffer());
          assert.ok(p.getPageCount() >= 1);
        },
      );
      await t.test("PDF merge preserves original pages", async () => {
        const r = await request("/api/documents/merge", {
          documentIds: [pdfId],
        });
        const p = await ReadPDF.load(await r.arrayBuffer());
        assert.equal(p.getPageCount(), 2);
      });
      await t.test(
        "chat, memory and reminders persist to database",
        async () => {
          await json("/api/memories", {
            text: "My integration test preference.",
          });
          const c = await json("/api/chat", {
            message: "What is the hearing date?",
          });
          assert.ok(c.reply);
          assert.ok((await json("/api/chat/history")).history.length >= 2);
          assert.ok(
            (await json("/api/memories")).memories.some(
              (m: any) => m.text === "My integration test preference.",
            ),
          );
          const r = await json("/api/reminders", {
            title: "Integration reminder",
            dueAt: "2030-01-01T09:00:00+05:30",
          });
          assert.ok(r.id);
        },
      );
      await t.test(
        "unsigned webhook is rejected and Meta challenge works",
        async () => {
          assert.equal(
            (await request("/api/whatsapp/webhook", { entry: [] })).status,
            403,
          );
          const r = await fetch(
            base +
              "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verification-token&hub.challenge=123",
          );
          assert.equal(await r.text(), "123");
          const raw = JSON.stringify({ entry: [] });
          const signature =
            "sha256=" +
            crypto
              .createHmac("sha256", "test-signing-secret")
              .update(raw)
              .digest("hex");
          const s = await fetch(base + "/api/whatsapp/webhook", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-hub-signature-256": signature,
            },
            body: raw,
          });
          assert.equal(s.status, 200);
        },
      );
      await t.test(
        "server restart preserves sessions, documents and conversation",
        async () => {
          await stop();
          start();
          await ready();
          assert.equal((await request("/api/auth/me")).status, 200);
          assert.ok(
            (
              await json("/api/documents?search=integration-original.pdf")
            ).documents.some((d: any) => d.id === pdfId),
          );
          assert.ok((await json("/api/chat/history")).history.length >= 2);
        },
      );
      await t.test("logout revokes the persisted session", async () => {
        await json("/api/auth/logout", {});
        assert.equal((await request("/api/auth/me")).status, 401);
      });
    } finally {
      await stop();
      fixture.closeAllConnections();
      await new Promise<void>((r) => fixture.close(() => r()));
    }
  },
);
