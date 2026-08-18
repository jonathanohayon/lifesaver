import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE,
  SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE,
  SUPPORT_FAQ_AUTO_REPLY_POLICY_HEALTH_MODE,
  SUPPORT_FAQ_AUTO_REPLY_POLICY_PACKAGE,
  SUPPORT_FAQ_AUTO_REPLY_POLICY_PHASE,
  SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER,
  assertSupportFaqAutoReplyPolicyOutputSafe,
  buildSupportFaqAutoReplyPolicyExample,
  buildSupportFaqAutoReplyPolicyStatus,
  evaluateSupportFaqAutoReplyPolicy,
  previewSupportFaqAutoReplyPolicy,
} from './support-faq-auto-reply-policy.model.js';

const passingInput = {
  actionType: 'support_reply_send',
  provider: 'gmail',
  category: 'faq',
  confidenceScore: 0.96,
  riskLevel: 'low',
  sensitiveFlag: false,
  escalationRequired: false,
  recipientCount: 1,
  threadAssociationVerified: true,
  capUsage: {
    maxSupportAutoRepliesPerDay: 5,
    sentSupportAutoRepliesToday: 1,
    maxSupportAutoRepliesPerHour: 2,
    sentSupportAutoRepliesThisHour: 0,
  },
  explicitRule: {
    id: 'policy_faq_auto_reply_preview',
    name: 'FAQ auto-reply preview policy',
    enabled: true,
    actionType: 'support_reply_send',
    provider: 'gmail',
    category: 'faq',
    decision: 'auto_approve',
    allowAutoReply: true,
    minConfidenceScore: 0.9,
    maxRiskLevel: 'low',
  },
};

test('Phase 13.5 constants are correct', () => {
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_POLICY_PHASE, 'phase_13_5_faq_auto_reply_policy');
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_POLICY_HEALTH_MODE, 'v2-phase-13-5-faq-auto-reply-policy');
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_POLICY_PACKAGE, 'lifesaver-v0.7.0-phase-13-5-faq-auto-reply-policy.zip');
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE, 'support_reply_send');
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER, 'gmail');
  assert.equal(SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE, 0.9);
});

test('status describes evaluation-only FAQ auto-reply policy', () => {
  const status = buildSupportFaqAutoReplyPolicyStatus();
  assert.equal(status.deliverable, 'faq_auto_reply_policy');
  assert.equal(status.evaluationOnly, true);
  assert.equal(status.autoSendEnabledNow, false);
  assert.equal(status.manualApprovalStillRequiredThisPhase, true);
  assert.equal(status.requiresExplicitRule, true);
  assert.equal(status.requiresCapNotExceeded, true);
  assert.equal(status.requiresThreadAssociation, true);
  assert.equal(status.bulkSendAllowed, false);
});

test('marks FAQ ticket eligible for future auto-reply but still blocks auto-send now', () => {
  const result = evaluateSupportFaqAutoReplyPolicy(passingInput);
  assert.equal(result.eligibleForFutureAutoReply, true);
  assert.equal(result.decision, 'eligible_future_auto_reply_manual_gate_active');
  assert.equal(result.autoSendNow, false);
  assert.equal(result.safety.emailSent, false);
  assert.equal(result.safety.gmailApiCalled, false);
  assert.equal(result.safety.manualApprovalStillRequiredThisPhase, true);
});

test('blocks non-FAQ category', () => {
  const result = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, category: 'shipping' });
  assert.equal(result.eligibleForFutureAutoReply, false);
  assert.equal(result.decision, 'blocked_non_faq_category');
  assert.equal(result.checks.categoryIsFaq, false);
});

test('blocks low confidence ticket', () => {
  const result = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, confidenceScore: 0.72 });
  assert.equal(result.eligibleForFutureAutoReply, false);
  assert.equal(result.decision, 'blocked_low_confidence');
  assert.equal(result.checks.confidenceHigh, false);
});

test('blocks sensitive or escalation tickets even when category is FAQ', () => {
  const sensitive = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, sensitiveFlag: true });
  const escalation = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, escalationRequired: true });
  assert.equal(sensitive.decision, 'blocked_ticket_not_low_risk');
  assert.equal(escalation.decision, 'blocked_ticket_not_low_risk');
});

test('blocks when support auto-reply cap is missing or exceeded', () => {
  const missingCap = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, capUsage: null });
  const exceededCap = evaluateSupportFaqAutoReplyPolicy({
    ...passingInput,
    capUsage: { maxSupportAutoRepliesPerDay: 5, sentSupportAutoRepliesToday: 5 },
  });
  assert.equal(missingCap.decision, 'blocked_missing_or_exceeded_cap');
  assert.equal(exceededCap.decision, 'blocked_missing_or_exceeded_cap');
});

test('blocks without explicit enabled auto-approve rule', () => {
  const missingRule = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, explicitRule: null });
  const askRule = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, explicitRule: { ...passingInput.explicitRule, decision: 'ask' } });
  assert.equal(missingRule.decision, 'blocked_missing_explicit_rule');
  assert.equal(askRule.decision, 'blocked_missing_explicit_rule');
});

test('blocks bulk recipients and unverified thread association', () => {
  const bulk = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, recipientCount: 2 });
  const noThread = evaluateSupportFaqAutoReplyPolicy({ ...passingInput, threadAssociationVerified: false });
  assert.equal(bulk.decision, 'blocked_bulk_send');
  assert.equal(noThread.decision, 'blocked_thread_not_verified');
});

test('preview is safe and never sends', () => {
  const preview = previewSupportFaqAutoReplyPolicy(passingInput);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(preview.safety.autoSendEnabledNow, false);
  assert.doesNotThrow(() => assertSupportFaqAutoReplyPolicyOutputSafe(preview));
});

test('example includes eligible and blocked paths without sending', () => {
  const example = buildSupportFaqAutoReplyPolicyExample();
  assert.equal(example.eligibleFutureAutoReply.eligibleForFutureAutoReply, true);
  assert.equal(example.blockedLowConfidence.eligibleForFutureAutoReply, false);
  assert.equal(example.blockedNonFaq.eligibleForFutureAutoReply, false);
  assert.equal(example.blockedCapExceeded.eligibleForFutureAutoReply, false);
  assert.equal(example.blockedMissingRule.eligibleForFutureAutoReply, false);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.gmailApiCalled, false);
});

test('safe assertion rejects raw provider payload and token-like output', () => {
  assert.throws(() => assertSupportFaqAutoReplyPolicyOutputSafe({ raw_provider_payload: { body: 'private' } }), /forbidden fragment/);
  assert.throws(() => assertSupportFaqAutoReplyPolicyOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
});
