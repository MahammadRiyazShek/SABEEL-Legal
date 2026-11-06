import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMemoryCandidates,
  upsertMemory,
  getRelevantMemories,
  buildMemoryPromptSection,
} from './memory';
import { MemoryItem } from '../types/assistant';

test('extractMemoryCandidates correctly parses explicit instructions and preferences', () => {
  const directive = 'Remember that all invoice summaries must include VAT breakdown';
  const candidates1 = extractMemoryCandidates(directive);
  assert.equal(candidates1.length, 1);
  assert.equal(candidates1[0].category, 'instruction');
  assert.ok(candidates1[0].value.includes('invoice summaries'));

  const pref = 'I prefer concise bullet points in responses';
  const candidates2 = extractMemoryCandidates(pref);
  assert.equal(candidates2.length, 1);
  assert.equal(candidates2[0].category, 'preference');
  assert.ok(candidates2[0].value.includes('concise bullet points'));

  const name = 'My name is Riyaz';
  const candidates3 = extractMemoryCandidates(name);
  assert.equal(candidates3.length, 1);
  assert.equal(candidates3[0].category, 'fact');
  assert.equal(candidates3[0].value, 'Riyaz');
});

test('upsertMemory updates existing keys or appends new ones', () => {
  const initial: MemoryItem[] = [
    {
      id: 'mem1',
      category: 'preference',
      key: 'preference',
      value: 'Short replies',
      confidence: 0.8,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  // Update existing key
  const updated = upsertMemory(initial, {
    category: 'preference',
    key: 'preference',
    value: 'Detailed reports with tables',
    confidence: 0.9,
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].value, 'Detailed reports with tables');
  assert.equal(updated[0].confidence, 0.9);

  // Add new key
  const appended = upsertMemory(updated, {
    category: 'fact',
    key: 'user_name',
    value: 'Riyaz',
    confidence: 0.95,
  });

  assert.equal(appended.length, 2);
  assert.equal(appended[0].key, 'user_name');
});

test('getRelevantMemories prioritizes query matching items', () => {
  const memories: MemoryItem[] = [
    {
      id: '1',
      category: 'preference',
      key: 'tax_format',
      value: 'Always calculate GST and VAT separately',
      confidence: 0.9,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      category: 'contact',
      key: 'accountant',
      value: 'Accountant phone is +123456789',
      confidence: 0.8,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const relevant = getRelevantMemories('calculate tax and vat on invoice', memories);
  assert.equal(relevant[0].id, '1');

  const prompt = buildMemoryPromptSection(relevant);
  assert.ok(prompt.includes('LONG-TERM USER MEMORY'));
  assert.ok(prompt.includes('GST and VAT'));
});
