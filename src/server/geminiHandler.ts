/**
 * Server-side Gemini API Handler
 * Uses @google/genai with Gemini 2.5 Flash and Google Search grounding.
 * NEVER exposes the API key to the browser.
 */

import { GoogleGenAI } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ChatRequestPayload {
  message: string;
  media?: {
    type: 'document' | 'image' | 'audio';
    filename: string;
    mimeType: string;
    content?: string;
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  ragContext?: string;
  memoryContext?: string;
  enableGoogleSearch?: boolean;
}

export interface ChatResponsePayload {
  text: string;
  toolCalls?: Array<{
    toolName: string;
    status: 'calling' | 'success' | 'failed';
    summary: string;
    details?: string;
  }>;
  groundingSources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

const SYSTEM_INSTRUCTION = `You are "DriveGenie", an intelligent, high-efficiency personal assistant accessible via WhatsApp and integrated with Google Drive.

Your core capabilities:
1. Analyze documents only when their text or file content is actually included in the request; never claim a file was stored unless a connected Drive upload confirms it.
2. Retrieve and analyze documents when their contents are provided in the context.
3. RAG-based document search and question answering: Accurately cite facts, clauses, numbers, and dates from provided documents.
4. Long-term conversational memory: Recall user preferences, deadlines, names, and directives naturally.
5. Internet research and summarization: Search the web for real-time information, market data, and tech news with citations.
6. Execute tasks cleanly with connected tools and APIs.

WhatsApp Persona & Style:
- Professional, warm, and concise.
- Format for WhatsApp: use *bold* for emphasis, bullet points (•) for readability, and helpful emojis (📁, 📄, 🔍, 💡, ⚡, ✅).
- When a document is analyzed, provide an executive summary, key findings, and recommended next steps or Drive folder location.
- When answering from RAG documents, clearly state which document provided the information.
- When performing internet research, cite sources and summarize key takeaways.`;

export async function handleAssistantChat(
  payload: ChatRequestPayload
): Promise<ChatResponsePayload> {
  const {
    message,
    media,
    conversationHistory = [],
    ragContext = '',
    memoryContext = '',
    enableGoogleSearch = true,
  } = payload;

  const toolCalls: ChatResponsePayload['toolCalls'] = [];
  let inlineMedia: { mimeType: string; data: string } | undefined;

  // Construct context-enriched prompt
  let promptContext = '';

  if (memoryContext) {
    promptContext += `${memoryContext}\n\n`;
    toolCalls.push({
      toolName: 'long_term_memory',
      status: 'success',
      summary: 'Recalled long-term user preferences & facts',
    });
  }

  if (ragContext) {
    promptContext += `${ragContext}\n\n`;
    toolCalls.push({
      toolName: 'rag_document_search',
      status: 'success',
      summary: 'Retrieved matching semantic document chunks from knowledge base',
    });
  }

  if (media) {
    promptContext += `### INCOMING ATTACHMENT METADATA:\nFilename: ${media.filename}\nMIME Type: ${media.mimeType}\n`;
    if (media.content) {
      const dataUrl = media.content.match(/^data:([^;,]+);base64,([\s\S]*)$/);
      if (dataUrl) {
        if (dataUrl[2].length > 24 * 1024 * 1024) throw new Error('Attachment exceeds the Gemini processing size limit.');
        inlineMedia = { mimeType: dataUrl[1] || media.mimeType, data: dataUrl[2] };
        promptContext += 'The original attachment is included as multimodal input. Analyze its actual contents and do not claim it was saved to Google Drive.\n\n';
      } else {
        promptContext += `Extracted text content:\n${media.content.slice(0, 12000)}\n\n`;
      }
    } else {
      promptContext += 'The attachment bytes have not been downloaded or parsed. Do not claim to have read, analyzed, organized, stored, or indexed the file. Explain that only its metadata is available.\n\n';
    }
  }

  // Format past turns for context continuity
  let conversationPrompt = '';
  if (conversationHistory.length > 0) {
    conversationPrompt = '### RECENT CONVERSATION HISTORY:\n';
    conversationHistory.slice(-6).forEach(h => {
      const speaker = h.role === 'user' ? 'User' : 'Assistant';
      conversationPrompt += `${speaker}: ${h.text}\n`;
    });
    conversationPrompt += '\n';
  }

  const finalUserContent = `${promptContext}${conversationPrompt}User's Current Message:\n${message || (media ? `The user sent an attachment named ${media.filename}.` : 'Hello!')}`;

  try {
    const ai = getAiClient();

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
    };

    // Enable Google Search grounding if requested
    if (enableGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: inlineMedia
        ? [{ role: 'user', parts: [{ text: finalUserContent }, { inlineData: inlineMedia }] }]
        : finalUserContent,
      config,
    });

    const text = response.text || 'I processed your request, but no text output was generated.';

    // Extract grounding sources if available
    const groundingSources: ChatResponsePayload['groundingSources'] = [];
    const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks;

    if (Array.isArray(groundingChunks)) {
      toolCalls.push({
        toolName: 'google_search_grounding',
        status: 'success',
        summary: 'Queried Google Search for live verified internet research',
      });

      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            url: chunk.web.uri,
          });
        }
      });
    }

    return {
      text,
      toolCalls,
      groundingSources: groundingSources.length > 0 ? groundingSources.slice(0, 4) : undefined,
    };
  } catch (error: any) {
    console.error('Gemini API execution error:', error);
    throw new Error(error.message?.includes('429') ? 'Gemini quota or rate limit exceeded. Check your Google API billing and retry later.' : `Gemini could not answer: ${error.message || 'Unknown API error'}`);
  }
}
