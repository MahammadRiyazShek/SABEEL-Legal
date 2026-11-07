/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fuzzyMatchDocument,
  buildDocumentGraph,
  findInterconnectionPath,
  generateLargeInterconnectedCorpus,
  levenshteinDistance,
  normalizePhonetic,
  LegalDocumentNode,
} from './documentGraph.ts';

test('levenshteinDistance computes edit distance correctly', () => {
  assert.equal(levenshteinDistance('shamshabad', 'shamshabad'), 0);
  assert.equal(levenshteinDistance('shamshabad', 'shamchabaz') <= 4, true);
  assert.equal(levenshteinDistance('peddashahpur', 'pidashop') <= 6, true);
});

test('fuzzyMatchDocument resolves speech transcription typos from user screenshot', () => {
  const sampleDocs: LegalDocumentNode[] = [
    {
      id: 'doc-1',
      title: 'B-184-2026 Letter to RDO',
      category: 'RDO',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#B-184-2026-RDO',
      date: '2026-10-18',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['RDO Rajendranagar'],
      citations: [],
      summary: 'Letter to RDO',
      pdfFileName: 'B-184-2026 letter to RDO.pdf',
    },
    {
      id: 'doc-2',
      title: 'Shamshabad 626 Demarcation Report',
      category: 'Revenue',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#SHAM-626-DEMARC',
      date: '2026-08-14',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Pattadars'],
      citations: [],
      summary: 'Inspection report for Sy 626 Shamshabad',
      pdfFileName: 'Shamshabad 626.pdf',
    },
    {
      id: 'doc-3',
      title: 'BRIEF NOTE of Peddashahpur Land',
      category: 'Revenue',
      village: 'Peddashahpur',
      surveyNumber: '45',
      uniqueTag: '#PEDDA-45-BRIEF',
      date: '2026-07-29',
      assignedLawyer: 'Adv. Fatima Begum',
      parties: ['Syed Munawwar Ali'],
      citations: [],
      summary: 'Title memo for Peddashahpur land Sy 45',
      pdfFileName: 'BRIEF NOTE of Peddashahpur land.pdf',
    },
  ];

  // 1. "shamchabaz 626" (speech typo in user screenshot) -> Shamshabad 626.pdf
  const match1 = fuzzyMatchDocument('shamchabaz 626', sampleDocs);
  assert.ok(match1, 'Should find match for shamchabaz 626');
  assert.equal(match1?.document.pdfFileName, 'Shamshabad 626.pdf');

  // 2. "pida shop" (speech typo in user screenshot) -> BRIEF NOTE of Peddashahpur land.pdf
  const match2 = fuzzyMatchDocument('pida shop', sampleDocs);
  assert.ok(match2, 'Should find match for pida shop');
  assert.equal(match2?.document.pdfFileName, 'BRIEF NOTE of Peddashahpur land.pdf');

  // 3. "send shamshabad 626 document" -> Shamshabad 626.pdf
  const match3 = fuzzyMatchDocument('send shamshabad 626 document', sampleDocs);
  assert.ok(match3);
  assert.equal(match3?.document.pdfFileName, 'Shamshabad 626.pdf');

  // 4. "letter to rdo" -> B-184-2026 letter to RDO.pdf
  const match4 = fuzzyMatchDocument('letter to rdo', sampleDocs);
  assert.ok(match4);
  assert.equal(match4?.document.pdfFileName, 'B-184-2026 letter to RDO.pdf');
});

