/**
 * Full-stack Express production and API server for WhatsApp AI Drive Assistant.
 * Securely interacts with Gemini API and handles Meta WhatsApp Cloud API webhooks.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAssistantChat } from './src/server/geminiHandler.ts';
import {
  verifyWebhookSubscription,
  processIncomingWhatsAppMessage,
} from './src/server/whatsappWebhookHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  const origin=req.get('origin');
  const allowed=(process.env.ALLOWED_ORIGINS || 'https://mahammadriyazshek.github.io,http://localhost:3000,http://127.0.0.1:3000').split(',').map(v=>v.trim());
  if(origin && allowed.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Assistant-Token');
  } else if(origin && req.path.startsWith('/api/')) {res.status(403).json({error:'Origin not allowed. Add your dashboard origin to ALLOWED_ORIGINS.'});return;}
  if(req.method==='OPTIONS'){res.sendStatus(204);return;}next();
});
app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint for Cloud Run
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-ai-drive-assistant',
    uptimeSeconds: Math.floor(process.uptime()),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    whatsappConfigured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    webhookSignatureConfigured: !!process.env.META_APP_SECRET,
    whatsappVerifyConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timestamp: new Date().toISOString(),
  });
});

// Primary Assistant Chat API (calls Gemini server-side)
const rateWindows = new Map<string,{start:number,count:number}>();
app.post('/api/chat', async (req: Request, res: Response) => {
  const token=process.env.DASHBOARD_API_TOKEN;
  if(process.env.NODE_ENV==='production' && !token){res.status(503).json({error:'Set DASHBOARD_API_TOKEN on the backend before enabling public AI requests.'});return;}
  if(token){const a=Buffer.from(req.get('x-assistant-token')||'');const b=Buffer.from(token);if(a.length!==b.length||!timingSafeEqual(a,b)){res.status(401).json({error:'Invalid dashboard access token. Enter it in Connections.'});return;}}
  const key=req.ip||'unknown';const now=Date.now();
  for(const [id,entry] of rateWindows)if(now-entry.start>60000)rateWindows.delete(id);
  const window=rateWindows.get(key)||{start:now,count:0};window.count++;rateWindows.set(key,window);
  if(window.count>30){res.status(429).json({error:'Too many requests. Wait one minute.'});return;}
  if(!req.body || typeof req.body.message!=='string' || req.body.message.length>50000 || (!req.body.message.trim()&&!req.body.media)){res.status(400).json({error:'Provide a message up to 50,000 characters or an attachment.'});return;}
  if(!process.env.GEMINI_API_KEY){res.status(503).json({error:'GEMINI_API_KEY is not configured on this backend.'});return;}

  try {
    const result = await handleAssistantChat(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Meta WhatsApp Cloud API Webhook Verification (GET)
app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const verification = verifyWebhookSubscription(mode, token, challenge, expectedToken);

  if (verification.isValid && verification.challenge) {
    res.status(200).send(verification.challenge);
  } else {
    res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
  }
});

// Meta WhatsApp Cloud API Webhook Receiver (POST)
app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
  const appSecret = process.env.META_APP_SECRET;
  const signature = req.get('x-hub-signature-256');
  if (!appSecret && process.env.NODE_ENV === 'production') {
    res.status(503).json({ error: 'META_APP_SECRET is required for production webhook verification.' });
    return;
  }
  if (appSecret) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody || Buffer.alloc(0)).digest('hex')}`;
    const receivedBuffer = Buffer.from(signature || '');
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
      res.status(401).json({ error: 'Invalid Meta webhook signature.' });
      return;
    }
  }
  try {
    const result = await processIncomingWhatsAppMessage(
      req.body,
      req.body.ragContext,
      req.body.memoryContext
    );
    // WhatsApp Cloud API expects an HTTP 200 OK promptly to acknowledge receipt
    res.status(200).json(result);
  } catch (error: any) {
    console.error('WhatsApp webhook processing error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

app.use('/api', (_req,res)=>{res.status(404).json({error:'API route not found.'});});

// Serve static frontend assets when in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Only start listening directly if not run inside Vite dev server
if (!process.env.VITE_DEV) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp AI Drive Assistant server running on port ${PORT}`);
  });
}

export default app;
