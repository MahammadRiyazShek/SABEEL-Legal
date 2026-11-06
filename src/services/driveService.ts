/**
 * Google Drive Service
 * Interacts with Google Drive REST API v3 when OAuth access token is provided,
 * and maintains a persistent sandbox Drive environment for local development & preview.
 */

import { DriveItem } from '../types/assistant';
import { classifyDocumentForDrive, formatBytes } from '../utils/driveOrganizer';
import { getAccessToken } from './firebaseAuth';

const INITIAL_SANDBOX_FILES: DriveItem[] = [];

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
      throw new Error('Browser storage is full or unavailable. Connect Google Drive before uploading large files.');
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
        let q = folderId === 'all' ? 'trashed = false' : `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
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
          files: [],
          isLive: false,
          error: `Google Drive request failed: ${err.message}. No local files substituted. Reconnect if the token expired.`,
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
        throw new Error(`Google Drive folder creation failed (${res.status}): ${await res.text()}`);
      } catch (err) {
        throw err;
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
        throw new Error(`Google Drive upload failed (${res.status}): ${await res.text()}`);
      } catch (err) {
        throw err;
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
    if (rootRes.error) throw new Error(rootRes.error);
    let assistantFolder = rootRes.files.find(
      f => f.isFolder && f.name.toLowerCase() === 'whatsapp assistant'
    );

    if (!assistantFolder) {
      const created = await this.createFolder('WhatsApp Assistant', 'root');
      assistantFolder = created.folder;
    }

    const subRes = await this.listFiles(assistantFolder.id);
    if (subRes.error) throw new Error(subRes.error);
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
        throw new Error(`Google Drive deletion failed (${res.status}).`);
      } catch (err) {
        throw err;
      }
    }

    this.sandboxFiles = this.sandboxFiles.filter(f => f.id !== fileId);
    this.saveSandbox();
    return { success: true, isLive: false };
  }

  /**
   * Get file content
   */
  async getFileContent(fileId: string, mimeType = 'text/plain'): Promise<string> {
    const accessToken = await getAccessToken();

    if (accessToken) {
      try {
        const endpoint = mimeType === 'application/vnd.google-apps.document' ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain` : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          return await res.text();
        }
        throw new Error(`Google Drive download failed (${res.status}).`);
      } catch (err) {
        throw err;
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
