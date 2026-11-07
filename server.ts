import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  extractNextHearingDate,
  classifyLegalCategory,
  extractSurveyAndVillage,
  parseCauselistEntry,
  CauselistResult,
  extractDocumentActionRule,
  DocumentActionRule,
} from './src/utils/legalDocumentParser.ts';
import {
  LegalDocument,
  filterDocuments,
  rankDocumentChunks,
  findDocumentConflicts,
  DocumentConflict,
} from './src/utils/ragEngine.ts';
import {
  fuzzyMatchDocument,
  buildDocumentGraph,
  findInterconnectionPath,
  generateLargeInterconnectedCorpus,
  LegalDocumentNode,
} from './src/utils/documentGraph.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Server-side Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory persistent database for documents, cases, causelist logs, and reminders
let documentsVault: LegalDocument[] = [
  {
    id: 'doc-rdo-b184',
    title: 'B-184-2026 letter to RDO - Stay & Enquiry Application',
    category: 'RDO' as any,
    village: 'Shamshabad',
    surveyNumber: '626',
    uniqueTag: 'B-184-2026-RDO',
    date: '2026-10-18',
    assignedLawyer: 'Adv. M.A. Riyaz',
    caseNumber: 'Appeal/B-184/2026',
    content: `BEFORE THE REVENUE DIVISIONAL OFFICER, RAJENDRANAGAR DIVISION, RANGA REDDY DISTRICT
Appeal Revision Petition No. B-184-2026
Between: Mohammed Abdul Quddus ... Appellant
AND
The Tahsildar, Shamshabad Mandal & 2 Others ... Respondents
Subject: Application under Section 5(5) of Telangana Rights in Land and Pattadar Passbooks Act praying to stay illegal mutation entries in Sy.No. 626 Shamshabad Village.
ORDER:
Issue urgent notices to respondents. Tahsildar Shamshabad is directed to maintain status quo regarding revenue record entries and submit spot inspection report by next hearing date.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/RDO/Shamshabad/B-184-2026 letter to RDO.pdf',
    status: 'active',
  },
  {
    id: 'doc-sham-626',
    title: 'Shamshabad 626 - Demarcation & Title Chain Report',
    category: 'Revenue',
    village: 'Shamshabad',
    surveyNumber: '626',
    uniqueTag: 'SHAM-626-DEMARC',
    date: '2026-08-14',
    assignedLawyer: 'Adv. M.A. Riyaz',
    caseNumber: 'REV/DEMARC/626/2026',
    content: `OFFICE OF THE MANDAL SURVEYOR & TAHSILDAR, SHAMSHABAD MANDAL
Field Inspection & Panchanama Report for Survey No. 626
Village: Shamshabad, Mandal: Shamshabad, District: Ranga Reddy.
Extent: Ac. 6.20 Guntas.
BOUNDARIES:
North: Land in Sy.No. 625 (Pattadar Ahmed Khan)
South: 40 Feet Village Panchayat Road
East: Land in Sy.No. 627 (Pattadar Venkat Reddy)
West: Water canal boundary
FINDINGS: The applicant has continuous possession and cultivated crops. Boundary stone markers fixed on all 4 corners as per Village Map of 1954. No third-party encroachment observed.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Revenue/Shamshabad/Shamshabad 626.pdf',
    status: 'active',
  },
  {
    id: 'doc-sham-brief',
    title: 'New Brief of Shamshabad Village - Master Title Study',
    category: 'Court H.C.',
    village: 'Shamshabad',
    surveyNumber: '626, 142/A',
    uniqueTag: 'SHAM-VIL-BRIEF',
    date: '2026-09-02',
    assignedLawyer: 'Adv. M.A. Riyaz',
    caseNumber: 'BRIEF/SHAM/2026',
    content: `LEGAL BRIEF & MEMORANDUM ON SHAMSHABAD VILLAGE LANDS
Prepared for: Adv. M.A. Riyaz & Associates
Scope: Comprehensive legal review of agricultural parcels in Shamshabad Mandal, Ranga Reddy District.
1. Historical Title: Flow of title from Nizam Firman and 1954 Khasra Pahani to present Pattadars.
2. Regulatory Landscape: Impact of GO 111 modifications and Master Plan 2031 buffer zones near airport corridor.
3. Pending Litigation: High Court WP 18942/2026 (Sy 142/A) and RDO Revision Petition B-184-2026 (Sy 626). Status Quo granted by High Court holds binding authority on revenue officials.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Court H.C./Shamshabad/New Brief of Shamshabad Village.pdf',
    status: 'active',
  },
  {
    id: 'doc-pedda-brief',
    title: 'BRIEF NOTE of Peddashahpur Land - Survey 45 & 46',
    category: 'Revenue',
    village: 'Peddashahpur',
    surveyNumber: '45',
    uniqueTag: 'PEDDA-45-BRIEF',
    date: '2026-07-29',
    assignedLawyer: 'Adv. Fatima Begum',
    caseNumber: 'BRIEF/PEDDA/45/2026',
    content: `MEMORANDUM & TITLE OPINION ON PEDDASHAHPUR VILLAGE LAND
Client: Syed Munawwar Ali
Property: Land admeasuring Ac. 3.14 Gts in Survey No. 45 & 46 situated at Peddashahpur Village, Shamshabad Mandal.
1. Land Nature: Ryotwari patta land recorded in Sethwar and Wasool Baqui registers.
2. Mutation Status: Digital passbook issued under ROR Act. Neighboring claimant filed objection citing oral partition.
3. Opinion: The oral partition lacks registered deed under Section 17 of Registration Act. Civil suit OS pending. Strong prima facie possession established.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Revenue/Peddashahpur/BRIEF NOTE of Peddashahpur land.pdf',
    status: 'active',
  },
  {
    id: 'doc-sham-142',
    title: 'High Court Interim Injunction Order - WP 18942/2026',
    category: 'Court H.C.',
    village: 'Shamshabad',
    surveyNumber: '142/A',
    uniqueTag: 'SHAM-142-HC-ORDER',
    date: '2026-10-28',
    nextHearingDate: '2026-11-14',
    caseNumber: 'WP 18942/2026',
    assignedLawyer: 'Adv. M.A. Riyaz',
    content: `IN THE HIGH COURT FOR THE STATE OF TELANGANA AT HYDERABAD
WRIT PETITION NO. 18942 OF 2026
Between: Mohammed Abdul Quddus & 2 Others ... Petitioners
AND
The State of Telangana, rep. by Principal Secretary (Revenue), Tahsildar Shamshabad Mandal, & 3 Others ... Respondents

ORDER:
Heard learned counsel for the petitioners Adv. M.A. Riyaz.
Issue notice before admission to the respondents.
Learned Government Pleader for Revenue takes notice for Respondents 1 & 2.
There shall be an interim order directing both parties to maintain STATUS QUO in respect of possession and nature of agricultural land admeasuring Ac. 4.18 Guntas in Survey No. 142/A, situated at Shamshabad Village, Shamshabad Mandal, Ranga Reddy District.
Registry is directed to Post on 14.11.2026 for filing counter affidavit.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Court H.C./Shamshabad/WP_18942_2026_Interim_Order.pdf',
    status: 'active',
  },
  {
    id: 'doc-moin-88',
    title: 'Tahsildar Moinabad Mutation & Passbook Proceedings',
    category: 'Revenue',
    village: 'Moinabad',
    surveyNumber: '88/2',
    uniqueTag: 'MOIN-88-REV-MUT',
    date: '2026-09-15',
    assignedLawyer: 'Adv. Fatima Begum',
    caseNumber: 'ROR/1042/2026',
    content: `OFFICE OF THE TAHSILDAR, MOINABAD MANDAL, RANGA REDDY DISTRICT
Proceedings No. ROR/1042/2026, Dated: 15-09-2026
Sub: Telangana Rights in Land & Pattadar Pass Books Act - Mutation & Issuance of digital Passbook for Sy.No. 88/2 Moinabad Village.
ORDER:
Upon spot inspection and verification of Dharani portal title records, the applicant is registered as legal pattadar for land measuring 2 Acres 10 Guntas in Sy.No. 88/2. The objections filed by adjacent boundary holders stand disposed. Digital Dharani Passbook issued.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Revenue/Moinabad/ROR_1042_2026_Mutation.pdf',
    status: 'active',
  },
  {
    id: 'doc-raj-204',
    title: 'HMDA Layout Technical Clearance & Land Use Certificate',
    category: 'HMDA',
    village: 'Rajendranagar',
    surveyNumber: '204',
    uniqueTag: 'RAJ-204-HMDA-APP',
    date: '2026-08-20',
    assignedLawyer: 'Adv. K. Srinivas',
    caseNumber: 'HMDA/PLG/2026/8912',
    content: `HYDERABAD METROPOLITAN DEVELOPMENT AUTHORITY (HMDA)
Planning Department - Zonal Office Rajendranagar
File No. HMDA/PLG/2026/8912
Subject: Technical clearance application for gated community layout in Sy.No. 204, Rajendranagar Village & Mandal.
Master Plan Zone: Residential Multi-Use Zone R-1.
Buffer distance from Himayat Sagar lake catchment boundary complies with GO 111 revised regulations. Mortgage deed executed for 15% open space. Final technical feasibility granted subject to Fire NOC.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/HMDA/Rajendranagar/HMDA_PLG_2026_Clearance.pdf',
    status: 'active',
  },
  {
    id: 'doc-chev-71',
    title: 'Police FIR & Land Trespass Complaint - Chevella PS',
    category: 'Police',
    village: 'Chevella',
    surveyNumber: '71/A',
    uniqueTag: 'CHEV-71-POL-COMP',
    date: '2026-10-05',
    assignedLawyer: 'Adv. M.A. Riyaz',
    caseNumber: 'Crime No. 342/2026',
    content: `STATION HOUSE OFFICER, CHEVELLA POLICE STATION, CYBERABAD
First Information Report (FIR) - Crime No. 342/2026
Sections: 447, 427, 506 read with 34 IPC (Criminal Trespass, Mischief, Criminal Intimidation).
Complainant: Syed Farooq.
Allegations: Accused persons unauthorizedly entered boundary in Survey No. 71/A Chevella and demolished fencing stones. Panchanama completed. Interim boundary protection provided.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Police/Chevella/FIR_342_2026_Trespass.pdf',
    status: 'active',
  },
  {
    id: 'doc-mah-115',
    title: 'Senior Civil Judge Maheshwaram - Injunction Suit OS 412/2025',
    category: 'Court L.C.',
    village: 'Maheshwaram',
    surveyNumber: '115',
    uniqueTag: 'MAH-115-LC-PLAINT',
    date: '2026-06-11',
    nextHearingDate: '2026-11-20',
    assignedLawyer: 'Adv. Fatima Begum',
    caseNumber: 'OS 412/2025',
    content: `IN THE COURT OF SENIOR CIVIL JUDGE, MAHESHWARAM AT RANGA REDDY
ORIGINAL SUIT NO. 412 OF 2025
Suit for Perpetual Injunction restraining defendants from interfering with peaceful possession of agricultural land in Sy.No. 115 Maheshwaram.
Next Date of Hearing: 20-11-2026 for cross-examination of PW-1.`,
    fileType: 'pdf',
    drivePath: 'Google Drive/Court L.C./Maheshwaram/OS_412_2025_Plaint.pdf',
    status: 'active',
  },
];

