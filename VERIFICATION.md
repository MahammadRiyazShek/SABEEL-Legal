# Executed verification — SABEEL 2.0

This package was adapted from the supplied ready-to-deploy source ZIP, compared with the supplied requirements and the existing GitHub/live-app behavior. No GitHub push, Vercel production deployment, provider connection or live alert was performed.

## Checks executed on this revision

- TypeScript type check and Vite production build.
- 26 unit tests, including page-aware chunking, multi-page corpus blocks, scope boundaries, timezone/date boundaries, listing verification, hearing-date evidence, fuzzy screenshot-style retrieval, URL validation, embedding dimensions, text extraction and XLSX extraction.
- 18 end-to-end scenarios using actual local PostgreSQL + pgvector, real file bytes and a local deterministic AI fixture: no-login API, absent login/signup/logout routes, keyword validation, text/PDF indexing, duplicate handling, cited RAG, scope isolation, evidence connections, persisted full-corpus studies, parseable PDF exports, PDF merging, conversation/memory persistence, Meta challenge/signatures and process-restart persistence.
- 8 serverless/worker scenarios: Vercel-style lazy body handling, raw-whitespace webhook HMAC, cron authorization, multipart intake with no serverless worker loop, separate worker consumption/heartbeat, Vercel browser upload cap, keyword uniqueness/intermediate result boundaries, and a full-corpus run over 1,000 fixture documents.
- Chromium browser checks: workspace opens without a password/login, all six screens render, 390 px mobile layout has no horizontal overflow, and no uncaught browser errors. Screenshots are included in `previews/`.
- Official local `@vercel/node` production function compilation, portable-font inclusion and compiled JavaScript entry import. This checks the function artifact, not an authenticated production deployment/routing run.

The thousand-record check uses synthetic fixture text and a deterministic local provider. It verifies orchestration/coverage/checkpoints, not real-world legal reasoning, provider throughput or OCR quality across a thousand uploaded files.

## Not live-tested

Actual OpenAI/Gemini model calls, Meta delivery/templates/voice media, Google OAuth/Drive permissions, Pinecone account, Tavily account, court-source compatibility, Docker image execution on a cloud host and an actual Vercel deployment. Real credentials, source URLs and account access were not supplied. Runtime errors and job retry state are visible instead of fabricated success.

## Re-run

```sh
npm ci
npm run check
INTEGRATION_DATABASE_URL=postgresql://.../dedicated_test_db npm run test:integration
SERVERLESS_TEST_DATABASE_URL=postgresql://.../separate_empty_test_db npm run test:serverless
BROWSER_TEST_DATABASE_URL=postgresql://.../separate_empty_browser_db npm run test:browser
```

The serverless fixture suite needs an empty disposable database and inserts 1,000 fixture records. Never point tests at your real document vault. Install Chromium for browser checks (`npx playwright install chromium`) and the worker extraction tools if running integration tests outside Docker. No test fixture accounts or documents are included in the normal production seed: production starts empty.
