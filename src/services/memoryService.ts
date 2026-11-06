/**
 * Long-Term Conversational Memory Service
 */

import { MemoryItem } from '../types/assistant';
import {
  extractMemoryCandidates,
  upsertMemory,
  getRelevantMemories,
  buildMemoryPromptSection,
} from '../utils/memory';

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_init_1',
    category: 'instruction',
    key: 'auto_file_organization',
    value: 'Always categorize uploaded documents into appropriate Drive subfolders (Financial, Legal, Reports, Personal)',
    confidence: 1.0,
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z',
  },
  {
    id: 'mem_init_2',
    category: 'preference',
    key: 'response_style',
    value: 'Keep WhatsApp messages clean and structured with emojis, bold headers, and key actionable bullet points',
    confidence: 0.95,
    createdAt: '2026-10-12T09:00:00Z',
    updatedAt: '2026-10-12T09:00:00Z',
  },
  {
    id: 'mem_init_3',
    category: 'fact',
    key: 'user_organization',
    value: 'Apex AI Solutions / TechVentures',
    confidence: 0.9,
    createdAt: '2026-10-14T15:30:00Z',
    updatedAt: '2026-10-14T15:30:00Z',
  },
];

class MemoryService {
  private memories: MemoryItem[] = [];

  constructor() {
    this.loadMemories();
  }

  private loadMemories() {
    try {
      const stored = localStorage.getItem('assistant_long_term_memories');
      if (stored) {
        this.memories = JSON.parse(stored);
      } else {
        this.memories = [...INITIAL_MEMORIES];
        this.saveMemories();
      }
    } catch {
      this.memories = [...INITIAL_MEMORIES];
    }
  }

  private saveMemories() {
    try {
      localStorage.setItem('assistant_long_term_memories', JSON.stringify(this.memories));
    } catch {
      // storage quota or SSR
    }
  }

  /**
   * Process message for potential long-term memory updates
   */
  processMessage(text: string, messageId?: string): MemoryItem[] {
    const candidates = extractMemoryCandidates(text);
    const addedOrUpdated: MemoryItem[] = [];

    for (const cand of candidates) {
      this.memories = upsertMemory(this.memories, {
        category: cand.category,
        key: cand.key,
        value: cand.value,
        confidence: 0.88,
        sourceMessageId: messageId,
      });
      const match = this.memories.find(m => m.category === cand.category && m.key === cand.key);
      if (match) addedOrUpdated.push(match);
    }

    if (candidates.length > 0) {
      this.saveMemories();
    }

    return addedOrUpdated;
  }

  getMemoriesForQuery(query: string, maxCount = 5): { promptSection: string; items: MemoryItem[] } {
    const items = getRelevantMemories(query, this.memories, maxCount);
    return {
      promptSection: buildMemoryPromptSection(items),
      items,
    };
  }

  getAllMemories(): MemoryItem[] {
    return [...this.memories];
  }

  addMemory(category: MemoryItem['category'], key: string, value: string): MemoryItem {
    this.memories = upsertMemory(this.memories, {
      category,
      key,
      value,
      confidence: 1.0,
    });
    this.saveMemories();
    return this.memories[0];
  }

  deleteMemory(id: string) {
    this.memories = this.memories.filter(m => m.id !== id);
    this.saveMemories();
  }

  clearAll() {
    this.memories = [];
    this.saveMemories();
  }
}

export const memoryService = new MemoryService();
