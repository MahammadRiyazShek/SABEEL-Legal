/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LegalDocumentNode {
  id: string;
  title: string;
  category: 'Court H.C.' | 'Court S.C.' | 'Court L.C.' | 'Revenue' | 'HMDA' | 'Police' | 'A.D.' | 'RDO';
  village: string;
  surveyNumber: string;
  uniqueTag: string;
  date: string;
  assignedLawyer: string;
  parties: string[];
  citations: string[]; // mentions of other case numbers, doc tags, or file names
  summary: string;
  fileSize?: string;
  pdfFileName?: string;
}

export type InterconnectionType =
  | 'SURVEY_NUMBER'       // Identical survey number & sub-division
  | 'TITLE_CHAIN'         // Chronological chain of ownership (Pahani -> Sale Deed -> Mutation -> Writ Petition)
  | 'COMMON_AUTHORITY'    // Same magistrate, RDO, or Tahsildar
  | 'COMMON_PARTIES'      // Same petitioner, respondent, or adverse claimant
  | 'EXPLICIT_CITATION'   // One document directly references or attaches another
  | 'VILLAGE_CLUSTER';    // Common village land boundary

export interface GraphEdge {
  id: string;
  source: string; // doc id
  target: string; // doc id
  type: InterconnectionType;
  strength: number; // 0 to 1
  label: string;
  explanation: string;
}

export interface InterconnectionNetwork {
  nodes: LegalDocumentNode[];
  edges: GraphEdge[];
  clusters: Record<string, string[]>; // clusterId -> docIds
}

// ==========================================
// 1. Phonetic & Fuzzy Document Matcher
// Handles speech-to-text typos like:
// "shamchabaz 626" -> "Shamshabad 626.pdf"
// "pida shop" -> "BRIEF NOTE of Peddashahpur land.pdf"
// ==========================================

export function normalizePhonetic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance for fuzzy string comparison
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Phonetic alias dictionary for speech-to-text slips in Hyderabadi Urdu context
 */
const PHONETIC_ALIASES: Record<string, string[]> = {
  shamshabad: ['shamchabaz', 'shamshabaad', 'shamsabad', 'shams abad', 'shamshapat', 'shamsha'],
  peddashahpur: ['pida shop', 'pedda shahpur', 'pedashapur', 'pidashop', 'peddashapur', 'pedda shah pur'],
  moinabad: ['moynabad', 'moinbaad', 'moeenabad', 'moyanabad'],
  rajendranagar: ['rajendra nagar', 'rajendranagr', 'rajendranagur'],
  chevella: ['chevla', 'chevalla', 'chewella', 'chevela'],
  maheshwaram: ['maheswaram', 'maheshwarm', 'maheswaramu'],
  rdo: ['r d o', 'ardo', 'aado', 'revenue divisional officer', 'rdo office'],
  tahsildar: ['tehsildar', 'tahsildhar', 'tasildar', 'tahsildar sahab'],
};

