/**
 * RAG Knowledge Base Component
 * Displays indexed documents, semantic chunks, and interactive test search.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  FileText,
  Sparkles,
  Layers,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { RAGDocument, RAGChunk } from '../types/assistant';
import { ragService } from '../services/ragService';

export const RAGKnowledgeBase: React.FC = () => {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<RAGDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ chunk: RAGChunk; score: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = () => {
    const docs = ragService.getAllDocuments();
    setDocuments(docs);
    if (docs.length > 0 && !selectedDoc) {
      setSelectedDoc(docs[0]);
    }
  };

  const handleTestSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = ragService.search(searchQuery.trim(), 5);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleReindex = () => {
    ragService.seedFromDrive();
    loadDocs();
  };

  const handleDelete = (docId: string) => {
    ragService.removeDocument(docId);
    loadDocs();
    if (selectedDoc?.id === docId) {
      setSelectedDoc(null);
    }
  };

  const totalChunks = ragService.getTotalChunksCount();

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">RAG Document Knowledge Base</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Browser-local text chunks and keyword-ranked document search. No vector database or cloud sync is configured.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-zinc-400">Indexed:</span>
            <span className="font-semibold text-white">{documents.length} Docs ({totalChunks} Chunks)</span>
          </div>

          <button
            onClick={handleReindex}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            Re-index Drive
          </button>
        </div>
      </div>

      {/* Main split view */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Document List & Test Search */}
        <div className="w-full md:w-2/5 border-r border-zinc-800 flex flex-col bg-zinc-950/70 overflow-hidden">
          {/* Test Search Input */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Test Semantic Retrieval
            </label>
            <form onSubmit={handleTestSearch} className="relative">
              <input
                type="text"
                placeholder="Ask e.g. What is the hourly rate or notice period?"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-16 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-purple-500"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] rounded bg-purple-600 hover:bg-purple-500 text-white font-medium"
              >
                Search
              </button>
            </form>
          </div>

          {/* Search results or Document list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {searchResults.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-purple-400 font-semibold mb-2">
                  <span>Search Matches ({searchResults.length})</span>
                  <button
                    onClick={() => setSearchResults([])}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Clear Results
                  </button>
                </div>
                <div className="space-y-2">
                  {searchResults.map((res, i) => (
                    <div
                      key={res.chunk.id}
                      className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium text-purple-300 mb-1">
                        <span className="truncate">{res.chunk.docTitle}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">
                          Score: {res.score}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-mono text-[11px] line-clamp-3 leading-relaxed">
                        "{res.chunk.text}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Indexed Documents ({documents.length})
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                No documents indexed yet. Upload documents via WhatsApp or Drive.
              </div>
            ) : (
              documents.map(doc => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/30 border-purple-500/50 shadow-xs'
                        : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        {doc.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                        <span>{doc.chunks.length} chunks</span>
                        <span>•</span>
                        <span>{doc.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        title="Remove from knowledge base"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Document Chunks Inspector */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">
          {selectedDoc ? (
            <div>
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-400" /> {selectedDoc.title}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-1 flex items-center gap-3">
                    <span>Category: <strong className="text-zinc-200">{selectedDoc.category}</strong></span>
                    <span>Total Chunks: <strong className="text-zinc-200">{selectedDoc.chunks.length}</strong></span>
                    <span>Indexed: <strong className="text-zinc-200">{new Date(selectedDoc.uploadedAt).toLocaleDateString()}</strong></span>
                  </div>
                </div>
              </div>

              {/* Chunks breakdown */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Semantic Chunks Breakdown
                </h4>

                {selectedDoc.chunks.map((chunk, index) => (
                  <div
                    key={chunk.id}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-purple-400 text-[11px]">
                        Chunk #{index + 1} ({chunk.text.length} chars)
                      </span>
                    </div>

                    <p className="font-mono text-zinc-300 text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 whitespace-pre-wrap leading-relaxed">
                      {chunk.text}
                    </p>

                    {chunk.keywords.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-zinc-500">Keywords:</span>
                        {chunk.keywords.map(kw => (
                          <span
                            key={kw}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              Select a document from the left to inspect its semantic chunks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
