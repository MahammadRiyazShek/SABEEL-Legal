/**
 * Cloud Run & GitHub Pages Deployment Guide Component
 * Supports both Google Cloud Run (Full-Stack Express) and GitHub Pages (Static Hosting)
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  Globe,
  MessageSquare,
  Key,
  Server,
  Zap,
  Github,
  Lock,
  ExternalLink,
  Users,
} from 'lucide-react';

export const CloudDeploymentModal: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeDeployTab, setActiveDeployTab] = useState<'github' | 'cloudrun'>('github');

  // Client-side Gemini API key for GitHub Pages
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [savedKeyNotice, setSavedKeyNotice] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('assistant_custom_gemini_key');
      if (stored) setCustomApiKey(stored);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('assistant_custom_gemini_key', customApiKey.trim());
      setSavedKeyNotice(true);
      setTimeout(() => setSavedKeyNotice(false), 2500);
    } catch {
      // ignore
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestWebhookHandshake = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const verifyToken = 'whatsapp_drive_genie_verify_token_2026';
      const challenge = 'test_challenge_code_98234';
      const res = await fetch(
        `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`
      );
      if (res.ok) {
        const text = await res.text();
        if (text === challenge) {
          setTestResult('Webhook GET Handshake 200 OK: Correct challenge echoed successfully!');
        } else {
          setTestResult(`Received unexpected response: ${text}`);
        }
      } else {
        setTestResult(`Handshake response: ${res.status} (Note: On static GitHub Pages, no server route exists; use Cloud Run for Meta Webhooks)`);
      }
    } catch (err: any) {
      setTestResult(`Test note: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://your-cloud-run-service.run.app';
  const webhookUrl = `${currentHost}/api/whatsapp/webhook`;

  const githubWorkflowSnippet = `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: touch dist/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'dist'
      - id: deployment
        uses: actions/deploy-pages@v4`;

  const dockerfileSnippet = `# Production Container for Google Cloud Run
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start"]`;

  const gcloudDeploySnippet = `# 1. Build and push container to Google Artifact Registry
gcloud builds submit --tag gcr.io/\$GOOGLE_CLOUD_PROJECT/whatsapp-drive-genie

# 2. Deploy to Google Cloud Run
gcloud run deploy whatsapp-drive-genie \\
  --image gcr.io/\$GOOGLE_CLOUD_PROJECT/whatsapp-drive-genie \\
  --platform managed \\
  --region asia-southeast1 \\
  --allow-unauthenticated \\
  --set-env-vars GEMINI_API_KEY="\$GEMINI_API_KEY",WHATSAPP_VERIFY_TOKEN="whatsapp_drive_genie_verify_token_2026"`;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Deployment & Multi-User Hosting</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Ready to run on <strong>GitHub Pages</strong> (static hosting for public users) and <strong>Google Cloud Run</strong> (full-stack WhatsApp webhook).
              </p>
            </div>
          </div>
        </div>

        {/* Deploy mode tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveDeployTab('github')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDeployTab === 'github'
                ? 'bg-zinc-100 text-zinc-900 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            GitHub Pages
          </button>
          <button
            onClick={() => setActiveDeployTab('cloudrun')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeDeployTab === 'cloudrun'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Google Cloud Run
          </button>
        </div>
      </div>

      {/* Multi-User Google Drive Architecture Notice */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 sm:p-5 flex items-start gap-3.5 text-xs leading-relaxed text-zinc-300">
        <Users className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-white text-sm mb-1">
            Multi-User Google Drive Connection
          </div>
          <p>
            Your personal Google Drive account is <strong>not hardcoded</strong>. Anyone visiting your app (on GitHub Pages or Cloud Run) can click <strong>"Connect Your Google Drive"</strong> in the Google Drive tab. The official Google OAuth popup will let them pick <em>their own account</em>, authorizing the assistant to organize files in their private Google Drive!
          </p>
        </div>
      </div>

      {activeDeployTab === 'github' ? (
        /* GITHUB PAGES TAB */
        <div className="space-y-5">
          {/* Critical Troubleshooting: Blank Screen Fix */}
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              Fixing White Blank Screen on GitHub Pages (Read This First)
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              If your GitHub Pages link shows a white blank screen, it is almost always caused by GitHub trying to serve raw, unbuilt source code instead of the compiled bundle. Follow one of these two options:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  ✅ Option A: Use GitHub Actions (Zero Hassle)
                </span>
                <ol className="list-decimal list-inside text-zinc-400 text-[11px] space-y-1">
                  <li>Push your repository to GitHub.</li>
                  <li>Go to <strong>Settings &gt; Pages</strong>.</li>
                  <li>Under <strong>Source</strong>, select <span className="text-white font-semibold">"GitHub Actions"</span> (do NOT select "Deploy from a branch").</li>
                  <li>Our included <code className="text-cyan-300">deploy.yml</code> workflow will compile and launch the app in 30 seconds!</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
                <span className="font-bold text-blue-400 flex items-center gap-1.5">
                  📁 Option B: Manual File Upload
                </span>
                <ol className="list-decimal list-inside text-zinc-400 text-[11px] space-y-1">
                  <li>Run <code className="text-cyan-300">npm run build</code> locally.</li>
                  <li>Open the <span className="text-white font-semibold">dist/</span> folder.</li>
                  <li>Upload the contents of <span className="text-white font-semibold">dist/</span> (index.html, 404.html, assets/) directly to your branch.</li>
                  <li><em>Never upload raw <code className="text-zinc-500">.tsx</code> files directly to GitHub Pages.</em></li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 1: Base URL and Build */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="text-base font-semibold text-white">GitHub Pages Static Compatibility</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We configured <code className="text-cyan-300 bg-zinc-950 px-1.5 py-0.5 rounded">base: './'</code> in <code className="text-zinc-300">vite.config.ts</code> so all JavaScript, CSS, and assets use relative paths. Running <code className="text-emerald-300 bg-zinc-950 px-1.5 py-0.5 rounded">npm run build</code> outputs a purely static <code className="text-zinc-300">dist/</code> directory that deploys seamlessly to GitHub Pages.
            </p>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              # Build the static site bundle<br />
              <span className="text-emerald-400">npm run build</span>
            </div>
          </div>

          {/* Step 2: Google Cloud Console Authorized Origin */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-base font-semibold text-white">Authorizing Your GitHub Pages URL in Google Cloud</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              To allow other people to sign in with their Google accounts from your GitHub Pages site, add your GitHub Pages origin to Google Cloud Console:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-800 leading-relaxed">
              <li>
                Open the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline inline-flex items-center gap-1">Google Cloud Console Credentials <ExternalLink className="w-3 h-3" /></a> page.
              </li>
              <li>
                Select your project (<code className="text-emerald-300 font-mono">gen-lang-client-0585089693</code>).
              </li>
              <li>
                Click your <strong>OAuth 2.0 Web Client ID</strong>.
              </li>
              <li>
                Under <strong>Authorized JavaScript origins</strong>, click <em>+ ADD URI</em> and paste your GitHub Pages URL (e.g. <code className="text-cyan-300 font-mono">https://&lt;your-username&gt;.github.io</code>).
              </li>
              <li>
                Click <strong>Save</strong>. Now anyone on your GitHub Pages site can click "Connect Your Google Drive" and link their account!
              </li>
            </ol>
          </div>

          {/* Step 3: GitHub Actions Workflow */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-base font-semibold text-white">Automated GitHub Actions Deploy Workflow</h3>
              </div>
              <button
                onClick={() => copyToClipboard(githubWorkflowSnippet, 'workflow')}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                {copiedKey === 'workflow' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy .github/workflows/deploy.yml
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Created at <code className="text-zinc-200">.github/workflows/deploy.yml</code> in your repository. When you push to GitHub, it automatically publishes to GitHub Pages!
            </p>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-56 overflow-y-auto whitespace-pre leading-relaxed">
              {githubWorkflowSnippet}
            </div>
          </div>

          {/* Step 4: Optional Client-Side Gemini Key for GitHub Pages */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Optional: Client-Side Gemini API Key for GitHub Pages</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              On static GitHub Pages without an Express backend, our built-in assistant automatically uses the RAG retriever and Drive organizer. If you want full live Gemini AI text generation directly in the browser on GitHub Pages, enter an API key below (stored in your browser's <code className="text-zinc-300">localStorage</code>):
            </p>

            <form onSubmit={handleSaveApiKey} className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy... (Gemini API Key)"
                value={customApiKey}
                onChange={e => setCustomApiKey(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 font-mono focus:outline-hidden focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                Save Key
              </button>
            </form>
            {savedKeyNotice && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> API key saved in browser storage for GitHub Pages mode!
              </span>
            )}
          </div>
        </div>
      ) : (
        /* CLOUD RUN TAB */
        <div className="space-y-5">
          {/* WhatsApp Cloud API Webhook Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Meta WhatsApp Cloud API Webhook</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              In your <strong>Meta for Developers</strong> dashboard (WhatsApp &gt; Configuration), configure the Webhook Callback URL and Verify Token to receive real WhatsApp messages.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase">Callback URL</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-cyan-400 truncate">{webhookUrl}</span>
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'webhookUrl')}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === 'webhookUrl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase">Verify Token</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-zinc-200">whatsapp_drive_genie_verify_token_2026</span>
                  <button
                    onClick={() => copyToClipboard('whatsapp_drive_genie_verify_token_2026', 'verifyToken')}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === 'verifyToken' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleTestWebhookHandshake}
                disabled={isTesting}
                className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                {isTesting ? 'Verifying...' : 'Test Webhook Verification Handshake'}
              </button>
              {testResult && (
                <span className="text-xs font-mono text-emerald-400">{testResult}</span>
              )}
            </div>
          </div>

          {/* Google Cloud Run Deploy Command */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-semibold text-white">Google Cloud Run Deployment</h3>
              </div>
              <button
                onClick={() => copyToClipboard(gcloudDeploySnippet, 'gcloud')}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                {copiedKey === 'gcloud' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy gcloud Command
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
              {gcloudDeploySnippet}
            </div>
          </div>

          {/* Dockerfile */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-semibold text-white">Production Container Dockerfile</h3>
              </div>
              <button
                onClick={() => copyToClipboard(dockerfileSnippet, 'dockerfile')}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                {copiedKey === 'dockerfile' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy Dockerfile
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
              {dockerfileSnippet}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
