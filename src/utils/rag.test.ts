import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkText,
  extractKeywords,
  scoreChunkRelevance,
  searchKnowledgeBase,
  buildRAGContextPrompt,
} from './rag';
import { RAGDocument, RAGChunk } from '../types/assistant';

test('chunkText splits text within bounds and preserves content', () => {
  const shortText = 'Hello world, this is a quick note.';
  const shortChunks = chunkText(shortText, 200);
  assert.equal(shortChunks.length, 1);
  assert.equal(shortChunks[0], shortText);

  const longParagraphs = [
    'Paragraph 1: Google Drive integration allows storing documents safely in cloud folders.',
    'Paragraph 2: RAG retrieval-augmented generation breaks large documents into semantic chunks.',
    'Paragraph 3: WhatsApp webhook interfaces receive messages and process automated responses.',
    'Paragraph 4: Long term memory preserves user instructions, deadlines, and preferences.',
  ].join('\n\n');

  const chunks = chunkText(longParagraphs, 150, 40);
  assert.ok(chunks.length > 1, 'Should create multiple chunks for long multi-paragraph text');
  assert.ok(chunks[0].includes('Paragraph 1'));
});

test('extractKeywords filters stopwords and returns top terms', () => {
  const sample = 'Google Drive Google Drive documents contract invoice contract report budget';
  const keywords = extractKeywords(sample);
  assert.ok(keywords.includes('google'));
  assert.ok(keywords.includes('drive'));
  assert.ok(keywords.includes('contract'));
  assert.ok(!keywords.includes('the'));
});

test('scoreChunkRelevance scores matching queries higher', () => {
  const chunk: RAGChunk = {
    id: 'c1',
    docId: 'd1',
    docTitle: 'Q3 Financial Report 2026.pdf',
    chunkIndex: 0,
    text: 'Total revenue for Q3 reached 4.5 million dollars with net profit margin of 22 percent.',
    keywords: ['revenue', 'profit', 'financial', 'margin'],
  };

  const highMatchScore = scoreChunkRelevance('financial revenue profit', chunk);
  const unrelatedScore = scoreChunkRelevance('recipe chocolate cake', chunk);

  assert.ok(highMatchScore > unrelatedScore);
  assert.ok(highMatchScore >= 10);
  assert.equal(unrelatedScore, 0);
});

test('searchKnowledgeBase ranks most relevant chunk first', () => {
  const docs: RAGDocument[] = [
    {
      id: 'doc1',
      title: 'Employment Agreement.pdf',
      mimeType: 'application/pdf',
      category: 'Legal & Contracts',
      uploadedAt: new Date().toISOString(),
      fullText: 'Notice period is 30 days. Annual leave is 25 days.',
      chunks: [
        {
          id: 'c1',
          docId: 'doc1',
          docTitle: 'Employment Agreement.pdf',
          chunkIndex: 0,
          text: 'Notice period for termination is 30 days. Annual leave entitlement is 25 days.',
          keywords: ['notice', 'period', 'termination', 'leave'],
        },
      ],
    },
    {
      id: 'doc2',
      title: 'Server Architecture Specs.txt',
      mimeType: 'text/plain',
      category: 'Work & Reports',
      uploadedAt: new Date().toISOString(),
      fullText: 'Node.js Express backend deployed on Cloud Run container with port 3000.',
      chunks: [
        {
          id: 'c2',
          docId: 'doc2',
          docTitle: 'Server Architecture Specs.txt',
          chunkIndex: 0,
          text: 'Node.js Express backend deployed on Cloud Run container with port 3000.',
          keywords: ['server', 'cloud', 'run', 'backend'],
        },
      ],
    },
  ];

  const results = searchKnowledgeBase('notice period days leave', docs);
  assert.ok(results.length > 0);
  assert.equal(results[0].chunk.docTitle, 'Employment Agreement.pdf');

  const contextPrompt = buildRAGContextPrompt(results);
  assert.ok(contextPrompt.includes('RELEVANT RETRIEVED DOCUMENTS'));
  assert.ok(contextPrompt.includes('Employment Agreement.pdf'));
});
