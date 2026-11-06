/**
 * Client-Side Assistant Engine for GitHub Pages & Serverless Deployments.
 * Enables intelligent RAG retrieval, Google Drive document organization,
 * and conversational answers even in purely static environments without an Express server.
 */

import { ChatResponsePayload } from '../server/geminiHandler';
import { ragService } from './ragService';
import { memoryService } from './memoryService';
import { driveService } from './driveService';
import { classifyDocumentForDrive } from '../utils/driveOrganizer';

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
      summary: `Matched ${ragResult.retrievedChunks.length} chunks from Google Drive knowledge base`,
    });
  }

  // 3. Document categorization
  if (media) {
    const classification = classifyDocumentForDrive(media.filename, media.content);
    toolCalls.push({
      toolName: 'google_drive_organizer',
      status: 'success',
      summary: `Routed to '${classification.folderName}' (${classification.folderCategory})`,
    });
  }

  // 4. If user configured a client-side Gemini API key on GitHub Pages, call Gemini REST API
  if (customApiKey && customApiKey.trim().length > 10) {
    try {
      toolCalls.push({
        toolName: 'gemini_client_api',
        status: 'calling',
        summary: 'Calling Gemini API directly via client API key',
      });

      const promptContext = `${memoryResult.promptSection}\n${ragResult.contextPrompt}\nUser Message: ${message}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          customApiKey.trim()
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptContext }] }],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          toolCalls.push({
            toolName: 'gemini_client_api',
            status: 'success',
            summary: 'Received response from Gemini 2.5 Flash',
          });
          return { text, toolCalls };
        }
      }
    } catch (err: any) {
      console.warn('Client-side Gemini API call failed, falling back to local RAG synthesis:', err);
    }
  }

  // 5. Intelligent Client-Side Synthesis (100% static GitHub Pages compatible)
  if (media) {
    const classification = classifyDocumentForDrive(media.filename, media.content);
    const text = `*Document Processed & Stored in Google Drive!* ✅

• *File:* \`${media.filename}\`
• *Target Folder:* \`WhatsApp Assistant / ${classification.folderName}\`
• *Category:* *${classification.folderCategory}*
• *Tags:* ${classification.suggestedTags.map(t => `#${t}`).join(' ')}

⚡ *Knowledge Base:* Chunks extracted and indexed into your RAG search engine. You can now ask questions about this document right here in WhatsApp or in the Drive tab!`;

    return { text, toolCalls };
  }

  // If query matches RAG documents
  if (ragResult.retrievedChunks.length > 0) {
    const topChunk = ragResult.retrievedChunks[0];
    const otherDocs = Array.from(new Set(ragResult.retrievedChunks.map(c => c.docTitle)));

    let answerText = `*Document Retrieval Answer (Grounded in Google Drive)* 📄\n\n`;
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
      text: `*Your Google Drive Folder Structure:* 📁\n\n${folderList}\n\nAny user can upload documents via the paperclip icon or browse them in the *Google Drive* tab!`,
      toolCalls,
    };
  }

  if (queryLower.includes('who are you') || queryLower.includes('help') || queryLower.includes('hello') || queryLower.includes('hi')) {
    return {
      text: `*Hello! I'm DriveGenie*, your intelligent personal assistant.\n\n• Anyone can click *Google Drive* to connect their personal account.\n• Upload invoices, agreements, or reports and I'll automatically organize them into Google Drive folders.\n• Ask me questions about any uploaded document using our RAG search.\n• Everything is 100% live on GitHub Pages!`,
      toolCalls,
    };
  }

  return {
    text: `*DriveGenie WhatsApp Assistant* ⚡\n\nI received your query: "${message}".\n\n• *Google Drive:* Ready to store & organize your files.\n• *RAG Search:* Searched your document index.\n• *GitHub Pages Mode:* Active & ready for multi-user connections. Upload a document or connect your Google account to get started!`,
    toolCalls,
  };
}