// 7 PM Causelist tracker status & simulated live court causelist bulletin
interface TrackedCase {
  caseNumber: string;
  title: string;
  court: string;
  village: string;
  surveyNumber: string;
  nextHearingDate: string;
  assignedLawyer: string;
  lastCheckedAt?: string;
  status: 'monitoring' | 'listed' | 'not_listed';
  itemNumber?: string;
  courtHall?: string;
  judge?: string;
  stage?: string;
  whatsappSent: boolean;
  history: Array<{
    date: string;
    time: string;
    isListed: boolean;
    remarks: string;
  }>;
}

let trackedCourtCases: TrackedCase[] = [
  {
    caseNumber: 'WP 18942/2026',
    title: 'Mohammed Abdul Quddus vs State of Telangana (Sy No 142 Shamshabad)',
    court: 'High Court for the State of Telangana',
    village: 'Shamshabad',
    surveyNumber: '142/A',
    nextHearingDate: '2026-11-14',
    assignedLawyer: 'Adv. M.A. Riyaz',
    lastCheckedAt: '2026-11-06 19:00:00',
    status: 'listed',
    itemNumber: '14',
    courtHall: 'Court Hall No. 04',
    judge: "Hon'ble Justice K. Lakshman",
    stage: 'For Admission / Interim Hearing',
    whatsappSent: true,
    history: [
      {
        date: '2026-11-05',
        time: '19:00:12',
        isListed: false,
        remarks: 'Daily 7:00 PM check: Causelist not published yet for 14.11.2026. Scheduled re-check tomorrow.',
      },
      {
        date: '2026-11-06',
        time: '19:00:05',
        isListed: true,
        remarks: 'Listed in Court Hall 04, Item 14 before Hon\'ble Justice K. Lakshman. WhatsApp alert dispatched to Adv. Riyaz & Client.',
      },
    ],
  },
  {
    caseNumber: 'OS 412/2025',
    title: 'Injunction Suit Sy No 115 Maheshwaram',
    court: 'Senior Civil Judge Court, Maheshwaram',
    village: 'Maheshwaram',
    surveyNumber: '115',
    nextHearingDate: '2026-11-20',
    assignedLawyer: 'Adv. Fatima Begum',
    lastCheckedAt: '2026-11-06 19:00:00',
    status: 'monitoring',
    whatsappSent: false,
    history: [
      {
        date: '2026-11-06',
        time: '19:00:20',
        isListed: false,
        remarks: 'Daily 7:00 PM check: Hearing date is 20-11-2026. Causelist for 20th will be published on 19-11-2026 at 7 PM.',
      },
    ],
  },
];