test('buildDocumentGraph links documents by survey number, title chain, and explicit citations', () => {
  const docs: LegalDocumentNode[] = [
    {
      id: 'doc-rdo',
      title: 'B-184-2026 Letter to RDO',
      category: 'RDO',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#B-184-2026-RDO',
      date: '2026-10-18',
      assignedLawyer: 'Adv. Riyaz',
      parties: ['RDO Rajendranagar', 'Abdul Quddus'],
      citations: ['Shamshabad 626.pdf'],
      summary: 'Letter to RDO citing Shamshabad 626.pdf',
      pdfFileName: 'B-184-2026 letter to RDO.pdf',
    },
    {
      id: 'doc-rev',
      title: 'Shamshabad 626 Demarcation',
      category: 'Revenue',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#SHAM-626-REV',
      date: '2026-08-14',
      assignedLawyer: 'Adv. Riyaz',
      parties: ['Abdul Quddus'],
      citations: [],
      summary: 'Demarcation in 626',
      pdfFileName: 'Shamshabad 626.pdf',
    },
  ];

  const graph = buildDocumentGraph(docs);
  assert.equal(graph.nodes.length, 2);
  assert.ok(graph.edges.length >= 1, 'Should find at least 1 edge between related documents');

  const edgeTypes = graph.edges.map(e => e.type);
  assert.ok(
    edgeTypes.includes('TITLE_CHAIN') || edgeTypes.includes('SURVEY_NUMBER') || edgeTypes.includes('EXPLICIT_CITATION'),
    'Should have detected legal relationship'
  );
});

test('findInterconnectionPath discovers multi-hop evidentiary chain', () => {
  const docs: LegalDocumentNode[] = [
    {
      id: 'doc-a',
      title: 'Sale Deed 1995',
      category: 'Revenue',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#DEED-1995',
      date: '1995-01-01',
      assignedLawyer: 'Adv. Riyaz',
      parties: ['Vendor', 'Vendee'],
      citations: [],
      summary: 'Registered deed',
    },
    {
      id: 'doc-b',
      title: 'Tahsildar Mutation 2018',
      category: 'Revenue',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#MUT-2018',
      date: '2018-05-10',
      assignedLawyer: 'Adv. Riyaz',
      parties: ['Vendee', 'Tahsildar'],
      citations: ['#DEED-1995'],
      summary: 'Mutation proceeding',
    },
    {
      id: 'doc-c',
      title: 'High Court Writ Petition 2026',
      category: 'Court H.C.',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#WP-2026',
      date: '2026-10-12',
      assignedLawyer: 'Adv. Riyaz',
      parties: ['Vendee', 'State of Telangana'],
      citations: ['#MUT-2018'],
      summary: 'Injunction stay',
    },
  ];

  const network = buildDocumentGraph(docs);
  const pathResult = findInterconnectionPath('doc-a', 'doc-c', network);
  assert.ok(pathResult, 'Should find path between Doc A and Doc C');
  assert.equal(pathResult?.path[0].id, 'doc-a');
  assert.equal(pathResult?.path[pathResult.path.length - 1].id, 'doc-c');
});

test('generateLargeInterconnectedCorpus generates 1,000+ interconnected documents', () => {
  const corpus = generateLargeInterconnectedCorpus(1050);
  assert.ok(corpus.length >= 1050, 'Corpus should contain at least 1050 documents');

  // Verify key screenshot documents are present
  const hasRdoLetter = corpus.some(d => d.pdfFileName === 'B-184-2026 letter to RDO.pdf');
  const hasSham626 = corpus.some(d => d.pdfFileName === 'Shamshabad 626.pdf');
  const hasShamBrief = corpus.some(d => d.pdfFileName === 'New Brief of Shamshabad Village.pdf');
  const hasPeddaBrief = corpus.some(d => d.pdfFileName === 'BRIEF NOTE of Peddashahpur land.pdf');

  assert.ok(hasRdoLetter, 'Must contain B-184-2026 letter to RDO.pdf');
  assert.ok(hasSham626, 'Must contain Shamshabad 626.pdf');
  assert.ok(hasShamBrief, 'Must contain New Brief of Shamshabad Village.pdf');
  assert.ok(hasPeddaBrief, 'Must contain BRIEF NOTE of Peddashahpur land.pdf');

  // Verify graph generation over scale
  const graph = buildDocumentGraph(corpus.slice(0, 50));
  assert.ok(graph.edges.length > 20, 'Should form interconnected edges across documents');
});
