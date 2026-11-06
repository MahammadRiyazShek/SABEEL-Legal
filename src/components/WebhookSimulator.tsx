/**
 * Meta WhatsApp Cloud API Webhook Interactive Simulator
 * Allows testing live webhook receiver with realistic Meta JSON payloads.
 */

import React, { useState } from 'react';
import {
  Send,
  FileText,
  Terminal,
  CheckCircle2,
  RefreshCw,
  Code,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { WhatsAppIncomingPayload } from '../server/whatsappWebhookHandler';

export const WebhookSimulator: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('+15551234567');
  const [contactName, setContactName] = useState('Sarah Connor');
  const [messageType, setMessageType] = useState<'text' | 'document'>('text');
  const [textContent, setTextContent] = useState('Can you check my Google Drive for the Q3 hosting invoice and tell me what the total was?');
  const [documentName, setDocumentName] = useState('Annual_Software_License_Invoice.pdf');

  const [isLoading, setIsLoading] = useState(false);
  const [lastRequestPayload, setLastRequestPayload] = useState<any>(null);
  const [lastResponsePayload, setLastResponsePayload] = useState<any>(null);

  const handleSimulateWebhook = async () => {
    setIsLoading(true);

    const metaPayload: WhatsAppIncomingPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_993897623566',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+16505550199',
                  phone_number_id: '109283746591283',
                },
                contacts: [
                  {
                    profile: { name: contactName },
                    wa_id: phoneNumber.replace(/[^0-9]/g, ''),
                  },
                ],
                messages: [
                  messageType === 'text'
                    ? {
                        from: phoneNumber.replace(/[^0-9]/g, ''),
                        id: `wamid.HBgL${Date.now()}`,
                        timestamp: `${Math.floor(Date.now() / 1000)}`,
                        type: 'text',
                        text: { body: textContent },
                      }
                    : {
                        from: phoneNumber.replace(/[^0-9]/g, ''),
                        id: `wamid.HBgL${Date.now()}`,
                        timestamp: `${Math.floor(Date.now() / 1000)}`,
                        type: 'document',
                        document: {
                          id: `doc_media_${Date.now()}`,
                          filename: documentName,
                          mime_type: 'application/pdf',
                          caption: textContent,
                        },
                      },
                ],
              },
            },
          ],
        },
      ],
    };

    setLastRequestPayload(metaPayload);

    try {
      setLastResponsePayload({mode:'local-payload-inspection', sent:false, message:'Payload built locally only. No request was sent and no WhatsApp reply was delivered. Real production events must come from Meta with a valid signature.', payload:metaPayload});
    } catch (err: any) {
      setLastResponsePayload({ error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      <div className="pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Meta WhatsApp Webhook Simulator</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Inspect an example Meta payload locally. This tool does not send messages or bypass webhook signatures.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls form */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Simulated Incoming WhatsApp Message</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Sender Name</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Sender WhatsApp #</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">Message Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageType('text')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  messageType === 'text'
                    ? 'bg-emerald-600 border-emerald-500 text-white font-medium'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Text Message
              </button>
              <button
                type="button"
                onClick={() => setMessageType('document')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  messageType === 'document'
                    ? 'bg-emerald-600 border-emerald-500 text-white font-medium'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Document Attachment
              </button>
            </div>
          </div>

          {messageType === 'document' && (
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">Document Filename</label>
              <input
                type="text"
                value={documentName}
                onChange={e => setDocumentName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              {messageType === 'document' ? 'Document Caption' : 'Message Text'}
            </label>
            <textarea
              rows={3}
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleSimulateWebhook}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Simulate Meta WhatsApp Webhook POST
          </button>
        </div>

        {/* Live response inspector */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" /> WhatsApp Cloud API Response JSON
              </h3>
              {lastResponsePayload && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                  HTTP 200 OK
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              This is the exact JSON payload the webhook handler returns for Meta WhatsApp Cloud API to deliver to the user's phone.
            </p>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {lastResponsePayload
                ? JSON.stringify(lastResponsePayload, null, 2)
                : '// Click "Simulate Meta WhatsApp Webhook POST" to test live endpoint'}
            </div>
          </div>

          {lastResponsePayload?.replyText && (
            <div className="p-3.5 rounded-xl bg-[#202c33] border border-zinc-700/60 text-xs">
              <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                Rendered WhatsApp Message:
              </div>
              <p className="text-zinc-200 whitespace-pre-wrap">{lastResponsePayload.replyText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