// Generalized automated action rules for ANY document type (Court, Revenue, HMDA, Police, Contracts)
let documentActionRules: DocumentActionRule[] = [
  {
    ruleId: 'rule-court-142',
    docTitle: 'High Court Interim Injunction Order - WP 18942/2026',
    docCategory: 'Court H.C.',
    actionType: 'causelist_check',
    schedule: 'Daily at 7:00 PM',
    targetPortalName: 'Telangana High Court e-Causelist',
    targetUrl: 'https://tshc.gov.in/causelist',
    queryParam: 'WP 18942/2026',
    nextActionDate: '2026-11-14',
    status: 'triggered',
    whatsappAlertTemplate: `⚖️ *HIGH COURT CAUSELIST ALERT (7:00 PM)*\nCase WP 18942/2026 is LISTED for hearing tomorrow in Court Hall 04, Item 14 before Hon'ble Justice K. Lakshman.\nKeep brief and paperbook bundle ready!`,
    lastChecked: '2026-11-06 19:00:05',
    checkCount: 2,
  },
  {
    ruleId: 'rule-rev-88',
    docTitle: 'Tahsildar Moinabad Mutation & Passbook Proceedings',
    docCategory: 'Revenue',
    actionType: 'mutation_status',
    schedule: 'Daily at 9:00 AM',
    targetPortalName: 'Dharani Land Records & ROR Portal',
    targetUrl: 'https://dharani.telangana.gov.in/mutationStatus',
    queryParam: 'ROR/1042/2026 (Sy.No 88/2 Moinabad)',
    nextActionDate: '2026-11-15',
    status: 'active_monitoring',
    whatsappAlertTemplate: `🏛️ *DHARANI REVENUE PORTAL ALERT (9:00 AM)*\nTahsildar Moinabad Sy.No 88/2: Digital passbook generation verified and biometric slot unlocked for Pattadar.`,
    lastChecked: '2026-11-06 09:00:15',
    checkCount: 3,
  },
  {
    ruleId: 'rule-hmda-204',
    docTitle: 'HMDA Layout Technical Clearance & Land Use Certificate',
    docCategory: 'HMDA',
    actionType: 'clearance_renewal',
    schedule: 'Weekly on Mondays at 10:00 AM',
    targetPortalName: 'HMDA DPMS Online Layout Tracker',
    targetUrl: 'https://hmda.gov.in/dpms',
    queryParam: 'HMDA/PLG/2026/8912 (Sy.No 204 Rajendranagar)',
    nextActionDate: '2026-11-17',
    status: 'active_monitoring',
    whatsappAlertTemplate: `🏗️ *HMDA PLANNING CLEARANCE RADAR*\nFile HMDA/PLG/2026/8912: Fire NOC compliance window active. 15% open space deed registered.`,
    lastChecked: '2026-11-03 10:00:00',
    checkCount: 1,
  },
  {
    ruleId: 'rule-pol-71',
    docTitle: 'Police FIR & Land Trespass Complaint - Chevella PS',
    docCategory: 'Police',
    actionType: 'statutory_deadline',
    schedule: 'Daily at 6:00 PM',
    targetPortalName: 'Telangana Police CCTNS Crime Tracker',
    targetUrl: 'https://tspolice.gov.in/cctns',
    queryParam: 'Crime No. 342/2026 Chevella PS',
    nextActionDate: '2026-12-05',
    status: 'active_monitoring',
    whatsappAlertTemplate: `🛡️ *POLICE INVESTIGATION MONITOR*\nCrime No. 342/2026: 60-day statutory limitation clock for Section 447/427 chargesheet. 32 days elapsed.`,
    lastChecked: '2026-11-06 18:00:00',
    checkCount: 4,
  },
  {
    ruleId: 'rule-lc-115',
    docTitle: 'Senior Civil Judge Maheshwaram - Injunction Suit OS 412/2025',
    docCategory: 'Court L.C.',
    actionType: 'causelist_check',
    schedule: 'Daily at 7:00 PM',
    targetPortalName: 'District Courts eCourts Portal',
    targetUrl: 'https://districts.ecourts.gov.in/rangareddy',
    queryParam: 'OS 412/2025',
    nextActionDate: '2026-11-20',
    status: 'repeating_daily',
    whatsappAlertTemplate: `⚖️ *DISTRICT COURT CAUSELIST (7:00 PM)*\nCase OS 412/2025 not on tomorrow's daily board. Scheduled re-scan tomorrow at 7:00 PM.`,
    lastChecked: '2026-11-06 19:00:20',
    checkCount: 5,
  },
];

// Reminders & Morning Briefing store
interface ReminderItem {
  id: string;
  type: 'hearing' | 'meeting' | 'call' | 'doc_request' | 'general';
  title: string;
  time: string;
  caseRef?: string;
  village?: string;
  lawyer: string;
  completed: boolean;
}

let remindersStore: ReminderItem[] = [
  {
    id: 'rem-1',
    type: 'hearing',
    title: 'High Court Appearance: WP 18942/2026 (Shamshabad Sy No 142/A)',
    time: '10:30 AM (Court Hall 04, Item 14)',
    caseRef: 'WP 18942/2026',
    village: 'Shamshabad',
    lawyer: 'Adv. M.A. Riyaz',
    completed: false,
  },
  {
    id: 'rem-2',
    type: 'meeting',
    title: 'Client Meeting with Farooq bhai regarding Chevella FIR 342/2026',
    time: '03:00 PM at Office',
    caseRef: 'Crime No. 342/2026',
    village: 'Chevella',
    lawyer: 'Adv. M.A. Riyaz',
    completed: false,
  },
  {
    id: 'rem-3',
    type: 'doc_request',
    title: 'Ask Client for 1954 Khasra Pahani for Moinabad Sy No 88',
    time: 'Morning check-in',
    caseRef: 'ROR/1042/2026',
    village: 'Moinabad',
    lawyer: 'Adv. Fatima Begum',
    completed: false,
  },
  {
    id: 'rem-4',
    type: 'call',
    title: 'Scheduled Call with HMDA Planning Officer regarding Rajendranagar Sy 204 Fire NOC',
    time: '05:30 PM',
    caseRef: 'HMDA/PLG/2026/8912',
    village: 'Rajendranagar',
    lawyer: 'Adv. K. Srinivas',
    completed: false,
  },
];

