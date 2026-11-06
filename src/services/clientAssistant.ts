/**
 * Client-Side Assistant Engine for GitHub Pages & Serverless Deployments.
 * Enables intelligent RAG retrieval, Google Drive document organization,
 * and conversational answers even in purely static environments without an Express server.
 */

import type { ChatResponsePayload } from '../server/geminiHandler';
import { ragService } from './ragService';
import { memoryService } from './memoryService';
import { driveService } from './driveService';
import { classifyDocumentForDrive } from '../utils/driveOrganizer';
import { readSettings } from './connection';

export async function processClientSideAssistant(
  message: string,
  media?: {
    type: 'document' | 'image' | 'audio';
    filename: string;
    mimeType: string;
    content?: string;
  },
  customApiKey?: string
): Promise<ChatResponsePayload> {
  const toolCalls: ChatResponsePayload['toolCalls'] = [];

  // 1. Process long term memory
  memoryService.processMessage(message);
  const memoryResult = memoryService.getMemoriesForQuery(message);
  if (memoryResult.items.length > 0) {
    toolCalls.push({
      toolName: 'long_term_memory',
      status: 'success',
      summary: `Recalled ${memoryResult.items.length} long-term user memories`,
    });
  }

  // 2. Perform RAG search
  const ragResult = ragService.getContextForQuery(message);
  if (ragResult.retrievedChunks.length > 0) {
    toolCalls.push({
      toolName: 'rag_document_search',
      status: 'success',
      summary: `Matched ${ragResult.retrievedChunks.length} chunks from local knowledge base`,
    });
  }

  // 3. Document categorization
  if (media) {
    const classification = classifyDocumentForDrive(media.filename, media.content);
    toolCalls.push({
      toolName: 'google_drive_organizer',
      status: 'success',
      summary: `Suggested category: '${classification.folderName}' (not proof of upload)`,
    });
  }

  // Explicit personal mode: send only to Google; errors must never look like AI success.
  if (customApiKey?.trim()) {
    const parts:any[] = [{text:`You are DriveGenie. Answer only from provided context or your knowledge. Never claim you uploaded a file, sent WhatsApp messages or searched the internet.\n${memoryResult.promptSection}\n${ragResult.contextPrompt}\nUser: ${message}`}];
    if (media?.content) {
      const match=media.content.match(/^data:([^;,]+);base64,([\s\S]*)$/);
      parts.push(match ? {inlineData:{mimeType:match[1],data:match[2]}} : {text:`Attachment ${media.filename}:\n${media.content}`});
    }
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${readSettings().model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':customApiKey.trim()},body:JSON.stringify({contents:[{role:'user',parts}]}),signal:AbortSignal.timeout(90000)});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error?.message||`Gemini failed (${res.status})`);
    const text=(data.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||'').join('');
    if(!text)throw new Error('Gemini returned no text. The request may have been blocked.');
    return {text,toolCalls:[...toolCalls,{toolName:'gemini_client_api',status:'success',summary:'Response received directly from Google Gemini.'}]};
  }

  // 5. Intelligent Client-Side Synthesis (100% static GitHub Pages compatible)
  if (media) {
    const classification = classifyDocumentForDrive(media.filename, media.content);
    const text = `*Document ready in this browser session* 📄

• *File:* \`${media.filename}\`
• *Target Folder:* \`WhatsApp Assistant / ${classification.folderName}\`
• *Category:* *${classification.folderCategory}*
• *Tags:* ${classification.suggestedTags.map(t => `#${t}`).join(' ')}

⚠️ This is a local suggestion only. Connect Google Drive and upload from the Drive tab to store the original file. Live WhatsApp requires a deployed backend and Meta credentials.`;

    return { text, toolCalls };
  }

  // If query matches RAG documents
  if (ragResult.retrievedChunks.length > 0) {
    const topChunk = ragResult.retrievedChunks[0];
    const otherDocs = Array.from(new Set(ragResult.retrievedChunks.map(c => c.docTitle)));

    let answerText = `*Local document search · not a generated AI answer* 📄\n\n`;
    answerText += `From *${topChunk.docTitle}* (Chunk #${topChunk.chunkIndex + 1}):\n\n`;
    answerText += `> "${topChunk.text}"\n\n`;

    if (otherDocs.length > 1) {
      answerText += `• *Related Documents Found:* ${otherDocs.join(', ')}\n`;
    }
    answerText += `\n💡 *Action:* You can view the full file or download it from the *Google Drive* tab.`;

    return { text: answerText, toolCalls };
  }

  // Default helpful response
  const queryLower = message.toLowerCase();
  if (queryLower.includes('folder') || queryLower.includes('drive')) {
    const folders = driveService.getAllSandboxFiles().filter(f => f.isFolder);
    const folderList = folders.map(f => `• 📁 *${f.name}*`).join('\n');
    return {
      text: `*Available folders in this browser's local demo:* 📁\n\n${folderList}\n\nConnect Google Drive in the Drive tab to see or change files in your real account.`,
      toolCalls,
    };
  }

  if (queryLower.includes('who are you') || queryLower.includes('help') || queryLower.includes('hello') || queryLower.includes('hi')) {
    return {
      text: `*Hello! I'm DriveGenie*, your personal assistant.\n\n• Connect Google Drive from the Drive tab to use your account.\n• Upload documents in the dashboard to organize them and add them to the local knowledge base.\n• Live AI answers require a Gemini API key or configured backend.\n• Live WhatsApp replies require a deployed webhook backend and Meta credentials.`,
      toolCalls,
    };
  }

  return {
    text: `*DriveGenie Assistant* ⚡\n\nI received your query: "${message}".\n\n• *Google Drive:* Connect your account in the Drive tab.\n• *Knowledge search:* No matching local document was found.\n• *Live AI:* Configure a Gemini key or backend to enable generated answers.`,
    toolCalls,
  };
}
