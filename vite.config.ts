import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

function apiPlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        // Parse JSON body if present
        let body: any = {};
        if (req.method === 'POST' || req.method === 'PUT') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(Buffer.from(chunk));
          }
          const raw = Buffer.concat(buffers).toString('utf-8');
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = {};
          }
        }

        const url = new URL(req.url, 'http://localhost:3000');
        const pathname = url.pathname;

        if (pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'healthy',
              service: 'whatsapp-ai-drive-assistant',
              geminiConfigured: !!process.env.GEMINI_API_KEY,
              uptimeSeconds: Math.floor(process.uptime()),
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        if (pathname === '/api/chat' && req.method === 'POST') {
          try {
            const { handleAssistantChat } = await import('./src/server/geminiHandler.ts');
            const result = await handleAssistantChat(body);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Chat error' }));
          }
          return;
        }

        if (pathname === '/api/whatsapp/webhook') {
          const { verifyWebhookSubscription, processIncomingWhatsAppMessage } = await import(
            './src/server/whatsappWebhookHandler.ts'
          );
          if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode') || undefined;
            const token = url.searchParams.get('hub.verify_token') || undefined;
            const challenge = url.searchParams.get('hub.challenge') || undefined;
            const verification = verifyWebhookSubscription(mode, token, challenge);
            if (verification.isValid && verification.challenge) {
              res.statusCode = 200;
              res.end(verification.challenge);
            } else {
              res.statusCode = 403;
              res.end('Forbidden');
            }
            return;
          }

          if (req.method === 'POST') {
            try {
              const result = await processIncomingWhatsAppMessage(body);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
