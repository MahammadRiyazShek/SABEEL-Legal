import pg from "pg";
import crypto from "node:crypto";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE || 8),
  ...(process.env.DATABASE_SSL === "true"
    ? {
        ssl: {
          rejectUnauthorized: process.env.DATABASE_SSL_VERIFY !== "false",
        },
      }
    : {}),
});
export async function q(text: string, values: any[] = []) {
  return (await pool.query(text, values)).rows;
}
export const id = () => crypto.randomUUID();
export async function migrate() {
  await pool.query(`
 CREATE EXTENSION IF NOT EXISTS vector;
 CREATE TABLE IF NOT EXISTS documents (
 id uuid PRIMARY KEY, title text NOT NULL, sha text UNIQUE NOT NULL, mime text NOT NULL,
 bytes bytea, text text NOT NULL DEFAULT '', metadata jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued', error text, drive_id text UNIQUE, drive_url text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS chunks (id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents ON DELETE CASCADE,
 page int NOT NULL, ordinal int NOT NULL, text text NOT NULL, embedding vector(1536),
 search tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
 UNIQUE(document_id,ordinal));
 CREATE INDEX IF NOT EXISTS chunks_fts ON chunks USING gin(search);
 CREATE INDEX IF NOT EXISTS chunks_vector ON chunks USING hnsw(embedding vector_cosine_ops);
 CREATE INDEX IF NOT EXISTS chunks_doc ON chunks(document_id);
 CREATE TABLE IF NOT EXISTS entities (document_id uuid REFERENCES documents ON DELETE CASCADE, type text, value text, evidence text, PRIMARY KEY(document_id,type,value));
 CREATE INDEX IF NOT EXISTS entities_lookup ON entities(type,value);
 CREATE TABLE IF NOT EXISTS conversations (id uuid PRIMARY KEY, channel text, owner text, role text, content text, created_at timestamptz DEFAULT now());
 CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner,created_at DESC);
 CREATE TABLE IF NOT EXISTS memories (id uuid PRIMARY KEY, owner text, text text, embedding vector(1536), created_at timestamptz DEFAULT now());
 CREATE INDEX IF NOT EXISTS memories_owner ON memories(owner);
 CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, username text, role text, expires timestamptz);
 CREATE TABLE IF NOT EXISTS jobs (id uuid PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts int DEFAULT 0, run_after timestamptz DEFAULT now(), locked_at timestamptz, result jsonb, error text, created_at timestamptz DEFAULT now());
 CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(status,run_after);
 CREATE TABLE IF NOT EXISTS monitors (id uuid PRIMARY KEY, document_id uuid REFERENCES documents ON DELETE SET NULL,
 title text NOT NULL, url text NOT NULL, match_text text NOT NULL, date_pattern text NOT NULL DEFAULT '',
 timezone text NOT NULL DEFAULT 'Asia/Kolkata', local_time text NOT NULL DEFAULT '19:00',
 phone text, enabled boolean DEFAULT true, last_slot text, last_result jsonb, created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS monitor_runs (id uuid PRIMARY KEY, monitor_id uuid REFERENCES monitors ON DELETE CASCADE,
 result jsonb, created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS reminders (id uuid PRIMARY KEY, title text NOT NULL, due_at timestamptz NOT NULL,
 phone text, owner text NOT NULL, done boolean DEFAULT false, notified boolean DEFAULT false, created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS audit (id bigserial PRIMARY KEY, actor text, action text, details jsonb, created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS webhook_events (event_id text PRIMARY KEY, created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY,value jsonb NOT NULL);
 `);
  const old = await q(`SELECT value FROM settings WHERE key='embedding_model'`);
  const model = `${process.env.AI_PROVIDER || "openai"}:${process.env.EMBEDDING_MODEL || (process.env.AI_PROVIDER === "gemini" ? "gemini-embedding-001" : "text-embedding-3-small")}:1536`;
  if (old.length && old[0].value !== model)
    throw new Error(
      "Embedding model differs from stored index. Keep the configured model or reindex the database before changing it.",
    );
  await q(
    `INSERT INTO settings(key,value) VALUES('embedding_model',$1) ON CONFLICT DO NOTHING`,
    [JSON.stringify(model)],
  );
}
export async function enqueue(kind: string, payload: any, when = new Date()) {
  const key = id();
  await q(`INSERT INTO jobs(id,kind,payload,run_after) VALUES($1,$2,$3,$4)`, [
    key,
    kind,
    payload,
    when,
  ]);
  return key;
}
export async function audit(actor: string, action: string, details: any = {}) {
  await q("INSERT INTO audit(actor,action,details) VALUES($1,$2,$3)", [
    actor,
    action,
    details,
  ]);
}
export function vector(a: number[]) {
  if (a.length !== 1536 || a.some((n) => !Number.isFinite(n)))
    throw new Error("Expected 1536 finite embedding dimensions");
  return "[" + a.join(",") + "]";
}