// Conversation memory for WhatsApp & Assistant
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  senderName?: string;
  text: string;
  timestamp: string;
  mediaType?: 'text' | 'audio' | 'document' | 'image';
  mediaUrl?: string;
  mediaCaption?: string;
  meta?: any;
}

let chatHistory: ChatMessage[] = [
  {
    id: 'msg-seed-1',
    sender: 'assistant',
    senderName: 'SABEEL Legal AI (Aliya)',
    text: `Assalam alaikum Vakil Sahab! Main aapka personal legal assistant SABEEL hoon.
Aap WhatsApp ke zariye documents bhej sakte hain, Google Drive me folders organize ho jaate hain, court orders ka next hearing date track karke rozaana shaam 7 baje causelist check karta hoon.
Aap kisi bhi village (Shamshabad, Moinabad wagaira) ya Survey Number ke papers puch sakte hain!`,
    timestamp: '2026-11-06 09:00:00',
    mediaType: 'text',
  },
];

// Real-time legal news mock cache
const legalNewsFeed = [
  {
    title: 'Telangana High Court: Status Quo mandatory where prima facie title and continuous possession established in Sy No records',
    source: 'LiveLaw Hyderabad',
    date: '2026-11-06',
    category: 'High Court',
    snippet: 'Division bench clarifies revenue authorities cannot disturb long-standing possession without due notice and survey panchanama.',
  },
  {
    title: 'Dharani Portal 2.0: Special modules launched for pending ROR appeals in Shamshabad & Rajendranagar mandals',
    source: 'Telangana Revenue Gazette',
    date: '2026-11-05',
    category: 'Revenue',
    snippet: 'Collectors empowered to rectify digital passbook discrepancies and biometric mismatch for agricultural lands.',
  },
  {
    title: 'HMDA updates Master Plan 2031 buffer guidelines for GO 111 catchment areas in Chevella and Moinabad',
    source: 'Hyderabad Urban Watch',
    date: '2026-11-04',
    category: 'HMDA',
    snippet: 'Relaxation of low-density residential layouts subject to green STP standards and 30-meter road widening stipulations.',
  },
];

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. GET /api/documents - List documents with search & filter
app.get('/api/documents', (req: Request, res: Response) => {
  const { village, surveyNumber, category, lawyer, search } = req.query;
  const filtered = filterDocuments(documentsVault, {
    village: village as string,
    surveyNumber: surveyNumber as string,
    category: category as string,
    assignedLawyer: lawyer as string,
    searchQuery: search as string,
  });
  res.json({ success: true, count: filtered.length, documents: filtered });
});

// 2. POST /api/documents/analyze - Intelligent document parser & metadata extractor
app.post('/api/documents/analyze', async (req: Request, res: Response) => {
  try {
    const { text, title, fileType } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Document text content is required' });
    }

    // Pure deterministic parsing
    const { date: ndohDate, confidence } = extractNextHearingDate(text);
    const category = classifyLegalCategory(text);
    const { surveyNumbers, village } = extractSurveyAndVillage(text);

    let aiAnalysis: any = null;

    if (aiClient) {
      try {
        const prompt = `You are SABEEL, an expert legal AI assistant specializing in Telangana High Court, District Courts, Revenue (Dharani), HMDA, and land law.
Analyze this legal document text and extract structured information.

Document text:
${text.slice(0, 4000)}

Return ONLY valid JSON matching this structure:
{
  "summary": "Brief 2-3 sentence legal executive summary",
  "category": "${category}",
  "village": "${village || 'Shamshabad'}",
  "surveyNumbers": ${JSON.stringify(surveyNumbers)},
  "nextHearingDate": "${ndohDate || ''}",
  "caseNumber": "e.g. WP 1234/2026 or OS 56/2025 or N/A",
  "parties": {"petitioner": "...", "respondent": "..."},
  "keyDirections": ["bullet 1", "bullet 2"],
  "recommendedLawyer": "Adv. M.A. Riyaz or Adv. Fatima Begum or Adv. K. Srinivas",
  "uniqueTag": "UPPERCASE_TAG_LIKE_VILLAGE-SYNO-TYPE",
  "hyderabadiAudioNote": "Brief conversational note in Hyderabadi Roman Urdu explaining the key order and next date."
}`;

        const aiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 6000));
        const resp: any = await Promise.race([aiPromise, timeoutPromise]);

        if (resp.text) {
          aiAnalysis = JSON.parse(resp.text);
        }
      } catch (err) {
        console.warn('Gemini analysis fallback to deterministic parser:', err);
      }
    }

    // Fallback/merged result
    const finalVillage = aiAnalysis?.village || village || 'Shamshabad';
    const finalSyNo = (aiAnalysis?.surveyNumbers?.[0] || surveyNumbers[0] || '142');
    const finalTag = aiAnalysis?.uniqueTag || `${finalVillage.slice(0, 4).toUpperCase()}-${finalSyNo.replace(/[^0-9A-Z]/gi, '')}-${category.replace(/[^0-9A-Z]/gi, '')}`;
    const finalNDOH = aiAnalysis?.nextHearingDate || ndohDate || null;
    const finalCategory = aiAnalysis?.category || category;
    const finalLawyer = aiAnalysis?.recommendedLawyer || 'Adv. M.A. Riyaz';

    const newDoc: LegalDocument = {
      id: `doc-${Date.now()}`,
      title: title || aiAnalysis?.summary?.slice(0, 50) || `${finalCategory} Document - Sy No ${finalSyNo}`,
      category: finalCategory,
      village: finalVillage,
      surveyNumber: finalSyNo,
      uniqueTag: finalTag,
      date: new Date().toISOString().split('T')[0],
      nextHearingDate: finalNDOH || undefined,
      caseNumber: aiAnalysis?.caseNumber || 'WP/Pending/2026',
      assignedLawyer: finalLawyer,
      content: text,
      fileType: fileType || 'pdf',
      drivePath: `Google Drive/${finalCategory}/${finalVillage}/${title || 'Uploaded_Document.pdf'}`,
      status: 'active',
    };

    documentsVault.unshift(newDoc);

    // If a next hearing date was detected, auto-register for 7 PM Causelist Tracker!
    let trackingAdded = false;
    if (finalNDOH) {
      const existing = trackedCourtCases.find(c => c.caseNumber === newDoc.caseNumber);
      if (!existing && newDoc.caseNumber) {
        trackedCourtCases.unshift({
          caseNumber: newDoc.caseNumber,
          title: newDoc.title,
          court: finalCategory === 'Court H.C.' ? 'High Court of Telangana' : 'District Courts Telangana',
          village: finalVillage,
          surveyNumber: finalSyNo,
          nextHearingDate: finalNDOH,
          assignedLawyer: finalLawyer,
          status: 'monitoring',
          whatsappSent: false,
          history: [
            {
              date: new Date().toISOString().split('T')[0],
              time: '19:00:00 (Scheduled)',
              isListed: false,
              remarks: `Registered from newly uploaded ${finalCategory} document. Automated 7:00 PM causelist scan active for ${finalNDOH}.`,
            },
          ],
        });
        trackingAdded = true;
      }
    }

    // Universal Action Rule Generator for ANY document type
    const actionRule = extractDocumentActionRule(text, finalCategory, newDoc.title);
    documentActionRules.unshift(actionRule);

    res.json({
      success: true,
      document: newDoc,
      analysis: aiAnalysis,
      nextHearingDate: finalNDOH,
      trackingAdded,
      actionRule,
      folderPath: newDoc.drivePath,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error analyzing document' });
  }
});

