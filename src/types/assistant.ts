/**
 * Type definitions for WhatsApp AI Drive Assistant
 */

export interface WhatsAppMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string; // ISO string
  text: string;
  status?: 'sent' | 'delivered' | 'read';
  media?: {
    type: 'document' | 'image' | 'audio';
    url?: string;
    filename: string;
    mimeType: string;
    fileSize?: string;
    pageCount?: number;
    driveFileId?: string;
  };
  toolCalls?: Array<{
    toolName: string;
    status: 'calling' | 'success' | 'failed';
    summary: string;
    details?: string;
  }>;
  groundingSources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  isFolder: boolean;
  webViewLink?: string;
  content?: string;
  category?: 'Financial' | 'Legal & Contracts' | 'Identity & Personal' | 'Work & Reports' | 'General';
  tags?: string[];
}

export interface RAGDocument {
  id: string;
  title: string;
  mimeType: string;
  driveFileId?: string;
  category: string;
  uploadedAt: string;
  chunks: RAGChunk[];
  fullText: string;
}

export interface RAGChunk {
  id: string;
  docId: string;
  docTitle: string;
  chunkIndex: number;
  text: string;
  keywords: string[];
}

export interface MemoryItem {
  id: string;
  category: 'preference' | 'fact' | 'instruction' | 'contact' | 'project';
  key: string;
  value: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  sourceMessageId?: string;
}

export interface WebhookConfig {
  verifyToken: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  webhookUrl: string;
}

export interface AssistantConfig {
  aiModel: string;
  enableGoogleSearch: boolean;
  enableDriveSync: boolean;
  storageMode: 'live_google_drive' | 'sandbox_drive';
}
