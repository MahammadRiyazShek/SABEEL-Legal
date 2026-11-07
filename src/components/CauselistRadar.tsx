import React, { useState, useEffect } from 'react';
import {
  Clock,
  Scale,
  CheckCircle2,
  AlertCircle,
  Play,
  Send,
  Calendar,
  Building,
  RefreshCw,
  FileCheck,
  BellRing,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Eye,
  Plus,
  Layers,
  MapPin,
  Shield,
  FileText
} from 'lucide-react';

interface TrackedCase {
  caseNumber: string;
  title: string;
  court: string;
  village: string;
  surveyNumber: string;
  nextHearingDate: string;
  assignedLawyer: string;
  lastCheckedAt?: string;
  status: 'monitoring' | 'listed' | 'not_listed';
  itemNumber?: string;
  courtHall?: string;
  judge?: string;
  stage?: string;
  whatsappSent: boolean;
  history: Array<{
    date: string;
    time: string;
    isListed: boolean;
    remarks: string;
  }>;
}

interface DocumentActionRule {
  ruleId: string;
  docTitle: string;
  docCategory: string;
  actionType: string;
  schedule: string;
  targetPortalName: string;
  targetUrl: string;
  queryParam: string;
  nextActionDate: string;
  status: 'active_monitoring' | 'triggered' | 'completed' | 'repeating_daily';
  whatsappAlertTemplate: string;
  lastChecked?: string;
  checkCount: number;
}

interface CauselistRadarProps {
  onNavigateToTab?: (tab: string) => void;
}

