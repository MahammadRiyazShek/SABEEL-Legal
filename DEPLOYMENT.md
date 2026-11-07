# SABEEL — deploy on Vercel, with a persistent research worker

## 1. Replace the GitHub repository contents

Repository: https://github.com/MahammadRiyazShek/SABEEL-Legal

Unzip this package and place its CONTENTS at the repository root. Replace the old files rather than overlaying only `src/`. Remove obsolete root `server.ts`, old login-gated builds, old deployment configuration and obsolete workflows if they remain in the repository. Keep the new `api/`, `backend/`, `assets/`, `src/`, `vercel.json`, `package.json` and `package-lock.json` together. Do not upload `node_modules`.

No admin username/password is required. Opening the app goes directly to Document Vault. All web visitors use the same workspace and shared web history, as requested. WhatsApp remains restricted to configured phone numbers. There is no web staff-account separation in no-login mode.

## 2. Create persistent PostgreSQL with pgvector

Use an externally reachable PostgreSQL database with pgvector (for example, a provider supporting the vector extension). The Vercel API and worker must use the SAME `DATABASE_URL`. Do not use a Render private/internal database address from Vercel; use an external connection URL.

The database role must be able to create tables and indexes. Enable the extension in the provider's SQL editor if extension creation needs an administrator:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The application creates its schema automatically, with a database advisory lock so API cold starts and worker startup do not race. Optional manual initialization: `npm run db:migrate` with the environment loaded.

If reusing the previous SABEEL database, take a backup first. Existing documents and vectors remain; existing `ADMIN_*` variables are ignored. Keep the same embedding provider/model used by that database. The no-login web owner is now `web:workspace`; earlier account-specific web conversations are not silently reassigned. Previously generated unique document tags continue to work. The new keyword uniqueness index requires pre-existing nonempty tags to be unique.

## 3. Deploy the web workspace/API on Vercel

Import the GitHub repository into the existing Vercel project for https://sabeel-legal.vercel.app/.

| Setting | Value |
|---|---|
| Framework | Vite |
| Root directory | Repository root |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 22.x |

`vercel.json` routes `/api/*` to the single Node.js function and serves the React workspace. It also includes a daily scheduler at 13:30 UTC (19:00 Asia/Kolkata).

Set environment variables from `.env.vercel.example` in Project Settings > Environment Variables. Minimum configuration:

```text
DATABASE_URL=<external PostgreSQL connection URL>
DATABASE_SSL=true
APP_URL=https://sabeel-legal.vercel.app
NODE_ENV=production
AI_PROVIDER=openai
OPENAI_API_KEY=<your key>
CRON_SECRET=<random alphanumeric value, at least 16 characters>
DEFAULT_TIMEZONE=Asia/Kolkata
```

For Gemini instead, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY`. Voice transcription still needs an OpenAI key. Database SSL settings must follow your provider's connection instructions; a URL with `sslmode=require` can configure SSL itself.

Redeploy after changing environment variables. The frontend build does not require a database or provider credentials; API operations do. Check `/api/healthz` for database connectivity and `/api/status` for configuration/worker heartbeat.

Vercel invocation durations and scheduler timing depend on the project's plan. The included `maxDuration` is 300 seconds; reduce it if your plan rejects it. The persistent worker performs the actual long-running jobs and schedules checks every 30 seconds, so precise 19:00 checks do not depend on daily Vercel scheduler precision. Cron configuration here is code only; no deployment or live schedule was activated by preparing these files.

## 4. Deploy the worker — required for full functionality

In Render, create a Blueprint from the SAME repository. The root `render.yaml` provisions a Docker background worker, NOT a second website. Or create a Background Worker manually with Docker and command `npm run worker`. Railway/Fly/a Docker VPS can run the same image/command.

The Dockerfile installs Poppler, Tesseract, Antiword and OCR language packs. The worker has no public port. Copy values from `.env.worker.example` into its environment. Set the SAME database, AI provider/model, Drive settings, Meta credentials, Tavily key, court source mappings and connected-tool secrets used by Vercel. These values are not synchronized automatically between hosts. Use `DB_POOL_SIZE=8` on the worker and `3` on Vercel initially.

Set `APP_URL` to the Vercel domain, not the worker host. Add optional credentials described below before testing those features. Deploy the worker and confirm its logs show `SABEEL persistent worker running`.

Open Integrations & Jobs in the Vercel app. The worker heartbeat should be recent. Without a worker, uploads remain queued and WhatsApp webhooks queue messages without replies.

## 5. Connect Google Drive

Enable the Google Drive API in a dedicated Google Cloud project. Use either:

**Personal Drive OAuth:** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`. The refresh token must have access to the target folder and relevant Drive read/write scopes. The application does not provide a browser Google-account connection flow; supply the refresh token through the environment.

**Service account:** set one-line `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID`, with appropriate access to a Workspace Shared Drive/folder. Use OAuth for a personal Drive when service-account storage/ownership prevents uploads.

Set these on BOTH hosts. In the app click **Import Drive folder** to queue recursive import, or set `DRIVE_AUTO_SYNC=true` for daily incremental import. Original files are retained in PostgreSQL; newly uploaded files are mirrored under category/village folders when Drive is configured. Each file is limited to 25 MB. Drive-imported files receive system tags; edit their keywords in Document Vault if desired. Browser uploads always ask for keywords.

