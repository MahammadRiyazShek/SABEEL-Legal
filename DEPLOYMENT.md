# Deployment and account connection

## 1. Replace the prototype repository

Unzip the package. Upload its **contents**, including dotfiles and `.github/`, into the root of `MahammadRiyazShek/SABEEL-Legal` (or a new repository). Replace the old `server.ts`, `src/`, `package.json`, old lockfiles and old deployment workflow. Do not nest the new files inside a second project folder.

The new backend entrypoint is `backend/server.ts`. Do not retain old workflows that deploy `src/` or a React bundle as a functioning full-stack app. Commit `package-lock.json`; do not commit `.env`, service-account keys or access tokens.

## 2. Recommended: Render Blueprint connected to GitHub

1. In Render, choose **New → Blueprint**, connect GitHub and choose this repository.
2. Render reads `render.yaml` and creates `sabeel-legal` plus `sabeel-postgres` in Singapore.
3. Set `ADMIN_PASSWORD` to a unique value of at least 16 characters. Set `APP_URL` to the exact app origin, for example `https://sabeel-legal-xxxx.onrender.com` (no trailing path). If not known yet, use the expected origin, deploy, then correct it and redeploy before sign-in.
4. Set `OPENAI_API_KEY`. The default models are `gpt-4.1-mini` and `text-embedding-3-small` with 1536 dimensions. Alternatively set `AI_PROVIDER=gemini`, add `GEMINI_API_KEY`, and leave `CHAT_MODEL` / `EMBEDDING_MODEL` unset to use the Gemini defaults. Voice transcription separately needs `OPENAI_API_KEY`.
5. Deploy. `/healthz` becomes healthy after schema creation and database connection succeed. `CREATE EXTENSION vector` runs automatically; Render supports pgvector. Use the internal database URL supplied by the Blueprint.
6. Open the app; sign in as `admin` or `ADMIN_USERNAME`.
7. Add Drive, WhatsApp, live search and source-monitor settings below to the service's environment and redeploy. Credentials are not entered into the browser.
8. GitHub commits subsequently trigger redeployments. CI verifies the source independently.

Use an always-running web service for daily checks and reminders. A sleeping/static-only service cannot run a 19:00 scheduler while suspended. The queue and last-run markers survive application restarts in PostgreSQL. If restarted after the scheduled local time, a missed check is queued for that day; it does not replay every historical missed day.

`APP_URL` must match the origin you use to sign in. If using a custom domain, update it. TLS is provided by the platform. Set `TRUST_PROXY_HOPS` to the known reverse-proxy hop count; default is 1.

## 3. Railway or another Docker host

`railway.json` uses the provided Dockerfile and `/healthz`. Connect the GitHub repository to a new Railway service, add a PostgreSQL service **with pgvector installed**, and set `DATABASE_URL` to its private connection URL. Set the same environment variables from `.env.example`. The Railway JSON does not create your database or install pgvector into an ordinary stock database image. A `pgvector/pgvector:pg17` database service with a persistent volume is a compatible option.

For a VPS, run Docker Compose and place Caddy/Nginx with HTTPS in front of the localhost-bound port. Use a URL-safe `POSTGRES_PASSWORD` in Compose because it is interpolated into the connection URL. Do not remove the `sabeel_database` volume during upgrades. `docker compose down` preserves it; `down -v` removes it.

Native Node development needs Node 22+, PostgreSQL with pgvector, `pdftotext` / `pdftoppm`, Tesseract, antiword and DejaVu fonts. Set `.env`, then run `npm ci && npm run dev`. The Docker image installs those system dependencies for you.

## 4. Google Drive

### Personal Google Drive: OAuth refresh token (recommended for Gmail accounts)

