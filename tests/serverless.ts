import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
const db = process.env.SERVERLESS_TEST_DATABASE_URL;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
test(
  "Vercel handler + separate persistent worker",
  {
    timeout: 180000,
    skip: !db
      ? "Set SERVERLESS_TEST_DATABASE_URL to a dedicated pgvector test DB"
      : false,
  },
  async (t) => {
    process.env.DATABASE_URL = db;
    process.env.VERCEL = "1";
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "serverless-fixture-cron-secret";
    process.env.META_APP_SECRET = "raw-body-fixture-secret";
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "fixture-not-a-real-key";
    process.env.WHATSAPP_ALLOWED_NUMBERS = "";
    process.env.GOOGLE_DRIVE_FOLDER_ID = "";
    process.env.DRIVE_AUTO_SYNC = "false";
    process.env.MONITOR_SOURCES_JSON = "[]";
    const fixture = http.createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const part of req) parts.push(Buffer.from(part));
      const body = JSON.parse(Buffer.concat(parts).toString());
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/embeddings")
        return res.end(
          JSON.stringify({
            data: body.input.map((_: any, index: number) => ({
              index,
              embedding: Array.from({ length: 1536 }, (_, i) =>
                i % 10 === 0 ? 0.2 : 0.01,
              ),
            })),
          }),
        );
      const content = body.response_format
        ? JSON.stringify({
            summary: "Fixture summary",
            category: "Revenue",
            village: "Example",
            surveyNumber: "626",
            parties: [],
            entities: [],
            actions: [],
            nextHearingDate: null,
          })
        : "Fixture research finding. Evidence preserved for this test only.";
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(fixture.address() as any).port}/v1`;
    const { default: handler } = await import("../api/index.ts");
    const { q, pool } = await import("../backend/db.ts");
    // Match Vercel's documented lazy request.body helper, without allowing it to
    // consume/normalize the bytes used to verify a signed Meta webhook.
    const server = http.createServer((req: any, res) => {
      Object.defineProperty(req, "body", {
        configurable: true,
        get() {
          throw new Error("Vercel body getter consumed raw bytes");
        },
      });
      handler(req, res);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    process.env.APP_URL = base;
    let worker: ReturnType<typeof spawn> | undefined;
    let log = "";
    const request = (path: string, body?: any, extra: RequestInit = {}) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        ...(body
          ? {
              headers:
                body instanceof FormData
                  ? {}
                  : { "Content-Type": "application/json" },
              body: body instanceof FormData ? body : JSON.stringify(body),
            }
          : {}),
        ...extra,
      });
    const json = async (path: string, body?: any) => {
      const r = await request(path, body);
      const value = await r.json();
      assert.ok(r.ok, JSON.stringify(value));
      return value;
    };
    try {
      await t.test("cold-start health and no-login workspace", async () => {
        assert.equal((await request("/api/healthz")).status, 200);
        assert.equal((await json("/api/workspace")).username, "workspace");
        assert.equal((await json("/api/status")).deployment, "vercel");
      });
      await t.test(
        "raw JSON whitespace survives Meta HMAC validation",
        async () => {
          const raw = '{ "entry" : [ ] , "fixture" : "preserve  spaces" }';
          const signature =
            "sha256=" +
            crypto
              .createHmac("sha256", process.env.META_APP_SECRET!)
              .update(raw)
              .digest("hex");
          const result = await request("/api/whatsapp/webhook", undefined, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-hub-signature-256": signature,
            },
            body: raw,
          });
          assert.equal(result.status, 200);
        },
      );
      await t.test("cron requires its bearer secret", async () => {
        assert.equal((await request("/api/cron")).status, 401);
        assert.equal(
          (
            await request("/api/cron", undefined, {
              headers: { authorization: "Bearer " + process.env.CRON_SECRET },
            })
          ).status,
          200,
        );
      });
      let documentId = "",
        jobId = "";
      await t.test(
        "multipart upload queues work without a serverless background loop",
        async () => {
          const f = new FormData();
          f.set(
            "files",
            new Blob(
              [
                "Actual extracted text: Survey 626 in Example village. This is a fixture.",
              ],
              { type: "text/plain" },
            ),
            "serverless-fixture.txt",
          );
          f.set("tags", JSON.stringify(["Serverless fixture keyword"]));
          const result = await json("/api/documents/upload", f);
          documentId = result.results[0].document.id;
          jobId = result.results[0].jobId;
          await sleep(1600);
          assert.equal((await json("/api/jobs/" + jobId)).status, "pending");
          assert.equal((await json("/api/status")).worker, null);
        },
      );
      await t.test(
        "worker process consumes persisted queue and updates heartbeat",
        async () => {
          worker = spawn(
            process.execPath,
            ["--import", "tsx", "backend/worker-entry.ts"],
            {
              env: { ...process.env, VERCEL: "", WORKER_CONCURRENCY: "2" },
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          worker.stdout?.on("data", (d) => (log += d));
          worker.stderr?.on("data", (d) => (log += d));
          for (let i = 0; i < 120; i++) {
            const job = await json("/api/jobs/" + jobId);
            if (job.status === "completed") break;
            if (job.error) throw new Error(job.error);
            await sleep(250);
          }
          assert.equal(
            (await json("/api/jobs/" + jobId)).status,
            "completed",
            log,
          );
          assert.ok((await json("/api/status")).worker.at);
          const docs = await json("/api/documents?search=serverless-fixture");
          assert.equal(
            docs.documents.find((d: any) => d.id === documentId).uniqueTag,
            "Serverless fixture keyword",
          );
        },
      );
      await t.test(
        "browser upload cap returns an actionable error",
        async () => {
          const f = new FormData();
          f.set(
            "files",
            new Blob([new Uint8Array(4000001)], { type: "text/plain" }),
            "too-large.txt",
          );
          f.set("tags", JSON.stringify(["Oversize fixture"]));
          const r = await request("/api/documents/upload", f);
          assert.equal(r.status, 413);
          assert.match((await r.json()).error, /Google Drive/);
        },
      );
      await t.test(
        "keyword uniqueness and partial-job payload boundaries",
        async () => {
          const r = await request("/api/documents/analyze", {
            title: "conflict.txt",
            uniqueTag: "Serverless fixture keyword",
            text: "A different file with conflicting keyword.",
          });
          assert.equal(r.status, 409);
          const key = crypto.randomUUID();
          await q(
            "INSERT INTO jobs(id,kind,payload,result) VALUES($1,'study','{}',$2)",
            [
              key,
              JSON.stringify({
                partial: { large: "notes" },
                progress: { completed: 1, total: 2 },
              }),
            ],
          );
          const job = await json("/api/jobs/" + key);
          assert.equal(job.result.partial, undefined);
          assert.equal(job.result.progress.total, 2);
          await q("DELETE FROM jobs WHERE id=$1", [key]);
        },
      );
      await t.test(
        "full-corpus review covers 1,000 selected fixture documents",
        async () => {
          await q(
            `INSERT INTO documents(id,title,sha,mime,text,status,metadata) SELECT gen_random_uuid(),'Scale fixture '||i,'scale-fixture-'||i,'text/plain','Scale fixture record '||i||'. Case WP TEST 2026. Evidence from this selected record.','ready','{"village":"Scale Fixture"}'::jsonb FROM generate_series(1,1000) i`,
          );
          const result = await json("/api/research/deep-study", {
            query: "Review the selected fixture records",
            village: "Scale Fixture",
          });
          assert.equal(result.documentCount, 1000);
          let job: any;
          for (let i = 0; i < 500; i++) {
            job = await json("/api/jobs/" + result.jobId);
            if (job.status === "completed") break;
            if (job.error) throw new Error(job.error);
            await sleep(150);
          }
          assert.equal(job.status, "completed", log);
          assert.equal(job.result.analyzedDocCount, 1000);
          assert.equal(job.result.sources.length, 1000);
        },
      );
    } finally {
      if (worker && worker.exitCode === null) {
        const exited = new Promise((r) => worker!.once("exit", r));
        worker.kill("SIGTERM");
        await Promise.race([exited, sleep(25000)]);
        if (worker.exitCode === null) worker.kill("SIGKILL");
      }
      await pool.end();
      server.closeAllConnections();
      fixture.closeAllConnections();
      await Promise.all([
        new Promise<void>((r) => server.close(() => r())),
        new Promise<void>((r) => fixture.close(() => r())),
      ]);
    }
  },
);
