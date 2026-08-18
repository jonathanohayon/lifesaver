import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_ROLLBACK_POLICY_DELIVERABLE,
  SUPPORT_ROLLBACK_POLICY_HEALTH_MODE,
  SUPPORT_ROLLBACK_POLICY_PACKAGE,
  SUPPORT_ROLLBACK_POLICY_PHASE,
  assertSupportRollbackPolicyOutputSafe,
  buildSupportRollbackPolicyExample,
  buildSupportRollbackPolicyStatus,
  evaluateSupportRollbackPolicy,
  previewSupportRollbackPolicy,
} from './support-rollback-policy.model.js';

test('Phase 13.9 constants are correct', () => {
  assert.equal(SUPPORT_ROLLBACK_POLICY_PHASE, 'phase_13_9_follow_up_rollback_handling');
  assert.equal(SUPPORT_ROLLBACK_POLICY_HEALTH_MODE, 'v2-phase-13-9-follow-up-rollback-handling');
  assert.equal(SUPPORT_ROLLBACK_POLICY_PACKAGE, 'lifesaver-v0.7.0-phase-13-9-follow-up-rollback-handling.zip');
  assert.equal(SUPPORT_ROLLBACK_POLICY_DELIVERABLE, 'support_rollback_policy');
});

test('status confirms email undo is not supported and no Gmail call is made', () => {
  const status = buildSupportRollbackPolicyStatus();
  assert.equal(status.emailUndoSupported, false);
  assert.equal(status.rollbackMeansDraftCorrection, true);
  assert.equal(status.rollbackMeansDraftApologyFollowUp, true);
  assert.equal(status.rollbackMeansMarkForHumanReview, true);
  assert.equal(status.previewCallsGmail, false);
  assert.equal(status.previewSendsEmail, false);
  assert.equal(status.previewDeletesEmail, false);
  assert.equal(status.nextStep, 'Phase 13.10 — Support Send QA');
});

test('successful support send with wrong information recommends correction follow-up draft', () => {
  const evaluation = evaluateSupportRollbackPolicy({
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_123',
    externalThreadId: 'gmail_thread_123',
    sentAt: '2026-07-08T12:00:00.000Z',
    ticketId: 'ticket_123',
    ticketCategory: 'faq',
    issueReason: 'wrong_information',
    correctionText: 'The previous ETA was too early; the correct ETA is pending review',
    customerEmail: 'customer@example.com',
  });
  assert.equal(evaluation.canUndoEmail, false);
  assert.equal(evaluation.decision, 'draft_correction_follow_up');
  assert.equal(evaluation.recoveryPlan.draftCorrection, true);
  assert.equal(evaluation.recoveryPlan.sendNow, false);
  assert.equal(evaluation.futureActionPreview?.approvalRequired, true);
  assert.equal(evaluation.futureActionPreview?.autoSendAllowed, false);
});

test('sensitive sent reply recommends apology follow-up and human review', () => {
  const evaluation = evaluateSupportRollbackPolicy({
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_124',
    externalThreadId: 'gmail_thread_124',
    sentAt: '2026-07-08T12:05:00.000Z',
    ticketCategory: 'refund',
    confidenceScore: 0.61,
    issueReason: 'refund_or_payment',
  });
  assert.equal(evaluation.decision, 'draft_apology_follow_up');
  assert.equal(evaluation.recoveryPlan.draftApologyFollowUp, true);
  assert.equal(evaluation.recoveryPlan.markForHumanReview, true);
  assert.equal(evaluation.checks.apologyFollowUpRecommended, true);
});

test('failed send does not draft apology because customer-visible send was not confirmed', () => {
  const evaluation = evaluateSupportRollbackPolicy({
    resultStatus: 'failed',
    externalThreadId: 'gmail_thread_125',
    failureReason: 'Gmail API returned 403; no send success was confirmed.',
    issueReason: 'api_failed',
  });
  assert.equal(evaluation.decision, 'retry_or_human_review');
  assert.equal(evaluation.checks.customerVisibleSendConfirmed, false);
  assert.equal(evaluation.recoveryPlan.retryAsNewManualAction, true);
  assert.equal(evaluation.recoveryPlan.draftApologyFollowUp, false);
  assert.equal(evaluation.futureActionPreview?.sentNow, false);
});

test('blocked send is marked for human review only', () => {
  const evaluation = evaluateSupportRollbackPolicy({ resultStatus: 'blocked', ticketCategory: 'complaint' });
  assert.equal(evaluation.decision, 'mark_for_human_review');
  assert.equal(evaluation.recoveryPlan.markForHumanReview, true);
  assert.equal(evaluation.recoveryPlan.sendNow, false);
});

test('nested Phase 13.8 result log input can be evaluated safely', () => {
  const evaluation = evaluateSupportRollbackPolicy({
    issueReason: 'wrong_information',
    correctionText: 'The previous wording needs correction',
    supportSendResultLog: {
      resultStatus: 'success',
      externalMessageId: 'gmail_msg_nested',
      externalThreadId: 'gmail_thread_nested',
      sentAt: '2026-07-08T12:10:00.000Z',
      actionResult: {
        metadataJson: {
          ticket_id: 'ticket_nested',
          external_message_id: 'gmail_msg_nested',
          external_thread_id: 'gmail_thread_nested',
          sent_at: '2026-07-08T12:10:00.000Z',
        },
      },
    },
  });
  assert.equal(evaluation.checks.externalMessageIdKnown, true);
  assert.equal(evaluation.checks.threadIdKnown, true);
  assert.equal(evaluation.futureActionPreview?.threadId, 'gmail_thread_nested');
});

test('preview and examples are safe and never send or delete', () => {
  const preview = previewSupportRollbackPolicy({ resultStatus: 'success', issueReason: 'wrong_information' });
  const example = buildSupportRollbackPolicyExample();
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.previewCallsGmail, false);
  assert.equal(preview.safety.previewSendsEmail, false);
  assert.equal(preview.safety.previewDeletesEmail, false);
  assert.equal(example.safety.exampleCallsGmail, false);
  assert.equal(example.safety.exampleDeletesEmail, false);
  assert.doesNotThrow(() => assertSupportRollbackPolicyOutputSafe(preview));
  assert.doesNotThrow(() => assertSupportRollbackPolicyOutputSafe(example));
});

test('safe assertion rejects token and raw MIME-like output', () => {
  assert.throws(() => assertSupportRollbackPolicyOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
  assert.throws(() => assertSupportRollbackPolicyOutputSafe({ raw_mime: 'To: x' }), /forbidden fragment/);
});
