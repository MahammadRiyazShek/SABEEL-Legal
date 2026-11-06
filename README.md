# WhatsApp AI Drive Assistant

This repository contains a Vite/React dashboard and an Express API server. GitHub Pages can host the dashboard only; live Gemini chat and the Meta WhatsApp webhook require the Express server to run on a public HTTPS host such as Google Cloud Run.

## Run locally

Requirements: Node.js 24 or newer and npm.

```bash
npm ci
cp .env.example .env
# Edit .env and add your own credentials
npm run dev
```

The dashboard is at `http://localhost:3000`. The Vite dev server forwards `/api` requests to the app's API middleware. To exercise the production Express server instead:

```bash
npm run build
npm start
```

The health endpoint is `/api/health`.

## Configure real AI and WhatsApp

Set these values in `.env` locally, or configure them as secrets/environment variables in the production host. Never commit `.env` or expose Meta/Gemini secrets in frontend code.

- `GEMINI_API_KEY`: Google AI Studio / Gemini API key. The backend defaults to `gemini-2.5-flash`; set `GEMINI_MODEL` only to a model enabled for your key.
- `WHATSAPP_VERIFY_TOKEN`: private string entered as the webhook verification token in Meta's WhatsApp configuration.
- `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API access token with permission to send messages and download media.
- `WHATSAPP_PHONE_NUMBER_ID`: the WhatsApp Cloud API phone-number ID.
- `META_APP_SECRET`: Meta app secret; production POST webhooks are rejected unless this is set and the signature is valid.
- `META_GRAPH_API_VERSION`: optional Graph API version, default `v22.0`; set this to a currently supported version for your Meta app.

Configure the Meta webhook URL as `https://YOUR_BACKEND_HOST/api/whatsapp/webhook`, subscribe to the `messages` field, and use the same `WHATSAPP_VERIFY_TOKEN` value. Allow the host to receive public HTTPS requests. The server verifies `X-Hub-Signature-256`, downloads supported incoming documents, images, and audio for Gemini analysis, then posts the reply to Meta. WhatsApp media is not automatically copied to a visitor's Google Drive; Drive OAuth is performed by the dashboard in that user's browser.

For Google Drive, enable Google sign-in in the Firebase project used by `firebase-applet-config.json`, enable the Google Drive API, configure the OAuth consent screen, and add the deployed dashboard hostname to Firebase authorized domains and Google OAuth origins. The app requests the Drive scope from the signed-in user's browser. Verify the Firebase project and OAuth client configuration are yours before production use.

## Deploy to Cloud Run with Docker

Create the required secrets in Google Secret Manager (`gemini-api-key`, `whatsapp-access-token`, and `meta-app-secret`). Then:

```bash
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/whatsapp-ai-drive-assistant
gcloud run deploy whatsapp-ai-drive-assistant \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/whatsapp-ai-drive-assistant \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,META_APP_SECRET=meta-app-secret:latest \
  --set-env-vars WHATSAPP_VERIFY_TOKEN=YOUR_PRIVATE_VERIFY_TOKEN,WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
```

Use a strong private verify token and do not paste secrets into source files or commit history. The GitHub Pages workflow deploys only a static frontend; it does not deploy the Express API or create a live WhatsApp webhook. The Cloud Deployment tab's code snippets are illustrative; follow this README and use Secret Manager for production secrets.

## What is and is not live

The dashboard's chat tab uses the backend when available and can fall back to local retrieval. Gemini generation requires a valid Gemini key. WhatsApp replies require a public backend plus valid Meta credentials, webhook subscriptions, and an approved/active WhatsApp Cloud API setup. Google Drive writes require the visiting user to sign in and grant the Drive scope. The browser-local demo data is not a shared multi-user database.

The app can upload original binary files from the dashboard to a connected Google Drive. Text documents are indexed locally for RAG. PDFs and other binary files are sent to Gemini for analysis when their size is within the configured request limits, but they are not OCR-indexed into local RAG. The WhatsApp integration downloads media for answering but does not persist it to Drive or a shared database. Those parts need a separate tenant-aware storage/database design before multi-user production use.

## Checks

```bash
npm run lint
npm test
npm run build
```
