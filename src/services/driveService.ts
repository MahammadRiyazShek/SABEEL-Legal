/**
 * Google Drive Service
 * Interacts with Google Drive REST API v3 when OAuth access token is provided,
 * and maintains a persistent sandbox Drive environment for local development & preview.
 */

import { DriveItem } from '../types/assistant';
import { classifyDocumentForDrive, formatBytes } from '../utils/driveOrganizer';
import { getAccessToken } from './firebaseAuth';

const INITIAL_SANDBOX_FILES: DriveItem[] = [
  {
    id: 'folder_root_assistant',
    name: 'WhatsApp Assistant',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    parents: ['root'],
    createdTime: '2026-10-15T10:00:00Z',
    modifiedTime: '2026-10-15T10:00:00Z',
    category: 'General',
  },
  {
    id: 'folder_financial',
    name: 'Financial & Invoices',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    parents: ['folder_root_assistant'],
    createdTime: '2026-10-15T10:05:00Z',
    modifiedTime: '2026-10-15T10:05:00Z',
    category: 'Financial',
  },
  {
    id: 'folder_legal',
    name: 'Legal & Contracts',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    parents: ['folder_root_assistant'],
    createdTime: '2026-10-15T10:06:00Z',
    modifiedTime: '2026-10-15T10:06:00Z',
    category: 'Legal & Contracts',
  },
  {
    id: 'folder_reports',
    name: 'Work & Reports',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    parents: ['folder_root_assistant'],
    createdTime: '2026-10-15T10:07:00Z',
    modifiedTime: '2026-10-15T10:07:00Z',
    category: 'Work & Reports',
  },
  {
    id: 'file_inv_001',
    name: 'Cloud_Hosting_Invoice_Oct2026.pdf',
    mimeType: 'application/pdf',
    size: 245760,
    isFolder: false,
    parents: ['folder_financial'],
    createdTime: '2026-10-20T14:32:00Z',
    modifiedTime: '2026-10-20T14:32:00Z',
    category: 'Financial',
    tags: ['Invoice', 'Hosting', 'Google Cloud'],
    content: `INVOICE #INV-9821
Date: October 20, 2026
Vendor: CloudScale Infrastructure Inc.
Customer: TechVentures AI Studio
Line Items:
1. Google Cloud Run Managed Microservices (Asia-Southeast1): $1,450.00
2. Cloud Storage & Egress: $280.00
3. Cloud DNS & SSL Termination: $45.00
Subtotal: $1,775.00
Tax (VAT 10%): $177.50
Total Due: $1,952.50
Payment Terms: Net 30. Bank transfer or credit card accepted.
Status: Paid in full via auto-debit.`,
  },
  {
    id: 'file_contract_001',
    name: 'Software_Consulting_Agreement_Signed.pdf',
    mimeType: 'application/pdf',
    size: 512000,
    isFolder: false,
    parents: ['folder_legal'],
    createdTime: '2026-09-12T09:15:00Z',
    modifiedTime: '2026-09-12T09:15:00Z',
    category: 'Legal & Contracts',
    tags: ['Contract', 'Consulting', 'NDA'],
    content: `MASTER SERVICES & CONSULTING AGREEMENT
Effective Date: September 15, 2026
Between: TechVentures Corp ("Client") and Apex AI Solutions ("Consultant")
Scope of Work: Delivery of autonomous WhatsApp conversational agents, Google Drive document pipelines, and enterprise RAG architecture.
Key Terms:
- Section 4.1: Hourly rate $185/hr or fixed monthly retainer $12,500.
- Section 6.2: Intellectual property rights: All custom source code, RAG embeddings, and Google Drive automation scripts remain 100% owned by Client.
- Section 8.3: Termination notice: Either party may terminate with 30 calendar days written notice.
- Section 11: Confidentiality non-disclosure strictly in effect for 3 years post-termination.`,
  },
  {
    id: 'file_report_001',
    name: 'Q3_Enterprise_RAG_Architecture_Review.pdf',
    mimeType: 'application/pdf',
    size: 780000,
    isFolder: false,
    parents: ['folder_reports'],
    createdTime: '2026-10-28T16:00:00Z',
    modifiedTime: '2026-10-28T16:00:00Z',
    category: 'Work & Reports',
    tags: ['Architecture', 'RAG', 'Gemini'],
    content: `Q3 ENTERPRISE RAG ARCHITECTURE & SYSTEM REVIEW
Executive Summary:
The integration of Gemini 3.8 Flash with Google Drive vector pipelines achieved sub-200ms document classification and 98.4% retrieval accuracy on technical documentation.
Key Recommendations:
1. Multi-modal chunking: Index diagrams and scanned invoices using Gemini OCR inline.
2. WhatsApp Webhook: Deploy with Cloud Run scale-to-zero microservice to handle peak message bursts up to 250 req/sec.
3. Memory Store: Implement dual-tier memory (short-term conversational context + long-term user entity graphs).
Conclusion: Ready for production rollout on Google Cloud Run.`,
  },
];

