import React, { useState } from 'react';
import {
  MessageSquare,
  HardDrive,
  Scale,
  BookOpen,
  Calendar,
  Layers,
  Shield,
  Sparkles,
  User,
  CheckCircle,
  HelpCircle,
  Network,
  Clock
} from 'lucide-react';
import { WhatsAppChat } from './components/WhatsAppChat.tsx';
import { DocumentVault } from './components/DocumentVault.tsx';
import { CauselistRadar } from './components/CauselistRadar.tsx';
import { RagBriefStudio } from './components/RagBriefStudio.tsx';
import { MorningDocket } from './components/MorningDocket.tsx';
import { PipelineInspector } from './components/PipelineInspector.tsx';
import DocumentGraphVisualizer from './components/DocumentGraphVisualizer.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('whatsapp');
  const [dialect, setDialect] = useState<'hyderabadi_roman_urdu' | 'english'>('hyderabadi_roman_urdu');
  const [userRole, setUserRole] = useState<'advocate' | 'client'>('advocate');
  const [selectedDocForResearch, setSelectedDocForResearch] = useState<any>(null);

  const tabs = [
    { id: 'whatsapp', label: 'WhatsApp Assistant', icon: MessageSquare, badge: 'Active' },
    { id: 'graph', label: '1,000+ Doc Knowledge Graph', icon: Network, highlight: true },
    { id: 'vault', label: 'Google Drive Vault', icon: HardDrive, count: '9+' },
    { id: 'causelist', label: '7 PM Causelist Radar', icon: Scale },
    { id: 'briefs', label: 'RAG Brief Studio', icon: BookOpen },
    { id: 'docket', label: 'Morning Docket', icon: Calendar },
    { id: 'pipeline', label: 'n8n Architecture', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo & Assistant Identity */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-base shadow-md">
                S
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">SABEEL Legal OS</h1>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-semibold">
                    Aliya WhatsApp AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Google Drive Document Vault & 7 PM Court Causelist Bot
                </p>
              </div>
            </div>

            {/* Mobile quick role tag */}
            <div className="sm:hidden text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
              {userRole === 'advocate' ? 'Staff' : 'Client'}
            </div>
          </div>

          {/* Right Controls: Dialect, Access Role, Google Drive Status */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* 7 PM Crawler Pulse */}
            <div className="hidden md:flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-1 rounded-lg text-[11px] text-indigo-300">
              <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>7 PM Causelist: Active</span>
            </div>

            {/* Google Drive Status */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/70 border border-slate-700/60 px-2.5 py-1 rounded-lg text-[11px] text-emerald-400">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Drive: Synced</span>
            </div>

            {/* Dialect Toggle */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setDialect('hyderabadi_roman_urdu')}
                className={`px-2.5 py-1 rounded-md transition font-medium text-[11px] ${
                  dialect === 'hyderabadi_roman_urdu'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Hyderabadi Urdu in Roman Script"
              >
                🌙 Hyderabadi Urdu
              </button>
              <button
                onClick={() => setDialect('english')}
                className={`px-2.5 py-1 rounded-md transition font-medium text-[11px] ${
                  dialect === 'english'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Professional Legal English"
              >
                ⚖️ English
              </button>
            </div>

            {/* Access Role Switcher */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setUserRole('advocate')}
                className={`px-2.5 py-1 rounded-md transition font-medium text-[11px] ${
                  userRole === 'advocate'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Advocate / Staff
              </button>
              <button
                onClick={() => setUserRole('client')}
                className={`px-2.5 py-1 rounded-md transition font-medium text-[11px] ${
                  userRole === 'client'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Client View
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : tab.highlight
                    ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 hover:bg-indigo-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {activeTab === 'whatsapp' && (
          <WhatsAppChat
            dialect={dialect}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'graph' && (
          <DocumentGraphVisualizer
            dialect={dialect}
            onSendToWhatsApp={(text) => {
              fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, dialect }),
              }).then(() => setActiveTab('whatsapp'));
            }}
          />
        )}

        {activeTab === 'vault' && (
          <DocumentVault
            onSelectDocForResearch={(doc) => setSelectedDocForResearch(doc)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'causelist' && (
          <CauselistRadar onNavigateToTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'briefs' && (
          <RagBriefStudio
            initialDoc={selectedDocForResearch}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'docket' && (
          <MorningDocket onNavigateToTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'pipeline' && <PipelineInspector />}
      </main>

      {/* Persistent Status Bar */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 px-4 lg:px-8 py-2 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>SABEEL OS v2.4 • Telangana Courts & Land Administration</span>
          <span className="hidden sm:inline">•</span>
          <span>Villages: Shamshabad, Moinabad, Rajendranagar, Chevella, Maheshwaram</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Google Drive Connected</span>
          <span className="mx-1">•</span>
          <span>Daily 7 PM Crawler: Active</span>
        </div>
      </footer>
    </div>
  );
}
