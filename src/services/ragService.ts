/**
 * RAG Knowledge Base Service
 * Indexes documents, creates chunks, and executes semantic queries.
 */

import { RAGDocument, RAGChunk, DriveItem } from '../types/assistant';
import { chunkText, extractKeywords, searchKnowledgeBase, buildRAGContextPrompt } from '../utils/rag';
import { driveService } from './driveService';

class RAGService {
  private documents: RAGDocument[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('assistant_rag_docs');
      if (stored) {
        this.documents = JSON.parse(stored);
      } else {
        this.seedFromDrive();
      }
    } catch {
      this.seedFromDrive();
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('assistant_rag_docs', JSON.stringify(this.documents));
    } catch {
      // quota or SSR
    }
  }

  seedFromDrive() {
    const sandboxFiles = driveService.getAllSandboxFiles().filter(f => !f.isFolder && f.content);
    this.documents = [];

    for (const file of sandboxFiles) {
      this.indexDocument(file.name, file.content || '', file.mimeType, file.id, file.category || 'General');
    }
  }

  /**
   * Index a new document into RAG knowledge base
   */
  indexDocument(
    title: string,
    content: string,
    mimeType = 'text/plain',
    driveFileId?: string,
    category = 'General'
  ): RAGDocument {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const textChunks = chunkText(content, 500, 100);

    const chunks: RAGChunk[] = textChunks.map((chunkStr, idx) => ({
      id: `chunk_${docId}_${idx}`,
      docId,
      docTitle: title,
      chunkIndex: idx,
      text: chunkStr,
      keywords: extractKeywords(chunkStr),
    }));

    const ragDoc: RAGDocument = {
      id: docId,
      title,
      mimeType,
      driveFileId,
      category,
      uploadedAt: new Date().toISOString(),
      chunks,
      fullText: content,
    };

    // Remove old version if same title exists
    this.documents = this.documents.filter(d => d.title.toLowerCase() !== title.toLowerCase());
    this.documents.unshift(ragDoc);
    this.saveToStorage();

    return ragDoc;
  }

  /**
   * Search knowledge base
   */
  search(query: string, maxResults = 4): Array<{ chunk: RAGChunk; score: number }> {
    return searchKnowledgeBase(query, this.documents, maxResults, 2);
  }

  /**
   * Get formatted context prompt for Gemini
   */
  getContextForQuery(query: string): { contextPrompt: string; retrievedChunks: RAGChunk[] } {
    const matches = this.search(query, 4);
    return {
      contextPrompt: buildRAGContextPrompt(matches),
      retrievedChunks: matches.map(m => m.chunk),
    };
  }

  getAllDocuments(): RAGDocument[] {
    return [...this.documents];
  }

  removeDocument(docId: string) {
    this.documents = this.documents.filter(d => d.id !== docId);
    this.saveToStorage();
  }

  getTotalChunksCount(): number {
    return this.documents.reduce((acc, doc) => acc + doc.chunks.length, 0);
  }
}

export const ragService = new RAGService();
