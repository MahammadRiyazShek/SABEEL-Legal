/**
 * Google Drive Explorer Component
 * Manages Google Drive folders, files, uploads, and automated categorization.
 * Supports both Live Google Drive OAuth connection and Sandbox storage.
 */

import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Eye,
  FileCheck,
  Tag,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DriveItem } from '../types/assistant';
import { driveService } from '../services/driveService';
import { formatBytes, buildFolderPath, classifyDocumentForDrive } from '../utils/driveOrganizer';
import { DestructiveModal } from './DestructiveModal';
import { GoogleSignInButton } from './GoogleSignInButton';
import { googleSignIn, logout, getCurrentUser, switchAccount } from '../services/firebaseAuth';
import { ragService } from '../services/ragService';

interface GoogleDriveExplorerProps {
  onSelectDocumentForChat?: (doc: { title: string; content: string }) => void;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({
  onSelectDocumentForChat,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [items, setItems] = useState<DriveItem[]>([]);
  const [allFolders, setAllFolders] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [user, setUser] = useState<any>(null);

  // Modals state
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DriveItem | null>(null);

  // Destructive modal state
  const [itemToDelete, setItemToDelete] = useState<DriveItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification / notice
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    loadFiles();
  }, [currentFolderId]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await driveService.listFiles(currentFolderId, searchQuery);
      setItems(res.files);
      setIsLiveConnected(res.isLive);
      if (res.error) {
        setNotice(res.error);
      } else {
        setNotice(null);
      }

      // Also get all folders for breadcrumb tracing
      const allRes = await driveService.listFiles('all');
      setAllFolders(allRes.files.filter(f => f.isFolder));
    } catch (err: any) {
      console.error('Failed to load drive files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setIsLiveConnected(true);
        setNotice('Connected to Live Google Drive successfully!');
        loadFiles();
      }
    } catch (err: any) {
      setNotice(`Google Sign-In note: ${err.message || 'Popup closed'}. Using sandbox storage.`);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setIsLiveConnected(false);
    setNotice('Disconnected from Google Drive. Active storage is sandbox.');
    loadFiles();
  };

  const handleSwitchAccount = async () => {
    try {
      const result = await switchAccount();
      if (result) {
        setUser(result.user);
        setIsLiveConnected(true);
        setNotice(`Switched Google Drive account to: ${result.user.email}`);
        loadFiles();
      }
    } catch (err: any) {
      setNotice(`Account switch note: ${err.message || 'Cancelled'}`);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    await driveService.createFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName('');
    setIsCreateFolderOpen(false);
    loadFiles();
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) return;

    const res = await driveService.uploadFile(
      uploadFileName.trim(),
      'text/plain',
      uploadContent.trim() || 'Uploaded document content via assistant dashboard.',
      currentFolderId
    );

    // Auto index to RAG
    ragService.indexDocument(
      res.file.name,
      uploadContent.trim() || 'Sample document content',
      'text/plain',
      res.file.id,
      res.file.category
    );

    setUploadFileName('');
    setUploadContent('');
    setIsUploadOpen(false);
    setNotice(`Document saved and organized into '${res.targetFolder}'!`);
    loadFiles();
  };