export function fuzzyMatchDocument(
  query: string,
  documents: LegalDocumentNode[]
): { document: LegalDocumentNode; score: number; reason: string } | null {
  const cleanQuery = normalizePhonetic(query);
  if (!cleanQuery) return null;

  // 1. Direct tag or filename match
  for (const doc of documents) {
    if (doc.uniqueTag && cleanQuery.includes(doc.uniqueTag.toLowerCase())) {
      return { document: doc, score: 1.0, reason: `Exact unique tag match (${doc.uniqueTag})` };
    }
    if (doc.pdfFileName && cleanQuery.includes(normalizePhonetic(doc.pdfFileName))) {
      return { document: doc, score: 0.98, reason: `Exact file name match (${doc.pdfFileName})` };
    }
  }

  // 2. Expand query using phonetic alias mapping
  let expandedQuery = cleanQuery;
  for (const [canonical, aliases] of Object.entries(PHONETIC_ALIASES)) {
    for (const alias of aliases) {
      if (cleanQuery.includes(alias)) {
        expandedQuery = expandedQuery.replace(new RegExp(`\\b${alias}\\b`, 'gi'), canonical);
      }
    }
  }

  // Check if query is looking for survey number and village
  const numbersInQuery = expandedQuery.match(/\d+/g) || [];

  let bestMatch: LegalDocumentNode | null = null;
  let highestScore = 0;
  let bestReason = '';

  for (const doc of documents) {
    let score = 0;
    const reasons: string[] = [];

    const docTarget = normalizePhonetic(
      `${doc.title} ${doc.pdfFileName || ''} ${doc.village} ${doc.surveyNumber} ${doc.uniqueTag}`
    );

    // Number matching (critical for legal survey/case numbers like 626, 142, 184)
    for (const num of numbersInQuery) {
      if (doc.surveyNumber.includes(num) || doc.title.includes(num) || (doc.pdfFileName && doc.pdfFileName.includes(num))) {
        score += 0.45;
        reasons.push(`Survey/Number ${num} match`);
      }
    }

    // Village matching
    if (doc.village && expandedQuery.includes(doc.village.toLowerCase())) {
      score += 0.35;
      reasons.push(`Village ${doc.village} match`);
    }

    // Keyword matching
    const queryTokens = expandedQuery.split(' ').filter(t => t.length > 2);
    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (docTarget.includes(token)) {
        tokenMatches++;
      } else {
        // Fuzzy token similarity
        const words = docTarget.split(' ');
        for (const w of words) {
          if (w.length >= 4 && Math.abs(w.length - token.length) <= 2) {
            const dist = levenshteinDistance(token, w);
            if (dist <= 2) {
              tokenMatches += 0.7;
              break;
            }
          }
        }
      }
    }

    // Specific filename stem match (e.g. "Shamshabad 626.pdf" vs query "shamshabad 626")
    if (doc.pdfFileName) {
      const fileStem = normalizePhonetic(doc.pdfFileName.replace(/\.pdf$/i, ''));
      if (expandedQuery === fileStem || fileStem.includes(expandedQuery) || expandedQuery.includes(fileStem)) {
        score += 0.55;
        reasons.push(`File name match (${doc.pdfFileName})`);
      }
    }

    // Direct title match
    const titleClean = normalizePhonetic(doc.title);
    if (expandedQuery === titleClean || titleClean.includes(expandedQuery) || expandedQuery.includes(titleClean)) {
      score += 0.4;
      reasons.push(`Document title match`);
    }

    // Negative bias if query did not ask for RDO but doc is specifically an RDO letter
    if (!cleanQuery.includes('rdo') && !cleanQuery.includes('letter') && (doc.category === 'RDO' || doc.pdfFileName?.toLowerCase().includes('rdo'))) {
      score -= 0.2;
    }

    // Positive bias if query explicitly asks for RDO or letter
    if ((cleanQuery.includes('rdo') || cleanQuery.includes('letter')) && (doc.category === 'RDO' || doc.pdfFileName?.toLowerCase().includes('rdo'))) {
      score += 0.4;
      reasons.push('RDO proceeding requested');
    }

    if (queryTokens.length > 0) {
      score += (tokenMatches / queryTokens.length) * 0.3;
    }

    if (score > highestScore && score >= 0.45) {
      highestScore = score;
      bestMatch = doc;
      bestReason = reasons.join(', ') || 'Fuzzy text similarity';
    }
  }

  if (bestMatch) {
    return { document: bestMatch, score: Math.min(highestScore, 0.99), reason: bestReason };
  }
  return null;
}

// ==========================================
// 2. Interconnection Knowledge Graph Builder
// Discovers how 1000s of documents are linked
// ==========================================

