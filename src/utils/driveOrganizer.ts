/**
 * Google Drive document organization pure logic
 */

import { DriveItem } from '../types/assistant';

export interface FolderClassification {
  folderName: string;
  folderCategory: DriveItem['category'];
  suggestedTags: string[];
  description: string;
}

/**
 * Categorize a document by its filename and content keywords
 */
export function classifyDocumentForDrive(
  filename: string,
  contentSample = ''
): FolderClassification {
  const nameLower = filename.toLowerCase();
  const contentLower = contentSample.toLowerCase();
  const combined = `${nameLower} ${contentLower}`;

  // Financial documents (Invoices, Receipts, Bank Statements, Budgets)
  if (
    /invoice|receipt|tax|bill|payroll|expense|salary|w2|1099|statement|balance sheet|profit loss|budget/i.test(combined)
  ) {
    return {
      folderName: 'Financial & Invoices',
      folderCategory: 'Financial',
      suggestedTags: ['Finance', 'Accounting', 'Receipts'],
      description: 'Invoices, bank statements, tax records, and budgets',
    };
  }

  // Legal and Contracts (Agreements, NDAs, Leases, Policies, Terms)
  if (
    /contract|agreement|nda|lease|terms|privacy policy|mou|settlement|deed|bylaws|compliance/i.test(combined)
  ) {
    return {
      folderName: 'Legal & Contracts',
      folderCategory: 'Legal & Contracts',
      suggestedTags: ['Legal', 'Agreements', 'Contracts'],
      description: 'Employment agreements, NDAs, legal policies, and signed contracts',
    };
  }

  // Identity and Personal (Passport, ID, License, Medical, Resume, CV)
  if (
    /passport|license|resume|curriculum vitae|cv|certificate|visa|medical|health record|insurance/i.test(combined)
  ) {
    return {
      folderName: 'Identity & Personal',
      folderCategory: 'Identity & Personal',
      suggestedTags: ['Personal', 'ID', 'Credentials'],
      description: 'Identification cards, credentials, resumes, and medical records',
    };
  }

  // Work, Projects, and Reports
  if (
    /report|presentation|roadmap|deck|quarterly|specs|brief|meeting minutes|proposal|project/i.test(combined)
  ) {
    return {
      folderName: 'Work & Reports',
      folderCategory: 'Work & Reports',
      suggestedTags: ['Work', 'Project', 'Reports'],
      description: 'Work reports, project briefs, slides, and engineering specifications',
    };
  }

  return {
    folderName: 'General Documents',
    folderCategory: 'General',
    suggestedTags: ['Document', 'Inbox'],
    description: 'General correspondence and miscellaneous files',
  };
}

/**
 * Format bytes into readable format
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Sanitize filename for safe Drive storage
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'untitled_document';
}

/**
 * Helper to build folder path breadcrumbs
 */
export function buildFolderPath(
  folderId: string | null,
  allFolders: DriveItem[]
): Array<{ id: string; name: string }> {
  if (!folderId || folderId === 'root') {
    return [{ id: 'root', name: 'My Drive' }];
  }

  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | undefined = folderId;

  while (currentId && currentId !== 'root') {
    const found = allFolders.find(f => f.id === currentId);
    if (!found) break;
    path.unshift({ id: found.id, name: found.name });
    currentId = found.parents?.[0];
  }

  path.unshift({ id: 'root', name: 'My Drive' });
  return path;
}