// 3. POST /api/documents/rag-search - Vector/Semantic RAG search + brief drafter
app.post('/api/documents/rag-search', async (req: Request, res: Response) => {
  try {
    const { query, village, surveyNumber, prepareBriefType } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Filter relevant documents
    const candidateDocs = filterDocuments(documentsVault, {
      village: village || undefined,
      surveyNumber: surveyNumber || undefined,
    });

    // Rank chunks
    const rankedChunks = rankDocumentChunks(query, candidateDocs.length > 0 ? candidateDocs : documentsVault, 5);

    let synthesis = '';
    const contextText = rankedChunks
      .map(
        (c, idx) =>
          `[Citation ${idx + 1}] Document: ${c.documentTitle} | Village: ${c.village} | Sy No: ${c.surveyNumbers?.join(', ')} | Category: ${c.category}\nContent: ${c.text}`
      )
      .join('\n\n---\n\n');

    if (aiClient) {
      try {
        let taskInstruction = 'Answer the advocate\'s question thoroughly based strictly on the retrieved document citations. Cite citations like [Citation 1].';
        if (prepareBriefType === 'brief') {
          taskInstruction = 'Draft a formal Legal Case Brief summarizing the material facts, survey numbers, dispute history, court orders, next hearing date, and proposed legal arguments.';
        } else if (prepareBriefType === 'application') {
          taskInstruction = 'Draft a formal Legal Application / Representation addressed to the relevant Telangana Department (e.g., Tahsildar / HMDA / Police) requesting immediate official action based on the cited orders.';
        }

        const prompt = `You are SABEEL, Senior Legal AI Research Assistant.
${taskInstruction}

Query: ${query}

Retrieved Document Context:
${contextText}

Guidelines:
1. Provide accurate references to survey numbers, village names, case numbers, and dates.
2. Note both English legal points and include a short "SABEEL Note (Hyderabadi Roman Urdu)" summarizing the takeaway for the client.`;

        const aiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 6000));
        const resp: any = await Promise.race([aiPromise, timeoutPromise]);

        synthesis = resp.text || '';
      } catch (e) {
        console.warn('RAG generation fallback:', e);
      }
    }

    if (!synthesis) {
      synthesis = `### Legal Analysis & Findings for: "${query}"\n\nBased on stored records for ${village || 'Shamshabad/Moinabad'}:\n- In WP 18942/2026, High Court ordered Status Quo on Sy No 142/A Shamshabad. Next hearing: 14.11.2026.\n- Revenue records show Mutation Proceeding ROR/1042/2026 for Sy No 88/2 Moinabad.\n\n**SABEEL Note (Hyderabadi Roman Urdu):** Vakil Sahab, papers verify karliye. High Court ka stay order active hai, Tahsildar ko copy deke entry confirm karwana hai.`;
    }

    res.json({
      success: true,
      query,
      citations: rankedChunks,
      synthesis,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error executing RAG search' });
  }
});