export function buildDocumentGraph(documents: LegalDocumentNode[]): InterconnectionNetwork {
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  const addEdge = (
    source: string,
    target: string,
    type: InterconnectionType,
    strength: number,
    label: string,
    explanation: string
  ) => {
    if (source === target) return;
    const key = source < target ? `${source}--${target}--${type}` : `${target}--${source}--${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);

    edges.push({
      id: `edge-${edges.length + 1}`,
      source,
      target,
      type,
      strength,
      label,
      explanation,
    });
  };

  // Group by Survey Number
  const surveyMap = new Map<string, LegalDocumentNode[]>();
  // Group by Village
  const villageMap = new Map<string, LegalDocumentNode[]>();

  for (const doc of documents) {
    // Key by Village + Survey Number for precise land parcel identification
    if (doc.surveyNumber && doc.village) {
      const landKey = `${doc.village.toLowerCase()}:${doc.surveyNumber.split('/')[0]}`.trim();
      if (!surveyMap.has(landKey)) surveyMap.set(landKey, []);
      surveyMap.get(landKey)!.push(doc);
    }

    if (doc.village) {
      const vKey = doc.village.toLowerCase();
      if (!villageMap.has(vKey)) villageMap.set(vKey, []);
      villageMap.get(vKey)!.push(doc);
    }
  }

  // 1. Survey Number & Land Parcel Linkages (Strongest interconnection)
  for (const [landKey, docs] of surveyMap.entries()) {
    if (docs.length > 1) {
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          const d1 = docs[i];
          const d2 = docs[j];

          // Check if Title Chain (chronological relationship between deed, mutation, and court stay)
          const isTitleChain =
            (d1.category === 'Revenue' && d2.category === 'Court H.C.') ||
            (d1.category === 'Court H.C.' && d2.category === 'Revenue') ||
            (d1.category === 'Revenue' && d2.category === 'Police') ||
            (d1.category === 'Court L.C.' && d2.category === 'Court H.C.') ||
            (d1.category === 'RDO' && d2.category === 'Revenue') ||
            (d1.category === 'RDO' && d2.category === 'Court H.C.');

          if (isTitleChain) {
            addEdge(
              d1.id,
              d2.id,
              'TITLE_CHAIN',
              0.95,
              'Title & Proceeding Chain',
              `Both documents relate to land in ${landKey.toUpperCase()}. Forms direct chain from revenue proceeding to court order.`
            );
          } else {
            addEdge(
              d1.id,
              d2.id,
              'SURVEY_NUMBER',
              0.9,
              `Same Sy No (${d1.surveyNumber})`,
              `Directly tied to the same parcel in ${d1.village} (Sy.No ${d1.surveyNumber}).`
            );
          }
        }
      }
    }
  }

  // 2. Explicit Cross-Citations and References
  for (let i = 0; i < documents.length; i++) {
    const docA = documents[i];
    const textA = `${docA.title} ${docA.summary} ${docA.uniqueTag} ${(docA.citations || []).join(' ')}`.toLowerCase();

    for (let j = i + 1; j < documents.length; j++) {
      const docB = documents[j];

      // Check if docA references docB's tag, case, or filename
      const refDirect =
        (docB.uniqueTag && textA.includes(docB.uniqueTag.toLowerCase())) ||
        (docB.pdfFileName && textA.includes(docB.pdfFileName.toLowerCase().replace('.pdf', '')));

      const textB = `${docB.title} ${docB.summary} ${docB.uniqueTag} ${(docB.citations || []).join(' ')}`.toLowerCase();
      const refReverse =
        (docA.uniqueTag && textB.includes(docA.uniqueTag.toLowerCase())) ||
        (docA.pdfFileName && textB.includes(docA.pdfFileName.toLowerCase().replace('.pdf', '')));

      if (refDirect || refReverse) {
        addEdge(
          docA.id,
          docB.id,
          'EXPLICIT_CITATION',
          1.0,
          'Direct Legal Reference',
          `Directly cites and incorporates legal pleadings/orders between "${docA.title}" and "${docB.title}".`
        );
      }

      // Check common parties
      const commonParties = (docA.parties || []).filter(p =>
        (docB.parties || []).some(bp => bp.toLowerCase() === p.toLowerCase() && p.length > 4)
      );
      if (commonParties.length > 0) {
        addEdge(
          docA.id,
          docB.id,
          'COMMON_PARTIES',
          0.8,
          `Common Party: ${commonParties[0]}`,
          `Both documents involve identical litigant/authority: ${commonParties.join(', ')}.`
        );
      }
    }
  }

  // 3. Cluster identification (Group interconnected components)
  const clusters: Record<string, string[]> = {};
  for (const doc of documents) {
    const clusterId = doc.village ? `village-${doc.village.toLowerCase()}` : 'uncategorized';
    if (!clusters[clusterId]) clusters[clusterId] = [];
    clusters[clusterId].push(doc.id);
  }

  return { nodes: documents, edges, clusters };
}

/**
 * Finds shortest pathway of interconnected documents connecting two specific documents
 */
export function findInterconnectionPath(
  docAId: string,
  docBId: string,
  network: InterconnectionNetwork
): { path: LegalDocumentNode[]; edges: GraphEdge[]; explanation: string } | null {
  if (docAId === docBId) return null;

  // BFS search
  const adjacency = new Map<string, Array<{ neighbor: string; edge: GraphEdge }>>();
  for (const edge of network.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source)!.push({ neighbor: edge.target, edge });
    adjacency.get(edge.target)!.push({ neighbor: edge.source, edge });
  }

  const queue: Array<{ current: string; path: string[]; edges: GraphEdge[] }> = [
    { current: docAId, path: [docAId], edges: [] },
  ];
  const visited = new Set<string>([docAId]);

  while (queue.length > 0) {
    const { current, path, edges: pathEdges } = queue.shift()!;
    if (current === docBId) {
      const docMap = new Map(network.nodes.map(n => [n.id, n]));
      const fullPathNodes = path.map(id => docMap.get(id)!).filter(Boolean);

      const explanations = pathEdges.map(e => `[${e.type}]: ${e.explanation}`);
      return {
        path: fullPathNodes,
        edges: pathEdges,
        explanation: explanations.join(' -> '),
      };
    }

    const neighbors = adjacency.get(current) || [];
    for (const { neighbor, edge } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          current: neighbor,
          path: [...path, neighbor],
          edges: [...pathEdges, edge],
        });
      }
    }
  }

  return null;
}

// ==========================================
// 3. 1,000+ Document Corpus Generator
// Generates interconnected legal vault records
// ==========================================

export function generateLargeInterconnectedCorpus(totalTarget: number = 1050): LegalDocumentNode[] {
  const baseDocs: LegalDocumentNode[] = [
    // 1. Documents matching user screenshot exactly!
    {
      id: 'doc-rdo-b184',
      title: 'B-184-2026 Letter to RDO - Stay & Enquiry Application',
      category: 'RDO',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#B-184-2026-RDO',
      date: '2026-10-18',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Revenue Divisional Officer Rajendranagar', 'Mohammed Abdul Quddus', 'Tahsildar Shamshabad'],
      citations: ['Shamshabad 626.pdf', 'WP 18942/2026'],
      summary: 'Formal representation and statutory revision petition submitted to RDO Rajendranagar Division under Telangana Rights in Land and Pattadar Passbooks Act praying to stay mutation entries in Sy.No. 626 Shamshabad pending High Court adjudication.',
      fileSize: '412 KB',
      pdfFileName: 'B-184-2026 letter to RDO.pdf',
    },
    {
      id: 'doc-sham-626',
      title: 'Shamshabad 626 - Demarcation & Title Chain Report',
      category: 'Revenue',
      village: 'Shamshabad',
      surveyNumber: '626',
      uniqueTag: '#SHAM-626-DEMARC',
      date: '2026-08-14',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Mohammed Abdul Quddus', 'Adjacent Boundary Pattadars', 'Assistant Director Survey'],
      citations: ['B-184-2026 letter to RDO.pdf', 'New Brief of Shamshabad Village.pdf'],
      summary: 'Detailed land inspection and panchanama report of Survey No. 626 situated at Shamshabad Village measuring Ac. 6.20 Guntas. Confirms boundaries, stone markers, and non-agricultural classification verification.',
      fileSize: '381 KB',
      pdfFileName: 'Shamshabad 626.pdf',
    },
    {
      id: 'doc-sham-brief',
      title: 'New Brief of Shamshabad Village - Master Title Study',
      category: 'Court H.C.',
      village: 'Shamshabad',
      surveyNumber: '626, 142/A',
      uniqueTag: '#SHAM-VIL-BRIEF',
      date: '2026-09-02',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Shamshabad Land Holders Association', 'State of Telangana', 'HMDA'],
      citations: ['Shamshabad 626.pdf', 'WP 18942/2026'],
      summary: 'Comprehensive legal brief analyzing Shamshabad village survey tracts, GO 111 environmental impact relaxations, Master Plan 2031 designations, and interim status quo precedents granted by Telangana High Court.',
      fileSize: '524 KB',
      pdfFileName: 'New Brief of Shamshabad Village.pdf',
    },
    {
      id: 'doc-pedda-brief',
      title: 'BRIEF NOTE of Peddashahpur Land - Survey 45 & 46',
      category: 'Revenue',
      village: 'Peddashahpur',
      surveyNumber: '45',
      uniqueTag: '#PEDDA-45-BRIEF',
      date: '2026-07-29',
      assignedLawyer: 'Adv. Fatima Begum',
      parties: ['Syed Munawwar Ali', 'Tahsildar Shamshabad Mandal', 'Peddashahpur Gram Panchayat'],
      citations: ['B-184-2026 letter to RDO.pdf'],
      summary: 'Concise title opinion and factual memorandum regarding agricultural land situated in Peddashahpur village Sy.No. 45 & 46. Cross-references 1954-55 Khasra Pahani and Dharani digital title passbooks.',
      fileSize: '298 KB',
      pdfFileName: 'BRIEF NOTE of Peddashahpur land.pdf',
    },
    // Existing base documents
    {
      id: 'doc-sham-142',
      title: 'High Court Interim Injunction Order - WP 18942/2026',
      category: 'Court H.C.',
      village: 'Shamshabad',
      surveyNumber: '142/A',
      uniqueTag: '#SHAM-142-HC-ORDER',
      date: '2026-10-12',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Mohammed Abdul Quddus', 'State of Telangana (Revenue)', 'Tahsildar Shamshabad'],
      citations: ['WP 18942/2026', 'New Brief of Shamshabad Village.pdf'],
      summary: 'Status quo order in WP 18942/2026 restraining respondents from altering nature of Ac. 4.18 Gts in Sy.No. 142/A Shamshabad. Next Hearing 14.11.2026 before Court Hall 04.',
      fileSize: '650 KB',
      pdfFileName: 'WP_18942_2026_HighCourt_Order.pdf',
    },
    {
      id: 'doc-moin-88',
      title: 'Tahsildar Moinabad Mutation & Passbook Proceedings',
      category: 'Revenue',
      village: 'Moinabad',
      surveyNumber: '88/2',
      uniqueTag: '#MOIN-88-REV-MUT',
      date: '2026-09-15',
      assignedLawyer: 'Adv. Fatima Begum',
      parties: ['Syed Farooq', 'Tahsildar Moinabad', 'Adjacent Pattadars'],
      citations: ['ROR/1042/2026'],
      summary: 'Proceedings No. ROR/1042/2026 issuing digital Dharani passbook for 2 Acres 10 Guntas in Sy.No. 88/2 Moinabad.',
      fileSize: '480 KB',
      pdfFileName: 'ROR_1042_2026_Moinabad_Mutation.pdf',
    },
    {
      id: 'doc-raj-204',
      title: 'HMDA Layout Technical Clearance & Land Use Certificate',
      category: 'HMDA',
      village: 'Rajendranagar',
      surveyNumber: '204',
      uniqueTag: '#RAJ-204-HMDA-APP',
      date: '2026-08-20',
      assignedLawyer: 'Adv. K. Srinivas',
      parties: ['HMDA Planning Dept', 'Green Meadows Developers', 'Himayat Sagar Protection Cell'],
      citations: ['HMDA/PLG/2026/8912'],
      summary: 'File No. HMDA/PLG/2026/8912 layout feasibility for residential multi-use in Sy.No. 204 Rajendranagar complying with revised GO 111 rules.',
      fileSize: '1.2 MB',
      pdfFileName: 'HMDA_PLG_2026_8912_Clearance.pdf',
    },
    {
      id: 'doc-chev-71',
      title: 'Police FIR & Land Trespass Complaint - Chevella PS',
      category: 'Police',
      village: 'Chevella',
      surveyNumber: '71/A',
      uniqueTag: '#CHEV-71-POL-COMP',
      date: '2026-10-05',
      assignedLawyer: 'Adv. M.A. Riyaz',
      parties: ['Syed Farooq', 'SHO Chevella Police Station', 'Accused Trespassers'],
      citations: ['Crime No. 342/2026 Chevella'],
      summary: 'Crime No. 342/2026 registered under Sec 447, 427, 506 IPC for demolition of boundary fencing in Sy.No. 71/A Chevella.',
      fileSize: '320 KB',
      pdfFileName: 'Chevella_PS_FIR_342_2026.pdf',
    },
    {
      id: 'doc-mah-115',
      title: 'Senior Civil Judge Maheshwaram - Injunction Suit OS 412/2025',
      category: 'Court L.C.',
      village: 'Maheshwaram',
      surveyNumber: '115',
      uniqueTag: '#MAH-115-LC-PLAINT',
      date: '2026-06-18',
      assignedLawyer: 'Adv. Fatima Begum',
      parties: ['Senior Civil Judge Maheshwaram', 'Ramesh Rao', 'Suresh Kumar'],
      citations: ['OS 412/2025'],
      summary: 'Original Suit No. 412/2025 for perpetual injunction restraining defendants from interfering in Sy.No. 115 Maheshwaram. Hearing: 20-11-2026.',
      fileSize: '890 KB',
      pdfFileName: 'OS_412_2025_Maheshwaram_Suit.pdf',
    },
  ];

  const fullCorpus: LegalDocumentNode[] = [...baseDocs];

  const villages = ['Shamshabad', 'Peddashahpur', 'Moinabad', 'Rajendranagar', 'Chevella', 'Maheshwaram'];
  const categories: Array<LegalDocumentNode['category']> = [
    'Court H.C.',
    'Court L.C.',
    'Revenue',
    'HMDA',
    'Police',
    'RDO',
    'A.D.',
  ];
  const lawyers = ['Adv. M.A. Riyaz', 'Adv. Fatima Begum', 'Adv. K. Srinivas'];

  const docTypeTemplates = [
    { prefix: 'Registered Sale Deed Doc No.', cat: 'Revenue' as const },
    { prefix: 'Khasra Pahani Record of Rights', cat: 'Revenue' as const },
    { prefix: 'Faisal Patti & Sesala Pahani', cat: 'Revenue' as const },
    { prefix: 'Writ Petition Pleading Paperbook WP', cat: 'Court H.C.' as const },
    { prefix: 'Interlocutory Application IA No.', cat: 'Court H.C.' as const },
    { prefix: 'Caveat Petition Under Sec 148A CPC', cat: 'Court L.C.' as const },
    { prefix: 'Written Statement & Counter Claim in OS', cat: 'Court L.C.' as const },
    { prefix: 'Revenue Appeal to RDO Rajendranagar File', cat: 'RDO' as const },
    { prefix: 'Tahsildar Spot Inspection Panchanama', cat: 'Revenue' as const },
    { prefix: 'HMDA Zonal Master Plan Land Use NOC', cat: 'HMDA' as const },
    { prefix: 'Station House Diary & Panchanama Crime No.', cat: 'Police' as const },
    { prefix: 'Assistant Director Survey Demarcation Sketch', cat: 'A.D.' as const },
  ];

  // Common survey numbers per village to ensure dense interconnections
  const villageSurveyPool: Record<string, string[]> = {
    Shamshabad: ['626', '142/A', '142/B', '143', '144/1', '210', '315', '402', '512'],
    Peddashahpur: ['45', '46', '47/A', '52', '68', '89', '104'],
    Moinabad: ['88/2', '88/1', '89', '90/A', '124', '156', '201'],
    Rajendranagar: ['204', '205/A', '206', '240', '312', '389'],
    Chevella: ['71/A', '71/B', '72', '85', '110', '135'],
    Maheshwaram: ['115', '116/A', '120', '142', '180', '215'],
  };

  let count = fullCorpus.length;
  while (count < totalTarget) {
    const vIndex = count % villages.length;
    const village = villages[vIndex];
    const pool = villageSurveyPool[village];
    const syNo = pool[count % pool.length];

    const template = docTypeTemplates[count % docTypeTemplates.length];
    const year = 1970 + ((count * 7) % 57); // 1970 to 2026
    const docNum = (count * 17) % 9999 + 1;
    const uniqueTag = `#${village.slice(0, 4).toUpperCase()}-${syNo.replace('/', '-')}-${template.cat.slice(0, 3).toUpperCase()}-${docNum}`;

    const title = `${template.prefix} ${docNum}/${year} - ${village} (Sy.No ${syNo})`;
    const assignedLawyer = lawyers[count % lawyers.length];

    // Interconnect with earlier docs in the same village & survey
    const relatedDocs = fullCorpus.filter(d => d.village === village && d.surveyNumber.includes(syNo.split('/')[0]));
    const citations: string[] = [];
    if (relatedDocs.length > 0) {
      const citeTarget = relatedDocs[count % relatedDocs.length];
      if (citeTarget.pdfFileName) citations.push(citeTarget.pdfFileName);
      if (citeTarget.uniqueTag) citations.push(citeTarget.uniqueTag);
    }

    fullCorpus.push({
      id: `doc-gen-${count + 1}`,
      title,
      category: template.cat,
      village,
      surveyNumber: syNo,
      uniqueTag,
      date: `${year}-${String((count % 12) + 1).padStart(2, '0')}-${String((count % 28) + 1).padStart(2, '0')}`,
      assignedLawyer,
      parties: [
        `Pattadar Family of Sy.No ${syNo}`,
        `Tahsildar ${village} Mandal`,
        count % 3 === 0 ? 'State of Telangana (Revenue)' : 'Opposing Claimant',
      ],
      citations,
      summary: `Legal instrument comprising ${template.prefix} relating to land parcel Sy.No ${syNo} in ${village} village. Recorded in land registry and cross-referenced with judicial case record ${docNum}/${year}.`,
      fileSize: `${180 + (count % 800)} KB`,
      pdfFileName: `${village}_Sy_${syNo.replace('/', '_')}_${template.cat.replace(/[^a-zA-Z]/g, '')}_${year}.pdf`,
    });

    count++;
  }

  return fullCorpus;
}
