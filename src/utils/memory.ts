/**
 * Long-Term Conversational Memory pure logic
 */

import { MemoryItem } from '../types/assistant';

/**
 * Heuristics to detect if a user message contains persistent preferences, facts, or instructions
 */
export function extractMemoryCandidates(messageText: string): Array<{
  category: MemoryItem['category'];
  key: string;
  value: string;
}> {
  const candidates: Array<{
    category: MemoryItem['category'];
    key: string;
    value: string;
  }> = [];

  const text = messageText.trim();

  // Pattern: "Remember that...", "Remember to...", "Always..."
  const rememberMatch = text.match(/remember\s+(?:that|to)?\s*(.+)/i);
  if (rememberMatch) {
    candidates.push({
      category: 'instruction',
      key: 'user_directive',
      value: rememberMatch[1].trim(),
    });
  }

  // Pattern: "My name is X" / "Call me X"
  const nameMatch = text.match(/(?:my name is|call me)\s+([A-Za-z0-9_\s]{2,30})/i);
  if (nameMatch) {
    candidates.push({
      category: 'fact',
      key: 'user_name',
      value: nameMatch[1].trim(),
    });
  }

  // Pattern: "My email is X"
  const emailMatch = text.match(/(?:my email is|email:?)\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    candidates.push({
      category: 'contact',
      key: 'user_email',
      value: emailMatch[1].trim(),
    });
  }

  // Pattern: "I prefer X" / "I always want X"
  const prefMatch = text.match(/i(?:\s+always)?\s+prefer\s+([^.,;]+)/i);
  if (prefMatch) {
    candidates.push({
      category: 'preference',
      key: 'preference',
      value: prefMatch[1].trim(),
    });
  }

  // Pattern: "I work at X" / "My company is X" / "My role is X"
  const workMatch = text.match(/(?:i work (?:at|as)|my company is|my role is)\s+([^.,;]+)/i);
  if (workMatch) {
    candidates.push({
      category: 'fact',
      key: 'occupation_role',
      value: workMatch[1].trim(),
    });
  }

  // Pattern: "Project X deadline is Y"
  const projectMatch = text.match(/(?:project|deadline)\s+([^.,;]+)/i);
  if (projectMatch && !rememberMatch) {
    candidates.push({
      category: 'project',
      key: 'project_note',
      value: text,
    });
  }

  return candidates;
}

/**
 * Merge or insert a new memory item into existing memories
 */
export function upsertMemory(
  existingMemories: MemoryItem[],
  newItem: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>
): MemoryItem[] {
  const now = new Date().toISOString();
  const existingIdx = existingMemories.findIndex(
    m => m.category === newItem.category && m.key.toLowerCase() === newItem.key.toLowerCase()
  );

  if (existingIdx >= 0) {
    const updated = [...existingMemories];
    updated[existingIdx] = {
      ...updated[existingIdx],
      value: newItem.value,
      confidence: Math.max(updated[existingIdx].confidence, newItem.confidence),
      updatedAt: now,
    };
    return updated;
  }

  const createdItem: MemoryItem = {
    ...newItem,
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
  };

  return [createdItem, ...existingMemories];
}

/**
 * Rank memories by relevance to current conversational query
 */
export function getRelevantMemories(
  query: string,
  memories: MemoryItem[],
  maxCount = 6
): MemoryItem[] {
  if (memories.length === 0) return [];
  if (!query) return memories.slice(0, maxCount);

  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = memories.map(mem => {
    let score = mem.confidence * 2;
    const target = `${mem.key} ${mem.value} ${mem.category}`.toLowerCase();

    for (const term of queryTerms) {
      if (target.includes(term)) {
        score += 5;
      }
    }
    return { mem, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(item => item.mem);
}

/**
 * Format memories into a system prompt injection string
 */
export function buildMemoryPromptSection(memories: MemoryItem[]): string {
  if (memories.length === 0) {
    return '';
  }

  let text = '### LONG-TERM USER MEMORY & PREFERENCES:\n';
  memories.forEach(mem => {
    text += `- [${mem.category.toUpperCase()}] ${mem.key}: "${mem.value}" (confidence: ${Math.round(mem.confidence * 100)}%)\n`;
  });
  text += 'Take these user preferences and facts into account seamlessly without repeating them unnecessarily.\n';
  return text;
}
