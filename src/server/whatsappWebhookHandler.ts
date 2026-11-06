/**
 * Meta WhatsApp Cloud API Webhook Handler
 * Supports official webhook subscription verification and message processing.
 */

import { handleAssistantChat } from './geminiHandler';

export interface WhatsAppIncomingPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'document' | 'image' | 'interactive' | 'audio';
          text?: { body: string };
          document?: {
            id: string;
            filename: string;
            mime_type: string;
            caption?: string;
          };
          image?: {
            id: string;
            mime_type: string;
            caption?: string;
          };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

export function verifyWebhookSubscription(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
  expectedVerifyToken = 'whatsapp_drive_genie_verify_token_2026'
): { isValid: boolean; challenge?: string } {
  if (mode === 'subscribe' && token === expectedVerifyToken) {
    return { isValid: true, challenge };
  }
  return { isValid: false };
}

export async function processIncomingWhatsAppMessage(
  payload: WhatsAppIncomingPayload,
  ragContext = '',
  memoryContext = ''
): Promise<{
  success: boolean;
  replyText: string;
  senderPhone?: string;
  senderName?: string;
  messageType?: string;
  filename?: string;
  whatsappResponsePayload?: any;
}> {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];

  if (!message) {
    return {
      success: false,
      replyText: 'No message found in webhook payload.',
    };
  }

  const senderPhone = message.from;
  const senderName = contact?.profile?.name || 'WhatsApp User';
  let incomingText = '';
  let media: any = undefined;

  if (message.type === 'text' && message.text) {
    incomingText = message.text.body;
  } else if (message.type === 'document' && message.document) {
    incomingText = message.document.caption || `Uploaded document: ${message.document.filename}`;
    media = {
      type: 'document',
      filename: message.document.filename,
      mimeType: message.document.mime_type,
    };
  } else if (message.type === 'interactive' && message.interactive?.button_reply) {
    incomingText = message.interactive.button_reply.title;
  }

  const chatResult = await handleAssistantChat({
    message: incomingText,
    media,
    ragContext,
    memoryContext,
    enableGoogleSearch: true,
  });

  // Construct official Meta WhatsApp Cloud API response format
  const whatsappResponsePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: senderPhone,
    type: 'text',
    text: {
      preview_url: true,
      body: chatResult.text,
    },
  };

  return {
    success: true,
    replyText: chatResult.text,
    senderPhone,
    senderName,
    messageType: message.type,
    filename: media?.filename,
    whatsappResponsePayload,
  };
}