- Enable Google Drive API in a Google Cloud project.
- Configure the OAuth consent screen and a Web OAuth client.
- Authorize the Drive scope `https://www.googleapis.com/auth/drive` with offline access, and exchange the authorization code for a refresh token. Google OAuth Playground can do this using **your own OAuth credentials**, with its redirect URI added to that client.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID`.
- OAuth apps left in Google's external Testing mode can have short-lived refresh-token behavior. Configure the consent-screen publishing/user access appropriate for your account before relying on unattended operation.

### Workspace Shared Drive: service account

Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the complete JSON on one environment-variable line and give its client email appropriate access to the intended Shared Drive folder. Set `GOOGLE_DRIVE_FOLDER_ID` to that folder's ID. For personal My Drive storage, use the OAuth option rather than assuming a service account can own uploaded files or use your storage allocation.

### Import and organization

- The vault's **Import Drive folder** button queues recursive import of the configured folder and descendants. Google Docs/Sheets/Slides are imported as PDF exports where the Drive export API supports them. Folder shortcuts are not followed.
- `DRIVE_AUTO_SYNC=true` queues one incremental scan per local day. Existing imported files with changed `modifiedTime` are reindexed; unchanged files are skipped.
- New uploads are mirrored to `root/category/village/filename` after successful indexing. Unknown categories/villages use General.
- The original file also remains in PostgreSQL, so downloads do not depend on a public Drive sharing link.
- Import errors are collected in the Drive sync job result. Database deletion does not delete the Drive source. Deleting a Drive source does not automatically delete its local archived copy.

## 5. WhatsApp Cloud API

Set these variables:

| Variable | Value |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Suitable production System User access token |
| `META_APP_SECRET` | Meta app secret for webhook HMAC validation |
| `WHATSAPP_VERIFY_TOKEN` | Your own long random verification string |
| `WHATSAPP_ALLOWED_NUMBERS` | Authorized client/staff numbers, comma-separated digits including country code |
| `WHATSAPP_DEFAULT_RECIPIENT` | Optional authorized number for auto hearing reminders/source mappings |
| `META_GRAPH_VERSION` | Default v23.0; update when your account requires another supported version |

In Meta's webhook setup, use:

```text
https://YOUR-APP-HOST/api/whatsapp/webhook
```

Use the same verification token and subscribe to **messages**. Signed inbound messages are acknowledged after atomic persistence and processed by background workers. Unauthorized senders are ignored. Original PDFs/DOCX/images are downloaded from Meta and indexed. Voice notes require an OpenAI transcription key, independently of the selected chat provider.

Scheduled notifications may occur outside the customer-service window. Create an approved template with a body such as:

```text
SABEEL update: {{1}}
```

Use a **single positional text body parameter** and no required header/button parameters. Set `WHATSAPP_ALERT_TEMPLATE` to the approved name and `WHATSAPP_TEMPLATE_LANGUAGE` to its exact language code, for example `en` or `en_US`. Approval is managed by Meta; the application does not create or approve the template. When a reply window is open it sends ordinary text; otherwise it uses this template. Delivery failures appear as retryable/failed `notify` jobs instead of fake success messages.

The server sends one WhatsApp text response up to 4,000 characters; use the web workspace for long reports and PDF export. Delivery jobs are at-least-once: a provider timeout after acceptance can cause a duplicate on retry.

## 6. Court and general-document monitoring

The app does not pretend that every court has a uniform public API. Configure the actual accessible official HTML/PDF/JSON source for your court or use your own connector exposing a dated source feed. Interactive CAPTCHA/login portals require a portal-specific connector; the generic fetcher reports them as unverified.

### Manual setup

- Add the exact HTTPS hostname to `ALLOWED_FETCH_HOSTS` (for example the hostname of the real official source you selected). Redirect destinations must also be allowlisted.
- In **Monitoring & Reminders → Add source monitor**, enter the source URL, a case/reference identifier, a publication/date marker, local time and timezone.
- URLs can use `{date}` as `YYYY-MM-DD` or `{YYYY}`, `{MM}`, `{DD}` placeholders for **tomorrow in the monitor timezone**.
- The date marker can contain `YYYY`, `MM`, `DD`, e.g. `CAUSELIST FOR DD.MM.YYYY`. Match the actual source's formatting. A narrow publication label is better than a bare date appearing elsewhere on a large page.
- Checks search the configured source; they do not search every official list or prove legal case status. Use a date-specific list URL/feed and verify the connector for that court. A bare case number found on a multi-date page is not definitive listing verification.
- The outcome is `found_in_source`, `not_found_in_source`, or `unverified`. Only a source with the configured date marker can produce a found/not-found result. Missing date, HTTP failure, challenge page or parsing failure produces unverified.
- The default is 19:00 Asia/Kolkata. The monitor repeats every day until paused/deleted, including after it finds a match. It does not silently stop or create procedural filings.
- The same engine can monitor a revenue-file reference, application number, licence condition or other document identifier in an accessible source. A literal stable marker can be used for a non-dated general status source; in that configuration the output is only an identifier observation, not a date-verified court-listing claim.

### Automatic monitoring after upload

Set `MONITOR_SOURCES_JSON` once for each document category you want to auto-track. Example structure (replace the example URL with your real source; `.invalid` is intentionally not a working court):

```json
[
  {
    "category": "Court H.C.",
    "matchField": "caseNumber",
    "url": "https://your-official-feed.invalid/list/{date}.pdf",
    "datePattern": "CAUSELIST FOR DD.MM.YYYY",
    "localTime": "19:00",
    "timezone": "Asia/Kolkata",
    "phone": "YOUR_AUTHORIZED_NUMBER"
  }
]
```

When an indexed upload has a matching category and an extracted case entity with quote evidence, the app creates its monitor automatically. Reindexing does not create another monitor for the same document/source URL. For other document types use `matchField` corresponding to a metadata field such as `surveyNumber`; qualify the source carefully. Source mapping failures are recorded in the audit log.

A stated hearing date with a matching source quote also creates a practice reminder at **09:00 India time on that date**. This is a reminder convention, not an extracted hearing time. It does not infer a court's cause-list URL. Review OCR-derived dates and source configuration in the vault.

## 7. AI, Pinecone and scaling

Default mode requires one AI provider and PostgreSQL; Pinecone is optional. The standard pipeline is real hybrid RAG, not keyword search labelled as a vector database. Embeddings have **1536 dimensions** and are checked before insertion.

For Pinecone, create a dense cosine index with 1536 dimensions. Set `VECTOR_BACKEND=pinecone`, `PINECONE_API_KEY`, `PINECONE_HOST=https://YOUR-INDEX-HOST.pinecone.io`, and `PINECONE_NAMESPACE`. This code targets the standard vector `/vectors/upsert` and `/query` API, not an integrated-embedding index. Document uploads queue a Pinecone mirror job. Reindex any pre-existing documents after changing the vector backend so they are mirrored. Scoped queries use PostgreSQL fallback when Pinecone's global top-k is insufficient.

