# SABEEL Legal — Vercel-ready, no login / signup

**Start with [DEPLOYMENT.md](DEPLOYMENT.md).** This is the updated application, not a patch and not a static mockup. Replace the repository contents with this package.

The React workspace and Express API deploy on Vercel. A separate persistent Docker worker processes PostgreSQL jobs: OCR, embeddings, WhatsApp messages, full-corpus research, Drive synchronization and source monitoring. Both hosts use the SAME PostgreSQL database with pgvector.

## Included

- No login page, signup, password, session cookie or authentication requirement for the web workspace.
- Original-file vault; unique search keywords; category, village, survey and lawyer metadata.
- PDF/DOCX/DOC, XLSX, text/CSV/JSON, scanned images/TIFF with worker OCR.
- Real embeddings and PostgreSQL hybrid full-text/vector retrieval; optional Pinecone.
- Page-aware citations, evidence-backed entity connections, chronology and draft preparation.
- Full-corpus map/reduce review with durable per-document checkpoints; distinct from top-hit RAG.
- Google Drive recursive import and categorized mirroring.
- Meta WhatsApp signed webhooks, voice transcription, fuzzy retrieval, original attachments.
- Persistent shared web conversation history and per-phone WhatsApp history/preferences.
- English / professional Hyderabadi Roman Urdu preference.
- Tavily live internet research and explicitly registered HTTP/n8n actions.
- Document date extraction, hearing reminders, configurable daily source checks and WhatsApp alerts.
- Real research PDF exports and original PDF merging.
- Vercel function, daily scheduler, Docker worker, Render worker Blueprint, environment templates and tests.

## Deployment layout

```text
Browser + WhatsApp webhook
          |
          v
Vercel: React workspace + API
          |
          v
PostgreSQL + pgvector: originals, text, vectors, entities, jobs, conversations
          ^
          |
Persistent Docker worker <--> Google Drive / AI / Pinecone / Meta / configured sources
```

Vercel is the application host; it is not used as an always-running OCR/queue worker. The worker remains required for document indexing and asynchronous processing.

## Quick commands

```sh
npm ci
npm run check
npm run dev          # local web/API with workers; .env required
npm run worker       # worker-only service
npm run db:migrate
```

`npm start` serves the built app and starts workers for a single-host Docker deployment. `npm run worker` starts no public HTTP listener.

## WhatsApp / assistant commands

```text
list documents
list documents Shamshabad
list documents Revenue page 2
send Shamshabad 626
/language urdu
/remember My preferred lawyer for land matters is ...
/research Reconstruct ownership history and inconsistencies across all indexed records
/web Recent government orders relevant to Telangana land records
/remind 2026-12-01T09:00:00+05:30 Prepare hearing brief
/tool create_task {"title":"Collect certified copies"}
```

Normal questions use document retrieval. `/research` queues a full-corpus review. Web research and external tools use explicit commands. On a new WhatsApp document, reply to the keyword prompt before sending another document.

## Scope

Provider credentials and the worker/database are configuration inputs, not bundled accounts. Court checks use configured accessible official feeds/PDFs/APIs, not a universal court crawler. Browser transfers on Vercel are capped at 4 MB/file; use Drive import or WhatsApp up to 25 MB/file. `.xlsx` is supported; legacy `.xls` is not. The optional scanned-image-to-PDF conversion is not included.

[VERIFICATION.md](VERIFICATION.md) separates executed local checks from untested live provider integrations. [ARCHITECTURE.md](ARCHITECTURE.md) explains RAG versus full-corpus processing.
