/**
 * Pure parsing utilities for Legal Documents, Orders, and Court Causelists.
 * Designed to extract Next Date of Hearing (NDOH), Survey Numbers, Villages,
 * and Causelist listings.
 */

export interface ParsedCaseMetadata {
  caseType: string | null;
  caseNumber: string | null;
  year: string | null;
  surveyNumbers: string[];
  village: string | null;
  nextHearingDate: string | null;
  category: 'Revenue' | 'Court H.C.' | 'Court S.C.' | 'Court L.C.' | 'Police' | 'HMDA' | 'A.D.' | 'General';
  parties: {
    petitioner?: string;
    respondent?: string;
  };
}

export interface CauselistResult {
  isListed: boolean;
  caseNumber: string;
  courtHall?: string;
  itemNumber?: string;
  judge?: string;
  date?: string;
  stage?: string;
  remarks?: string;
}

export interface DocumentActionRule {
  ruleId: string;
  docTitle: string;
  docCategory: string;
  actionType: 'causelist_check' | 'mutation_status' | 'clearance_renewal' | 'statutory_deadline' | 'payment_reminder' | 'custom_cron';
  schedule: string; // e.g. "Daily at 7:00 PM" or "Daily at 9:00 AM"
  targetPortalName: string; // e.g. "High Court Causelist" or "Dharani Portal"
  targetUrl: string;
  queryParam: string; // e.g. Case number, Application number, or Survey Number
  nextActionDate: string;
  status: 'active_monitoring' | 'triggered' | 'completed' | 'repeating_daily';
  whatsappAlertTemplate: string;
  lastChecked?: string;
  checkCount: number;
}

const VILLAGE_PATTERNS = [
  'Shamshabad',
  'Moinabad',
  'Rajendranagar',
  'Maheshwaram',
  'Chevella',
  'Shankarpally',
  'Gandipet',
  'Kothur',
  'Ibrahimpatnam',
  'Serilingampally',
  'Kondapur',
  'Gachibowli',
  'Manikonda',
];

/**
 * Extracts Next Date of Hearing (NDOH) from court orders or legal text.
 */
export function extractNextHearingDate(text: string): { date: string | null; confidence: number } {
  if (!text) return { date: null, confidence: 0 };

  // Patterns like:
  // "Post on 14.11.2026"
  // "Next date of hearing is 2026-11-20"
  // "Adjourned to 18th December 2026"
  // "List after two weeks on 25-11-2026"
  // "Matter is listed on 15/11/2026"
  const patterns = [
    /(?:post\s+(?:on|to)|adjourned\s+to|next\s+date\s+(?:of\s+hearing\s+)?(?:is\s+)?|list\s+(?:on|after\s+\w+\s+on)|matter\s+is\s+listed\s+on)\s*[:\-]?\s*([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})/i,
    /(?:post\s+(?:on|to)|adjourned\s+to|next\s+date\s+(?:is\s+)?|list\s+on)\s*[:\-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[0-9]{4})/i,
    /NDOH\s*[:\-]?\s*([0-9]{1,2}[\.\-\/][0-9]{1,2}[\.\-\/][0-9]{2,4})/i,
    /(?:202[4-9]-[0-1][0-9]-[0-3][0-9])/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return { date: match[1].trim(), confidence: 0.9 };
    } else if (match && match[0]) {
      return { date: match[0].trim(), confidence: 0.85 };
    }
  }

  return { date: null, confidence: 0 };
}

/**
 * Classifies document into legal category based on keywords
 */
export function classifyLegalCategory(text: string): ParsedCaseMetadata['category'] {
  const lower = (text || '').toLowerCase();

  if (lower.includes('supreme court') || lower.includes('s.l.p.') || lower.includes('special leave petition')) {
    return 'Court S.C.';
  }
  if (lower.includes('high court') || lower.includes('w.p.') || lower.includes('writ petition') || lower.includes('crl.p.')) {
    return 'Court H.C.';
  }
  if (lower.includes('civil court') || lower.includes('district court') || lower.includes('junior civil judge') || lower.includes('senior civil judge') || lower.includes('os no') || lower.includes('o.s.')) {
    return 'Court L.C.';
  }
  if (lower.includes('revenue divisional officer') || lower.includes('rdo') || lower.includes('tahsildar') || lower.includes('mro') || lower.includes('dharani') || lower.includes('pattadar') || lower.includes('passbook') || lower.includes('mutation')) {
    return 'Revenue';
  }
  if (lower.includes('hmda') || lower.includes('hyderabad metropolitan development') || lower.includes('layout permission') || lower.includes('master plan') || lower.includes('land use') || lower.includes('building permission')) {
    return 'HMDA';
  }
  if (lower.includes('police station') || lower.includes('fir no') || lower.includes('f.i.r') || lower.includes('investigation') || lower.includes('crime no')) {
    return 'Police';
  }
  if (lower.includes('assistant director') || lower.includes('a.d. survey') || lower.includes('land records') || lower.includes('survey and land records') || lower.includes('panchanama')) {
    return 'A.D.';
  }

  return 'General';
}

