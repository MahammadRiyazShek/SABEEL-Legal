# Architecture and implemented scope

## Persistent storage

PostgreSQL with pgvector stores original bytes, extracted text, page chunks, 1536-dimensional vectors, metadata, exact-quote entity evidence, memories, conversations, monitors, reminders, job checkpoints and audit events. No browser-local document database or in-memory production store is used. Files are SHA-256 deduplicated. Google Drive is an integrated original-file mirror/import source, not the job database.

## Two research paths

**Focused RAG:** embedding search + PostgreSQL full-text search + graph-neighbor passages, scoped by selected documents/village/survey metadata. The response includes retrieved source UUIDs and page labels. Optional Pinecone returns candidate IDs; authoritative passages still come from PostgreSQL. Retrieval is NOT an exhaustive review of the entire library.

**Full-corpus study:** a durable `study` job snapshots all eligible selected document IDs. The worker reads every extracted page in each available selected document, processes bounded blocks, checkpoints per-document notes, reduces the notes and synthesizes a report. After a failure/retry, completed document notes are reused. The response reports selected and actually reviewed counts. Source originals remain the evidence authority. A single-document block in flight is reprocessed after a crash; checkpoints are per-document, not per-token.

Thousand-document orchestration was checked with a local deterministic provider fixture, not a production workload benchmark. Real throughput and AI usage vary with document length, OCR quality, model limits and worker capacity. The database and worker can grow independently of the Vercel frontend. The graph screen shows up to 250 nodes / 1,500 edges for responsiveness; retrieval and full-corpus review are not restricted to those visible nodes. Fuzzy original-file retrieval considers up to the latest 10,000 documents. Document-list chat commands paginate 40 results.

## Entity connections

Case, party/person, reference and survey entities are stored only with supporting quotes verified against extracted text. Survey matches require a shared village. Shared entity connections are evidence of a common identifier, not a judicial finding or guaranteed equivalence of properties/people. The report prompt distinguishes explicit connections from hypotheses and identifies gaps/contradictions.

## Ingestion and execution

Vercel handles short HTTP requests, writes files/jobs and returns queued status. It does not start workers or timer loops. A Docker worker claims jobs with PostgreSQL row locking / SKIP LOCKED, maintains job heartbeats, retries failed work up to five attempts and recovers stale running jobs. Ingestion uses Poppler/Tesseract/Antiword, Mammoth and ExcelJS. Scanned PDF pages retain their original page positions. Embeddings are indexed after extraction/classification. Full report polling omits large intermediate checkpoint notes from HTTP responses.

The worker scheduler checks every 30 seconds. It creates at most one monitor job per local day using row locks, queues reminders and optional daily Drive imports. Vercel's authorized daily cron is a redundant queueing trigger. Monitors resolve configured dated source templates and verify both a publication-date marker and the target identifier before reporting a match/absence in that source.

## Interfaces and identity

No login, signup, web password or session cookies remain. The web workspace identity is `web:workspace`: web conversations/memories are shared. WhatsApp identity is `wa:<digits>` with phone allowlisting and a persisted dialect preference. Meta HMAC validation and cron bearer authorization remain independent of the no-login web UI. The Vercel adapter removes the lazy request-body getter before Express parses the original bytes, preserving Meta signature validation.

## Deliberately explicit boundaries

Provider accounts, new email/Google IDs, OAuth refresh tokens and deployment permissions are not created by the package. WhatsApp returns text/files, not generated speech. Legacy `.xls`, handwritten recognition guarantees and optional image-to-PDF conversion are not included. External actions use registered HTTP/n8n endpoints. Court monitoring is configured-source checking rather than unrestricted portal browsing. Automatic interpretation of every possible document into an arbitrary autonomous workflow is not implemented; supported extracted dates/identifiers, source mappings, reminder controls and registered tools define executable behavior.
