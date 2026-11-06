import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDocumentForDrive,
  formatBytes,
  sanitizeFilename,
  buildFolderPath,
} from './driveOrganizer';
import { DriveItem } from '../types/assistant';

test('classifyDocumentForDrive classifies financial documents accurately', () => {
  const result1 = classifyDocumentForDrive('Vendor_Invoice_INV2026.pdf', 'Total amount due: $1,250.00 with tax breakdown');
  assert.equal(result1.folderCategory, 'Financial');
  assert.equal(result1.folderName, 'Financial & Invoices');

  const result2 = classifyDocumentForDrive('Q4_Receipt.png');
  assert.equal(result2.folderCategory, 'Financial');
});

test('classifyDocumentForDrive classifies legal contracts accurately', () => {
  const result = classifyDocumentForDrive('Master_Services_Agreement_Signed.docx', 'Confidentiality terms and non-disclosure obligations');
  assert.equal(result.folderCategory, 'Legal & Contracts');
  assert.equal(result.folderName, 'Legal & Contracts');
});

test('classifyDocumentForDrive classifies personal credentials and work documents', () => {
  const idResult = classifyDocumentForDrive('Passport_Copy.pdf');
  assert.equal(idResult.folderCategory, 'Identity & Personal');

  const workResult = classifyDocumentForDrive('Q4_Quarterly_Strategy_Report.pdf', 'Executive summary of key results and engineering roadmap');
  assert.equal(workResult.folderCategory, 'Work & Reports');

  const genResult = classifyDocumentForDrive('random_notes.txt', 'quick grocery list');
  assert.equal(genResult.folderCategory, 'General');
});

test('formatBytes produces readable strings', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');
});

test('sanitizeFilename removes illegal characters', () => {
  assert.equal(sanitizeFilename('report: 2026/10*final?.pdf'), 'report_ 2026_10_final_.pdf');
});

test('buildFolderPath traces parent folder hierarchy', () => {
  const folders: DriveItem[] = [
    {
      id: 'f_root_assistant',
      name: 'WhatsApp Assistant',
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
      parents: ['root'],
      createdTime: '',
      modifiedTime: '',
    },
    {
      id: 'f_invoices',
      name: 'Invoices',
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
      parents: ['f_root_assistant'],
      createdTime: '',
      modifiedTime: '',
    },
  ];

  const path = buildFolderPath('f_invoices', folders);
  assert.equal(path.length, 3);
  assert.equal(path[0].name, 'My Drive');
  assert.equal(path[1].name, 'WhatsApp Assistant');
  assert.equal(path[2].name, 'Invoices');
});
