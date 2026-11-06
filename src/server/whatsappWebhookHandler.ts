import { handleAssistantChat } from './geminiHandler';

export interface WhatsAppIncomingPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'document' | 'image' | 'interactive' | 'audio';
          text?: { body: string };
          document?: { id: string; filename: string; mime_type: string; caption?: string };
          image?: { id: string; mime_type: string; caption?: string };
          audio?: { id: string; mime_type: string };
          interactive?: { type: string; button_reply?: { id: string; title: string } };
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
  expectedVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN
): { isValid: boolean; challenge?: string } {
  if (mode === 'subscribe' && !!expectedVerifyToken && token === expectedVerifyToken && challenge) {
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
  whatsappResponsePayload?: unknown;
}> {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  if (!message) return { success: true, replyText: 'Webhook event acknowledged; no user message to process.' };

  const senderPhone = message.from;
  const senderName = contact?.profile?.name || 'WhatsApp User';
  let incomingText = '';
  let media: { type: 'document' | 'image' | 'audio'; filename: string; mimeType: string; content?: string } | undefined;
  if (message.type === 'text') incomingText = message.text?.body || '';
  else if (message.type === 'document' && message.document) {
    incomingText = message.document.caption || `Please analyze the attached document ${message.document.filename}.`;
    media = { type: 'document', filename: message.document.filename, mimeType: message.document.mime_type };
  } else if (message.type === 'image' && message.image) {
    incomingText = message.image.caption || 'Please analyze the attached image.';
    media = { type: 'image', filename: `whatsapp-image-${message.id}`, mimeType: message.image.mime_type };
  } else if (message.type === 'audio' && message.audio) {
    incomingText = 'Please transcribe and summarize the attached audio.';
    media = { type: 'audio', filename: `whatsapp-audio-${message.id}`, mimeType: message.audio.mime_type };
  } else if (message.type === 'interactive' && message.interactive?.button_reply) {
    incomingText = message.interactive.button_reply.title;
  } else {
    incomingText = 'I received an unsupported message type. Please send text or a document.';
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || value?.metadata?.phone_number_id;
  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v22.0';
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp reply not sent: configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
  }
  if (media) {
    const mediaId = message.document?.id || message.image?.id || message.audio?.id;
    if (mediaId) {
      const metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!metaResponse.ok) throw new Error(`Meta media lookup failed (${metaResponse.status}).`);
      const mediaInfo = await metaResponse.json() as { url?: string; mime_type?: string };
      if (!mediaInfo.url) throw new Error('Meta did not return a media download URL.');
      const bytesResponse = await fetch(mediaInfo.url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!bytesResponse.ok) throw new Error(`Meta media download failed (${bytesResponse.status}).`);
      const bytes = Buffer.from(await bytesResponse.arrayBuffer());
      if (bytes.byteLength > 18 * 1024 * 1024) throw new Error('Attachment exceeds the 18 MB processing limit.');
      media.content = `data:${mediaInfo.mime_type || media.mimeType};base64,${bytes.toString('base64')}`;
      media.mimeType = mediaInfo.mime_type || media.mimeType;
    }
  }
  const chatResult = await handleAssistantChat({ message: incomingText, media, ragContext, memoryContext });
  const whatsappResponsePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: senderPhone,
    type: 'text',
    text: { preview_url: true, body: chatResult.text },
  };
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(whatsappResponsePayload),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Meta WhatsApp send failed (${response.status}): ${details.slice(0, 500)}`);
  }
  return { success: true, replyText: chatResult.text, senderPhone, senderName, messageType: message.type, filename: media?.filename, whatsappResponsePayload };
}
