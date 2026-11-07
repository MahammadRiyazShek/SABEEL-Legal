import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractNextHearingDate,
  classifyLegalCategory,
  extractSurveyAndVillage,
  parseCauselistEntry,
  extractDocumentActionRule,
} from './legalDocumentParser.ts';

test('extractNextHearingDate detects date after Post on / List on', () => {
  const sample1 = 'The High Court directed the Registry: Post on 14.11.2026 for hearing.';
  const res1 = extractNextHearingDate(sample1);
  assert.equal(res1.date, '14.11.2026');

  const sample2 = 'Next date of hearing is 2026-12-05 for filing counter affidavit.';
  const res2 = extractNextHearingDate(sample2);
  assert.equal(res2.date, '2026-12-05');
});

test('classifyLegalCategory identifies court and departments accurately', () => {
  assert.equal(classifyLegalCategory('Writ Petition in High Court for the State of Telangana'), 'Court H.C.');
  assert.equal(classifyLegalCategory('Special Leave Petition (Civil) in the Supreme Court of India'), 'Court S.C.');
  assert.equal(classifyLegalCategory('Application before Tahsildar for Dharani passbook and mutation'), 'Revenue');
  assert.equal(classifyLegalCategory('Application for layout permission to Hyderabad Metropolitan Development HMDA'), 'HMDA');
  assert.equal(classifyLegalCategory('FIR No. 204/2026 registered at Shamshabad Police Station'), 'Police');
  assert.equal(classifyLegalCategory('Panchanama conducted by Assistant Director Survey and Land Records'), 'A.D.');
});

test('extractSurveyAndVillage finds survey numbers and village from text', () => {
  const text = 'Agricultural land located at Shamshabad in Sy.No. 142/A and Survey No 143/2, Ranga Reddy District';
  const { surveyNumbers, village } = extractSurveyAndVillage(text);
  assert.equal(village, 'Shamshabad');
  assert.ok(surveyNumbers.includes('142/A') || surveyNumbers.includes('142'));
});

test('parseCauselistEntry finds listed case details', () => {
  const causelist = `
TELANGANA HIGH COURT - CAUSELIST FOR 14.11.2026
COURT HALL NO. 04
HON'BLE JUSTICE K. LAKSHMAN
Item 14: W.P. No. 18942/2026 - Mohammed Abdul & Ors vs State of Telangana
Item 15: W.P. No. 19001/2026 - G. Srinivas vs District Collector
  `;

  const listed = parseCauselistEntry(causelist, '18942/2026');
  assert.equal(listed.isListed, true);
  assert.equal(listed.itemNumber, '14');
  assert.ok(listed.courtHall?.includes('04'));

  const notListed = parseCauselistEntry(causelist, '99999/2026');
  assert.equal(notListed.isListed, false);
});

test('extractDocumentActionRule creates generalized scheduled action rules for any document', () => {
  const courtText = 'High Court Writ Petition. Post on 14.11.2026 for hearing.';
  const courtRule = extractDocumentActionRule(courtText, 'Court H.C.', 'W.P. 18942/2026');
  assert.equal(courtRule.actionType, 'causelist_check');
  assert.equal(courtRule.schedule, 'Daily at 7:00 PM');
  assert.equal(courtRule.nextActionDate, '14.11.2026');

  const revenueText = 'Tahsildar ROR mutation application for Sy.No 88 Moinabad Village. 30 days notice.';
  const revRule = extractDocumentActionRule(revenueText, 'Revenue', 'Moinabad Mutation Order');
  assert.equal(revRule.actionType, 'mutation_status');
  assert.equal(revRule.schedule, 'Daily at 9:00 AM');
  assert.ok(revRule.targetPortalName.includes('Dharani'));

  const hmdaText = 'HMDA Technical layout approval in Sy.No 204 Rajendranagar.';
  const hmdaRule = extractDocumentActionRule(hmdaText, 'HMDA', 'HMDA Layout Permit');
  assert.equal(hmdaRule.actionType, 'clearance_renewal');
  assert.ok(hmdaRule.targetPortalName.includes('HMDA'));
});
