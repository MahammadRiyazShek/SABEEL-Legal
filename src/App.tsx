/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  HardDrive,
  Database,
  Brain,
  Cloud,
  Zap,
  Sparkles,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { WhatsAppInterface } from './components/WhatsAppInterface';
import { GoogleDriveExplorer } from './components/GoogleDriveExplorer';
import { RAGKnowledgeBase } from './components/RAGKnowledgeBase';
import { MemoryInspector } from './components/MemoryInspector';
import { CloudDeploymentModal } from './components/CloudDeploymentModal';
import { WebhookSimulator } from './components/WebhookSimulator';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'chat' | 'drive' | 'rag' | 'memory' | 'webhook' | 'deploy'
  >('chat');
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string>('');

  const handleSelectDocForChat = (doc: { title: string; content: string }) => {
    setChatInitialPrompt(`Please analyze this document from my Google Drive: "${doc.title}"`);
    setActiveTab('chat');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-zinc-950 font-bold shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              WhatsApp AI Drive Assistant
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium hidden sm:inline-block">
                DriveGenie
              </span>
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'drive'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'rag'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>RAG Search</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'memory'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Memory</span>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'webhook'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Webhook Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('deploy')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'deploy'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Deployment</span>
          </button>
        </nav>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && (
          <WhatsAppInterface
            onOpenDriveTab={() => setActiveTab('drive')}
            onOpenMemoryTab={() => setActiveTab('memory')}
            initialPrompt={chatInitialPrompt}
          />
        )}

        {activeTab === 'drive' && (
          <GoogleDriveExplorer onSelectDocumentForChat={handleSelectDocForChat} />
        )}

        {activeTab === 'rag' && <RAGKnowledgeBase />}

        {activeTab === 'memory' && <MemoryInspector />}

        {activeTab === 'webhook' && <WebhookSimulator />}

        {activeTab === 'deploy' && <CloudDeploymentModal />}
      </main>
    </div>
  );
}
