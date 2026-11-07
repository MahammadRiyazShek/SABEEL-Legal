# Executed verification — delivered package

Verification date: 2026-11-07.

## Passed

| Check | Executed result |
| --- | --- |
| TypeScript | `npm run lint` passed |
| Unit tests | 25 passed, 0 failed |
| Real-database integration | 17 individual workflow checks passed, plus their parent TAP test (18 TAP passes) |
| Production frontend | Vite production build passed |
| Browser | Desktop sign-in, all six workspace screens, and 390 px mobile layout passed; no uncaught browser exceptions |
| Dependency audit | `npm audit --omit=dev` reported 0 known vulnerabilities at verification time |

The integration tests used a real local PostgreSQL 16 server with pgvector 0.8.1. The supplied Docker/CI database configuration uses PostgreSQL 17; that exact container image was not executed in this environment.

The AI endpoint in the integration suite is a deterministic local test fixture. Tests verify the real extraction, database, vector insertion/retrieval, queue and API code paths without billing or contacting a real model account. Fixture documents and passwords exist only inside test code / the isolated test database; no test database or sample document content is shipped as application data.

## Integration checks covered

1. Private API authentication.
2. Invalid versus valid login and HttpOnly session cookie.
3. Cross-origin write rejection.
4. Staff restrictions on administrator operations.
5. Text ingestion, job completion, embedding insertion and verified hearing metadata.
6. Actual two-page PDF extraction and byte-identical original download.
7. Binary deduplication.
8. Scoped RAG retrieval and page-aware source citations.
9. Empty scope does not silently fall back to unrelated documents.
10. Graph connections between uploaded documents with quote evidence.
11. Full-corpus background research and persisted report/source list.
12. A parseable generated PDF, not a placeholder file.
13. PDF merge preserving page count.
14. Chat, explicit memory and reminder persistence.
15. Meta webhook HMAC rejection/acceptance and verification challenge.
16. Server restart preserving sessions, documents and conversation history.
17. Logout invalidating a persisted session.

Unit tests additionally cover date/identifier evidence checks, invalid dates, named months, page chunking, source date verification, numeric false-positive prevention, timezone boundaries, filename/phonetic matching, embedding dimensions and source URL restrictions.

## Not represented as live-verified

- Real OpenAI/Gemini generation quality, credentials or current account model access.
- Google OAuth/service-account access, personal folder permissions or live Drive transfers.
- Meta phone-number setup, actual WhatsApp sending/media downloads or template approval.
- Actual Pinecone index credentials/upsert/query.
- Tavily credentials and real search quality.
- A particular court's live cause-list endpoint, CAPTCHA/login flow or listing correctness.
- Scheduled WhatsApp delivery from an actual 19:00 deployed service.
- Render/Railway account provisioning, Docker image execution, DNS or HTTPS domain configuration.
- Throughput/accuracy benchmarks against a real 1,000-document customer corpus.

Those are configured-account acceptance checks to run after deployment. The package includes implementations and setup instructions, not credentials or an already-provisioned cloud service.

## Re-run

```sh
npm ci
npm run check
# A dedicated pgvector-enabled test DB is required; never use the production database.
INTEGRATION_DATABASE_URL=postgresql://.../sabeel_test npm run test:integration
# Optional browser verification with another dedicated DB:
npx playwright install --with-deps chromium
BROWSER_TEST_DATABASE_URL=postgresql://.../sabeel_browser npm run test:browser
```

`previews/` contains actual screenshots of the running app with an empty, unconfigured vault, not fabricated document results. Providers are intentionally not connected in those screenshots.