## 6. Connect WhatsApp Cloud API

Set on BOTH hosts:

```text
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
META_APP_SECRET
WHATSAPP_VERIFY_TOKEN
WHATSAPP_ALLOWED_NUMBERS
WHATSAPP_DEFAULT_RECIPIENT
WHATSAPP_ALERT_TEMPLATE
WHATSAPP_TEMPLATE_LANGUAGE
META_GRAPH_VERSION
```

Use digits-only recipient numbers with country codes, comma-separated. In Meta configure:

```text
Callback: https://sabeel-legal.vercel.app/api/whatsapp/webhook
Verify token: exactly WHATSAPP_VERIFY_TOKEN
Subscription: messages
```

Inbound webhook signatures are verified against the original request bytes. Event IDs are persisted for deduplication. The API acknowledges queued messages; the worker processes them. A new document prompts for a unique keyword. Reply with the keyword before the next file. Choose English/Urdu when prompted or use `/language urdu`.

For scheduled alerts outside the messaging reply window, configure an approved WhatsApp template with one body text parameter. A full research report is saved in the workspace even if an out-of-window template carries only a brief preview/link.

## 7. Optional Pinecone

PostgreSQL pgvector works without Pinecone. For a Pinecone mirror/search backend, create an index compatible with 1536-dimensional embeddings and set:

```text
VECTOR_BACKEND=pinecone
PINECONE_API_KEY=<key>
PINECONE_HOST=https://<your-index-host>.pinecone.io
PINECONE_NAMESPACE=sabeel
```

Use the same embedding model on both hosts and never mix embedding models in an existing index. Canonical document text, pages, metadata and jobs remain in PostgreSQL. Retry indexing/mirroring for existing records after enabling Pinecone.

## 8. Document-triggered 7 PM checks

The worker extracts explicit case identifiers and hearing dates during ingestion. A supported hearing date creates a reminder. Daily source checks require a known source; the app does not invent an official court endpoint from an uploaded order.

Add exact source hostnames in `ALLOWED_FETCH_HOSTS` and mappings in `MONITOR_SOURCES_JSON`. Example CONFIGURATION ONLY; replace the example host/URL with your actual official accessible source:

```json
[{"category":"Court H.C.","url":"https://official-court.example/cause-list/{YYYY}/{MM}/{DD}.pdf","datePattern":"DD.MM.YYYY","localTime":"19:00","timezone":"Asia/Kolkata"}]
```

The hostname must also be included in `ALLOWED_FETCH_HOSTS`. Source mappings are matched to extracted document metadata; examine `backend/documents.ts` for supported fields. You can also create a monitor directly in Monitoring & Reminders: title, source URL, exact case/reference match, publication date pattern, timezone, time and recipient.

At 19:00 Asia/Kolkata the scheduler queues the check for the NEXT day's dated source. It repeats daily until paused/deleted, including after a match. Results distinguish `found_in_source`, `not_found_in_source` and `unverified`. A source with no target-date marker is unverified, not an assertion that a case is absent. Accessible HTML, text and PDF sources work; interactive/CAPTCHA portals need an official feed/API or a separately configured integration. This is a source-template monitor, not a browser automation adapter for every court portal.

The same monitor mechanism can track identifiers in dated government notices/other sources. For broader periodic web research, register an external scheduler/n8n tool rather than treating a source monitor as a general autonomous web agent.

## 9. Internet research and connected tools

Set `TAVILY_API_KEY` for live internet search. Use `/web your question` or the Internet research mode. Define explicit tools in `CONNECTED_TOOLS_JSON`, allow their hostnames, and place their tokens in named environment variables. See `backend/integrations.ts` for the exact schema (`name`, `url`, `tokenEnv`, etc.). `/tool tool_name {JSON}` runs a registered action; the assistant does not execute arbitrary APIs without registration.

## 10. First real-use check

Open the Vercel domain: Document Vault should open directly. Save a language choice. Confirm the worker heartbeat is recent. Upload one small PDF and enter a keyword. Wait for status `ready`, ask a question and open its cited page. Import a real Drive folder, test WhatsApp retrieval, then run a selected full-corpus review. Add one real source monitor and use Run now before relying on daily alerts.

Browser uploads are sent one file per request and limited to 4 MB to stay below Vercel's 4.5 MB request ceiling. Original downloads over 4 MB open the stored Google Drive link when available; otherwise retrieve through WhatsApp. PDF merge/report downloads must also fit the Vercel response ceiling. Larger originals can enter through Drive or WhatsApp up to 25 MB/file.

## Local Docker alternative

Copy `.env.example` to `.env`, set a URL-safe `POSTGRES_PASSWORD` and AI key, set `APP_URL=http://localhost:3000`, and run `docker compose up --build -d`. Compose supplies its internal PostgreSQL URL and disables database SSL. This path runs web/API/workers together and does not have Vercel's transfer ceiling.

## References

- Vercel functions: https://vercel.com/docs/functions/runtimes/node-js
- Vercel payload limits: https://vercel.com/docs/functions/limitations
- Vercel cron configuration/timezone: https://vercel.com/docs/cron-jobs
- Cron secret: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Render workers: https://render.com/docs/background-workers
