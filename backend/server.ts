import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { PDFDocument as MergePDF } from "pdf-lib";
import { q, pool, id, migrate, enqueue, audit } from "./db.ts";
import { addDocument, viewDoc } from "./documents.ts";
import { answer, filters, graph, internetAnswer } from "./research.ts";
import { chat, remember } from "./chat.ts";
import { configured, provider } from "./ai.ts";
import {
  driveConfigured,
  allowedPhone,
  validateURL,
  connectedTool,
} from "./integrations.ts";
import { startWorkers } from "./worker.ts";

const app = express();
const prod = process.env.NODE_ENV === "production";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: prod ? undefined : false,
  }),
);
app.use(
  express.json({
    limit: "2mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cookieParser());
const wrap = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const equal = (a: string, b: string) =>
  crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
app.get(
  "/healthz",
  wrap(async (_req: any, res: any) => {
    await q("SELECT 1");
    res.json({ ok: true, service: "sabeel", version: "1.0.0" });
  }),
);
app.get("/api/whatsapp/webhook", (req, res) => {
  if (
    process.env.WHATSAPP_VERIFY_TOKEN &&
    req.query["hub.mode"] === "subscribe" &&
    equal(
      String(req.query["hub.verify_token"] || ""),
      process.env.WHATSAPP_VERIFY_TOKEN,
    )
  )
    res.send(req.query["hub.challenge"]);
  else res.sendStatus(403);
});
app.post(
  "/api/whatsapp/webhook",
  wrap(async (req: any, res: any) => {
    const secret = process.env.META_APP_SECRET;
    if (!secret)
      return res.status(503).json({ error: "META_APP_SECRET is missing" });
    const signature =
      "sha256=" +
      crypto
        .createHmac("sha256", secret)
        .update(req.rawBody || Buffer.alloc(0))
        .digest("hex");
    if (!equal(signature, req.headers["x-hub-signature-256"] || ""))
      return res.sendStatus(403);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const entry of req.body.entry || [])
        for (const change of entry.changes || [])
          for (const message of change.value?.messages || []) {
            if (!allowedPhone(message.from)) continue;
            const inserted = await client.query(
              "INSERT INTO webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id",
              [message.id],
            );
            if (inserted.rowCount)
              await client.query(
                "INSERT INTO jobs(id,kind,payload) VALUES($1,$2,$3)",
                [id(), "whatsapp", { message }],
              );
          }
      await client.query("COMMIT");
      res.sendStatus(200);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);
// Same-origin mutation guard; server-to-server WhatsApp is handled above.
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = process.env.APP_URL?.replace(/\/$/, "");
    if (
      origin &&
      origin !== (expected || `${req.protocol}://${req.get("host")}`)
    )
      return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
});
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req: any, res: any) => {
    const body = z
      .object({ username: z.string().max(100), password: z.string().max(300) })
      .parse(req.body);
    let role = "staff";
    let valid = false;
    if (
      body.username === (process.env.ADMIN_USERNAME || "admin") &&
      process.env.ADMIN_PASSWORD
    ) {
      valid = equal(body.password, process.env.ADMIN_PASSWORD);
      role = "admin";
    } else {
      const user = JSON.parse(process.env.STAFF_USERS_JSON || "[]").find(
        (u: any) => u.username === body.username,
      );
      if (user) {
        valid = await bcrypt.compare(body.password, user.passwordHash || "");
        role = user.role === "admin" ? "admin" : "staff";
      }
    }
    if (!valid)
      return res.status(401).json({ error: "Invalid username or password" });
    const token = crypto.randomBytes(32).toString("hex");
    await q(
      "INSERT INTO sessions(token_hash,username,role,expires) VALUES($1,$2,$3,now()+interval '12 hours')",
      [hash(token), body.username, role],
    );
    res.cookie("sabeel_session", token, {
      httpOnly: true,
      secure: prod,
      sameSite: "strict",
      maxAge: 43200000,
      path: "/",
    });
    await audit(body.username, "login");
    res.json({ username: body.username, role });
  }),
);
app.use(
  "/api",
  wrap(async (req: any, res: any, next: any) => {
    const token = req.cookies.sabeel_session;
    const session = token
      ? (
          await q(
            "SELECT username,role FROM sessions WHERE token_hash=$1 AND expires>now()",
            [hash(token)],
          )
        )[0]
      : null;
    if (!session) return res.status(401).json({ error: "Sign in required" });
    req.user = session;
    next();
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
const admin = (req: any, res: any, next: any) =>
  req.user.role === "admin"
    ? next()
    : res.status(403).json({ error: "Administrator access required" });
const owner = (req: any) => "web:" + req.user.username;
app.get("/api/auth/me", (req: any, res) => res.json(req.user));
app.post(
  "/api/auth/logout",
  wrap(async (req: any, res: any) => {
    await q("DELETE FROM sessions WHERE token_hash=$1", [
      hash(req.cookies.sabeel_session || ""),
    ]);
    res.clearCookie("sabeel_session", { path: "/" });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/status",
  wrap(async (req: any, res: any) => {
    const counts = (
      await q(
        `SELECT count(*)::int total,count(*) FILTER(WHERE status='ready')::int ready,count(*) FILTER(WHERE status='failed')::int failed FROM documents`,
      )
    )[0];
    const jobs = (
      await q(
        `SELECT count(*) FILTER(WHERE status IN ('pending','running'))::int pending,count(*) FILTER(WHERE status='failed')::int failed FROM jobs`,
      )
    )[0];
    res.json({
      counts,
      jobs,
      integrations: {
        ai: configured(),
        provider: provider(),
        drive: driveConfigured(),
        whatsapp:
          !!process.env.WHATSAPP_ACCESS_TOKEN &&
          !!process.env.WHATSAPP_PHONE_NUMBER_ID &&
          !!process.env.META_APP_SECRET,
        web: !!process.env.TAVILY_API_KEY,
        vector: process.env.VECTOR_BACKEND || "pgvector",
        pinecone: !!process.env.PINECONE_API_KEY && !!process.env.PINECONE_HOST,
      },
      timezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
      appUrl: process.env.APP_URL || "",
      tools: JSON.parse(process.env.CONNECTED_TOOLS_JSON || "[]").map(
        (t: any) => ({ name: t.name, description: t.description }),
      ),
      user: req.user,
    });
  }),
);
app.get(
  "/api/documents",
  wrap(async (req: any, res: any) => {
    const values: any[] = [];
    const parts: string[] = [];
    if (req.query.search) {
      values.push("%" + String(req.query.search) + "%");
      parts.push(
        `(title ILIKE $${values.length} OR text ILIKE $${values.length} OR metadata::text ILIKE $${values.length})`,
      );
    }
    for (const field of [
      "village",
      "category",
      "assignedLawyer",
      "surveyNumber",
    ])
      if (req.query[field]) {
        values.push(String(req.query[field]));
        parts.push(`metadata->>'${field}'=$${values.length}`);
      }
    const where = parts.length ? "WHERE " + parts.join(" AND ") : "";
    const count = (
      await q(`SELECT count(*)::int n FROM documents ${where}`, values)
    )[0].n;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    values.push(limit, offset);
    const rows = await q(
      `SELECT id,title,mime,status,error,drive_id,drive_url,metadata,created_at FROM documents ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    res.json({ documents: rows.map(viewDoc), count, limit, offset });
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25000000, files: 20 },
});
app.post(
  "/api/documents/upload",
  upload.array("files", 20),
  wrap(async (req: any, res: any) => {
    const results = [];
    for (const file of req.files || [])
      results.push(
        await addDocument(file.buffer, file.mimetype, file.originalname),
      );
    if (!results.length)
      return res.status(400).json({ error: "Choose at least one file" });
    await audit(req.user.username, "upload", { count: results.length });
    res.status(202).json({ results });
  }),
);
app.post(
  "/api/documents/analyze",
  wrap(async (req: any, res: any) => {
    const b = z
      .object({
        title: z.string().min(1).max(240),
        text: z.string().min(20).max(1000000),
      })
      .parse(req.body);
    res
      .status(202)
      .json(
        await addDocument(
          Buffer.from(b.text),
          "text/plain",
          b.title.endsWith(".txt") ? b.title : b.title + ".txt",
        ),
      );
  }),
);
app.get(
  "/api/documents/:id/download",
  wrap(async (req: any, res: any) => {
    const doc = (
      await q("SELECT title,mime,bytes FROM documents WHERE id=$1", [
        z.string().uuid().parse(req.params.id),
      ])
    )[0];
    if (!doc) return res.sendStatus(404);
    res.set("Content-Type", doc.mime);
    res.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.title)}`,
    );
    res.send(doc.bytes);
  }),
);
app.patch(
  "/api/documents/:id",
  wrap(async (req: any, res: any) => {
    const body = z
      .object({
        assignedLawyer: z.string().max(200).optional(),
        uniqueTag: z.string().min(2).max(100).optional(),
        village: z.string().max(200).optional(),
        surveyNumber: z.string().max(200).optional(),
        category: z.string().max(100).optional(),
      })
      .strict()
      .parse(req.body);
    await q("UPDATE documents SET metadata=metadata||$2::jsonb WHERE id=$1", [
      z.string().uuid().parse(req.params.id),
      JSON.stringify(body),
    ]);
    await audit(req.user.username, "document_metadata", {
      id: req.params.id,
      ...body,
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/documents/:id/retry",
  wrap(async (req: any, res: any) => {
    const key = z.string().uuid().parse(req.params.id);
    res.json({ jobId: await enqueue("ingest", { documentId: key }) });
  }),
);
app.delete(
  "/api/documents/:id",
  admin,
  wrap(async (req: any, res: any) => {
    const key = z.string().uuid().parse(req.params.id);
    await q("DELETE FROM documents WHERE id=$1", [key]);
    await audit(req.user.username, "delete_document", { id: key });
    res.json({
      ok: true,
      note: "Removed from local vault. Drive original remains; stale Pinecone IDs are excluded by SQL canonical access.",
    });
  }),
);
app.post(
  "/api/drive/sync",
  admin,
  wrap(async (_req: any, res: any) =>
    res.status(202).json({ jobId: await enqueue("drive_sync", {}) }),
  ),
);
const scopeSchema = z.object({
  documentIds: z.array(z.string().uuid()).max(20000).optional(),
  village: z.string().max(200).optional(),
  surveyNumber: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  lawyer: z.string().max(200).optional(),
});
app.post(
  "/api/documents/rag-search",
  wrap(async (req: any, res: any) => {
    const b = scopeSchema
      .extend({
        query: z.string().min(1).max(12000),
        prepareBriefType: z.string().max(100).optional(),
        dialect: z.string().max(100).optional(),
      })
      .parse(req.body);
    res.json(await answer(b.query, b));
  }),
);
app.post(
  "/api/research/deep-study",
  wrap(async (req: any, res: any) => {
    const b = scopeSchema
      .extend({ query: z.string().min(1).max(12000) })
      .parse(req.body);
    const f = filters(b);
    const ids = (
      await q(
        `SELECT d.id FROM documents d WHERE ${f.where} ORDER BY d.created_at`,
        f.values,
      )
    ).map((d) => d.id);
    if (!ids.length)
      return res
        .status(400)
        .json({ error: "No indexed documents in the selected scope" });
    const jobId = await enqueue("study", {
      documentIds: ids,
      query: b.query,
      owner: owner(req),
    });
    await audit(req.user.username, "full_corpus_research", {
      documents: ids.length,
      jobId,
    });
    res.status(202).json({ jobId, documentCount: ids.length });
  }),
);
app.get(
  "/api/documents/graph",
  wrap(async (req: any, res: any) => res.json(await graph(req.query))),
);
app.post(
  "/api/research/web",
  wrap(async (req: any, res: any) => {
    const { query } = z
      .object({ query: z.string().min(1).max(5000) })
      .parse(req.body);
    res.json(await internetAnswer(query));
  }),
);
app.post(
  "/api/chat",
  wrap(async (req: any, res: any) => {
    const b = z
      .object({
        message: z.string().min(1).max(12000),
        dialect: z.string().max(100).optional(),
      })
      .parse(req.body);
    res.json(await chat(owner(req), b.message, "web", b.dialect));
  }),
);
app.get(
  "/api/chat/history",
  wrap(async (req: any, res: any) =>
    res.json({
      history: (
        await q(
          "SELECT id,role,content,created_at FROM conversations WHERE owner=$1 ORDER BY created_at DESC LIMIT 100",
          [owner(req)],
        )
      ).reverse(),
    }),
  ),
);
app.get(
  "/api/memories",
  wrap(async (req: any, res: any) =>
    res.json({
      memories: await q(
        "SELECT id,text,created_at FROM memories WHERE owner=$1 ORDER BY created_at DESC",
        [owner(req)],
      ),
    }),
  ),
);
app.post(
  "/api/memories",
  wrap(async (req: any, res: any) => {
    await remember(
      owner(req),
      z.string().min(1).max(10000).parse(req.body.text),
    );
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/memories/:id",
  wrap(async (req: any, res: any) => {
    await q("DELETE FROM memories WHERE id=$1 AND owner=$2", [
      z.string().uuid().parse(req.params.id),
      owner(req),
    ]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/monitors",
  wrap(async (_req: any, res: any) =>
    res.json({
      monitors: await q("SELECT * FROM monitors ORDER BY created_at DESC"),
    }),
  ),
);
app.post(
  "/api/monitors",
  admin,
  wrap(async (req: any, res: any) => {
    const b = z
      .object({
        title: z.string().min(1).max(200),
        documentId: z.string().uuid().nullable().optional(),
        url: z.string().url().max(2000),
        matchText: z.string().min(3).max(300),
        datePattern: z.string().min(1).max(150),
        timezone: z.string().default("Asia/Kolkata"),
        localTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .default("19:00"),
        phone: z.string().optional(),
      })
      .parse(req.body);
    new Intl.DateTimeFormat("en", { timeZone: b.timezone });
    await validateURL(
      b.url
        .replaceAll("{date}", "2026-01-01")
        .replaceAll("{YYYY}", "2026")
        .replaceAll("{MM}", "01")
        .replaceAll("{DD}", "01"),
    );
    if (b.phone && !allowedPhone(b.phone))
      throw new Error("Phone is not in WhatsApp allowlist");
    const key = id();
    await q(
      "INSERT INTO monitors(id,title,document_id,url,match_text,date_pattern,timezone,local_time,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        key,
        b.title,
        b.documentId || null,
        b.url,
        b.matchText,
        b.datePattern,
        b.timezone,
        b.localTime,
        b.phone || null,
      ],
    );
    await audit(req.user.username, "create_monitor", { id: key });
    res.json({ id: key });
  }),
);
app.post(
  "/api/monitors/:id/run",
  admin,
  wrap(async (req: any, res: any) =>
    res.status(202).json({
      jobId: await enqueue("monitor", {
        monitorId: z.string().uuid().parse(req.params.id),
      }),
    }),
  ),
);
app.patch(
  "/api/monitors/:id",
  admin,
  wrap(async (req: any, res: any) => {
    await q("UPDATE monitors SET enabled=$2 WHERE id=$1", [
      z.string().uuid().parse(req.params.id),
      z.boolean().parse(req.body.enabled),
    ]);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/monitors/:id",
  admin,
  wrap(async (req: any, res: any) => {
    await q("DELETE FROM monitors WHERE id=$1", [
      z.string().uuid().parse(req.params.id),
    ]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/monitors/:id/runs",
  wrap(async (req: any, res: any) =>
    res.json({
      runs: await q(
        "SELECT * FROM monitor_runs WHERE monitor_id=$1 ORDER BY created_at DESC LIMIT 50",
        [z.string().uuid().parse(req.params.id)],
      ),
    }),
  ),
);
app.get(
  "/api/reminders",
  wrap(async (req: any, res: any) =>
    res.json({
      reminders: await q(
        `SELECT * FROM reminders WHERE owner=$1 OR owner='practice' ORDER BY due_at`,
        [owner(req)],
      ),
    }),
  ),
);
app.post(
  "/api/reminders",
  wrap(async (req: any, res: any) => {
    const b = z
      .object({
        title: z.string().min(1).max(500),
        dueAt: z.string().datetime({ offset: true }),
        phone: z.string().optional(),
      })
      .parse(req.body);
    if (b.phone && !allowedPhone(b.phone))
      throw new Error("Recipient is not allowed");
    const key = id();
    await q(
      "INSERT INTO reminders(id,title,due_at,phone,owner) VALUES($1,$2,$3,$4,$5)",
      [key, b.title, b.dueAt, b.phone || null, owner(req)],
    );
    res.json({ id: key });
  }),
);
app.patch(
  "/api/reminders/:id",
  wrap(async (req: any, res: any) => {
    await q(
      `UPDATE reminders SET done=$2 WHERE id=$1 AND (owner=$3 OR owner='practice')`,
      [
        z.string().uuid().parse(req.params.id),
        z.boolean().parse(req.body.done),
        owner(req),
      ],
    );
    res.json({ ok: true });
  }),
);
app.get(
  "/api/jobs",
  wrap(async (req: any, res: any) =>
    res.json({
      jobs: await q(
        `SELECT id,kind,status,attempts,error,created_at,result->'progress' progress FROM jobs WHERE ($1='admin' OR (kind='study' AND payload->>'owner'=$2) OR kind NOT IN ('study','whatsapp','memory_summary')) ORDER BY created_at DESC LIMIT 100`,
        [req.user.role, owner(req)],
      ),
    }),
  ),
);
app.get(
  "/api/jobs/:id",
  wrap(async (req: any, res: any) => {
    const job = (
      await q(
        "SELECT id,kind,payload,status,attempts,error,result,created_at FROM jobs WHERE id=$1",
        [z.string().uuid().parse(req.params.id)],
      )
    )[0];
    if (!job) return res.sendStatus(404);
    if (
      req.user.role !== "admin" &&
      job.payload.owner &&
      job.payload.owner !== owner(req)
    )
      return res.sendStatus(403);
    delete job.payload;
    res.json(job);
  }),
);
app.post(
  "/api/jobs/:id/retry",
  admin,
  wrap(async (req: any, res: any) => {
    await q(
      `UPDATE jobs SET status='pending',attempts=0,run_after=now(),error=NULL WHERE id=$1 AND status='failed'`,
      [z.string().uuid().parse(req.params.id)],
    );
    res.json({ ok: true });
  }),
);
app.get(
  "/api/audit",
  admin,
  wrap(async (_req: any, res: any) =>
    res.json({
      events: await q("SELECT * FROM audit ORDER BY created_at DESC LIMIT 100"),
    }),
  ),
);
app.post(
  "/api/tools/:name",
  admin,
  wrap(async (req: any, res: any) => {
    const result = await connectedTool(req.params.name, req.body);
    await audit(req.user.username, "tool_execution", { tool: req.params.name });
    res.json({ result });
  }),
);
app.post(
  "/api/export/pdf",
  wrap(async (req: any, res: any) => {
    const b = z
      .object({
        title: z.string().max(200),
        text: z.string().min(1).max(500000),
      })
      .parse(req.body);
    res.set("Content-Type", "application/pdf");
    res.set(
      "Content-Disposition",
      'attachment; filename="SABEEL-research.pdf"',
    );
    const pdf = new PDFDocument({ size: "A4", margin: 48 });
    pdf.pipe(res);
    pdf
      .font("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
      .fontSize(19)
      .text(b.title)
      .moveDown()
      .fontSize(10)
      .text(b.text, { lineGap: 4 });
    pdf.end();
  }),
);
app.post(
  "/api/documents/merge",
  wrap(async (req: any, res: any) => {
    const ids = z
      .array(z.string().uuid())
      .min(1)
      .max(30)
      .parse(req.body.documentIds);
    const docs = await q(
      "SELECT id,title,mime,bytes FROM documents WHERE id=ANY($1::uuid[])",
      [ids],
    );
    if (docs.length !== ids.length)
      return res
        .status(404)
        .json({ error: "One or more documents were not found" });
    if (docs.some((d) => !d.mime.includes("pdf")))
      return res.status(400).json({
        error:
          "Select original PDF documents only for merging. Use research PDF export for text reports.",
      });
    const pdf = await MergePDF.create();
    for (const key of ids) {
      const doc = docs.find((d) => d.id === key);
      const source = await MergePDF.load(doc.bytes);
      for (const page of await pdf.copyPages(source, source.getPageIndices()))
        pdf.addPage(page);
    }
    res.set("Content-Type", "application/pdf");
    res.set(
      "Content-Disposition",
      'attachment; filename="SABEEL-combined.pdf"',
    );
    res.send(Buffer.from(await pdf.save()));
  }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API endpoint not found" }),
);
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required. See .env.example and DEPLOYMENT.md.",
    );
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)
    throw new Error("Set ADMIN_PASSWORD to at least 16 characters");
  await migrate();
  const stop = await startWorkers();
  if (prod) {
    app.use(express.static(path.join(root, "dist")));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(root, "dist/index.html")),
    );
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err.message);
    if (res.headersSent) return;
    res
      .status(
        err instanceof z.ZodError || err instanceof multer.MulterError
          ? 400
          : 500,
      )
      .json({
        error:
          err instanceof z.ZodError
            ? err.issues
                .map((i: any) => i.path.join(".") + ": " + i.message)
                .join("; ")
            : err.message || "Request failed",
      });
  });
  const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("SABEEL ready on port " + (process.env.PORT || 3000)),
  );
  const shutdown = () => {
    server.close();
    void stop().finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((e) => {
  console.error("Startup failed:", e.message);
  process.exit(1);
});
