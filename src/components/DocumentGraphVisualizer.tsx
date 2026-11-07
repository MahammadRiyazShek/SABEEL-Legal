/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Network,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Shield,
  FileText,
  MapPin,
  Scale,
  Sparkles,
  Link as LinkIcon,
  Zap,
  ChevronRight,
  Share2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Database,
  RefreshCw,
  Eye,
  Info,
  Maximize2
} from 'lucide-react';
import {
  LegalDocumentNode,
  GraphEdge,
  InterconnectionType,
  InterconnectionNetwork,
  buildDocumentGraph,
  findInterconnectionPath,
  generateLargeInterconnectedCorpus
} from '../utils/documentGraph.ts';

interface DocumentGraphVisualizerProps {
  onSendToWhatsApp?: (text: string) => void;
  dialect?: 'hyderabadi_roman_urdu' | 'english';
}

export default function DocumentGraphVisualizer({
  onSendToWhatsApp,
  dialect = 'hyderabadi_roman_urdu',
}: DocumentGraphVisualizerProps) {
  const [corpusScale, setCorpusScale] = useState<'standard' | 'large'>('large');
  const [loading, setLoading] = useState<boolean>(false);
  const [documents, setDocuments] = useState<LegalDocumentNode[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selection & Path Finding
  const [selectedNodeId, setSelectedNodeId] = useState<string>('doc-sham-626');
  const [pathSourceId, setPathSourceId] = useState<string>('doc-rdo-b184');
  const [pathTargetId, setPathTargetId] = useState<string>('doc-sham-142');
  const [activeTab, setActiveTab] = useState<'graph' | 'path_finder' | 'title_chain'>('graph');

  // Load documents corpus
  useEffect(() => {
    setLoading(true);
    // Generate large corpus of 1,050 documents or 12 base documents
    const count = corpusScale === 'large' ? 1050 : 15;
    const generated = generateLargeInterconnectedCorpus(count);
    setDocuments(generated);
    setLoading(false);
  }, [corpusScale]);

  // Build the network graph
  const network = useMemo(() => {
    // For visual performance in the canvas, display top 60-80 clustered documents based on filter
    let filtered = documents;
    if (selectedVillage !== 'all') {
      filtered = filtered.filter(d => d.village.toLowerCase() === selectedVillage.toLowerCase());
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(d => d.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        d =>
          d.title.toLowerCase().includes(q) ||
          d.surveyNumber.toLowerCase().includes(q) ||
          d.uniqueTag.toLowerCase().includes(q) ||
          (d.pdfFileName && d.pdfFileName.toLowerCase().includes(q))
      );
    }

    // Always include key anchor documents
    const anchorIds = ['doc-rdo-b184', 'doc-sham-626', 'doc-sham-brief', 'doc-pedda-brief', 'doc-sham-142', 'doc-moin-88'];
    const anchorDocs = documents.filter(d => anchorIds.includes(d.id));
    const combined = Array.from(new Set([...anchorDocs, ...filtered.slice(0, 75)]));

    return buildDocumentGraph(combined);
  }, [documents, selectedVillage, selectedCategory, searchQuery]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    return documents.find(d => d.id === selectedNodeId) || network.nodes[0] || null;
  }, [documents, selectedNodeId, network.nodes]);

  // Direct Connections to Selected Node
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return network.edges.filter(
      e => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [network.edges, selectedNode]);

  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const neighborIds = new Set<string>();
    connectedEdges.forEach(e => {
      neighborIds.add(e.source === selectedNode.id ? e.target : e.source);
    });
    return documents.filter(d => neighborIds.has(d.id));
  }, [connectedEdges, selectedNode, documents]);

  // Multi-Hop Path Calculation
  const computedPath = useMemo(() => {
    if (!pathSourceId || !pathTargetId) return null;
    return findInterconnectionPath(pathSourceId, pathTargetId, network);
  }, [pathSourceId, pathTargetId, network]);

  // Synthesize Interconnection Narrative
  const interconnectionSynthesis = useMemo(() => {
    if (!selectedNode) return '';
    const neighborsCount = connectedNodes.length;
    const sameSurvey = connectedNodes.filter(n => n.surveyNumber.split('/')[0] === selectedNode.surveyNumber.split('/')[0]);
    const courtOrders = connectedNodes.filter(n => n.category === 'Court H.C.' || n.category === 'Court L.C.');
    const revenueDocs = connectedNodes.filter(n => n.category === 'Revenue' || n.category === 'RDO');

    if (dialect === 'hyderabadi_roman_urdu') {
      return `Vakil Sahab, '${selectedNode.title}' ${neighborsCount} dusre documents se gehra juda hua hai:
1. Survey Number ${selectedNode.surveyNumber} (${selectedNode.village}): Is parcel pe ${sameSurvey.length} purane pahanis aur sale deeds verified hain.
2. Judicial Links: Isme ${courtOrders.length} court orders (High Court/Civil Judge) Status Quo aur Injunction orders direct apply hote hain.
3. Revenue Department: RDO Rajendranagar aur Tahsildar ki ${revenueDocs.length} proceedings se boundary chain complete hoti hai.`;
    }
    return `Analysis of "${selectedNode.title}":
Interconnected with ${neighborsCount} total legal documents across ${selectedNode.village}.
- Land Record Integrity: ${sameSurvey.length} instruments tied directly to Survey ${selectedNode.surveyNumber}.
- Judicial Precedents: ${courtOrders.length} active stay/injunction orders impact this file.
- Chain of Custody: Seamless evidentiary trail between Revenue ROR registers and Court petitions.`;
  }, [selectedNode, connectedNodes, dialect]);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Court H.C.':
        return 'border-amber-500 bg-amber-500/10 text-amber-300';
      case 'Court L.C.':
        return 'border-orange-500 bg-orange-500/10 text-orange-300';
      case 'Revenue':
        return 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
      case 'RDO':
        return 'border-indigo-500 bg-indigo-500/10 text-indigo-300';
      case 'HMDA':
        return 'border-cyan-500 bg-cyan-500/10 text-cyan-300';
      case 'Police':
        return 'border-rose-500 bg-rose-500/10 text-rose-300';
      default:
        return 'border-slate-500 bg-slate-500/10 text-slate-300';
    }
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'Court H.C.':
        return 'bg-amber-900/60 text-amber-300 border-amber-600/60';
      case 'Court L.C.':
        return 'bg-orange-900/60 text-orange-300 border-orange-600/60';
      case 'Revenue':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-600/60';
      case 'RDO':
        return 'bg-indigo-900/60 text-indigo-300 border-indigo-600/60';
      case 'HMDA':
        return 'bg-cyan-900/60 text-cyan-300 border-cyan-600/60';
      case 'Police':
        return 'bg-rose-900/60 text-rose-300 border-rose-600/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner with Scale Metrics */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-800/50 rounded-2xl p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Network className="w-4 h-4 animate-pulse" />
            Cross-Document Interconnection Engine & Knowledge Graph
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1 flex items-center gap-2">
            Research Across 1,000+ Interconnected Legal Documents
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Understand how land records, High Court stays, RDO petitions (<code className="text-indigo-300">B-184-2026 letter to RDO.pdf</code>), survey demarcations (<code className="text-emerald-300">Shamshabad 626.pdf</code>), and village briefs connect across survey numbers, parties, and title chains.
          </p>
        </div>

        {/* Scale Toggle & Statistics Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 flex items-center text-xs">
            <button
              onClick={() => setCorpusScale('standard')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                corpusScale === 'standard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Core Vault (15 Docs)
            </button>
            <button
              onClick={() => setCorpusScale('large')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                corpusScale === 'large' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              1,050+ Documents Scale
            </button>
          </div>

          <div className="bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>{documents.length} Records Indexed</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, and Graph Mode Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Tab Switcher */}
          <div className="bg-slate-800 border border-slate-700 p-0.5 rounded-xl flex items-center">
            <button
              onClick={() => setActiveTab('graph')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Network Visualizer
            </button>
            <button
              onClick={() => setActiveTab('path_finder')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'path_finder' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Multi-Hop Path Finder
            </button>
            <button
              onClick={() => setActiveTab('title_chain')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'title_chain' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Chain of Title Timeline
            </button>
          </div>

          {/* Village Filter */}
          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Villages (6)</option>
            <option value="Shamshabad">Shamshabad (Sy 626, 142)</option>
            <option value="Peddashahpur">Peddashahpur (Sy 45)</option>
            <option value="Moinabad">Moinabad (Sy 88)</option>
            <option value="Rajendranagar">Rajendranagar (Sy 204)</option>
            <option value="Chevella">Chevella (Sy 71)</option>
            <option value="Maheshwaram">Maheshwaram (Sy 115)</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="Revenue">Revenue & Dharani</option>
            <option value="Court H.C.">Court H.C. (High Court)</option>
            <option value="RDO">RDO Revenue Appeal</option>
            <option value="Court L.C.">Court L.C. (District Court)</option>
            <option value="HMDA">HMDA Planning</option>
            <option value="Police">Police FIR</option>
          </select>
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Sy No (626, 142), tag, RDO letter..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Grid: Interactive Network Canvas / Path Finder + Detail Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Visual Canvas or Path Explorer */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {activeTab === 'graph' && (
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">Interactive Document Node Map</span>
                  <span className="text-slate-400">({network.nodes.length} nodes, {network.edges.length} linkages displayed)</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> RDO
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Revenue
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> High Court
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Police
                  </span>
                </div>
              </div>

              {/* Node Graph Grid Representation */}
              <div className="flex-1 min-h-[460px] max-h-[560px] overflow-y-auto p-4 bg-[#0a0f16] rounded-xl border border-slate-800/80 my-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {network.nodes.map((node) => {
                    const isSelected = node.id === selectedNode?.id;
                    const isConnected = connectedNodes.some(n => n.id === node.id);

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500/50 shadow-lg scale-[1.02]'
                            : isConnected
                            ? 'bg-slate-800/90 border-indigo-700/60 hover:border-indigo-500'
                            : 'bg-slate-850/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getCategoryBadgeColor(node.category)}`}>
                            {node.category}
                          </span>
                          <span className="text-[10px] font-mono text-indigo-400 truncate max-w-[100px]">
                            {node.uniqueTag}
                          </span>
                        </div>

                        <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 mb-1.5">
                          {node.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            {node.village}
                          </span>
                          <span className="font-mono text-amber-300">Sy.No {node.surveyNumber}</span>
                        </div>

                        {node.pdfFileName && (
                          <div className="mt-2 text-[10px] font-mono bg-black/40 text-slate-300 px-2 py-1 rounded border border-slate-800 flex items-center justify-between">
                            <span className="truncate">{node.pdfFileName}</span>
                            <span className="text-slate-500 shrink-0 ml-1">{node.fileSize || 'PDF'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Graph Footer Explanation */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Click any document card to highlight all <strong>interconnected revenue deeds, court stays, and RDO petitions</strong>.
                  </span>
                </div>
                <button
                  onClick={() => {
                    const text = interconnectionSynthesis;
                    if (onSendToWhatsApp) onSendToWhatsApp(text);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ml-3"
                >
                  <Share2 className="w-3 h-3" />
                  Send Analysis to WhatsApp
                </button>
              </div>
            </div>
          )}

          {activeTab === 'path_finder' && (
            <div className="p-5 flex-1 flex flex-col space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                  Multi-Hop Interconnection Path Finder
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Discover how Document A links to Document B through shared survey parcels, title chains, and court stays across 1,000+ files.
                </p>
              </div>

              {/* Source and Target Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Starting Document A:</label>
                  <select
                    value={pathSourceId}
                    onChange={(e) => setPathSourceId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {documents.slice(0, 25).map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.category}] {d.title} (Sy {d.surveyNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target Document B:</label>
                  <select
                    value={pathTargetId}
                    onChange={(e) => setPathTargetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {documents.slice(0, 25).map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.category}] {d.title} (Sy {d.surveyNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Computed Path View */}
              <div className="flex-1 bg-[#0a0f16] p-4 rounded-xl border border-slate-800 min-h-[300px]">
                {computedPath ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <CheckCircle className="w-4 h-4" />
                      Interconnection Verified: {computedPath.path.length} Documents Linked Across {computedPath.edges.length} Legal Relationships
                    </div>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-600/60">
                      {computedPath.path.map((node, idx) => {
                        const edgeBefore = idx > 0 ? computedPath.edges[idx - 1] : null;

                        return (
                          <div key={node.id} className="relative">
                            <span className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-4 ring-[#0a0f16]">
                              {idx + 1}
                            </span>

                            {edgeBefore && (
                              <div className="mb-2 -mt-3 text-[11px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-md inline-block">
                                🔗 {edgeBefore.label}: {edgeBefore.explanation}
                              </div>
                            )}

                            <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-700/80">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${getCategoryBadgeColor(node.category)}`}>
                                  {node.category}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{node.date}</span>
                              </div>
                              <h4 className="text-sm font-semibold text-slate-100">{node.title}</h4>
                              <p className="text-xs text-slate-400 mt-1">{node.summary}</p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                                <span>Village: <strong className="text-slate-300">{node.village}</strong></span>
                                <span>Survey: <strong className="text-amber-300">Sy.No {node.surveyNumber}</strong></span>
                                <span>Tag: <strong className="text-indigo-300">{node.uniqueTag}</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-12">
                    <Network className="w-8 h-8 mb-2 opacity-50" />
                    Select two documents above to calculate the legal chain connecting them.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'title_chain' && (
            <div className="p-5 flex-1 flex flex-col space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  Chain of Title & Proceeding Timeline (1954 to 2026)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Chronological progression of Survey No. 626 & 142/A Shamshabad from Revenue records to High Court Injunction.
                </p>
              </div>

              <div className="flex-1 bg-[#0a0f16] p-4 rounded-xl border border-slate-800 space-y-4 overflow-y-auto max-h-[460px]">
                {[
                  {
                    year: '1954-55',
                    type: 'Khasra Pahani (Revenue)',
                    title: 'Original Khasra Pahani - Sy.No 626 & 142 Shamshabad',
                    desc: 'Recorded under Hyderabad Land Revenue Act 1317 Fasli showing continuous agricultural possession.',
                    badge: 'bg-emerald-950 text-emerald-300 border-emerald-700',
                  },
                  {
                    year: '1971',
                    type: 'Faisal Patti (Revenue)',
                    title: 'Faisal Patti & Sesala Pahani Division Entry',
                    desc: 'Subdivision recorded confirming Ac. 6.20 Guntas with boundary stones fixed.',
                    badge: 'bg-emerald-950 text-emerald-300 border-emerald-700',
                  },
                  {
                    year: '1995',
                    type: 'Registered Sale Deed',
                    title: 'Registered Sale Deed Doc No. 412/1995 - SRO Shamshabad',
                    desc: 'Absolute conveyance of title with registered boundaries and consideration paid.',
                    badge: 'bg-indigo-950 text-indigo-300 border-indigo-700',
                  },
                  {
                    year: '2020',
                    type: 'Dharani Digital Passbook',
                    title: 'Dharani Portal ROR Mutation & E-Passbook',
                    desc: 'Issuance of digitally signed Pattadar Passbook with biometric thumb impression lock.',
                    badge: 'bg-cyan-950 text-cyan-300 border-cyan-700',
                  },
                  {
                    year: '2026 (Oct 18)',
                    type: 'RDO Appeal (B-184-2026)',
                    title: 'B-184-2026 letter to RDO - Stay & Enquiry Application.pdf',
                    desc: 'Statutory revision petition filed by Adv. M.A. Riyaz before RDO Rajendranagar division.',
                    badge: 'bg-indigo-950 text-indigo-300 border-indigo-700',
                  },
                  {
                    year: '2026 (Oct 28)',
                    type: 'High Court Status Quo',
                    title: 'High Court Interim Injunction Order - WP 18942/2026',
                    desc: 'Hon\'ble Justice K. Lakshman directs status quo. Next Date of Hearing 14.11.2026 (Court Hall 04, Item 14).',
                    badge: 'bg-amber-950 text-amber-300 border-amber-700',
                  },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-3 bg-slate-850/80 rounded-xl border border-slate-800">
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-xs font-mono font-bold text-slate-300">{step.year}</span>
                      <span className="block text-[10px] text-slate-500 uppercase">{step.type}</span>
                    </div>
                    <div className="w-1.5 h-full bg-indigo-500/50 rounded-full shrink-0"></div>
                    <div className="flex-1">
                      <h4 className="text-xs font-semibold text-white">{step.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Selected Node Deep Interconnection Inspector */}
        <div className="lg:col-span-4 space-y-4">
          {selectedNode ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${getCategoryBadgeColor(selectedNode.category)}`}>
                  {selectedNode.category}
                </span>
                <span className="text-xs font-mono text-indigo-400 font-semibold">
                  {selectedNode.uniqueTag}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {selectedNode.title}
                </h3>
                {selectedNode.pdfFileName && (
                  <div className="mt-2 text-xs font-mono bg-black/50 text-emerald-300 p-2 rounded-lg border border-emerald-900/60 flex items-center justify-between">
                    <span className="truncate">{selectedNode.pdfFileName}</span>
                    <span className="text-slate-400 shrink-0 ml-1">{selectedNode.fileSize}</span>
                  </div>
                )}
              </div>

              {/* Key Land & Case Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Village / Mandal</span>
                  <strong className="text-slate-200">{selectedNode.village}</strong>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Survey Number</span>
                  <strong className="text-amber-400">Sy.No {selectedNode.surveyNumber}</strong>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Execution Date</span>
                  <strong className="text-slate-200">{selectedNode.date}</strong>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Assigned Advocate</span>
                  <strong className="text-slate-200">{selectedNode.assignedLawyer}</strong>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-1">Document Synopsis:</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  {selectedNode.summary}
                </p>
              </div>

              {/* Interconnection Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Directly Interconnected Documents ({connectedNodes.length})
                  </h4>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {connectedNodes.length > 0 ? (
                    connectedNodes.map((neighbor) => {
                      const edge = connectedEdges.find(
                        e => (e.source === neighbor.id && e.target === selectedNode.id) ||
                             (e.target === neighbor.id && e.source === selectedNode.id)
                      );

                      return (
                        <div
                          key={neighbor.id}
                          onClick={() => setSelectedNodeId(neighbor.id)}
                          className="bg-slate-800/70 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-700/80 cursor-pointer transition text-xs"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-slate-200 truncate">{neighbor.title}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                          {edge && (
                            <span className="text-[10px] font-mono text-emerald-400 block">
                              🔗 {edge.label}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{neighbor.village}</span>
                            <span>•</span>
                            <span className="text-amber-400">Sy {neighbor.surveyNumber}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-slate-500 py-4 text-center">
                      No direct 1-hop connections in this filtered view.
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp Action Button */}
              <button
                onClick={() => {
                  const text = interconnectionSynthesis;
                  if (onSendToWhatsApp) onSendToWhatsApp(text);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Share2 className="w-4 h-4" />
                Push Interconnection Report to WhatsApp
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs">
              Select a document to inspect its relationships.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
