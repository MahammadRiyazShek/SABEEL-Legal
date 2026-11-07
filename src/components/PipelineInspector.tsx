import React, { useState } from 'react';
import {
  MessageSquare,
  FileText,
  Mic,
  HardDrive,
  BrainCircuit,
  Database,
  ArrowRight,
  CheckCircle,
  Play,
  Layers,
  Sparkles,
  Bot
} from 'lucide-react';

export const PipelineInspector: React.FC = () => {
  const [activeBranch, setActiveBranch] = useState<'text' | 'audio' | 'file'>('text');
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);

  const runSimulation = (branch: 'text' | 'audio' | 'file') => {
    setActiveBranch(branch);
    setIsRunningSim(true);
    setActiveStep(1);

    const timer1 = setTimeout(() => setActiveStep(2), 700);
    const timer2 = setTimeout(() => setActiveStep(3), 1500);
    const timer3 = setTimeout(() => setActiveStep(4), 2300);
    const timer4 = setTimeout(() => {
      setActiveStep(5);
      setIsRunningSim(false);
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-900/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            n8n Architecture & Phase 2 Pipeline
          </div>
          <h2 className="text-xl font-bold text-white">Aliya & SABEEL Workflow Pipeline (Phase 1 & 2)</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Visual interactive replica of your n8n workflow from the screenshot: WhatsApp Trigger → Audio Transcribe / Google Drive Upload → Pinecone Vector RAG → Gemini AI Agent → WhatsApp Reply.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runSimulation('text')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              activeBranch === 'text'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Simulate Text Flow
          </button>
          <button
            onClick={() => runSimulation('audio')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              activeBranch === 'audio'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Simulate Voice Note
          </button>
          <button
            onClick={() => runSimulation('file')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
              activeBranch === 'file'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Simulate Court Order
          </button>
        </div>
      </div>

      {/* Visual Workflow Canvas */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-x-auto">
        <div className="min-w-[850px] flex items-center justify-between gap-4 py-8 relative">
          {/* Node 1: WhatsApp Trigger */}
          <div
            className={`w-44 bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all ${
              activeStep >= 1 ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">WhatsApp Trigger</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Webhook listener for incoming client & lawyer messages</p>
            <div className="mt-2 text-[9px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded inline-block">
              Connected
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />

          {/* Node 2: Switch Mode (Rules) */}
          <div
            className={`w-44 bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all ${
              activeStep >= 2 ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-slate-800'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">Switch Router</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Routes by MIME: <br />
              <span className={activeBranch === 'text' ? 'text-emerald-400 font-bold' : ''}>Text</span> •{' '}
              <span className={activeBranch === 'audio' ? 'text-cyan-400 font-bold' : ''}>Audio</span> •{' '}
              <span className={activeBranch === 'file' ? 'text-amber-400 font-bold' : ''}>Court File</span>
            </p>
            <div className="mt-2 text-[9px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded inline-block font-mono">
              Mode: {activeBranch.toUpperCase()}
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />

          {/* Node 3: Processing & Vault Node */}
          <div
            className={`w-48 bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all ${
              activeStep >= 3 ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-800'
            }`}
          >
            {activeBranch === 'audio' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-2">
                  <Mic className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">Audio Transcribe</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Transcribe voice notes (Hyderabadi Urdu / English)</p>
              </>
            ) : activeBranch === 'file' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center mb-2">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">Google Drive Vault</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Auto-sorts into Revenue/HC/SC/HMDA folder</p>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-2">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">Pinecone Vector RAG</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Semantic search over village and survey chunks</p>
              </>
            )}
            <div className="mt-2 text-[9px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded inline-block">
              Phase 2 Active
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />

          {/* Node 4: AI Agent (Gemini + Memory) */}
          <div
            className={`w-52 bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all ${
              activeStep >= 4 ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-slate-800'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-2">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">SABEEL AI Agent</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Gemini 3.8 Flash • Long-term memory • 7 PM Causelist verification • Hyderabadi dialect
            </p>
            <div className="mt-2 text-[9px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded inline-block">
              Agent Authoritative
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-slate-600 shrink-0" />

          {/* Node 5: WhatsApp Send Message */}
          <div
            className={`w-44 bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all ${
              activeStep >= 5 ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">WhatsApp Reply</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Delivered to client / advocate WhatsApp thread</p>
            <div className="mt-2 text-[9px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded inline-block">
              Dispatched (200 OK)
            </div>
          </div>
        </div>

        {/* Live Simulation Status Log */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-400 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              {isRunningSim
                ? `Running n8n simulation: Step ${activeStep}/5 for ${activeBranch.toUpperCase()} pipeline...`
                : 'Pipeline idle and listening for incoming WhatsApp messages.'}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">eCourts 7 PM Cron: Scheduled (7:00 PM IST)</span>
        </div>
      </div>
    </div>
  );
};