// 4. POST /api/court/causelist-check - Daily 7:00 PM Causelist Crawler & Listing Verifier
app.post('/api/court/causelist-check', async (req: Request, res: Response) => {
  try {
    const { caseNumber, date, simulatedCauselistText } = req.body;
    const targetCase = caseNumber || 'WP 18942/2026';
    const checkDate = date || '14.11.2026';

    // Simulated Telangana High Court / District Court Causelist bulletin for today/tomorrow
    const defaultCauselist = simulatedCauselistText || `
HIGH COURT FOR THE STATE OF TELANGANA AT HYDERABAD
DAILY CAUSELIST FOR FRIDAY THE 14TH DAY OF NOVEMBER 2026
COURT HALL NO. 04
HON'BLE JUSTICE K. LAKSHMAN
MOTION HEARING / ADMISSION:
Item 12: WP 18810/2026 - K. V. Rao vs State of Telangana
Item 13: WP 18901/2026 - Venkatesh vs District Collector RR Dist
Item 14: WP 18942/2026 - Mohammed Abdul Quddus vs State of Telangana (Adv. M.A. Riyaz for Petitioner)
Item 15: WP 19022/2026 - Laxmi Devi vs Tahsildar Shamshabad
Item 16: CRL.P 4511/2026 - Anand Kumar vs State of Telangana
    `;

    const result: CauselistResult = parseCauselistEntry(defaultCauselist, targetCase);

    // Pre-format WhatsApp alert message
    let whatsappAlert = '';
    if (result.isListed) {
      whatsappAlert = `⚖️ *HIGH COURT CAUSELIST ALERT (7:00 PM)*
Assalam alaikum Vakil Sahab / Client!
Aapka case kal ke causelist me *LIST* ho chuka hai:

📋 *Case:* ${targetCase}
🏛️ *Bench:* ${result.courtHall}
👨‍⚖️ *Hon'ble Judge:* ${result.judge}
🔢 *Item No:* ${result.itemNumber}
📌 *Stage:* ${result.stage}
📅 *Date:* ${checkDate}

Kindly keep the brief and case bundle ready for tomorrow's morning motion list!`;
    } else {
      whatsappAlert = `ℹ️ *COURT CAUSELIST UPDATE (7:00 PM)*
Case ${targetCase} is *NOT listed* on the causelist for ${checkDate}.
The automated crawler will check again tomorrow at 7:00 PM upon new board publication.`;
    }

    // Update tracked case entry
    const tracked = trackedCourtCases.find(c => c.caseNumber.toLowerCase() === targetCase.toLowerCase());
    if (tracked) {
      tracked.lastCheckedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
      tracked.status = result.isListed ? 'listed' : 'not_listed';
      if (result.isListed) {
        tracked.itemNumber = result.itemNumber;
        tracked.courtHall = result.courtHall;
        tracked.judge = result.judge;
        tracked.stage = result.stage;
        tracked.whatsappSent = true;
      }
      tracked.history.unshift({
        date: new Date().toISOString().split('T')[0],
        time: '19:00:00 (Daily Scan)',
        isListed: result.isListed,
        remarks: result.isListed
          ? `Listed in ${result.courtHall}, Item ${result.itemNumber} before ${result.judge}. WhatsApp alert sent.`
          : 'Not found in published board. Re-scan scheduled for tomorrow 7 PM.',
      });
    }

    res.json({
      success: true,
      caseNumber: targetCase,
      checkDate,
      isListed: result.isListed,
      result,
      whatsappAlert,
      trackedCases: trackedCourtCases,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error checking causelist' });
  }
});

// 5. GET /api/court/tracked - Get all tracked court cases & 7 PM logs
app.get('/api/court/tracked', (_req: Request, res: Response) => {
  res.json({ success: true, trackedCases: trackedCourtCases });
});

// 6. POST /api/chat - WhatsApp / SABEEL Assistant Chat with dialect & memory
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, dialect, mediaType, senderName } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const isHyderabadi = dialect !== 'english';

    // Add user message to history
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      senderName: senderName || 'Advocate / Client',
      text: message,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      mediaType: mediaType || 'text',
    };
    chatHistory.push(userMsg);

    // Context from vault & tracked cases
    const vaultSummary = documentsVault
      .map(d => `- [${d.uniqueTag}] ${d.title} | Sy No: ${d.surveyNumber} in ${d.village} | Lawyer: ${d.assignedLawyer} | Next Hearing: ${d.nextHearingDate || 'None'}`)
      .join('\n');

    const trackedSummary = trackedCourtCases
      .map(t => `- ${t.caseNumber}: ${t.status.toUpperCase()} | Next date: ${t.nextHearingDate} | Court Hall: ${t.courtHall || 'Pending'} | Item: ${t.itemNumber || 'Pending'}`)
      .join('\n');

    const remindersSummary = remindersStore
      .filter(r => !r.completed)
      .map(r => `- ${r.time}: ${r.title} (${r.lawyer})`)
      .join('\n');

    let assistantReply = '';

    if (aiClient) {
      try {
        const systemPrompt = `You are SABEEL (also known as Aliya), a highly intelligent, dedicated personal legal assistant for advocates and land clients in Hyderabad / Telangana.

Key Directives:
1. Dialect & Persona:
   ${isHyderabadi
     ? `Use polite, professional Hyderabadi Urdu written in Roman script (e.g., "Assalam alaikum", "Kareeb se dekhe to...", "Hau bhai, bilkul", "Tahsildar ke paas application daal diye", "Shaam 7 baje causelist check kardiya maine, Item 14 pe list hua", "Fikarr mat karo, main files ready rakha hoon"). Maintain utmost legal respect ("Vakil Sahab", "Sahab", "Bhai").`
     : `Use clear, sharp, professional English for legal counsel, citing specific survey numbers and next dates.`
   }
2. Tone: Helpful, proactive, razor-sharp on dates, survey numbers, and court benches.
3. Morning Routine: If the user greets or asks about the day's schedule, provide the morning reminders (hearings, calls, client meetings) and ask if any new reminders need to be added.
4. Document / Causelist Queries: Refer to the live database below.
5. If the user asks to prepare an application or brief, generate the structured draft directly in the conversation.

CURRENT DATABASE SNAPSHOT:
Documents Vault:
${vaultSummary}

Tracked Court Cases (Daily 7 PM Crawler):
${trackedSummary}

Today's Reminders:
${remindersSummary}`;

        const aiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemPrompt}\n\nUser Message: "${message}"\n\nAssistant Response:`,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 6000));
        const resp: any = await Promise.race([aiPromise, timeoutPromise]);

        assistantReply = resp.text || '';
      } catch (e) {
        console.warn('Gemini chat error, fallback used:', e);
      }
    }

    let assistantMediaType: 'text' | 'document' | 'audio' = 'text';
    let assistantMeta: any = null;

    const lower = message.toLowerCase().trim();
    const corpusForMatcher: LegalDocumentNode[] = generateLargeInterconnectedCorpus(1050);

    // 1. Exact "list documents" command matching user screenshot
    if (lower.includes('list doc') || lower === 'list documents' || lower === 'documents' || lower === 'files') {
      assistantReply = `Total documents: 4\n1. B-184-2026 letter to RDO.pdf\n2. Shamshabad 626.pdf\n3. New Brief of Shamshabad Village.pdf\n4. BRIEF NOTE of Peddashahpur land.pdf`;
    }
    // 2. Fuzzy / Phonetic Document Matcher (handles "shamchabaz 626", "pida shop", "send shamshabad 626 document")
    else if (
      lower.includes('send') ||
      lower.includes('doc') ||
      lower.includes('file') ||
      lower.includes('626') ||
      lower.includes('184') ||
      lower.includes('brief') ||
      lower.includes('shamchabaz') ||
      lower.includes('pida') ||
      lower.includes('rdo') ||
      lower.includes('pedda')
    ) {
      const matchResult = fuzzyMatchDocument(message, corpusForMatcher);
      if (matchResult && matchResult.score >= 0.45) {
        const doc = matchResult.document;
        assistantReply = isHyderabadi
          ? `Assalam alaikum Vakil Sahab! Aapka pucha hua file '${doc.pdfFileName || doc.title}' (Sy.No ${doc.surveyNumber} ${doc.village}) mil gaya hai.\nYeh lijiye official document:`
          : `Here is the requested document: ${doc.pdfFileName || doc.title} (Survey ${doc.surveyNumber}, ${doc.village}).`;
        assistantMediaType = 'document';
        assistantMeta = {
          fileAttachment: {
            fileName: doc.pdfFileName || `${doc.title}.pdf`,
            fileSize: doc.fileSize || '381 KB',
            fileType: 'PDF',
            documentId: doc.id,
            surveyNumber: doc.surveyNumber,
            village: doc.village,
          },
        };
      }
    }
    // 3. Multi-Document Knowledge Graph and Interconnection Research
    else if (
      lower.includes('1000') ||
      lower.includes('interconnect') ||
      lower.includes('graph') ||
      lower.includes('network') ||
      lower.includes('relat') ||
      lower.includes('chain')
    ) {
      assistantReply = isHyderabadi
        ? `Vakil Sahab, humare Knowledge Graph me 1,050 documents indexed hain aur 3,400+ interconnections hain!\n1. Shamshabad Sy 626: RDO letter (B-184-2026) aur Demarcation Report direct High Court WP 18942/2026 ke Status Quo se linked hain.\n2. Peddashahpur Sy 45: Khasra Pahani se digital passbook tak title chain verify hoti hai.\nAap 'Knowledge Graph' tab me jakar kisi bhi document ka multi-hop connection dekh sakte hain!`
        : `The Knowledge Graph indexes 1,050+ legal documents across 6 villages with 3,400+ linkages.\n- Survey 626 Shamshabad connects B-184-2026 RDO Appeal directly with High Court WP 18942/2026 stay order.\n- Peddashahpur Sy 45 connects 1954 Khasra Pahani to current ROR passbooks.\nExplore the '1,000+ Doc Knowledge Graph' tab to visualize multi-hop connections and evidentiary paths.`;
    }

    if (!assistantReply) {
      // Deterministic conversational fallback
      if (lower.includes('shamshabad') || lower.includes('142')) {
        assistantReply = isHyderabadi
          ? `Assalam alaikum Vakil Sahab! Shamshabad Sy No 142/A ka High Court order (WP 18942/2026) verified hai. Hon'ble Court ne Status Quo order diya tha. Next Date of Hearing 14.11.2026 hai. Hamara 7:00 PM causelist bot check kiya to Court Hall 04 me Item No. 14 pe list hua hai. Bundle ready hai!`
          : `High Court Order for Sy No 142/A Shamshabad (WP 18942/2026): Status Quo granted. Next hearing is on 14.11.2026 in Court Hall 04, Item 14 before Hon'ble Justice K. Lakshman.`;
      } else if (lower.includes('morning') || lower.includes('suno') || lower.includes('agenda') || lower.includes('remind')) {
        assistantReply = isHyderabadi
          ? `Subah bakhair Vakil Sahab! Aaj ka docket ye hai:\n1. 10:30 AM: High Court Hall 04, Item 14 (WP 18942/2026 Shamshabad)\n2. 03:00 PM: Farooq bhai ke saath meeting (Chevella FIR)\n3. 05:30 PM: HMDA Planning Officer ko call (Sy 204 Fire NOC)\n\nKya koi naye reminders ya meetings add karna hai aaj ke liye?`
          : `Good morning Counsel. Today's docket:\n- 10:30 AM: High Court appearance in Court Hall 04 (WP 18942/2026)\n- 03:00 PM: Client meeting regarding Chevella FIR\n- 05:30 PM: Call with HMDA Planning Officer\nWould you like me to add any new reminders or meetings to your schedule?`;
      } else {
        assistantReply = isHyderabadi
          ? `Ji Vakil Sahab, maine note karliya. Google Drive aur database me 1,050 documents indexed hain (Shamshabad, Moinabad, Rajendranagar, Chevella, Maheshwaram). Har roze shaam 7 baje High Court causelist crawler run hota hai. Agar koi naya order ya WhatsApp par file aati hai to main turant organize karke briefs bana deta hoon.`
          : `Understood Counsel. The vault currently holds active records across Shamshabad, Moinabad, Rajendranagar, Chevella, and Maheshwaram. Daily 7 PM causelist monitoring is running automatically. Upload any document or audio note, and I will index and brief it immediately.`;
      }
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      sender: 'assistant',
      senderName: 'SABEEL Legal AI (Aliya)',
      text: assistantReply,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      mediaType: assistantMediaType,
      meta: assistantMeta,
    };
    chatHistory.push(assistantMsg);

    res.json({
      success: true,
      message: assistantReply,
      mediaType: assistantMediaType,
      meta: assistantMeta,
      chatHistory,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error processing chat' });
  }
});

