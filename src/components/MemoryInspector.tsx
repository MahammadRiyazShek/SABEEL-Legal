/**
 * Long-Term Conversational Memory Inspector Component
 * Allows viewing, adding, editing, and deleting user profile memories and directives.
 */

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Sparkles,
  Sliders,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { MemoryItem } from '../types/assistant';
import { memoryService } from '../services/memoryService';

export const MemoryInspector: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('preference');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = () => {
    setMemories(memoryService.getAllMemories());
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    memoryService.addMemory(newCategory, newKey.trim(), newValue.trim());
    setNewKey('');
    setNewValue('');
    setIsAddOpen(false);
    loadMemories();
  };

  const handleDelete = (id: string) => {
    memoryService.deleteMemory(id);
    loadMemories();
  };

  const filtered = memories.filter(m => {
    const matchCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.value.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Long-Term Conversational Memory</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automatically retained user directives, preferences, and organization facts across WhatsApp interactions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Memory
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-zinc-800 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'preference', 'instruction', 'fact', 'project', 'contact'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full capitalize transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-zinc-100 text-zinc-900 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search stored memories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Memory items grid */}
      <div className="p-4 sm:p-6 flex-1">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-6">
            <Brain className="w-12 h-12 text-zinc-700 mx-auto mb-3 stroke-1" />
            <h3 className="text-sm font-medium text-zinc-300">No memories in this view</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Talk to the WhatsApp assistant with "Remember that..." or add a memory directly above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(mem => (
              <div
                key={mem.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                        mem.category === 'instruction'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : mem.category === 'preference'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : mem.category === 'fact'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {mem.category}
                    </span>

                    <button
                      onClick={() => handleDelete(mem.id)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-xs font-semibold text-zinc-200 mt-2 font-mono">
                    {mem.key}
                  </div>

                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    "{mem.value}"
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <ShieldCheck className="w-3 h-3" /> {Math.round(mem.confidence * 100)}% Confidence
                  </span>
                  <span>Active in Context</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Memory Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-zinc-100">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" /> Add Long-Term Memory
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Add persistent context for DriveGenie to remember across all conversations.
            </p>

            <form onSubmit={handleAdd} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="preference">User Preference</option>
                  <option value="instruction">System / Workflow Directive</option>
                  <option value="fact">User Fact / Profile</option>
                  <option value="project">Project Note</option>
                  <option value="contact">Contact Information</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Key / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. document_formatting or company_name"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Value / Fact</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Always structure executive summaries with financial bullet points first."
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
