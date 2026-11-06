/**
 * RAG (Retrieval-Augmented Generation) utility functions
 * Decoupled, pure logic functions for document chunking, tokenization,
 * similarity ranking, and context synthesis.
 */

import { RAGChunk, RAGDocument } from '../types/assistant';

/**
 * Split text into semantic overlapping chunks
 */
export function chunkText(
  text: string,
  maxChunkChars = 600,
  overlapChars = 120
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (cleaned.length <= maxChunkChars) {
    return [cleaned];
  }

  const paragraphs = cleaned.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (currentChunk.length + trimmedPara.length + 2 <= maxChunkChars) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedPara}` : trimmedPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // keep overlap from end of current chunk
        const overlap = currentChunk.slice(Math.max(0, currentChunk.length - overlapChars));
        currentChunk = `${overlap}\n\n${trimmedPara}`;
      } else {
        // paragraph itself is bigger than maxChunkChars; split by sentences or hard break
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trimmedPara];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= maxChunkChars) {
            currentChunk = currentChunk ? `${currentChunk} ${sentence.trim()}` : sentence.trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence.trim();
          }
        }
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Extract salient keywords from text for lightweight keyword indexing
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
    'with', 'this', 'these', 'those', 'they', 'we', 'you', 'your', 'my', 'our', 'or',
    'about', 'above', 'after', 'again', 'against', 'all', 'am', 'any', 'before', 'being'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const frequencyMap = new Map<string, number>();
  for (const word of words) {
    frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
  }

  return Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(entry => entry[0]);
}

/**
 * Score relevance between a query and a RAG chunk using hybrid token match & position weighting
 */
export function scoreChunkRelevance(query: string, chunk: RAGChunk): number {
  if (!query || !chunk || !chunk.text) return 0;

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  if (queryTerms.length === 0) return 0;

  const chunkLower = chunk.text.toLowerCase();
  const titleLower = chunk.docTitle.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    // exact phrase bonus
    if (chunkLower.includes(query.toLowerCase())) {
      score += 15;
    }

    // doc title bonus
    if (titleLower.includes(term)) {
      score += 8;
    }

    // keyword match
    if (chunk.keywords.includes(term)) {
      score += 5;
    }

    // body frequency
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = chunkLower.match(regex);
    if (matches) {
      score += Math.min(matches.length * 3, 12);
    } else if (chunkLower.includes(term)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Retrieve top matching chunks across an array of documents
 */
export function searchKnowledgeBase(
  query: string,
  documents: RAGDocument[],
  maxResults = 4,
  minScore = 2
): Array<{ chunk: RAGChunk; score: number }> {
  const results: Array<{ chunk: RAGChunk; score: number }> = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const score = scoreChunkRelevance(query, chunk);
      if (score >= minScore) {
        results.push({ chunk, score });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

/**
 * Format retrieved chunks into a prompt context section
 */
export function buildRAGContextPrompt(
  retrieved: Array<{ chunk: RAGChunk; score: number }>
): string {
  if (retrieved.length === 0) {
    return '';
  }

  let prompt = '### RELEVANT RETRIEVED DOCUMENTS (RAG KNOWLEDGE BASE):\n';
  retrieved.forEach((item, idx) => {
    prompt += `[Source ${idx + 1}: ${item.chunk.docTitle} (Chunk #${item.chunk.chunkIndex + 1})]\n${item.chunk.text}\n\n`;
  });
  prompt += 'Use the above sources to accurately answer the question. Cite document names when referencing specific facts.\n';
  return prompt;
}