PostgreSQL remains authoritative for access and citations. Stale Pinecone IDs are discarded when their canonical chunks/documents no longer exist. The package does not delete old mirrored vectors automatically; use a dedicated namespace and clean/reset it during a controlled rebuild.

Do not change embedding model/provider on an existing index: the startup guard detects changes. For a deliberate change, back up the database, clear the old chunks and memories, remove the `embedding_model` settings row, select the new provider/model, restart and reindex every document. Reset/rebuild your dedicated Pinecone namespace if enabled. Ordinary chat-model changes do not require reindexing.

The library API paginates 100 records; RAG searches the database, not just the loaded UI page. Graph visualization shows at most 250 nodes/1,500 links and is explicitly labelled as bounded. Full-corpus research snapshots the selected document IDs and processes each available document's full extracted text in batches. Removed/unavailable documents are reported, not counted as reviewed. Metadata extraction/graph construction relies on model-extracted entities with quote checks and is not a mathematically exhaustive enumeration of every possible relationship.

For thousands of documents, use adequate database storage, RAM and backups. Original file bytes are stored in PostgreSQL as well as Drive, so database sizing must include them. Increase worker concurrency and AI rate limits gradually; CPU-heavy OCR, database I/O and upstream quota can be bottlenecks. Each upload is limited to 25 MB, up to 20 files per multipart request. These are implemented limits, not a throughput/SLA guarantee; the package was not load-tested with a live 1,000-document customer corpus.

