import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Upload,
  Search,
  Filter,
  Calendar,
  Tag,
  CheckCircle,
  ExternalLink,
  Plus,
  HardDrive,
  Eye,
  FileCheck,
  Building,
  Scale,
  Shield,
  Layers,
  Sparkles,
  MapPin,
  Clock,
  UserCheck
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  category: 'Revenue' | 'Court H.C.' | 'Court S.C.' | 'Court L.C.' | 'Police' | 'HMDA' | 'A.D.' | 'General';
  village: string;
  surveyNumber: string;
  uniqueTag: string;
  date: string;
  nextHearingDate?: string;
  caseNumber?: string;
  assignedLawyer: string;
  content: string;
  fileType: string;
  drivePath: string;
  status: 'active' | 'archived' | 'pending_verification';
}

interface DocumentVaultProps {
  onSelectDocForResearch?: (doc: LegalDocument) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ onSelectDocForResearch, onNavigateToTab }) => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [selectedLawyer, setSelectedLawyer] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadText, setUploadText] = useState('');
  const [uploadFileSample, setUploadFileSample] = useState<'court_order' | 'revenue_deed' | 'hmda_app'>('court_order');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const categories = [
    { key: 'all', label: 'All Documents', icon: Layers },
    { key: 'Court H.C.', label: 'Court H.C. (High Court)', icon: Scale },
    { key: 'Court S.C.', label: 'Court S.C. (Supreme Court)', icon: Scale },
    { key: 'Court L.C.', label: 'Court L.C. (Lower Court)', icon: Scale },
    { key: 'Revenue', label: 'Revenue & Dharani', icon: Building },
    { key: 'HMDA', label: 'HMDA Planning', icon: Layers },
    { key: 'Police', label: 'Police FIR & Panchanama', icon: Shield },
    { key: 'A.D.', label: 'A.D. Survey & Land Records', icon: MapPin },
  ];

  const villages = ['all', 'Shamshabad', 'Moinabad', 'Rajendranagar', 'Chevella', 'Maheshwaram'];
  const lawyers = ['all', 'Adv. M.A. Riyaz', 'Adv. Fatima Begum', 'Adv. K. Srinivas'];

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedVillage !== 'all') params.append('village', selectedVillage);
      if (selectedLawyer !== 'all') params.append('lawyer', selectedLawyer);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory, selectedVillage, selectedLawyer, searchQuery]);

  const loadSampleDocument = (type: 'court_order' | 'revenue_deed' | 'hmda_app') => {
    setUploadFileSample(type);
    if (type === 'court_order') {
      setUploadTitle('High Court Order - Shamshabad Sy No 142 Interim Extension');
      setUploadText(`IN THE HIGH COURT FOR THE STATE OF TELANGANA AT HYDERABAD
WRIT PETITION NO. 19502 OF 2026
Between:
Mohammed Abdul Quddus & Ors ... Petitioners
Versus
The State of Telangana, rep. by Tahsildar Shamshabad & Ors ... Respondents

CORAM: HON'BLE JUSTICE K. LAKSHMAN
ORDER:
Learned counsel for the petitioner Adv. M.A. Riyaz submits that despite earlier status quo orders, respondents are attempting to survey land in Sy No. 142/A Shamshabad.
Interim status quo granted earlier stands extended till the next date of hearing.
Post on 18.11.2026 for hearing on I.A. No. 2 of 2026.`);
    } else if (type === 'revenue_deed') {
      setUploadTitle('Tahsildar Chevella - Survey Panchanama Sy No 71');
      setUploadText(`GOVERNMENT OF TELANGANA - REVENUE DEPARTMENT
Office of the Tahsildar, Chevella Mandal, Ranga Reddy District
Ref: Application by Syed Farooq for demarcation in Sy.No. 71/A Chevella Village.
PANCHANAMA REPORT:
Inspected the scheduled land along with Mandal Surveyor. Boundary stones verified. Total area Ac 3.12 gts found under cultivation. Passbook issued.`);
    } else {
      setUploadTitle('HMDA Preliminary NOC - Moinabad Sy No 88 Layout');
      setUploadText(`HYDERABAD METROPOLITAN DEVELOPMENT AUTHORITY
Planning Dept, Sub-division Moinabad
Subject: Technical Scrutiny for Sy No 88/2 Moinabad Village.
Buffer clearance verified from reservoir tributary. Approach road 40 feet confirmed. Approved in principle.`);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!uploadText.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle,
          text: uploadText,
          fileType: 'pdf',
        }),
      });
      const data = await res.json();
      setAnalysisResult(data);
      fetchDocuments();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <HardDrive className="w-4 h-4" />
            Google Drive Synchronized Vault
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Legal Records & Document Intelligence
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Organized across Revenue, High Court, Supreme Court, Lower Courts, Police, and HMDA with single unique keyword tagging.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setIsUploadOpen(true);
              loadSampleDocument('court_order');
            }}
            className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Upload className="w-4 h-4" />
            Upload Court Order / Deed
          </button>
        </div>
      </div>

      {/* Main Grid: Categories on Left, Documents on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-emerald-400" />
              Drive Categories
            </h3>
            <div className="space-y-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                      isSelected
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Village Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Telangana Villages
            </h3>
            <div className="flex flex-wrap gap-1.5 px-1">
              {villages.map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVillage(v)}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    selectedVillage === v
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {v === 'all' ? 'All Villages' : v}
                </button>
              ))}
            </div>
          </div>

          {/* Lawyer Filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              Assigned Advocate
            </h3>
            <div className="space-y-1">
              {lawyers.map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLawyer(l)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition truncate ${
                    selectedLawyer === l
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {l === 'all' ? 'All Advocates' : l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents Listing & Details */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar & filter pills */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Survey No (e.g. 142), Tag, Village, or Case..."
                className="w-full bg-slate-950 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-400 shrink-0">
              Showing <span className="text-emerald-400 font-semibold">{documents.length}</span> records
            </div>
          </div>

          {/* Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition hover:border-emerald-500/60 shadow-sm flex flex-col justify-between ${
                  selectedDoc?.id === doc.id ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Category & Tag Row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
                      {doc.category}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                      #{doc.uniqueTag}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 line-clamp-2 mb-1.5">{doc.title}</h4>

                  {/* Village & Survey Number Badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                      <MapPin className="w-3 h-3 text-cyan-400" />
                      {doc.village}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono">
                      Sy.No: {doc.surveyNumber}
                    </span>
                  </div>

                  {/* Excerpt */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">{doc.content}</p>
                </div>

                {/* Footer: Next Date of Hearing & Lawyer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {doc.nextHearingDate ? (
                    <div className="text-amber-400 font-medium flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      NDOH: {doc.nextHearingDate}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      No court date
                    </div>
                  )}

                  <div className="text-slate-400 text-[11px] font-medium">{doc.assignedLawyer}</div>
                </div>
              </div>
            ))}
          </div>

          {documents.length === 0 && !loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">No legal documents matched the selected criteria.</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedVillage('all');
                  setSelectedLawyer('all');
                  setSearchQuery('');
                }}
                className="mt-3 text-xs text-emerald-400 hover:underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected Document Full Preview Drawer / Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedDoc.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedDoc.drivePath}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Category</span>
                  <span className="text-emerald-400 font-medium">{selectedDoc.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Village</span>
                  <span className="text-slate-200 font-medium">{selectedDoc.village}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Survey No</span>
                  <span className="text-cyan-400 font-mono font-medium">{selectedDoc.surveyNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Next Date</span>
                  <span className="text-amber-400 font-medium">{selectedDoc.nextHearingDate || 'None'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1">Document Content</h4>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto text-[11px]">
                  {selectedDoc.content}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="text-slate-400">
                  Unique Tag: <strong className="text-slate-200 font-mono">#{selectedDoc.uniqueTag}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectDocForResearch?.(selectedDoc);
                      setSelectedDoc(null);
                      onNavigateToTab?.('briefs');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Open in Brief Studio
                  </button>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload & Auto-Analyze Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Upload Legal Record to Google Drive</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Quick Preset Templates:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadSampleDocument('court_order')}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${
                      uploadFileSample === 'court_order'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    High Court Order (Status Quo + NDOH)
                  </button>
                  <button
                    onClick={() => loadSampleDocument('revenue_deed')}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${
                      uploadFileSample === 'revenue_deed'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Revenue Panchanama / Dharani
                  </button>
                  <button
                    onClick={() => loadSampleDocument('hmda_app')}
                    className={`px-3 py-1.5 rounded-lg border text-xs ${
                      uploadFileSample === 'hmda_app'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    HMDA Layout Application
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Document Title / File Name</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Document Text / OCR Content</label>
                <textarea
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {/* Analysis Result Banner */}
              {analysisResult && (
                <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Indexed & Saved to Google Drive!
                  </div>
                  <div>
                    Folder: <strong className="font-mono text-white">{analysisResult.folderPath}</strong>
                  </div>
                  <div>
                    Next Date of Hearing:{' '}
                    <strong className="text-amber-400">{analysisResult.nextHearingDate || 'None'}</strong>
                  </div>
                  {analysisResult.trackingAdded && (
                    <div className="text-cyan-300 text-[11px]">
                      ⚡ Automatically registered for Daily 7:00 PM Court Causelist Crawler!
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-xs"
                >
                  Close
                </button>
                <button
                  onClick={handleUploadAndAnalyze}
                  disabled={analyzing || !uploadText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  {analyzing ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      Parsing Order & Extracting Dates...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Analyze & Save to Drive
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