  const handleDeleteConfirmed = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await driveService.deleteFile(itemToDelete.id);
      setItemToDelete(null);
      loadFiles();
    } catch (err: any) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Breadcrumbs
  const breadcrumbs = buildFolderPath(currentFolderId, allFolders);

  // Filter items
  const filteredItems = items.filter(item => {
    const matchCategory =
      selectedCategory === 'All'
        ? true
        : item.category === selectedCategory || (item.isFolder && selectedCategory === 'Folders');
    return matchCategory;
  });

  const uploadClassification = uploadFileName
    ? classifyDocumentForDrive(uploadFileName, uploadContent)
    : null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Top Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Google Drive Integration</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  isLiveConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isLiveConnected ? 'Live Google Drive' : 'Sandbox Storage (Ready for Cloud Run)'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {isLiveConnected
                ? `Connected to ${user?.email || 'Google Drive'}. Any user can connect their own Drive or switch accounts.`
                : 'Anyone can connect their own Google Drive account via popup. No account is hardcoded or shared.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {user ? (
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                <div className="text-right sm:mr-1">
                  <div className="text-xs font-semibold text-zinc-200">{user.displayName || user.email}</div>
                  <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> User Connected
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSwitchAccount}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition-colors"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <GoogleSignInButton
                  onClick={handleSignIn}
                  label="Connect Your Google Drive"
                />
              </div>
            )}
          </div>
        </div>

        {notice && (
          <div className="mt-3 text-xs p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              {notice}
            </span>
            <button
              onClick={() => setNotice(null)}
              className="text-zinc-500 hover:text-zinc-300 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action bar & Breadcrumbs */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
          {/* Breadcrumb nav */}
          <nav aria-label="Drive path" className="flex items-center gap-1.5 text-xs text-zinc-400 overflow-x-auto py-1">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-zinc-600">/</span>}
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`hover:text-white transition-colors py-1 px-1.5 rounded-md ${
                      isLast ? 'font-semibold text-white bg-zinc-800' : 'text-zinc-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
              New Folder
            </button>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Document
            </button>
            <button
              onClick={loadFiles}
              aria-label="Refresh files"
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Financial', 'Legal & Contracts', 'Work & Reports', 'Identity & Personal'].map(
            cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-zinc-100 text-zinc-900 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Drive files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadFiles()}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* File & Folder Grid */}
      <div className="p-4 sm:p-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <span className="text-sm">Loading Google Drive items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center border-2 border-dashed border-zinc-800/80 rounded-2xl p-6">
            <Folder className="w-12 h-12 text-zinc-700 mb-3 stroke-1" />
            <h3 className="text-sm font-medium text-zinc-300">No documents in this folder</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Send a document via the WhatsApp interface or click "Upload Document" to automatically organize files into Google Drive.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="mt-4 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              Upload Sample File
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          item.isFolder
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {item.isFolder ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        {item.isFolder ? (
                          <button
                            onClick={() => setCurrentFolderId(item.id)}
                            className="text-xs font-semibold text-zinc-200 hover:text-blue-400 transition-colors truncate block text-left w-full"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <div className="text-xs font-medium text-zinc-200 truncate" title={item.name}>
                            {item.name}
                          </div>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {item.isFolder ? 'Folder' : formatBytes(item.size)} •{' '}
                          {new Date(item.modifiedTime || item.createdTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {!item.isFolder && (
                        <button
                          onClick={() => setPreviewDoc(item)}
                          title="Preview & RAG chunks"
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setItemToDelete(item)}
                        title="Delete from Drive"
                        className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.category && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                        {item.category}
                      </span>
                      {item.tags?.map(t => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {!item.isFolder && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <FileCheck className="w-3 h-3" /> Indexed in RAG
                    </span>
                    {onSelectDocumentForChat && (
                      <button
                        onClick={() =>
                          onSelectDocumentForChat({
                            title: item.name,
                            content: item.content || '',
                          })
                        }
                        className="text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Ask Assistant
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-zinc-100">
            <h3 className="text-sm font-semibold">Create New Drive Folder</h3>
            <form onSubmit={handleCreateFolder} className="mt-3">
              <input
                type="text"
                placeholder="Folder name (e.g., Invoices 2026)"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                autoFocus
                className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-blue-500"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-zinc-100">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Upload & Organize Document
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              DriveGenie will classify this file and route it to the appropriate Google Drive folder.
            </p>

            <form onSubmit={handleUploadDocument} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Document Title / Filename</label>
                <input
                  type="text"
                  placeholder="e.g. Master_Services_Agreement_Q4.pdf"
                  value={uploadFileName}
                  onChange={e => setUploadFileName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {uploadClassification && (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                  <span className="font-semibold text-blue-400">Target Folder: </span>
                  <span className="text-zinc-200">{uploadClassification.folderName}</span>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Category: {uploadClassification.folderCategory} • Tags: {uploadClassification.suggestedTags.join(', ')}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Document Text Content</label>
                <textarea
                  rows={5}
                  placeholder="Paste document text or contracts to chunk and index in RAG..."
                  value={uploadContent}
                  onChange={e => setUploadContent(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Upload & Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-zinc-100 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate">{previewDoc.name}</h3>
                <span className="text-[10px] text-zinc-400">
                  Category: {previewDoc.category} • Size: {formatBytes(previewDoc.size)}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded-md"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {previewDoc.content || 'No text extracted for this document.'}
            </div>

            <div className="mt-4 flex justify-between items-center pt-2 border-t border-zinc-800">
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5" /> Ready for RAG queries
              </span>
              {onSelectDocumentForChat && (
                <button
                  onClick={() => {
                    onSelectDocumentForChat({
                      title: previewDoc.name,
                      content: previewDoc.content || '',
                    });
                    setPreviewDoc(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Ask Assistant About This
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Destructive Operation Confirmation Dialog */}
      <DestructiveModal
        isOpen={!!itemToDelete}
        title="Delete Google Drive Item?"
        description={`Are you sure you want to permanently delete "${itemToDelete?.name}"? This action removes the file from Google Drive and RAG knowledge search.`}
        itemName={itemToDelete?.name}
        isProcessing={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