## 8. Staff, memories and connected APIs

Set `STAFF_USERS_JSON` to an array of accounts with bcrypt hashes:

```json
[{"username":"assistant1","passwordHash":"PASTE_BCRYPT_HASH","role":"staff"}]
```

Run `npm run hash-password` locally to generate a hash, or provide `PASSWORD_TO_HASH` through your local process environment. Staff share the practice document vault and reminders labelled practice; their web chat history, explicit memories and conversation summaries are private to their username. WhatsApp identities are separated by phone number. Admin-only routes manage monitors, Drive imports, document deletion and audit viewing. This is a **single-practice shared workspace**, not a multi-tenant client-portal product; do not use one instance for mutually isolated firms.

The first chat message per user per local day includes upcoming reminders and asks about new reminders/documents. There is no unsolicited daily conversation message without a configured reminder/monitor. `/remember` saves an explicit semantic memory; all conversations persist and summaries refresh periodically.

Set `TAVILY_API_KEY` for live internet research. Use `/web ...` or the live research mode. URLs and search snippets are included in the result. There is no fake news cache.

For registered tools:

```json
[
  {
    "name":"create_task",
    "description":"Create a task using my n8n workflow",
    "url":"https://YOUR-N8N-HOST/webhook/YOUR-WEBHOOK",
    "method":"POST",
    "tokenEnv":"N8N_TOOL_TOKEN"
  }
]
```

Set this JSON as `CONNECTED_TOOLS_JSON`, set the secret token separately, and allowlist the exact hostname. Invoke `/tool create_task {"title":"Prepare brief"}` explicitly. Tool names/endpoints are controlled by environment configuration; document text cannot register its own API. Authorized chat users can invoke the explicitly configured tools, so scope each connector's credentials appropriately. Arbitrary AI-generated code and arbitrary URLs are not executed.

## 9. Keep the old GitHub Pages URL

After the full app is live:

1. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, create `PUBLIC_APP_URL` with your actual HTTPS backend origin.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. In **Actions**, run **Publish GitHub Pages redirect** manually.

The original `https://mahammadriyazshek.github.io/SABEEL-Legal/` address then redirects to the hosted full app. It is intentionally not another disconnected UI making relative `/api` calls against `github.io`.

## 10. Operations, backups and troubleshooting

- **Health:** `/healthz` checks database reachability. An integration marked configured can still have an expired/wrong token; check actual jobs.
- **Queued/failed ingestion:** fix provider credentials or OCR dependency, then Retry in the vault. The job screen includes upstream errors and attempts.
- **Failed Drive job:** verify folder access, OAuth refresh token, enabled API and Shared Drive setup.
- **WhatsApp verification:** correct webhook URL, matching verify token, message subscription and app secret. Only allowlisted numbers are processed.
- **Scheduled delivery failure:** verify approved template name/language/one-parameter shape and allowed recipient.
- **Court check unverified:** open the exact source URL, verify publication marker/date, redirects and host allowlist. Do not interpret an inaccessible list as absence.
- **Login CSRF/origin error:** correct `APP_URL` to your browser's exact origin and redeploy.
- **Vector extension failure:** use a supported pgvector image/provider and a database owner allowed to create the extension.
- **Backup:** enable provider snapshots/PITR as available and export periodic `pg_dump` backups. The app creates tables, not a managed backup service. Restore into a pgvector-enabled database.
- **Jobs:** five exponential-backoff attempts, heartbeat/lease recovery, persistent progress between documents for full-corpus studies. Retry failed jobs after fixing configuration. A long document can repeat its in-progress page batches after a crash; completed per-document study notes are preserved.
- **Cleanup:** expired sessions, logs, old completed jobs and source-monitor run history are retained until you add a retention policy. No automatic legal-record deletion is imposed.

Official setup references: [Render](https://render.com/docs/blueprint-spec), [Render extensions](https://render.com/docs/postgresql-extensions), [Google Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [WhatsApp templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).