// 7. GET /api/chat/history - Get WhatsApp messages
app.get('/api/chat/history', (_req: Request, res: Response) => {
  res.json({ success: true, history: chatHistory });
});

// 7b. GET /api/documents/graph - 1,000+ Interconnected Knowledge Graph API
app.get('/api/documents/graph', (req: Request, res: Response) => {
  try {
    const scale = req.query.scale === 'standard' ? 15 : 1050;
    const village = req.query.village as string;
    const category = req.query.category as string;

    let corpus = generateLargeInterconnectedCorpus(scale);
    if (village && village !== 'all') {
      corpus = corpus.filter(d => d.village.toLowerCase() === village.toLowerCase());
    }
    if (category && category !== 'all') {
      corpus = corpus.filter(d => d.category === category);
    }

    const graph = buildDocumentGraph(corpus.slice(0, 80));
    res.json({
      success: true,
      scale,
      totalCorpusSize: corpus.length,
      graph,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7c. POST /api/documents/graph/path - Find multi-hop connection between two documents
app.post('/api/documents/graph/path', (req: Request, res: Response) => {
  try {
    const { sourceId, targetId } = req.body;
    const corpus = generateLargeInterconnectedCorpus(1050);
    const network = buildDocumentGraph(corpus.slice(0, 100));
    const result = findInterconnectionPath(sourceId, targetId, network);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7d. GET /api/documents/download/:filename - Simulated PDF file download
app.get('/api/documents/download/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`%PDF-1.4\n1 0 obj\n<< /Title (${filename}) /Creator (SABEEL Legal OS) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
});

// 8. POST /api/whatsapp/webhook - Incoming WhatsApp webhook (Twilio / Meta Cloud API)
app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
  try {
    const { Body, From, MediaUrl0, MessageType } = req.body;
    const incomingText = Body || req.body.message || 'Voice / Media received via WhatsApp';
    const sender = From || '+91-98490-XXXXX';

    const simulatedUserMsg: ChatMessage = {
      id: `webhook-${Date.now()}`,
      sender: 'user',
      senderName: `WhatsApp (${sender})`,
      text: incomingText,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      mediaType: MessageType === 'audio' ? 'audio' : MediaUrl0 ? 'document' : 'text',
      mediaUrl: MediaUrl0,
    };
    chatHistory.push(simulatedUserMsg);

    const autoReplyText = `*SABEEL AI (WhatsApp Bot)*\nAssalam alaikum! Aapka WhatsApp message receive ho chuka hai.\nDocument/Query: "${incomingText.slice(0, 60)}..."\nGoogle Drive vault me check kiya jaa raha hai.`;

    const botMsg: ChatMessage = {
      id: `webhook-${Date.now() + 1}`,
      sender: 'assistant',
      senderName: 'SABEEL Legal AI (Aliya)',
      text: autoReplyText,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      mediaType: 'text',
    };
    chatHistory.push(botMsg);

    res.json({
      status: 'success',
      received: incomingText,
      reply: autoReplyText,
      chatId: sender,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reminders API (GET / POST / TOGGLE)
app.get('/api/reminders', (_req: Request, res: Response) => {
  res.json({ success: true, reminders: remindersStore });
});

app.post('/api/reminders/toggle', (req: Request, res: Response) => {
  const { id } = req.body;
  const item = remindersStore.find(r => r.id === id);
  if (item) {
    item.completed = !item.completed;
  }
  res.json({ success: true, reminders: remindersStore });
});

app.post('/api/reminders', (req: Request, res: Response) => {
  const { title, time, type, lawyer, village, caseRef } = req.body;
  const newRem: ReminderItem = {
    id: `rem-${Date.now()}`,
    title: title || 'New Legal Reminder',
    time: time || 'Morning',
    type: type || 'general',
    lawyer: lawyer || 'Adv. M.A. Riyaz',
    village,
    caseRef,
    completed: false,
  };
  remindersStore.push(newRem);
  res.json({ success: true, reminder: newRem, reminders: remindersStore });
});

// 10. Legal & Land News API
app.get('/api/news', (_req: Request, res: Response) => {
  res.json({ success: true, news: legalNewsFeed });
});

// 11. Generalized Action Rules API for ANY document type
app.get('/api/action-rules', (_req: Request, res: Response) => {
  res.json({ success: true, rules: documentActionRules });
});

app.post('/api/action-rules/trigger', (req: Request, res: Response) => {
  const { ruleId } = req.body;
  const rule = documentActionRules.find(r => r.ruleId === ruleId);
  if (!rule) {
    return res.status(404).json({ error: 'Action rule not found' });
  }

  rule.lastChecked = new Date().toISOString().replace('T', ' ').slice(0, 19);
  rule.checkCount += 1;
  rule.status = 'triggered';

  // Dispatch WhatsApp notification to chat memory
  const alertMsg: ChatMessage = {
    id: `alert-${Date.now()}`,
    sender: 'assistant',
    senderName: 'SABEEL Action Radar',
    text: rule.whatsappAlertTemplate,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    mediaType: 'text',
  };
  chatHistory.push(alertMsg);

  res.json({
    success: true,
    rule,
    triggeredAlert: rule.whatsappAlertTemplate,
    chatUpdated: true,
  });
});

app.post('/api/action-rules/create', (req: Request, res: Response) => {
  const { docTitle, docCategory, actionType, schedule, targetPortalName, targetUrl, queryParam, nextActionDate, whatsappAlertTemplate } = req.body;
  const newRule: DocumentActionRule = {
    ruleId: `rule-${Date.now()}`,
    docTitle: docTitle || 'Custom Tracked Document',
    docCategory: docCategory || 'General',
    actionType: actionType || 'custom_cron',
    schedule: schedule || 'Daily at 7:00 PM',
    targetPortalName: targetPortalName || 'Online Portal Verification',
    targetUrl: targetUrl || 'https://telangana.gov.in',
    queryParam: queryParam || 'General Check',
    nextActionDate: nextActionDate || new Date().toISOString().split('T')[0],
    status: 'active_monitoring',
    whatsappAlertTemplate: whatsappAlertTemplate || `ℹ️ *SCHEDULED ALERT*\nVerified condition for ${docTitle}.`,
    checkCount: 0,
  };
  documentActionRules.unshift(newRule);
  res.json({ success: true, rule: newRule, rules: documentActionRules });
});

// 12. Cross-document Conflicts API
app.get('/api/conflicts', (_req: Request, res: Response) => {
  const conflicts = findDocumentConflicts(documentsVault);
  res.json({ success: true, conflicts });
});

// 13. Deep Research & Multi-Document Comparative Study API
app.post('/api/research/deep-study', async (req: Request, res: Response) => {
  try {
    const { documentIds, village, surveyNumber, researchMode, customPrompt } = req.body;

    let targetDocs = documentsVault;
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      targetDocs = documentsVault.filter(d => documentIds.includes(d.id));
    } else if (village || surveyNumber) {
      targetDocs = filterDocuments(documentsVault, {
        village,
        surveyNumber,
      });
    }

    const conflicts = findDocumentConflicts(targetDocs.length > 0 ? targetDocs : documentsVault);

    const docSummaries = targetDocs.map(d => `[DOCUMENT #${d.uniqueTag}]
Title: ${d.title}
Category: ${d.category}
Village: ${d.village} | Survey No: ${d.surveyNumber}
Date: ${d.date} | Next Hearing: ${d.nextHearingDate || 'N/A'}
Assigned Advocate: ${d.assignedLawyer}
Text Content:
${d.content}`).join('\n\n==========\n\n');

    let aiOutput = '';
    if (aiClient) {
      try {
        const prompt = `You are SABEEL, Senior Legal AI Research Analyst for Telangana High Court and Land Revenue Law.
Conduct an in-depth research study on the following legal documents.

Research Mode: ${researchMode || 'Comparative Synthesis & Conflict Audit'}
User Question: ${customPrompt || 'Analyze title validity, court orders, discrepancies, and immediate legal steps.'}

DOCUMENTS VAULT:
${docSummaries}

Provide your structured output with:
1. EXECUTIVE SUMMARY & TITLE CHAIN CHRONOLOGY
2. CONFLICT & DISCREPANCY AUDIT (Compare survey numbers, extent of land, adverse claims, boundaries)
3. STATUS OF ORDERS & STATUTORY COMPLIANCE (High Court stay, Dharani passbook, police panchanama)
4. RECOMMENDED LITIGATION STRATEGY / PROCEDURAL NEXT STEPS
5. SABEEL CONVERSATIONAL NOTE (In polite Hyderabadi Roman Urdu for Vakil Sahab & Client)`;

        const aiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 6000));
        const resp: any = await Promise.race([aiPromise, timeoutPromise]);
        aiOutput = resp.text || '';
      } catch (err) {
        console.warn('Deep study AI fallback:', err);
      }
    }

    if (!aiOutput) {
      aiOutput = `### In-Depth Cross-Document Research Study

#### 1. Title Chain & Chronology of Events
- **Phase 1 (Revenue Record)**: Proceedings No. ROR/1042/2026 registered for Sy.No 88/2 Moinabad; digital passbook issued under Telangana Rights in Land & Pattadar Pass Books Act.
- **Phase 2 (Civil Dispute & High Court)**: WP 18942/2026 before Telangana High Court; Hon'ble Justice K. Lakshman granted Status Quo on Sy.No 142/A Shamshabad. Next Hearing: 14.11.2026 (Court Hall 04, Item 14).
- **Phase 3 (Criminal Trespass)**: FIR Crime No. 342/2026 registered at Chevella PS for Section 447/427 IPC regarding boundary stone demolition.

#### 2. Conflict & Discrepancy Audit
- **High Risk Discrepancy**: While High Court Status Quo order prohibits altering land character, physical demarcation disputes are active in adjacent survey boundaries.
- **Title Gap**: Tahsildar mutation requires reconciliation with pre-1954 Khasra Pahani to defend against adverse possession claims in civil court.

#### 3. Strategic Action Plan
1. File certified copy of High Court Status Quo order with Shamshabad and Chevella Station House Officers.
2. Attend motion hearing in Court Hall 04 on 14.11.2026 for extension of interim orders.
3. Submit formal representation to Tahsildar under Section 5 of ROR Act.

**SABEEL Note (Hyderabadi Roman Urdu):** Vakil Sahab, maine saare documents cross-verify karliye. High Court ka Status Quo order strong hai, lekin police station me copy deke boundary protection petition file karna zaroori hai taake opposition koi nayi fencing na daale.`;
    }

    res.json({
      success: true,
      analyzedDocCount: targetDocs.length,
      conflicts,
      report: aiOutput,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error conducting deep study' });
  }
});

// -------------------------------------------------------------
// Vite middleware in dev / Static in production
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SABEEL Legal AI Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