export const CauselistRadar: React.FC<CauselistRadarProps> = ({ onNavigateToTab }) => {
  const [viewMode, setViewMode] = useState<'court_causelist' | 'all_documents'>('court_causelist');
  const [trackedCases, setTrackedCases] = useState<TrackedCase[]>([]);
  const [actionRules, setActionRules] = useState<DocumentActionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [running7pmScan, setRunning7pmScan] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TrackedCase | null>(null);
  const [selectedRule, setSelectedRule] = useState<DocumentActionRule | null>(null);
  const [lastScanAlert, setLastScanAlert] = useState<string | null>(null);
  const [showCourtBoardModal, setShowCourtBoardModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);

  // New Rule Form State
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Revenue');
  const [newSchedule, setNewSchedule] = useState('Daily at 7:00 PM');
  const [newPortalName, setNewPortalName] = useState('Dharani Land Records Portal');
  const [newTargetUrl, setNewTargetUrl] = useState('https://dharani.telangana.gov.in');
  const [newQueryParam, setNewQueryParam] = useState('Sy.No 142/A Shamshabad');
  const [newTargetDate, setNewTargetDate] = useState('2026-11-25');
  const [newAlertTemplate, setNewAlertTemplate] = useState('🏛️ *AUTOMATED DOCUMENT ALERT*\nCondition verified on portal. Immediate attention required.');

  const fetchTrackedCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/court/tracked');
      const data = await res.json();
      if (data.trackedCases) {
        setTrackedCases(data.trackedCases);
        if (data.trackedCases.length > 0 && !selectedCase) {
          setSelectedCase(data.trackedCases[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActionRules = async () => {
    try {
      const res = await fetch('/api/action-rules');
      const data = await res.json();
      if (data.rules) {
        setActionRules(data.rules);
        if (data.rules.length > 0 && !selectedRule) {
          setSelectedRule(data.rules[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTrackedCases();
    fetchActionRules();
  }, []);

  const handleRun7pmScan = async (targetCaseNumber?: string) => {
    setRunning7pmScan(true);
    setLastScanAlert(null);

    const target = targetCaseNumber || selectedCase?.caseNumber || 'WP 18942/2026';
    try {
      const res = await fetch('/api/court/causelist-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: target,
          date: '14.11.2026',
        }),
      });
      const data = await res.json();
      if (data.trackedCases) {
        setTrackedCases(data.trackedCases);
        const updated = data.trackedCases.find((c: TrackedCase) => c.caseNumber === target);
        if (updated) setSelectedCase(updated);
      }
      if (data.whatsappAlert) {
        setLastScanAlert(data.whatsappAlert);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning7pmScan(false);
    }
  };

  const handleTriggerActionRule = async (ruleId: string) => {
    setRunning7pmScan(true);
    setLastScanAlert(null);
    try {
      const res = await fetch('/api/action-rules/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      });
      const data = await res.json();
      if (data.rule) {
        setSelectedRule(data.rule);
        fetchActionRules();
      }
      if (data.triggeredAlert) {
        setLastScanAlert(data.triggeredAlert);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning7pmScan(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    try {
      const res = await fetch('/api/action-rules/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docTitle: newDocTitle,
          docCategory: newDocCategory,
          schedule: newSchedule,
          targetPortalName: newPortalName,
          targetUrl: newTargetUrl,
          queryParam: newQueryParam,
          nextActionDate: newTargetDate,
          whatsappAlertTemplate: newAlertTemplate,
        }),
      });
      const data = await res.json();
      if (data.rules) setActionRules(data.rules);
      setShowAddRuleModal(false);
      setNewDocTitle('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* 7 PM Autonomous Crawler Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/50 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4 animate-pulse" />
            Autonomous Action Radar & Scheduled Web Crawler
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Automated Task Execution For Any Document
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            "Works for any document: reads it, detects target date/deadline, goes online daily at 7:00 PM (or schedule), fetches the official website/portal, checks if listed/verified, and informs you via WhatsApp; or else repeats next day."
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setViewMode('court_causelist')}
              className={`px-3 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1.5 ${
                viewMode === 'court_causelist'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Court Causelist (7 PM)
            </button>
            <button
              onClick={() => setViewMode('all_documents')}
              className={`px-3 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1.5 ${
                viewMode === 'all_documents'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Document Rules ({actionRules.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddRuleModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-800/60 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Tracker Rule
          </button>

          {viewMode === 'court_causelist' ? (
            <button
              onClick={() => handleRun7pmScan()}
              disabled={running7pmScan}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              {running7pmScan ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Crawling Court Causelist...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Trigger 7:00 PM Scan Now
                </>
              )}
            </button>
          ) : (
            selectedRule && (
              <button
                onClick={() => handleTriggerActionRule(selectedRule.ruleId)}
                disabled={running7pmScan}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                Run Selected Online Check
              </button>
            )
          )}
        </div>
      </div>

      {/* WhatsApp Dispatch Banner if generated */}
      {lastScanAlert && (
        <div className="bg-emerald-950/70 border border-emerald-600/70 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 font-semibold block text-sm">
                WhatsApp Notification Dispatched to Advocate & Client!
              </strong>
              <p className="text-slate-300 whitespace-pre-line text-xs font-mono mt-1 bg-black/40 p-2.5 rounded-lg border border-emerald-900/60">
                {lastScanAlert}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab?.('whatsapp')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            View in WhatsApp
          </button>
        </div>
      )}

      {/* VIEW MODE 1: Court Causelist Radar */}
      {viewMode === 'court_causelist' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tracked Cases List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-400" />
                Tracked Court Cases
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Daily 7 PM Schedule</span>
            </div>

            <div className="space-y-3">
              {trackedCases.map((c) => {
                const isSelected = selectedCase?.caseNumber === c.caseNumber;
                const isListed = c.status === 'listed';
                return (
                  <div
                    key={c.caseNumber}
                    onClick={() => setSelectedCase(c)}
                    className={`bg-slate-900 border rounded-xl p-3.5 cursor-pointer transition shadow-sm ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold font-mono text-white">{c.caseNumber}</span>
                      {isListed ? (
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Listed on Board
                        </span>
                      ) : (
                        <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Monitoring (7 PM)
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs text-slate-300 font-medium line-clamp-1 mb-2">{c.title}</h4>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 mb-2">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Next Date</span>
                        <span className="text-amber-400 font-medium">{c.nextHearingDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase font-bold">Village / Sy No</span>
                        <span className="text-cyan-400 font-medium">
                          {c.village} ({c.surveyNumber})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Adv: {c.assignedLawyer}</span>
                      <span>{c.lastCheckedAt ? `Checked: ${c.lastCheckedAt.slice(11, 16)}` : 'Pending'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Case Deep Status & Causelist Bulletin */}
          <div className="lg:col-span-2 space-y-4">
            {selectedCase ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold bg-slate-800 text-indigo-300 px-2 py-0.5 rounded">
                        {selectedCase.caseNumber}
                      </span>
                      <span className="text-xs text-slate-400">{selectedCase.court}</span>
                    </div>
                    <h3 className="text-base font-bold text-white">{selectedCase.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRun7pmScan(selectedCase.caseNumber)}
                      disabled={running7pmScan}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${running7pmScan ? 'animate-spin' : ''}`} />
                      Test Crawler Scan
                    </button>
                    <button
                      onClick={() => setShowCourtBoardModal(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Court Board
                    </button>
                  </div>
                </div>

                {selectedCase.status === 'listed' ? (
                  <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl p-4 text-xs space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      CONFIRMED LISTED IN HIGH COURT CAUSELIST
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/60">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Court Hall</span>
                        <strong className="text-white text-xs">{selectedCase.courtHall || 'Court Hall No. 04'}</strong>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/60">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Item Number</span>
                        <strong className="text-cyan-300 text-sm font-mono">{selectedCase.itemNumber || 'Item 14'}</strong>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/60">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Bench / Judge</span>
                        <strong className="text-white text-xs">{selectedCase.judge || "Hon'ble Justice K. Lakshman"}</strong>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/60">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Stage</span>
                        <strong className="text-amber-300 text-xs">{selectedCase.stage || 'Motion / Hearing'}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold">
                      <Clock className="w-4 h-4" />
                      NOT YET PUBLISHED ON TODAY'S CAUSELIST
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      The court registry publishes daily cause lists between 6:30 PM - 7:00 PM for the subsequent day.
                      SABEEL's automated crawler will run at 7:00 PM on <strong>{selectedCase.nextHearingDate}</strong>.
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Crawler Check History Log
                  </h4>
                  <div className="space-y-2">
                    {selectedCase.history.map((log, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs flex items-start gap-3"
                      >
                        <div className="mt-0.5">
                          {log.isListed ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block"></span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block"></span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="font-semibold text-slate-200">
                              {log.date} • {log.time}
                            </span>
                            <span className={log.isListed ? 'text-emerald-400' : 'text-amber-400'}>
                              {log.isListed ? 'Listed' : 'Repeat Next Day'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed">{log.remarks}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Universal Document Action Rules (Any Document) */}
      {viewMode === 'all_documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Active Document Action Rules
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">All Document Types</span>
            </div>

            <div className="space-y-3">
              {actionRules.map((rule) => {
                const isSelected = selectedRule?.ruleId === rule.ruleId;
                return (
                  <div
                    key={rule.ruleId}
                    onClick={() => setSelectedRule(rule)}
                    className={`bg-slate-900 border rounded-xl p-3.5 cursor-pointer transition shadow-sm ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase bg-slate-800 text-indigo-300 px-2 py-0.5 rounded">
                        {rule.docCategory}
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60 font-medium">
                        {rule.schedule}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-white line-clamp-1 mb-1">{rule.docTitle}</h4>

                    <div className="text-[11px] text-slate-400 space-y-0.5 bg-slate-950 p-2 rounded-lg border border-slate-800/80 mb-2">
                      <div>Portal: <strong className="text-slate-200">{rule.targetPortalName}</strong></div>
                      <div>Query: <span className="text-cyan-400 font-mono">{rule.queryParam}</span></div>
                      <div>Target Date: <span className="text-amber-400">{rule.nextActionDate}</span></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Status: {rule.status.replace('_', ' ')}</span>
                      <span>Checks: {rule.checkCount} times</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Action Rule Deep Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRule ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded">
                      {selectedRule.actionType.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">{selectedRule.docTitle}</h3>
                  </div>

                  <button
                    onClick={() => handleTriggerActionRule(selectedRule.ruleId)}
                    disabled={running7pmScan}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Test Online Query Now
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Schedule</span>
                    <strong className="text-slate-200 text-xs">{selectedRule.schedule}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Target Date / NDOH</span>
                    <strong className="text-amber-400 text-xs">{selectedRule.nextActionDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Query Key</span>
                    <strong className="text-cyan-300 text-xs font-mono">{selectedRule.queryParam}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Last Checked</span>
                    <strong className="text-slate-300 text-xs">{selectedRule.lastChecked || 'Pending 7 PM'}</strong>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Configured Target Website / API Endpoint</span>
                    <a
                      href={selectedRule.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      {selectedRule.targetUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    SABEEL connects to <strong>{selectedRule.targetPortalName}</strong> on schedule, searches for{' '}
                    <code className="text-cyan-300 font-mono bg-black/40 px-1 py-0.5 rounded">{selectedRule.queryParam}</code>,
                    and if verified, dispatches the WhatsApp notification template below. If not found or pending, it logs and repeats next day.
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                    Configured WhatsApp Alert Message
                  </h4>
                  <pre className="bg-black/50 border border-slate-800 p-3 rounded-xl text-emerald-300 text-[11px] font-mono whitespace-pre-wrap leading-relaxed select-text">
                    {selectedRule.whatsappAlertTemplate}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Custom Action Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-sm">Add Automated Tracker Rule for Any Document</h3>
              <button onClick={() => setShowAddRuleModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Document Title / File Name</label>
                <input
                  type="text"
                  required
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. Commercial Lease Escalation Clause or FIR Status"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Category</label>
                  <select
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Court H.C.">Court H.C. (High Court)</option>
                    <option value="Revenue">Revenue & Dharani</option>
                    <option value="HMDA">HMDA Planning</option>
                    <option value="Police">Police FIR</option>
                    <option value="General">General Contract / Deed</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Crawl Schedule</label>
                  <select
                    value={newSchedule}
                    onChange={(e) => setNewSchedule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Daily at 7:00 PM">Daily at 7:00 PM</option>
                    <option value="Daily at 9:00 AM">Daily at 9:00 AM</option>
                    <option value="Daily at 6:00 PM">Daily at 6:00 PM</option>
                    <option value="Weekly on Mondays">Weekly on Mondays</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Target Portal / Website</label>
                  <input
                    type="text"
                    value={newPortalName}
                    onChange={(e) => setNewPortalName(e.target.value)}
                    placeholder="e.g. High Court Causelist"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Search Key / Query</label>
                  <input
                    type="text"
                    value={newQueryParam}
                    onChange={(e) => setNewQueryParam(e.target.value)}
                    placeholder="e.g. Case / Sy No / App No"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Target Hearing Date / Due Date</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">WhatsApp Alert Message Template</label>
                <textarea
                  rows={3}
                  value={newAlertTemplate}
                  onChange={(e) => setNewAlertTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-1.5 rounded-lg"
                >
                  Save & Activate Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulated Court Board Modal */}
      {showCourtBoardModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">High Court of Telangana - Official Causelist</h3>
                  <p className="text-xs text-slate-400">Published Friday, 14th November 2026 (Daily Board)</p>
                </div>
              </div>
              <button
                onClick={() => setShowCourtBoardModal(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto font-mono text-xs bg-slate-950 text-slate-300 space-y-2 leading-relaxed">
              <div className="text-center font-bold text-slate-100 border-b border-slate-800 pb-2">
                HIGH COURT FOR THE STATE OF TELANGANA AT HYDERABAD
                <br />
                COURT HALL NO. 04
                <br />
                HON'BLE JUSTICE K. LAKSHMAN
              </div>
              <div className="pt-2 text-slate-400">FOR MOTION HEARING / ADMISSION:</div>
              <div className="space-y-1.5 pl-2">
                <div>Item 12: W.P. No. 18810/2026 - K. V. Rao vs State of Telangana</div>
                <div>Item 13: W.P. No. 18901/2026 - Venkatesh vs District Collector RR Dist</div>
                <div className="bg-emerald-950/80 border border-emerald-500/60 p-2 rounded text-emerald-300 font-bold">
                  ➡️ Item 14: W.P. No. 18942/2026 - Mohammed Abdul Quddus & Ors vs State of Telangana & Ors
                  <div className="text-[10px] text-emerald-400 font-normal pl-4 mt-0.5">
                    (Adv. M.A. Riyaz for Petitioner | Sy No 142 Shamshabad | Status Quo Continuation)
                  </div>
                </div>
                <div>Item 15: W.P. No. 19022/2026 - Laxmi Devi vs Tahsildar Shamshabad</div>
                <div>Item 16: CRL.P 4511/2026 - Anand Kumar vs State of Telangana</div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowCourtBoardModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
