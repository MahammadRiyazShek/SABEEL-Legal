import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkDocument,
  computeKeywordScore,
  filterDocuments,
  rankDocumentChunks,
  findDocumentConflicts,
  cosineSimilarity,
  LegalDocument,
} from './ragEngine.ts';

const mockDocs: LegalDocument[] = [
  {
    id: 'doc-1',
    title: 'High Court Interim Injunction Order Sy No 142',
    category: 'Court H.C.',
    village: 'Shamshabad',
    surveyNumber: '142',
    uniqueTag: 'SHAM-142-HC-ORDER',
    date: '2026-10-15',
    nextHearingDate: '2026-11-14',
    caseNumber: 'WP 18942/2026',
    assignedLawyer: 'Adv. M.A. Riyaz',
    content: 'High Court of Telangana granted interim status quo in respect of land in Survey No 142 Shamshabad village against illegal encroachment.',
    fileType: 'pdf',
    drivePath: 'Google Drive/Court H.C./Shamshabad_Sy142_Order.pdf',
    status: 'active',
  },
  {
    id: 'doc-2',
    title: 'Moinabad Revenue Mutation Proceedings Sy No 88',
    category: 'Revenue',
    village: 'Moinabad',
    surveyNumber: '88',
    uniqueTag: 'MOIN-88-REV-MUT',
    date: '2026-09-02',
    assignedLawyer: 'Adv. Fatima Begum',
    content: 'Tahsildar Moinabad issued revised Pattadar passbook proceedings for Sy No 88 measuring 4.20 guntas.',
    fileType: 'pdf',
    drivePath: 'Google Drive/Revenue/Moinabad_Sy88_Passbook.pdf',
    status: 'active',
  },
];

test('chunkDocument slices long text into overlapping chunks', () => {
  const sample = Array(100).fill('legal word').join(' ');
  const chunks = chunkDocument(sample, 40, 10);
  assert.ok(chunks.length > 1);
});

test('filterDocuments filters accurately by village, survey number, and category', () => {
  const shamDocs = filterDocuments(mockDocs, { village: 'Shamshabad' });
  assert.equal(shamDocs.length, 1);
  assert.equal(shamDocs[0].surveyNumber, '142');

  const revDocs = filterDocuments(mockDocs, { category: 'Revenue' });
  assert.equal(revDocs.length, 1);
  assert.equal(revDocs[0].village, 'Moinabad');
});

test('rankDocumentChunks ranks relevant chunks highest', () => {
  const results = rankDocumentChunks('Shamshabad injunction', mockDocs, 2);
  assert.ok(results.length > 0);
  assert.equal(results[0].documentId, 'doc-1');
});

test('cosineSimilarity calculates geometric vector angle accurately', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
  assert.ok(cosineSimilarity([1, 1], [1, 0]) > 0.7);
});

test('findDocumentConflicts discovers contradictions between documents on same survey number', () => {
  const docsWithConflict: LegalDocument[] = [
    mockDocs[0], // High Court order Sy 142 Shamshabad
    {
      id: 'doc-police-1',
      title: 'Police Panchanama Trespass Complaint',
      category: 'Police',
      village: 'Shamshabad',
      surveyNumber: '142',
      uniqueTag: 'SHAM-142-POL-DISPUTE',
      date: '2026-10-20',
      assignedLawyer: 'Adv. M.A. Riyaz',
      content: 'Police investigated boundary demolition on Sy No 142 Shamshabad.',
      fileType: 'pdf',
      drivePath: 'Google Drive/Police/Shamshabad/FIR.pdf',
      status: 'active',
    },
  ];

  const conflicts = findDocumentConflicts(docsWithConflict);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].conflictType, 'stay_violation');
  assert.equal(conflicts[0].surveyNumber, '142');
});
