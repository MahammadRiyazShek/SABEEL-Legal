import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  FileText,
  BookOpen,
  MapPin,
  CheckCircle,
  Copy,
  Download,
  Send,
  Building,
  Shield,
  Scale,
  Newspaper,
  Layers,
  ArrowRight,
  AlertTriangle,
  GitCompare,
  Clock,
  CheckSquare,
  Square,
  FileSearch,
  Flame,
  FileCheck2,
  Network
} from 'lucide-react';

interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  village?: string;
  surveyNumbers?: string[];
  category: string;
  text: string;
  score?: number;
}

interface NewsItem {
  title: string;
  source: string;
  date: string;
  category: string;
  snippet: string;
}

interface DocumentConflict {
  surveyNumber: string;
  village: string;
  conflictType: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  conflictingDocTitles: string[];
  recommendation: string;
}

interface LegalDocument {
  id: string;
  title: string;
  category: string;
  village: string;
  surveyNumber: string;
  uniqueTag: string;
  date: string;
  nextHearingDate?: string;
  caseNumber?: string;
  assignedLawyer: string;
  content: string;
}

interface RagBriefStudioProps {
  initialDoc?: any;
  onNavigateToTab?: (tab: string) => void;
}

export const RagBriefStudio: React.FC<RagBriefStudioProps> = ({ initialDoc, onNavigateToTab }) => {
  const [researchMode, setResearchMode] = useState<'deep_study' | 'qa' | 'brief' | 'application' | 'conflicts'>('deep_study');
  const [query, setQuery] = useState(
    initialDoc
      ? `Compare High Court orders and Tahsildar revenue mutation records for ${initialDoc.village} Sy No ${initialDoc.surveyNumber}`
      : 'Conduct an in-depth cross-document research study comparing High Court orders, Dharani mutation proceedings, and police reports.'
  );
  const [villageFilter, setVillageFilter] = useState(initialDoc?.village || '');
  const [syFilter, setSyFilter] = useState(initialDoc?.surveyNumber || '');
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<DocumentChunk[]>([]);
  const [synthesis, setSynthesis] = useState<string>('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [conflicts, setConflicts] = useState<DocumentConflict[]>([]);
  const [vaultDocs, setVaultDocs] = useState<LegalDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch legal news
    fetch('/api/news')
      .then((r) => r.json())
      .then((d) => d.news && setNews(d.news))
      .catch((e) => console.error(e));

    // Fetch documents vault for multi-doc selector
    fetch('/api/documents')
      .then((r) => r.json())
      .then((d) => {
        if (d.documents) {
          setVaultDocs(d.documents);
          setSelectedDocIds(d.documents.slice(0, 3).map((doc: any) => doc.id));
        }
      })
      .catch((e) => console.error(e));

    // Fetch conflicts
    fetch('/api/conflicts')
      .then((r) => r.json())
      .then((d) => d.conflicts && setConflicts(d.conflicts))
      .catch((e) => console.error(e));
  }, []);

  const toggleDocSelection = (id: string) => {
    if (selectedDocIds.includes(id)) {
      setSelectedDocIds(selectedDocIds.filter((d) => d !== id));
    } else {
      setSelectedDocIds([...selectedDocIds, id]);
    }
  };

  const handleExecuteResearch = async (customMode?: typeof researchMode) => {
    const activeMode = customMode || researchMode;
    setLoading(true);

    try {
      if (activeMode === 'deep_study' || activeMode === 'conflicts') {
        const res = await fetch('/api/research/deep-study', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: selectedDocIds,
            village: villageFilter,
            surveyNumber: syFilter,
            researchMode: activeMode === 'conflicts' ? 'Conflict & Discrepancy Audit' : 'Cross-Document Comparative Synthesis',
            customPrompt: query,
          }),
        });
        const data = await res.json();
        if (data.report) setSynthesis(data.report);
        if (data.conflicts) setConflicts(data.conflicts);

        // Also fetch Pinecone citations
        const ragRes = await fetch('/api/documents/rag-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            village: villageFilter,
            surveyNumber: syFilter,
          }),
        });
        const ragData = await ragRes.json();
        if (ragData.citations) setCitations(ragData.citations);
      } else {
        const res = await fetch('/api/documents/rag-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            village: villageFilter,
            surveyNumber: syFilter,
            prepareBriefType: activeMode,
          }),
        });
        const data = await res.json();
        if (data.citations) setCitations(data.citations);
        if (data.synthesis) setSynthesis(data.synthesis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-900/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Phase 2: Pinecone Vector Index & Cross-Document Research Engine
          </div>
          <h2 className="text-xl font-bold text-white">AI Deep Research Within Stored Legal Documents</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Performs multi-document comparative synthesis, audits cross-document inconsistencies (area mismatches, boundary disputes, title gaps), and produces court-ready briefs and applications.
          </p>
        </div>

        {/* Research Modes */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setResearchMode('deep_study');
              handleExecuteResearch('deep_study');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              researchMode === 'deep_study'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Multi-Doc Study
          </button>
          <button
            onClick={() => {
              setResearchMode('conflicts');
              handleExecuteResearch('conflicts');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              researchMode === 'conflicts'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Discrepancy Audit
          </button>
          <button
            onClick={() => {
              setResearchMode('brief');
              handleExecuteResearch('brief');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              researchMode === 'brief'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Case Brief
          </button>
          <button
            onClick={() => {
              setResearchMode('application');
              handleExecuteResearch('application');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              researchMode === 'application'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Dept Application
          </button>
          <button
            onClick={() => onNavigateToTab?.('graph')}
            className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/70 text-indigo-300 px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            1,000+ Doc Knowledge Graph
          </button>
        </div>
      </div>

      {/* Multi-Document Scope Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-200">
              Select Documents for Cross-Analysis ({selectedDocIds.length} of {vaultDocs.length} selected):
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setSelectedDocIds(vaultDocs.map((d) => d.id))}
              className="text-[11px] text-emerald-400 hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => setSelectedDocIds([])}
              className="text-[11px] text-slate-400 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {vaultDocs.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => toggleDocSelection(doc.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 whitespace-nowrap transition shrink-0 ${
                  isSelected
                    ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                <span className="font-mono text-[10px]">#{doc.uniqueTag}</span>
                <span className="text-[11px] truncate max-w-[140px]">{doc.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Bar & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteResearch()}
              placeholder="Ask anything across documents: title chain, boundaries, conflicting clauses, next dates..."
              className="w-full bg-slate-950 text-slate-100 text-xs sm:text-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              placeholder="Village (optional)"
              className="w-28 bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={syFilter}
              onChange={(e) => setSyFilter(e.target.value)}
              placeholder="Sy No (e.g. 142)"
              className="w-24 bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              onClick={() => handleExecuteResearch()}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition shrink-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Researching...' : 'Deep Analyze'}
            </button>
          </div>
        </div>

        {/* Quick query tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
          <span className="text-[11px] font-medium text-slate-500">Quick Deep Inquiries:</span>
          {[
            'Audit Sy No 142 Shamshabad: Status Quo order vs boundary interference',
            'Cross-check Moinabad Sy No 88 Tahsildar passbook with Khasra Pahani',
            'Chronology of events across all High Court & Lower Court suits',
            'Identify conflicting survey demarcations and adverse claims',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(prompt);
                handleExecuteResearch();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Vector Chunks & Conflicts on Left, AI Deep Research Output on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Conflicts Matrix + Pinecone Vector Chunks */}
        <div className="lg:col-span-1 space-y-4">
          {/* Conflicts & Discrepancies Card */}
          {conflicts.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Detected Cross-Doc Conflicts ({conflicts.length})
                </h4>
                <span className="text-[10px] bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded font-mono">
                  High Attention
                </span>
              </div>

              <div className="space-y-2">
                {conflicts.map((c, i) => (
                  <div key={i} className="bg-black/40 border border-amber-900/60 p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-amber-300">
                        {c.village} • Sy.No {c.surveyNumber}
                      </span>
                      <span className="bg-red-950 text-red-300 px-1.5 py-0.2 rounded font-semibold uppercase">
                        {c.conflictType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{c.description}</p>
                    <div className="text-[10px] text-amber-400 bg-amber-950/40 p-1.5 rounded">
                      <strong>Rec:</strong> {c.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pinecone Vector Chunks */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-emerald-400" />
                Pinecone Vector Chunks (Top-K)
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">Cosine Sim</span>
            </div>

            <div className="space-y-2.5">
              {citations.length > 0 ? (
                citations.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs shadow-sm hover:border-emerald-500/50 transition"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/60">
                        Citation #{idx + 1}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-mono">
                        Sim: {c.score || 0.94}
                      </span>
                    </div>

                    <h5 className="font-semibold text-slate-200 text-xs mb-1 truncate">{c.documentTitle}</h5>

                    <p className="text-slate-400 text-[10px] leading-relaxed line-clamp-3 bg-black/40 p-2 rounded border border-slate-800/60 font-mono">
                      "{c.text}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Run deep analyze above to inspect semantic chunk retrieval.
                </div>
              )}
            </div>
          </div>

          {/* Real-time Land & High Court News Radar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                Live Land & Court Feed
              </h4>
              <span className="text-[10px] text-emerald-400 animate-pulse">Live</span>
            </div>

            <div className="space-y-2 text-xs">
              {news.map((n, idx) => (
                <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-[9px] font-semibold uppercase text-amber-400 bg-amber-950/60 px-1 py-0.5 rounded">
                    {n.category}
                  </span>
                  <h6 className="font-medium text-slate-200 text-xs mt-1 mb-0.5 leading-snug">{n.title}</h6>
                  <p className="text-slate-400 text-[10px] line-clamp-2">{n.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Deep Research / Synthesis Output */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  {researchMode === 'deep_study'
                    ? 'Cross-Document Synthesis & Title Analysis'
                    : researchMode === 'conflicts'
                    ? 'Inconsistency & Risk Audit'
                    : researchMode === 'brief'
                    ? 'Court Legal Brief'
                    : 'Departmental Representation Draft'}
                </h3>
              </div>

              {synthesis && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('whatsapp')}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Send className="w-3 h-3" />
                    Send to WhatsApp
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-12 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300">
                  Cross-referencing {selectedDocIds.length} documents, auditing title chain, and computing vector citations...
                </p>
              </div>
            ) : synthesis ? (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans space-y-2 select-text">
                {synthesis}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800/80 p-8 rounded-xl text-center text-slate-500 text-xs space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-600" />
                <p>Click "Deep Analyze" or select one of the quick inquiries above to research across all stored documents.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
