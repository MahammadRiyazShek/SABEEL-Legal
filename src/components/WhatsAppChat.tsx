import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  Paperclip,
  CheckCheck,
  FileText,
  Volume2,
  Phone,
  Video,
  MoreVertical,
  Clock,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Download,
  Network
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  senderName?: string;
  text: string;
  timestamp: string;
  mediaType?: 'text' | 'audio' | 'document' | 'image';
  mediaUrl?: string;
  meta?: {
    fileAttachment?: {
      fileName: string;
      fileSize: string;
      fileType: string;
      documentId?: string;
      surveyNumber?: string;
      village?: string;
    };
  };
}

interface WhatsAppChatProps {
  dialect: 'hyderabadi_roman_urdu' | 'english';
  onNavigateToTab?: (tab: string) => void;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({ dialect, onNavigateToTab }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const [showWebhookTester, setShowWebhookTester] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState('Salam Aliya! Shamshabad Sy No 142 ka High Court order kya status pe hai?');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/chat/history');
      const data = await res.json();
      if (data.history) {
        setMessages(data.history);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customText?: string, mediaType: 'text' | 'audio' | 'document' = 'text') => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          dialect,
          mediaType,
          senderName: 'Adv. M.A. Riyaz (WhatsApp)',
        }),
      });
      const data = await res.json();
      if (data.chatHistory) {
        setMessages(data.chatHistory);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateVoiceNote = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      handleSend(
        '🎙️ [Voice Note 0:18] "Aliya suno, Shamshabad Sy No 142 ka kal causelist me Item No check karo aur Tahsildar ko bhejne wali application ready karo."',
        'audio'
      );
    }, 1800);
  };

  const handleSendWebhook = async () => {
    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Body: webhookPayload,
          From: '+91 98490 12345',
          MessageType: 'text',
        }),
      });
      await res.json();
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const quickPrompts = [
    {
      title: 'list documents',
      prompt: 'list documents',
    },
    {
      title: 'Voice Typo: "shamchabaz 626"',
      prompt: '🎙️ [Voice Note] "Aliya suno, shamchabaz 626 ka document bhejo."',
    },
    {
      title: 'send shamshabad 626 document',
      prompt: 'send shamshabad 626 document',
    },
    {
      title: 'Voice Typo: "pida shop"',
      prompt: '🎙️ [Voice Note] "pida shop land ka brief memo nikalo"',
    },
    {
      title: '1,000+ Interconnected Graph',
      prompt: '1000 documents ka interconnected knowledge graph aur title chain dikhao.',
    },
    {
      title: '7 PM Causelist Check',
      prompt: 'Shamshabad Sy No 142 High Court case (WP 18942/2026) causelist me aaya kya?',
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[640px]">
      {/* WhatsApp Mobile / Web Interface Mockup */}
      <div className="flex-1 flex flex-col bg-[#0b141a] text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* WhatsApp Header */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow">
                S
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#202c33] rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm md:text-base">SABEEL Legal AI (Aliya)</h3>
                <span className="bg-emerald-900/60 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-medium border border-emerald-700/50">
                  WhatsApp Bot
                </span>
              </div>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                online • {dialect === 'hyderabadi_roman_urdu' ? 'Hyderabadi Dialect Active' : 'English Mode'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => setShowWebhookTester(!showWebhookTester)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1 transition-colors"
              title="Test WhatsApp Cloud API Webhook"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Webhook
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-full text-slate-300">
              <Phone className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-full text-slate-300">
              <Video className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-full text-slate-300">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Wallpaper / Messages Container */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0b141a] bg-radial from-[#111b21] to-[#0b141a]">
          {/* Security Notice Pill */}
          <div className="flex justify-center my-2">
            <div className="bg-[#182229] border border-slate-800 text-amber-300 text-xs px-3 py-1.5 rounded-lg shadow-sm text-center max-w-md">
              🔒 End-to-end encrypted • Synced with Google Drive Vault & Telangana Courts Causelist
            </div>
          </div>

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow text-sm relative ${
                    isUser
                      ? 'bg-[#005c4b] text-slate-100 rounded-tr-none'
                      : 'bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-800'
                  }`}
                >
                  {!isUser && (
                    <div className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      {msg.senderName || 'SABEEL Legal AI'}
                    </div>
                  )}

                  {/* Audio note render */}
                  {msg.mediaType === 'audio' && (
                    <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl mb-2 border border-white/5">
                      <button
                        onClick={() => setAudioPlayingId(audioPlayingId === msg.id ? null : msg.id)}
                        className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition"
                      >
                        <Volume2 className={`w-4 h-4 ${audioPlayingId === msg.id ? 'animate-bounce' : ''}`} />
                      </button>
                      <div className="flex-1">
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-emerald-400 ${
                              audioPlayingId === msg.id ? 'w-full transition-all duration-3000' : 'w-1/3'
                            }`}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>0:18</span>
                          <span>Voice Note</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Document preview if file attachment */}
                  {(msg.mediaType === 'document' || msg.meta?.fileAttachment) && (
                    <div className="bg-[#111b21] hover:bg-[#182229] transition p-2.5 rounded-xl mb-2.5 border border-slate-700/70 flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {/* Red PDF Icon badge */}
                        <div className="w-10 h-10 rounded-lg bg-rose-600/90 text-white flex flex-col items-center justify-center font-bold text-[10px] shadow shrink-0">
                          <FileText className="w-4 h-4 mb-0.5" />
                          <span>PDF</span>
                        </div>
                        <div className="text-xs truncate">
                          <div className="font-semibold text-slate-100 truncate">
                            {msg.meta?.fileAttachment?.fileName || 'Shamshabad 626.pdf'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {msg.meta?.fileAttachment?.fileSize || '381 KB'} • PDF
                          </div>
                        </div>
                      </div>

                      <a
                        href={`/api/documents/download/${encodeURIComponent(
                          msg.meta?.fileAttachment?.fileName || 'Shamshabad 626.pdf'
                        )}`}
                        download={msg.meta?.fileAttachment?.fileName || 'Shamshabad 626.pdf'}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full transition shrink-0"
                        title="Download Document"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                      </a>
                    </div>
                  )}

                  {/* Message Text with formatting support */}
                  <div className="whitespace-pre-wrap leading-relaxed select-text">{msg.text}</div>

                  {/* Timestamp & double blue checkmark */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                    <span>{msg.timestamp.slice(11, 16) || 'Just now'}</span>
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#202c33] text-slate-300 rounded-2xl rounded-tl-none px-4 py-2 text-xs flex items-center gap-2 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>SABEEL is researching documents & causelist...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestions */}
        <div className="bg-[#111b21] px-3 py-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Quick:
          </span>
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q.prompt)}
              className="text-xs bg-[#202c33] hover:bg-[#2a3942] text-slate-300 px-3 py-1 rounded-full whitespace-nowrap transition-colors border border-slate-700/60 flex items-center gap-1"
            >
              {q.title}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2 border-t border-slate-800">
          <button
            onClick={() => onNavigateToTab?.('vault')}
            title="Upload Document to Google Drive"
            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={
              dialect === 'hyderabadi_roman_urdu'
                ? 'SABEEL se puchiye... (e.g. Shamshabad Sy 142 ka status?)'
                : 'Ask SABEEL... (e.g., Check High Court causelist for WP 18942)'
            }
            className="flex-1 bg-[#2a3942] text-slate-100 placeholder-slate-400 text-sm px-4 py-2.5 rounded-lg border-0 focus:ring-1 focus:ring-emerald-500 outline-none"
          />

          <button
            onClick={handleSimulateVoiceNote}
            title="Simulate WhatsApp Voice Note"
            className={`p-2.5 rounded-full transition ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="p-2.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 disabled:hover:bg-[#00a884] text-white rounded-full transition shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Side Intelligence Panel (Features, Webhook Debugger & n8n Bridge) */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Assistant Capabilities Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            SABEEL Voice & WhatsApp AI
          </h4>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Directly replicates your n8n workflow architecture (WhatsApp trigger → Audio transcribe → Google Drive node → Pinecone RAG → Reply).
          </p>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0"></span>
              <div>
                <strong className="text-slate-200">7:00 PM Causelist Scanner:</strong>
                <p className="text-slate-400 text-[11px]">Auto checks High Court & District boards every evening at 7 PM for Next Date of Hearing.</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1 shrink-0"></span>
              <div>
                <strong className="text-slate-200">Village & Sy No Indexing:</strong>
                <p className="text-slate-400 text-[11px]">Instant retrieval for Shamshabad, Moinabad, Rajendranagar by Survey Number.</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50 flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0"></span>
              <div>
                <strong className="text-slate-200">Hyderabadi Roman Urdu:</strong>
                <p className="text-slate-400 text-[11px]">Natural, polite conversational dialect tailored for advocates and clients.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Simulator Modal / Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Incoming WhatsApp Webhook
            </h4>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              POST /api/whatsapp/webhook
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Test incoming WhatsApp Cloud API / Twilio payload simulation:
          </p>
          <textarea
            value={webhookPayload}
            onChange={(e) => setWebhookPayload(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 mb-2 resize-none"
          />
          <button
            onClick={handleSendWebhook}
            className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-700/50 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <Send className="w-3 h-3" />
            Fire Webhook Event
          </button>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs flex flex-col gap-2">
            <button
              onClick={() => onNavigateToTab?.('causelist')}
              className="w-full bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 rounded-lg py-2 px-3 text-xs flex items-center justify-between transition"
            >
              <span>Inspect 7 PM Causelist Radar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateToTab?.('briefs')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-2 px-3 text-xs flex items-center justify-between transition"
            >
              <span>RAG Research & Brief Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
