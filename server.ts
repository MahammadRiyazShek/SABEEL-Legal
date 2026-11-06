/**
 * Full-stack Express production and API server for WhatsApp AI Drive Assistant.
 * Securely interacts with Gemini API and handles Meta WhatsApp Cloud API webhooks.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAssistantChat } from './src/server/geminiHandler';
import {
  verifyWebhookSubscription,
  processIncomingWhatsAppMessage,
} from './src/server/whatsappWebhookHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint for Cloud Run
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-ai-drive-assistant',
    uptimeSeconds: Math.floor(process.uptime()),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Primary Assistant Chat API (calls Gemini 3.8 Flash server-side)
app.post('/api/chat', async (req: Request, res: Response) => {
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

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'whatsapp_drive_genie_verify_token_2026';
  const verification = verifyWebhookSubscription(mode, token, challenge, expectedToken);

  if (verification.isValid && verification.challenge) {
    res.status(200).send(verification.challenge);
  } else {
    res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
  }
});

// Meta WhatsApp Cloud API Webhook Receiver (POST)
app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
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

// Serve static frontend assets when in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Only start listening directly if not run inside Vite dev server
if (process.env.NODE_ENV === 'production' || !process.env.VITE_DEV) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp AI Drive Assistant server running on port ${PORT}`);
  });
}

export default app;