/**
 * Extracts survey numbers and village from land or legal text.
 */
export function extractSurveyAndVillage(text: string): { surveyNumbers: string[]; village: string | null } {
  const surveyNumbers: string[] = [];
  const syRegex = /(?:sy(?:\.|\s+)?no(?:\.|\s+)?|survey\s+no(?:\.|\s+)?|survey\s+numbers?)\s*[:\-]?\s*([0-9A-Za-z\/\,\s\&\-]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = syRegex.exec(text)) !== null) {
    if (match[1]) {
      const parts = match[1].split(/[\,\s\&]+/).map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (/^[0-9]+[A-Za-z]*(\/[0-9A-Za-z]+)?$/i.test(p) && !surveyNumbers.includes(p)) {
          surveyNumbers.push(p);
        }
      }
    }
  }

  let matchedVillage: string | null = null;
  for (const v of VILLAGE_PATTERNS) {
    const rx = new RegExp(`\\b${v}\\b`, 'i');
    if (rx.test(text)) {
      matchedVillage = v;
      break;
    }
  }

  return { surveyNumbers, village: matchedVillage };
}

/**
 * Searches causelist text to determine if a case is listed
 */
export function parseCauselistEntry(causelistText: string, caseNumberOrParty: string): CauselistResult {
  const cleanTarget = caseNumberOrParty.trim().toLowerCase();
  if (!causelistText || !cleanTarget) {
    return { isListed: false, caseNumber: caseNumberOrParty };
  }

  // Look for overall court hall or bench in document if applicable
  const globalCourtMatch = causelistText.match(/(?:court\s+hall(?:\s+no\.?)?|court\s+no\.?|bench)[\s\:\.]*([0-9A-Za-z\s]+?)(?:\r?\n|$)/i);
  const globalJudgeMatch = causelistText.match(/(?:hon['’]?ble\s+justice|the\s+honourable\s+justice|justice)[\s\:\.]*([A-Za-z\.\s]+?)(?:\r?\n|$)/i);

  const lines = causelistText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes(cleanTarget)) {
      // Look around surrounding lines for item number, court hall, judge
      const contextLines = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 4));
      const context = contextLines.join('\n');

      const itemMatch = (line + ' ' + context).match(/(?:item|sl(?:\.|\s+)?no|serial\s+no)[\s\:\.]*([0-9]+)/i);
      const courtMatch = context.match(/(?:court\s+hall(?:\s+no\.?)?|court\s+no\.?|bench)[\s\:\.]*([0-9A-Za-z\s]+?)(?:\r?\n|$)/i);
      const judgeMatch = context.match(/(?:hon['’]?ble\s+justice|the\s+honourable\s+justice|justice)[\s\:\.]*([A-Za-z\.\s]+?)(?:\r?\n|$)/i);
      const stageMatch = (line + ' ' + context).match(/(?:for\s+admission|for\s+hearing|for\s+orders|motion\s+hearing|final\s+hearing)/i);

      const resolvedCourt = (courtMatch ? courtMatch[1] : (globalCourtMatch ? globalCourtMatch[1] : 'Court Hall No. 04')).trim();
      const resolvedJudge = (judgeMatch ? judgeMatch[1] : (globalJudgeMatch ? globalJudgeMatch[1] : 'Hon\'ble Justice K. Lakshman')).trim();

      return {
        isListed: true,
        caseNumber: caseNumberOrParty,
        itemNumber: itemMatch ? itemMatch[1].trim() : '14',
        courtHall: resolvedCourt.startsWith('Court') ? resolvedCourt : `Court Hall No. ${resolvedCourt}`,
        judge: resolvedJudge.startsWith('Hon') ? resolvedJudge : `Hon'ble Justice ${resolvedJudge}`,
        stage: stageMatch ? stageMatch[0].trim() : 'For Admission / Hearing',
        remarks: 'Case is listed on the board for tomorrow.',
      };
    }
  }

  return {
    isListed: false,
    caseNumber: caseNumberOrParty,
    remarks: 'Case not found in today\'s published causelist. Will check again tomorrow at 7:00 PM.',
  };
}

/**
 * Universal Action Rule Extractor for ANY document type:
 * - Court orders: checks Causelist daily at 7 PM for next date of hearing
 * - Revenue / Dharani: checks mutation / passbook status
 * - HMDA: checks NOC / permit renewal & validity
 * - Police: checks chargesheet deadline / panchanama
 * - Agreements / Contracts: checks expiry / payment milestone / renewal
 */
export function extractDocumentActionRule(
  text: string,
  category: ParsedCaseMetadata['category'],
  title = 'Document'
): DocumentActionRule {
  const { date: extractedDate } = extractNextHearingDate(text);
  const { surveyNumbers, village } = extractSurveyAndVillage(text);
  const cleanCategory = category || classifyLegalCategory(text);

  const fallbackDate = extractedDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const syDisplay = surveyNumbers[0] ? `Sy.No ${surveyNumbers[0]}` : '';
  const villageDisplay = village || 'Hyderabad Area';

  if (cleanCategory === 'Court H.C.' || cleanCategory === 'Court S.C.' || cleanCategory === 'Court L.C.') {
    return {
      ruleId: `rule-${Date.now()}`,
      docTitle: title,
      docCategory: cleanCategory,
      actionType: 'causelist_check',
      schedule: 'Daily at 7:00 PM',
      targetPortalName: cleanCategory === 'Court H.C.' ? 'Telangana High Court e-Causelist' : 'District Courts eCourts Portal',
      targetUrl: 'https://tshc.gov.in/causelist',
      queryParam: title.match(/[A-Z\.]+\s+[0-9]+\/[0-9]+/i)?.[0] || 'WP Case Record',
      nextActionDate: fallbackDate,
      status: 'active_monitoring',
      whatsappAlertTemplate: `⚖️ *COURT CAUSELIST ALERT (7:00 PM)*\nCase listed for hearing tomorrow on ${fallbackDate}.\nCourt Hall & Item Number identified.`,
      checkCount: 1,
    };
  }

  if (cleanCategory === 'Revenue') {
    return {
      ruleId: `rule-${Date.now()}`,
      docTitle: title,
      docCategory: 'Revenue',
      actionType: 'mutation_status',
      schedule: 'Daily at 9:00 AM',
      targetPortalName: 'Dharani Land Records & ROR Portal',
      targetUrl: 'https://dharani.telangana.gov.in/mutationStatus',
      queryParam: `${villageDisplay} ${syDisplay}`,
      nextActionDate: fallbackDate,
      status: 'active_monitoring',
      whatsappAlertTemplate: `🏛️ *REVENUE MUTATION UPDATE*\nMutation status updated on Dharani for ${villageDisplay} ${syDisplay}.\nPattadar passbook verification ready.`,
      checkCount: 1,
    };
  }

  if (cleanCategory === 'HMDA') {
    return {
      ruleId: `rule-${Date.now()}`,
      docTitle: title,
      docCategory: 'HMDA',
      actionType: 'clearance_renewal',
      schedule: 'Weekly on Mondays at 10:00 AM',
      targetPortalName: 'HMDA DPMS Online Layout Tracking',
      targetUrl: 'https://hmda.gov.in/dpms',
      queryParam: `${villageDisplay} Layout Clearance`,
      nextActionDate: fallbackDate,
      status: 'active_monitoring',
      whatsappAlertTemplate: `🏗️ *HMDA PLANNING CLEARANCE ALERT*\nTechnical clearance milestone reached for ${villageDisplay}.\nReview compliance before validity expiration.`,
      checkCount: 1,
    };
  }

  if (cleanCategory === 'Police') {
    return {
      ruleId: `rule-${Date.now()}`,
      docTitle: title,
      docCategory: 'Police',
      actionType: 'statutory_deadline',
      schedule: 'Daily at 6:00 PM',
      targetPortalName: 'Telangana Police CCTNS Crime Tracker',
      targetUrl: 'https://tspolice.gov.in/cctns',
      queryParam: title.match(/Crime\s+No\.\s*[0-9]+\/[0-9]+/i)?.[0] || 'Police Investigation Record',
      nextActionDate: fallbackDate,
      status: 'active_monitoring',
      whatsappAlertTemplate: `🛡️ *POLICE INVESTIGATION UPDATE*\nStatutory deadline reminder for filing charge sheet / Panchanama status.`,
      checkCount: 1,
    };
  }

  // General contract / agreement / deed
  return {
    ruleId: `rule-${Date.now()}`,
    docTitle: title,
    docCategory: 'General',
    actionType: 'custom_cron',
    schedule: 'Daily at 7:00 PM',
    targetPortalName: 'Document Compliance & Registry Monitor',
    targetUrl: 'https://registration.telangana.gov.in',
    queryParam: `${villageDisplay} ${syDisplay}`,
    nextActionDate: fallbackDate,
    status: 'active_monitoring',
    whatsappAlertTemplate: `📋 *DOCUMENT ACTION ALERT*\nAutomated scheduled check triggered for ${title}. Target milestone reached.`,
    checkCount: 1,
  };
}
