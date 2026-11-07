# Architecture and data flow

```text
WhatsApp Meta webhook ── signature + sender allowlist ──┐
                                                     ├── PostgreSQL durable jobs
React workspace ── signed-in same-origin Express API ─┘          │
                                                                ├── extraction / OCR
                                                                ├── metadata + exact quote checks
                                                                ├── document chunks + embeddings
                                                                ├── Google Drive mirror / recursive import
                                                                └── optional Pinecone mirror

Research question ── FTS + vector RRF ── filtered graph-neighbor expansion
                                      └── cited AI answer + coverage counts
Full corpus study ── all selected extracted pages ── per-document notes
                                                  └── hierarchical synthesis + durable report

Persistent local-time scheduler ── dated source fetch + identifier match
                                  └── run record + WhatsApp delivery job
Conversations + explicit vector memories + rolling summaries ── per-user context
```

## Persistence

- `documents`: originals, MIME, SHA, extracted text, JSON metadata, Drive IDs and processing state.
- `chunks`: page, ordinal, source text, full-text index, vector(1536), HNSW index.
- `entities`: source document, type, normalized value, exact quote. Joins support evidence-backed connections.
- `conversations`, `memories`: private owner-scoped history and vectors.
- `jobs`: claimed with `FOR UPDATE SKIP LOCKED`, heartbeat, retries, progress and result.
- `monitors`, `monitor_runs`, `reminders`: persistent schedules, observations and delivery status.
- `sessions`: hashed opaque session tokens with expiry, HttpOnly/SameSite cookies.
- `webhook_events`: Meta message deduplication.
- `settings`: embedding model identity, daily markers and per-user rolling summaries.
- `audit`: login, uploads, edits, deletion and full-study launch records.

Original file bytes are private database records and are served only through authenticated download endpoints. No service keys are exposed by the frontend. Source fetches use HTTPS, an exact administrator-configured host allowlist, public-IP checks, redirect checks, size/time limits and no automatic cookie/login interaction. Registered tool endpoints and API tokens are environment-controlled.

## What a document connection means

An edge means two extracted entities share a normalized identifier, supported by a source quote on each side. A survey edge also needs a shared village. Case/party/reference edges support retrieval expansion. An edge alone does not assert a proven ownership chain, precedence, validity of an order or absence of conflicting evidence. The research prompt separates those claims.

## Research modes and coverage

Focused RAG retrieves a bounded set of passages from the full database and reports the number of eligible documents versus retrieved documents. Full-corpus jobs read all extracted pages of every selected available document; summaries are reduced in batches to fit model context. This avoids presenting the first handful of search results as if they were a review of thousands of complete records. Neither mode guarantees perfect OCR, perfect entity extraction or a particular model's reasoning quality; citations and original downloads are available for checking.

PDF pages retain source page numbers. DOCX/DOC/plain-text inputs are treated as extracted text page 1 because their visual pagination is not reconstructed. TIFF/image OCR can return page separators. Mixed PDFs trigger OCR for pages with very little extractable text; choosing the correct OCR languages matters.

## Operational boundaries

The shipped application runs API and worker loops in the same Docker service. Multiple instances can share the queue, but changing deployment topology needs connection-pool sizing and load testing. A single HNSW/PostgreSQL service supports the architecture for larger corpora; the delivered tests validate behavior, not a 1,000-document performance benchmark. Provider accounts, exact portal adapters, template approval, DNS/domain and cloud provisioning must be configured by the deploying account.

Internet research uses a search API. The source monitor is an identifier/date observer on a configured endpoint, not a universal browser or CAPTCHA solver. External task execution is explicit through registered HTTP tools, not arbitrary autonomous actions inferred from a document.