class DriveService {
  private sandboxFiles: DriveItem[] = [];

  constructor() {
    this.loadSandbox();
  }

  private loadSandbox() {
    try {
      const stored = localStorage.getItem('assistant_sandbox_drive');
      if (stored) {
        this.sandboxFiles = JSON.parse(stored);
      } else {
        this.sandboxFiles = [...INITIAL_SANDBOX_FILES];
        this.saveSandbox();
      }
    } catch {
      this.sandboxFiles = [...INITIAL_SANDBOX_FILES];
    }
  }

  private saveSandbox() {
    try {
      localStorage.setItem('assistant_sandbox_drive', JSON.stringify(this.sandboxFiles));
    } catch {
      // storage limit or SSR
    }
  }

  /**
   * List files from live Google Drive or sandbox
   */
  async listFiles(
    folderId = 'root',
    searchTerm = ''
  ): Promise<{ files: DriveItem[]; isLive: boolean; error?: string }> {
    const accessToken = await getAccessToken();

    if (accessToken) {
      try {
        let q = `'${folderId}' in parents and trashed = false`;
        if (searchTerm) {
          q += ` and name contains '${searchTerm.replace(/'/g, "\\'")}'`;
        }

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q
        )}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)&pageSize=100`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Drive API error: ${res.statusText}`);
        }

        const data = await res.json();
        const files: DriveItem[] = (data.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size ? parseInt(f.size, 10) : undefined,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          parents: f.parents,
          isFolder: f.mimeType === 'application/vnd.google-apps.folder',
          webViewLink: f.webViewLink,
          category: classifyDocumentForDrive(f.name).folderCategory,
        }));

        return { files, isLive: true };
      } catch (err: any) {
        console.warn('Live Google Drive request failed, falling back to sandbox storage:', err.message);
        return {
          files: this.listSandboxFiles(folderId, searchTerm),
          isLive: false,
          error: `Live Google Drive note: ${err.message}. Showing sandbox storage.`,
        };
      }
    }

    return {
      files: this.listSandboxFiles(folderId, searchTerm),
      isLive: false,
    };
  }

  private listSandboxFiles(folderId = 'root', searchTerm = ''): DriveItem[] {
    return this.sandboxFiles.filter(item => {
      const matchFolder =
        folderId === 'all'
          ? true
          : folderId === 'root'
          ? !item.parents || item.parents.includes('root')
          : item.parents?.includes(folderId);

      const matchSearch = searchTerm
        ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      return matchFolder && matchSearch;
    });
  }

  /**
   * Create folder in Google Drive or sandbox
   */
  async createFolder(
    name: string,
    parentId = 'root'
  ): Promise<{ folder: DriveItem; isLive: boolean }> {
    const accessToken = await getAccessToken();

    if (accessToken) {
      try {
        const metadata = {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId !== 'root' ? [parentId] : undefined,
        };

        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        });

        if (res.ok) {
          const f = await res.json();
          const folder: DriveItem = {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            parents: f.parents || [parentId],
            isFolder: true,
            category: classifyDocumentForDrive(name).folderCategory,
          };
          return { folder, isLive: true };
        }
      } catch (err) {
        console.warn('Failed creating live folder:', err);
      }
    }

    // Sandbox folder creation
    const classification = classifyDocumentForDrive(name);
    const newFolder: DriveItem = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
      parents: [parentId],
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      category: classification.folderCategory,
    };

    this.sandboxFiles.push(newFolder);
    this.saveSandbox();
    return { folder: newFolder, isLive: false };
  }

  /**
   * Upload file to Google Drive or sandbox
   */
  async uploadFile(
    name: string,
    mimeType: string,
    content: string,
    targetFolderId?: string
  ): Promise<{ file: DriveItem; isLive: boolean; targetFolder: string }> {
    const accessToken = await getAccessToken();
    const classification = classifyDocumentForDrive(name, content);

    // If no explicit folder given, organize by category
    let folderId: string = targetFolderId || 'root';
    if (!targetFolderId || targetFolderId === 'root') {
      const folders = await this.getOrCreateCategorizedFolders();
      const catKey = classification.folderCategory || 'General';
      folderId = folders[catKey] || 'root';
    }

    if (accessToken) {
      try {
        // Multipart upload to Google Drive API
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadata = {
          name,
          mimeType: mimeType || 'application/octet-stream',
          parents: folderId !== 'root' ? [folderId] : undefined,
        };

        const multipartHeader =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;
        const dataUrl = content.match(/^data:[^;,]+;base64,([\s\S]*)$/);
        let multipartRequestBody: BodyInit;
        if (dataUrl) {
          const binary = atob(dataUrl[1]);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          multipartRequestBody = new Blob([
            multipartHeader,
            bytes.buffer as ArrayBuffer,
            closeDelimiter,
          ]);
        } else {
          multipartRequestBody = multipartHeader + content + closeDelimiter;
        }

        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );

        if (res.ok) {
          const f = await res.json();
          const driveItem: DriveItem = {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: content.length,
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            parents: [folderId],
            isFolder: false,
            content,
            category: classification.folderCategory,
            tags: classification.suggestedTags,
          };
          return { file: driveItem, isLive: true, targetFolder: classification.folderName };
        }
      } catch (err) {
        console.warn('Live Google Drive upload failed, saving to sandbox:', err);
      }
    }

    // Save to sandbox
    const driveItem: DriveItem = {
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      mimeType: mimeType || 'text/plain',
      size: content.length,
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: [folderId],
      isFolder: false,
      content,
      category: classification.folderCategory,
      tags: classification.suggestedTags,
    };

    this.sandboxFiles.push(driveItem);
    this.saveSandbox();
    return { file: driveItem, isLive: false, targetFolder: classification.folderName };
  }

  /**
   * Find or create standard category folders in Drive
   */
  async getOrCreateCategorizedFolders(): Promise<Record<string, string>> {
    const rootRes = await this.listFiles('root');
    let assistantFolder = rootRes.files.find(
      f => f.isFolder && f.name.toLowerCase() === 'whatsapp assistant'
    );

    if (!assistantFolder) {
      const created = await this.createFolder('WhatsApp Assistant', 'root');
      assistantFolder = created.folder;
    }

    const subRes = await this.listFiles(assistantFolder.id);
    const mapping: Record<string, string> = {
      General: assistantFolder.id,
    };

    const categories = [
      { name: 'Financial & Invoices', key: 'Financial' },
      { name: 'Legal & Contracts', key: 'Legal & Contracts' },
      { name: 'Identity & Personal', key: 'Identity & Personal' },
      { name: 'Work & Reports', key: 'Work & Reports' },
    ];

    for (const cat of categories) {
      let sub = subRes.files.find(f => f.isFolder && f.name === cat.name);
      if (!sub) {
        const createdSub = await this.createFolder(cat.name, assistantFolder.id);
        sub = createdSub.folder;
      }
      mapping[cat.key] = sub.id;
    }

    return mapping;
  }

  /**
   * Delete file (Requires user confirmation in UI before calling this method)
   */
  async deleteFile(fileId: string): Promise<{ success: boolean; isLive: boolean }> {
    const accessToken = await getAccessToken();

    if (accessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          return { success: true, isLive: true };
        }
      } catch (err) {
        console.warn('Failed deleting live file:', err);
      }
    }

    this.sandboxFiles = this.sandboxFiles.filter(f => f.id !== fileId);
    this.saveSandbox();
    return { success: true, isLive: false };
  }

  /**
   * Get file content
   */
  async getFileContent(fileId: string): Promise<string> {
    const accessToken = await getAccessToken();

    if (accessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          return await res.text();
        }
      } catch (err) {
        console.warn('Failed getting live file content, checking sandbox:', err);
      }
    }

    const found = this.sandboxFiles.find(f => f.id === fileId);
    return found?.content || 'No text preview available for this document.';
  }

  getAllSandboxFiles(): DriveItem[] {
    return [...this.sandboxFiles];
  }
}

export const driveService = new DriveService();
