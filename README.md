# DriveGenie — functional GitHub Pages frontend + separate API backend

## What was repaired

The former published root index.html loaded `/src/main.tsx`. GitHub Pages cannot compile TypeScript or run Express. This package includes compiled JavaScript at the root **and** in docs/ and dist/. The source template is index.source.html. The build regenerates all three deployment targets.

The app now has a **Connections** screen with backend URL, tab-session dashboard token, optional personal Gemini key, owned Firebase configuration, and a backend check. Hard-coded online/Drive/webhook claims, preloaded fictional documents, simulated voice messages, and HTML injection in chat have been removed. Google Drive API failures no longer silently become successful local writes. The webhook inspector is local only and never sends fabricated events to Meta.

## Publish the frontend — easiest method

1. Unzip this package. Upload the **contents** into the root of your existing repository, not a nested folder and not the ZIP itself. Include index.html and assets/. Replace existing files. Keep all source files if you want automated builds.
2. In repository Settings → Pages, choose **GitHub Actions** as the source. The included `.github/workflows/deploy.yml` runs type checks, tests and a production build before publishing dist/.
3. Run the workflow from Actions if it did not start automatically. Wait for a successful deployment, then hard-refresh your site.

Alternative without Actions: use **Deploy from a branch → main → / (root)**. The bundled root index.html and assets/ are already built. `main /docs` also works. For later source edits, run `npm ci && npm run build` and commit the regenerated files.

Do not replace index.html with index.source.html. Do not delete assets/. The generated site uses relative asset URLs so it works under `/Whatsapp-AI-Drive-Assistant/`.

## Node development

Use Node 24.12 or newer. Run `npm ci`, copy `.env.example` to `.env`, then run `npm run dev`. Development opens at http://localhost:3000. The Vite middleware uses the same API and security rules as production.

Checks: `npm run lint`, `npm test`, `npm run build`.
Production: `npm run build && npm start`.

## Enable real AI

### Recommended: backend

Deploy the included Dockerfile on Cloud Run, Render, or another public HTTPS Node host. `render.yaml` is an optional Render Blueprint (it uses a paid starter service; review the host's plan before deploying). Set these **server-side** environment variables:

- GEMINI_API_KEY: your Google Gemini key.
- GEMINI_MODEL: a model available to your key; default gemini-2.5-flash.
- DASHBOARD_API_TOKEN: a long random private token. Required for production chat. This is a single-owner dashboard access control, not multi-tenant authentication.
- ALLOWED_ORIGINS: `https://mahammadriyazshek.github.io` (origin only; no repo path). Add your backend origin if you also use its hosted dashboard. Separate origins with commas.
- NODE_ENV: production.

On the Pages website open Connections, enter the backend **origin** (e.g. https://your-service.run.app) and matching dashboard access token, then Save & test. Configuration checks do not prove Google API credentials are valid; send a chat message for an actual AI request. Errors and quota failures are displayed, not passed off as successful AI answers.

The public health route is `/api/health`. Cross-origin requests accept only configured origins. CORS is not authentication; protect the dashboard token. A simple per-process rate limit is included, but not distributed abuse protection.

### Personal testing: no backend

Connections → Personal browser AI → enter your own Gemini API key and Save. This makes real requests directly to Google. The key is held in sessionStorage for the current browser tab and never built into the public bundle. Session storage is **not** a security vault: page scripts/extensions and developer tools can access it. Do not use shared production credentials. Closing the tab normally ends the session; browser session restore may retain it, so use Clear session credentials on shared machines. Model availability, Google billing, quotas and API restrictions still apply. This mode cannot receive WhatsApp webhooks and has no live web-search grounding.

## Connect real Google Drive

Use a Firebase/Google Cloud project you control. The previous unrelated embedded Firebase configuration is deliberately removed.

1. Create a Firebase web app and copy its public config JSON.
2. Enable Google sign-in in Firebase Authentication; add `mahammadriyazshek.github.io` to authorized domains.
3. Enable the Google Drive API in the same Google Cloud project. Set up OAuth consent and add test users if your OAuth app is in testing. Depending on the consent configuration and Drive scopes, Google verification may be required before general public use.
4. Paste the public config into Connections → Google Drive → Save & reload. Never paste a service-account private key.
5. Open Google Drive → Connect Your Google Drive. Grant the requested permission.

For an owner-configured public site, put your public Firebase web configuration in `firebase-applet-config.json` and rebuild before deployment, so visitors do not need to paste it themselves. The per-browser Connections value overrides that file. Restrict the public Firebase key appropriately in Google Cloud; it is not a server-side secret.

Uploads now use the original file bytes. Folder creation, upload, listing, and deletion call Drive v3 when connected. Without sign-in, storage is **local browser storage**, not a cloud copy. Access tokens stay in memory and expire conservatively after 55 minutes; reconnect after refresh/expiry.

Text files and Google Docs can be read into local search. PDFs, Office binaries, images and audio do not become searchable text automatically: attach the original in the Assistant tab for Gemini analysis. Binary preview uses Google Drive where available. Local storage has browser quota limits; large files may require a real Drive connection.

## Activate WhatsApp replies on an actual phone

Also set on the backend:

- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_VERIFY_TOKEN (a private verification string)
- META_APP_SECRET
- META_GRAPH_API_VERSION if your Meta app requires a version different from the default v22.0.

In Meta for Developers, register `https://YOUR-BACKEND-HOST/api/whatsapp/webhook` with the matching verification token and subscribe to `messages`. The POST endpoint checks Meta's X-Hub-Signature-256 in production. Send a message from an authorized WhatsApp test recipient or your approved production sender setup. Test the full path on your phone; a health flag only means environment variables exist, not that Meta accepted them.

The webhook receives text/documents/images/audio, obtains media from Meta and sends Gemini's response via the WhatsApp Cloud API. It does **not** connect to the personal WhatsApp Web app or scan a QR code. A browser's Drive OAuth grant is not a backend WhatsApp user's identity: incoming WhatsApp files are **not automatically uploaded to the browser user's Drive**.

## Limits and production hardening

This is a single-owner starter, not a complete multi-tenant SaaS. Dashboard messages, document chunks, preferences, and local files are in browser storage, not a shared database or end-to-end encrypted message store. The local search is keyword ranking, not embeddings/vector search. No fictional organization/user facts or sample documents are seeded on fresh installs; existing local data is preserved.

Real API credentials, owned OAuth configuration, and backend hosting are required to test real Google/Meta delivery. No credentials are included in this package. Browser tests mock Google responses only to verify wiring and error handling; they are not evidence of actual provider delivery.

Before production use at scale: add per-user auth, a tenant-aware database/Drive mapping, durable webhook queue, retry/idempotency handling, message batching and WhatsApp length splitting, request/attachment validation and streaming size limits, access auditing and monitoring. The current webhook processes the first message in an incoming payload synchronously; long-running generation may trigger Meta retries. Do not treat this starter as an exactly-once delivery service.

## Files

- `index.html` + `assets/`: precompiled root deployment.
- `docs/`: precompiled /docs branch deployment.
- `dist/`: precompiled Actions/static-host deployment.
- `index.source.html`, `src/`, `vite.config.ts`: editable frontend source.
- `server.ts`, `src/server/`, `Dockerfile`, `render.yaml`: optional backend.
- `.env.example`: placeholder environment variables only.
- `.github/workflows/deploy.yml`: tested Pages build and deploy workflow.
