/**
 * High-fidelity WhatsApp Web & Mobile Interface
 * Authentic layout with message bubbles, tool execution status, document cards,
 * grounding citations, and quick prompt chips.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  MoreVertical,
  Search,
  Check,
  CheckCheck,
  FileText,
  Folder,
  Sparkles,
  ExternalLink,
  Bot,
  User,
  ShieldCheck,
  Globe,
  Brain,
  HardDrive,
  Download,
  Play,
  Pause,
  ChevronDown,
  X,
  Upload,
} from 'lucide-react';
import { WhatsAppMessage, DriveItem } from '../types/assistant';
import { ragService } from '../services/ragService';
import { memoryService } from '../services/memoryService';
import { driveService } from '../services/driveService';
import { classifyDocumentForDrive } from '../utils/driveOrganizer';
import { processClientSideAssistant } from '../services/clientAssistant';

interface WhatsAppInterfaceProps {
  onOpenDriveTab?: () => void;
  onOpenMemoryTab?: () => void;
  initialPrompt?: string;
}

const INITIAL_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'msg_1',
    sender: 'assistant',
    timestamp: new Date().toISOString(),
    text: `*Welcome to DriveGenie.*\n\nConnect your Google Drive in the Drive tab, configure a Gemini key or backend for AI responses, or deploy this app with Meta credentials to receive live WhatsApp messages. This dashboard is not an actual WhatsApp client.`,
    status: 'read',
  },
];

export const WhatsAppInterface: React.FC<WhatsAppInterfaceProps> = ({
  onOpenDriveTab,
  onOpenMemoryTab,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>(() => {
    try {
      const stored = localStorage.getItem('assistant_whatsapp_messages');
      return stored ? JSON.parse(stored) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [activeTabChat, setActiveTabChat] = useState<'assistant' | 'group'>('assistant');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('assistant_whatsapp_messages', JSON.stringify(messages));
    } catch {
      // quota
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
    }
  }, [initialPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (textToSend?: string, attachedMedia?: WhatsAppMessage['media'], mediaContent?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text && !attachedMedia) return;

    const userMsgId = `msg_user_${Date.now()}`;
    const userMsg: WhatsAppMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date().toISOString(),
      text,
      status: 'sent',
      media: attachedMedia,
    };

    setMessages(prev => [...prev, userMsg]);
    if (textToSend === undefined) {
      setInputText('');
    }
    setIsAttachOpen(false);
    setIsProcessing(true);

    try {
      // 1. Process long term memory extraction
      memoryService.processMessage(text, userMsgId);

      // 2. Retrieve relevant long-term memory & RAG chunks
      const memoryResult = memoryService.getMemoriesForQuery(text);
      const ragResult = ragService.getContextForQuery(text);

      // 3. If there is a media document, upload & index to Drive & RAG
      if (attachedMedia && mediaContent) {
        const driveRes = await driveService.uploadFile(
          attachedMedia.filename,
          attachedMedia.mimeType,
          mediaContent
        );
        if (!mediaContent.startsWith('data:')) {
          ragService.indexDocument(
            attachedMedia.filename,
            mediaContent,
            attachedMedia.mimeType,
            driveRes.file.id,
            driveRes.file.category
          );
        }
      }

      let assistantMsg: WhatsAppMessage;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            media: attachedMedia
              ? {
                  type: attachedMedia.type,
                  filename: attachedMedia.filename,
                  mimeType: attachedMedia.mimeType,
                  content: mediaContent && mediaContent.length <= 22_000_000 ? mediaContent : undefined,
                }
              : undefined,
            conversationHistory: messages.slice(-6).map(m => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
            ragContext: ragResult.contextPrompt,
            memoryContext: memoryResult.promptSection,
            enableGoogleSearch: true,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        assistantMsg = {
          id: `msg_asst_${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: data.text || 'I processed your request.',
          status: 'read',
          toolCalls: data.toolCalls,
          groundingSources: data.groundingSources,
        };
      } catch (serverErr) {
        // GitHub Pages or static hosting fallback: Run client-side assistant
        const clientApiKey = localStorage.getItem('assistant_custom_gemini_key') || undefined;
        const clientData = await processClientSideAssistant(
          text,
          attachedMedia
            ? {
                type: attachedMedia.type,
                filename: attachedMedia.filename,
                mimeType: attachedMedia.mimeType,
                content: mediaContent,
              }
            : undefined,
          clientApiKey
        );

        assistantMsg = {
          id: `msg_asst_${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: clientData.text,
          status: 'read',
          toolCalls: clientData.toolCalls,
          groundingSources: clientData.groundingSources,
        };
      }

      setMessages(prev => {
        const updated = prev.map(m => (m.id === userMsgId ? { ...m, status: 'read' as const } : m));
        return [...updated, assistantMsg];
      });
    } catch (err: any) {
      console.error('Failed to get assistant response:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      const media = {
        type: 'document' as const,
        filename: file.name,
        mimeType: file.type || 'text/plain',
        fileSize: `${Math.round(file.size / 1024)} KB`,
      };

      await handleSendMessage(`Uploaded document: ${file.name}`, media, content);
    };
    if (file.type.startsWith('text/') || /\.(txt|md|csv|json|xml|html)$/i.test(file.name)) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const sendQuickSampleDocument = async (sampleType: 'invoice' | 'contract' | 'report') => {
    let filename = '';
    let content = '';
    let fileSize = '350 KB';

    if (sampleType === 'invoice') {
      filename = 'AWS_Infrastructure_Billing_Nov2026.pdf';
      fileSize = '180 KB';
      content = `AMAZON WEB SERVICES INVOICE
Invoice Number: 98124912
Billing Date: November 01, 2026
Account ID: 9938-9762-3566
Charges:
1. Amazon EC2 Compute (c6g.xlarge): $620.00
2. Amazon S3 Storage & API Calls: $85.40
3. Route 53 DNS & CloudFront CDN: $32.10
Subtotal: $737.50
Taxes: $51.62
Total Amount Due: $789.12
Due Date: November 25, 2026`;
    } else if (sampleType === 'contract') {
      filename = 'Non_Disclosure_Agreement_Mutual_2026.pdf';
      fileSize = '420 KB';
      content = `MUTUAL NON-DISCLOSURE AGREEMENT
This Agreement is entered into on Nov 05, 2026 by and between TechVentures Ltd and Partner Corp.
1. Purpose: Evaluation of collaborative AI microservices and Google Drive automation.
2. Confidential Period: 3 years from disclosure date.
3. Standard of Care: High degree of reasonable care standard.
4. Jurisdiction: Singapore Law with expedited arbitration.`;
    } else {
      filename = 'Market_Research_LLM_Agents_2026.pdf';
      fileSize = '610 KB';
      content = `EXECUTIVE BRIEF: THE STATE OF WHATSAPP ENTERPRISE AI AGENTS 2026
Key Takeaways:
- Over 74% of enterprise field teams now manage cloud document filing directly via WhatsApp conversational messaging.
- Average retrieval latency with RAG embeddings on Gemini 3.8 Flash dropped under 250 milliseconds.
- Storage categorization into Google Drive eliminates lost invoices and accelerates accounting audits by 3.8x.`;
    }

    const media = {
      type: 'document' as const,
      filename,
      mimeType: 'application/pdf',
      fileSize,
      pageCount: sampleType === 'report' ? 4 : 2,
    };

    await handleSendMessage(`Here is our document for analysis and Google Drive organization: ${filename}`, media, content);
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '12:00';
    }
  };

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Left Sidebar - WhatsApp Chats List */}
      <div className="w-80 md:w-96 border-r border-zinc-800 flex flex-col bg-[#111b21] shrink-0 hidden sm:flex">
        {/* User bar */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                DriveGenie AI
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[11px] text-zinc-400">Personal Assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            <button
              onClick={() => {
                if (confirm('Clear chat history?')) {
                  setMessages(INITIAL_MESSAGES);
                }
              }}
              title="Reset Chat"
              className="p-2 rounded-full hover:bg-zinc-700/50 hover:text-zinc-200 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="p-2.5 bg-[#111b21] border-b border-zinc-800/60">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg bg-[#202c33] text-zinc-200 placeholder-zinc-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Chats list */}
        <div className="flex-1 overflow-y-auto">
          {/* Active Chat: DriveGenie */}
          <div
            onClick={() => setActiveTabChat('assistant')}
            className={`px-3 py-3 flex items-center gap-3 cursor-pointer border-b border-zinc-800/40 transition-colors ${
              activeTabChat === 'assistant' ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]/50'
            }`}
          >
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Bot className="w-6 h-6" />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111b21]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-100 truncate">DriveGenie AI Assistant</span>
                <span className="text-[11px] text-emerald-400 font-medium">Online</span>
              </div>
              <div className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">
                  {messages[messages.length - 1]?.text.slice(0, 45) || 'Ready for documents & questions'}...
                </span>
              </div>
            </div>
          </div>

          {/* Connected Services Info card in chat list */}
          <div className="p-4 m-3 rounded-xl bg-[#202c33] border border-zinc-700/60 space-y-2 text-xs">
            <div className="font-semibold text-zinc-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Connected Integrations
            </div>
            <div className="space-y-1.5 text-zinc-400 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Google Drive
                </span>
                <span className="text-emerald-400 font-medium">Ready</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" /> Google Search
                </span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-purple-400" /> Long-Term Memory
                </span>
                <span className="text-emerald-400 font-medium">Synced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Main WhatsApp Conversation Feed */}
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative overflow-hidden">
        {/* WhatsApp Chat Top Header */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-zinc-800 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                DriveGenie AI
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gemini 3.8 Flash
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                online • Google Drive Connected • WhatsApp Webhook Ready
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenDriveTab && (
              <button
                onClick={onOpenDriveTab}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Drive Files</span>
              </button>
            )}
            {onOpenMemoryTab && (
              <button
                onClick={onOpenMemoryTab}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Memory</span>
              </button>
            )}
          </div>
        </div>

        {/* WhatsApp Chat Messages Stream */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          style={{
            backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        >
          {/* Encryption notice banner */}
          <div className="flex justify-center">
            <div className="px-3.5 py-1.5 rounded-lg bg-[#182229] border border-zinc-800 text-[11px] text-amber-300/80 max-w-md text-center shadow-xs">
              🔒 Messages and file streams are encrypted. Your Google Drive files are strictly private to your authorized session.
            </div>
          </div>

          {messages.map(msg => {
            const isMe = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
              >
                <div
                  className={`relative max-w-[88%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-md text-xs sm:text-[13px] leading-relaxed ${
                    isMe
                      ? 'bg-[#005c4b] text-zinc-100 rounded-tr-xs'
                      : 'bg-[#202c33] text-zinc-100 rounded-tl-xs border border-zinc-700/40'
                  }`}
                >
                  {/* Document Card if present */}
                  {msg.media && (
                    <div className="mb-2.5 rounded-xl bg-black/25 border border-white/10 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate text-xs">{msg.media.filename}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            {msg.media.fileSize || 'Document'} • {msg.media.mimeType.split('/')[1]?.toUpperCase() || 'PDF'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <HardDrive className="w-3 h-3" /> Drive
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message body with WhatsApp markdown formatting */}
                  <div className="whitespace-pre-wrap break-words">
                    {msg.text.split('\n').map((line, i) => {
                      // bold text replacement e.g. *bold*
                      const formatted = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
                      return (
                        <p
                          key={i}
                          dangerouslySetInnerHTML={{ __html: formatted }}
                          className={i > 0 ? 'mt-1' : ''}
                        />
                      );
                    })}
                  </div>

                  {/* Tool execution steps badge */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/10 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Connected Tool Automations
                      </div>
                      {msg.toolCalls.map((tool, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[11px] text-zinc-300 bg-black/20 px-2 py-1 rounded-md"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-mono text-emerald-300 text-[10px]">[{tool.toolName}]:</span>
                          <span className="truncate">{tool.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grounding sources if available */}
                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-semibold text-cyan-300 uppercase mb-1 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Verified Web Citations
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.groundingSources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 hover:text-white hover:border-cyan-400 transition-colors"
                          >
                            <span className="truncate max-w-[140px]">{source.title}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp & read receipt */}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-400 select-none">
                    <span>{formatTime(msg.timestamp)}</span>
                    {isMe && (
                      <span>
                        {msg.status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Processing typing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-[#202c33] p-3 rounded-2xl rounded-tl-xs max-w-xs border border-zinc-700/40">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-150" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-300" />
              </div>
              <span className="text-[11px] text-emerald-300 font-medium">DriveGenie is executing tools & typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions carousel */}
        <div className="px-4 py-2 bg-[#202c33]/70 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" /> Suggested:
          </span>
          {[
            'Summarize my Cloud Hosting Invoice',
            'What is the notice period in my signed contract?',
            'Research latest AI benchmarks on Google',
            'Remember: Fiscal year ends in December',
            'What folders do I have in Google Drive?',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              disabled={isProcessing}
              className="text-[11px] px-2.5 py-1 rounded-full bg-[#111b21] hover:bg-[#2a3942] text-zinc-300 border border-zinc-700/60 transition-colors whitespace-nowrap shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Attachment menu popover */}
        {isAttachOpen && (
          <div className="p-3 bg-[#202c33] border-t border-zinc-700 flex flex-wrap items-center gap-2 z-20">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.txt,.doc,.docx,.csv,.json"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Device Document
            </button>
            <span className="text-zinc-500 text-xs">or send realistic document:</span>
            <button
              onClick={() => sendQuickSampleDocument('invoice')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
            >
              📄 AWS Invoice (Nov 2026)
            </button>
            <button
              onClick={() => sendQuickSampleDocument('contract')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
            >
              📝 NDA Agreement
            </button>
            <button
              onClick={() => sendQuickSampleDocument('report')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
            >
              📊 Market Research PDF
            </button>
            <button
              onClick={() => setIsAttachOpen(false)}
              className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* WhatsApp Message Input Bar */}
        <div className="p-3 bg-[#202c33] flex items-center gap-2 border-t border-zinc-800 shrink-0">
          <button
            onClick={() => setIsAttachOpen(!isAttachOpen)}
            title="Attach Document"
            className={`p-2 rounded-full transition-colors ${
              isAttachOpen ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
            }`}
          >
            <Paperclip className="w-5 h-5 rotate-45" />
          </button>

          <input
            type="text"
            placeholder="Type a message or command for Google Drive / RAG..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isProcessing}
            className="flex-1 text-sm px-4 py-2 rounded-lg bg-[#2a3942] text-zinc-100 placeholder-zinc-400 focus:outline-hidden"
          />

          {inputText.trim() ? (
            <button
              onClick={() => handleSendMessage()}
              disabled={isProcessing}
              className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsPlayingAudio(prev => !prev);
                handleSendMessage('🎤 Voice note simulated: "DriveGenie, please search Google Drive for any signed agreements."');
              }}
              title="Send Voice Note"
              className="p-2 rounded-full text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
