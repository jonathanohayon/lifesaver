import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_AUTO_APPROVAL_DECISION_HEALTH_MODE,
  CONTENT_AUTO_APPROVAL_DECISION_PHASE,
  assertContentAutoApprovalDecisionSafe,
  buildContentAutoApprovalDecisionRecord,
  buildContentAutoApprovalDecisionStatus,
} from './content-auto-approval-decision.model.js';

const safeCaption = 'A calm founder update: today we are sharing a practical ecommerce workflow improvement, focused on clearer decisions, safer systems, and better operating rhythm.';

function buildSafeRecord(overrides = {}) {
  return buildContentAutoApprovalDecisionRecord({
    caption: safeCaption,
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    mediaType: 'none',
    timezone: 'UTC',
    scheduledTime: '2026-07-06T10:00:00.000Z',
    maxPostsPerDay: 3,
    publishedTodayCount: 0,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
    policyAutoApprovalRuleMatched: true,
    ...overrides,
  });
}

test('Phase 11.5 constants are correct', () => {
  assert.equal(CONTENT_AUTO_APPROVAL_DECISION_PHASE, 'phase_11_5_auto_approval_decision');
  assert.equal(CONTENT_AUTO_APPROVAL_DECISION_HEALTH_MODE, 'v2-phase-11-5-auto-approval-decision');
});

test('status describes auto-approval decision record and required gates', () => {
  const status = buildContentAutoApprovalDecisionStatus();
  assert.equal(status.deliverable, 'auto_approval_decision_record');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.equal(status.supportedChannel, 'linkedin_member_feed');
  assert.equal(status.supportedActionType, 'content_publish');
  assert.ok(status.requiredGateNames.includes('style_profile_matched'));
  assert.ok(status.requiredGateNames.includes('risk_score_eligible'));
  assert.equal(status.safety.decisionRecordOnly, true);
});

test('returns auto_approved only when every gate passes', () => {
  const record = buildSafeRecord();
  assert.equal(record.finalDecision, 'auto_approved');
  assert.equal(record.autoApproved, true);
  assert.equal(record.gateSummary.failedGates, 0);
  assert.equal(record.gates.every((item) => item.passed), true);
  assert.equal(record.autoPublishAllowedNow, false);
});

test('auto_approved decision still does not publish or mutate action status', () => {
  const record = buildSafeRecord();
  assert.equal(record.safety.autoPublishEnabled, false);
  assert.equal(record.safety.doesNotPublish, true);
  assert.equal(record.safety.externalApiCalled, false);
  assert.equal(record.safety.noDatabaseWrites, true);
  assert.equal(record.safety.doesNotMutateActionStatus, true);
});

test('missing policy auto-approval rule requires manual review', () => {
  const record = buildSafeRecord({ policyAutoApprovalRuleMatched: false });
  assert.equal(record.finalDecision, 'manual_review_required');
  assert.equal(record.autoApproved, false);
  assert.equal(record.matchedPolicyRuleKey, null);
  assert.equal(record.gates.find((item) => item.gate === 'policy_auto_approval_rule_matched')?.severity, 'ask');
});

test('master pause blocks auto-approval', () => {
  const record = buildSafeRecord({ masterPauseActive: true });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'master_pause_off')?.passed, false);
});

test('content pause blocks auto-approval', () => {
  const record = buildSafeRecord({ contentPauseActive: true });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'content_pause_off')?.passed, false);
});

test('emergency safe mode blocks auto-approval', () => {
  const record = buildSafeRecord({ emergencySafeModeActive: true });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'emergency_safe_mode_off')?.passed, false);
});

test('unsupported action type is blocked', () => {
  const record = buildSafeRecord({ actionType: 'support_reply_send' });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.policyDecisionSnapshot.dailyCapDecision, 'blocked_invalid_cap');
});

test('unsupported platform is blocked', () => {
  const record = buildSafeRecord({ platform: 'instagram' });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'platform_supported')?.passed, false);
});

test('unsupported channel is blocked', () => {
  const record = buildSafeRecord({ channel: 'linkedin_company_page' });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'platform_supported')?.passed, false);
});

test('style mismatch requiring ask keeps decision in manual review', () => {
  const record = buildSafeRecord({ caption: 'Too short.' });
  assert.equal(record.finalDecision, 'manual_review_required');
  assert.equal(record.policyDecisionSnapshot.styleDecision, 'requires_manual_review');
});

test('blocked style phrase blocks auto-approval', () => {
  const record = buildSafeRecord({ caption: `${safeCaption} Guaranteed profit for every founder.` });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.policyDecisionSnapshot.styleDecision, 'blocked_by_style_profile');
});

test('risk scoring requiring manual review prevents auto_approved', () => {
  const record = buildSafeRecord({ caption: `${safeCaption} This includes a verified sale update with a discount.`, offerSourceAttached: true });
  assert.equal(record.finalDecision, 'manual_review_required');
  assert.equal(record.policyDecisionSnapshot.riskDecision, 'requires_manual_review');
});

test('critical risk blocks auto-approval', () => {
  const record = buildSafeRecord({ caption: `${safeCaption} Guaranteed revenue and guaranteed ROAS with no verified source.` });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.policyDecisionSnapshot.riskDecision, 'blocked_by_risk_score');
});

test('daily cap exceeded blocks auto-approval', () => {
  const record = buildSafeRecord({ maxPostsPerDay: 1, publishedTodayCount: 1 });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.policyDecisionSnapshot.dailyCapDecision, 'blocked_daily_cap_exceeded');
});

test('outside channel/time window blocks auto-approval', () => {
  const record = buildSafeRecord({ scheduledTime: '2026-07-06T22:00:00.000Z' });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.policyDecisionSnapshot.channelTimeDecision, 'blocked_outside_time_window');
});

test('media image blocks narrow auto-approval lane', () => {
  const record = buildSafeRecord({ mediaType: 'image' });
  assert.equal(record.finalDecision, 'blocked');
  assert.equal(record.gates.find((item) => item.gate === 'media_type_allowed')?.passed, false);
});

test('link media can pass when all other gates pass', () => {
  const record = buildSafeRecord({ mediaType: 'link', linkUrl: 'https://lifesaveragent.com' });
  assert.equal(record.finalDecision, 'auto_approved');
  assert.equal(record.safeContentSummary.hasLinkUrl, true);
});

test('decision snapshot contains component decisions but no raw caption', () => {
  const record = buildSafeRecord();
  assert.equal(record.policyDecisionSnapshot.decision, 'auto_approved');
  assert.equal(record.policyDecisionSnapshot.styleDecision, 'style_match');
  assert.equal(record.policyDecisionSnapshot.riskDecision, 'eligible_for_future_auto_run_review');
  assert.equal(record.safeContentSummary.captionCharacters, safeCaption.length);
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes(safeCaption), false);
});

test('safe assertion passes for safe record', () => {
  const record = buildSafeRecord();
  assert.doesNotThrow(() => assertContentAutoApprovalDecisionSafe(record));
});

test('safe assertion rejects impossible auto_approved record with failed gate', () => {
  const record = buildSafeRecord();
  record.gates[0] = { ...record.gates[0], passed: false, severity: 'ask' };
  assert.throws(() => assertContentAutoApprovalDecisionSafe(record), /must not be returned/);
});

test('safe output does not contain secret-like fragments', () => {
  const record = buildSafeRecord();
  assert.doesNotThrow(() => assertContentAutoApprovalDecisionSafe(record));
});
