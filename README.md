# SABEEL Legal — deployable WhatsApp AI & document research workspace

A full-stack replacement for the supplied browser prototype. No sample cases, generated document corpus, simulated cause lists, in-memory database or placeholder PDF downloads are included in the production application.

## Start here

**Recommended cloud path:** push these files to your GitHub repository, then create a **Render Blueprint** from that repository. `render.yaml` provisions the Docker web service and PostgreSQL database. Open **DEPLOYMENT.md** for the exact steps.

[Deploy your repository with Render](https://render.com/deploy?repo=https://github.com/MahammadRiyazShek/SABEEL-Legal)

This button works after this package has replaced the repository contents and `render.yaml` is on its default branch. It does not upload these files for you.

**Local Docker path:**

```sh
cp .env.example .env
# Set ADMIN_PASSWORD (16+ chars), POSTGRES_PASSWORD (URL-safe), and an AI key in .env.
docker compose up --build -d
```

Open http://localhost:3000 and sign in with the configured account. No fixed or hidden default password exists. Chromium treats localhost as a secure cookie exception; use HTTPS on every public deployment. The Docker port binds to localhost so a public VPS needs an HTTPS reverse proxy.

## What is implemented

| Capability | Implementation |
| --- | --- |
| Persistent document vault | PostgreSQL stores original file bytes, text, metadata, tags and status; SHA-256 deduplication |
| File formats | PDF, DOCX, legacy DOC, text/Markdown/CSV/JSON, JPG/PNG/TIFF/WEBP; Tesseract OCR for scans |
| Google Drive | OAuth refresh token or service account, recursive folder import, changed-file reindexing, categorized uploads, original Drive links |
| Document research | Real embeddings, PostgreSQL pgvector HNSW + full-text hybrid retrieval, page citations, graph-neighbor expansion |
| Optional Pinecone | 1536-dimensional vector upsert/query; canonical document/chunk access stays in PostgreSQL |
| Full-corpus review | Durable background map/reduce job reads every extracted page in the selected scope, not just the top search hits |
| Interconnections | Shared case/party/reference entities with exact quote evidence; survey matches require a common village |
| Long-term memory | Persistent conversations, private per-user semantic memories, rolling conversation summaries |
| WhatsApp | Meta Cloud API signed webhooks, event deduplication, documents/images, voice transcription, original file delivery, template notifications |
| Internet research | Tavily live search + AI synthesis with original source URLs |
| Follow-up | Daily timezone-aware source monitors, hearing reminders, morning first-message reminder prompt |
| Connected actions | Explicit registered HTTP tools / n8n webhooks through `/tool name {JSON}` |
| Exports | Original files, actual research PDFs, merged original PDFs |
| Cloud | Docker, Render Blueprint, Railway Docker config, GitHub CI, health check and durable job queue |

The application is deployment-ready source code, not a pre-connected SaaS account. You must supply provider credentials, a database and any court-specific source/feed configuration. Integration indicators report configuration presence; actual operations show upstream errors and retry state.

## Core behavior

1. Upload a document in the vault or send it through an authorized WhatsApp number.
2. The persistent queue extracts pages/OCR, summarizes the complete extracted text, embeds page-aware chunks, verifies entity quote evidence and detects a stated hearing date.
3. Original bytes remain downloadable. If configured, the file is also uploaded to Drive under category/village folders.
4. Use focused Q&A for a cited answer, or full-corpus research to process every selected document page. Select documents across library pages before launching a study.
5. With `MONITOR_SOURCES_JSON` configured, matching uploads automatically create daily monitors. Otherwise create a monitor from the monitoring screen. Source URLs are configured once per portal/type rather than guessed from the document.
6. Checks continue daily at 19:00 Asia/Kolkata by default, until paused or deleted. Results distinguish a found identifier, no match in that dated source, and an unverified/unavailable source. Uploading a dated court order does not by itself establish a live court listing.

## Common commands

```text
list documents
send Shamshabad 626
/remember My preferred lawyer is ...
/web Recent updates relevant to Telangana land records
/remind 2026-12-01T09:00:00+05:30 Prepare hearing brief
/tool create_task {"title":"Collect certified copies"}
```

Ordinary chat questions run document retrieval automatically. Live web research, persistent explicit memory, reminder creation and external tool execution use the commands above or the corresponding UI. WhatsApp voice notes are transcribed and passed through the same command/research pipeline. This version returns text and files, not generated voice replies.

## Validation

```sh
npm ci
npm run check
INTEGRATION_DATABASE_URL=postgresql://.../dedicated_test_db npm run test:integration
```

`npm run check` runs TypeScript validation, unit tests and the Vite production build. Integration tests run the actual backend against PostgreSQL + pgvector, with a local deterministic AI fixture. They do not contact real AI, Google, Meta or court accounts. See **VERIFICATION.md** for the delivered build's executed checks and remaining live-account validation.

## Files

- `backend/`: API, persistence, extraction, AI adapters, research, WhatsApp, Drive, monitors, workers.
- `src/`: React workspace and responsive interface.
- `tests/`: unit and real-database integration tests.
- `Dockerfile`, `compose.yaml`, `render.yaml`, `railway.json`: deployment targets.
- `.env.example`: all configuration names.
- `.github/workflows/`: CI and optional GitHub Pages redirect.
- `DEPLOYMENT.md`, `ARCHITECTURE.md`, `VERIFICATION.md`: setup, operation and tested scope.

GitHub Pages serves static files only. It cannot execute this backend or scheduler. Keep the complete app on a Docker-capable host; the included optional Pages workflow redirects your existing `github.io/SABEEL-Legal/` address to that app.

References: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages), [Render Blueprint](https://render.com/docs/blueprint-spec), [Render pgvector support](https://render.com/docs/postgresql-extensions), [WhatsApp templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview).
