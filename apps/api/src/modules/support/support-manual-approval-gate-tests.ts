import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE,
  SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE,
  SUPPORT_MANUAL_APPROVAL_GATE_PACKAGE,
  SUPPORT_MANUAL_APPROVAL_GATE_PHASE,
  SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID,
  assertSupportManualApprovalGateOutputSafe,
  buildSupportManualApprovalGateExample,
  buildSupportManualApprovalGateStatus,
  evaluateSupportSendManualApprovalGate,
  previewSupportManualApprovalGate,
} from './support-manual-approval-gate.model.js';

test('Phase 13.3 constants are correct', () => {
  assert.equal(SUPPORT_MANUAL_APPROVAL_GATE_PHASE, 'phase_13_3_manual_approval_first');
  assert.equal(SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE, 'v2-phase-13-3-manual-approval-first');
  assert.equal(SUPPORT_MANUAL_APPROVAL_GATE_PACKAGE, 'lifesaver-v0.7.0-phase-13-3-manual-approval-first.zip');
  assert.equal(SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID, 'support_send_manual_approval_first_v1');
  assert.equal(SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE, 'support_reply_send');
});

test('status makes every support send approval-gated', () => {
  const status = buildSupportManualApprovalGateStatus();
  assert.equal(status.deliverable, 'all_support_sends_approval_gated');
  assert.equal(status.manualApprovalRequiredForEverySupportSend, true);
  assert.equal(status.autoSendEnabled, false);
  assert.equal(status.forceBypassAllowed, false);
  assert.equal(status.gmailApiCallAllowedWithoutApproval, false);
  assert.equal(status.emailSendingAllowedWithoutApproval, false);
});

test('gate blocks proposed actions before any send', () => {
  const result = evaluateSupportSendManualApprovalGate({ actionType: 'support_reply_send', actionStatus: 'proposed' });
  assert.equal(result.eligibleToSend, false);
  assert.equal(result.decision, 'blocked_manual_approval_required');
  assert.equal(result.safety.emailSent, false);
  assert.equal(result.safety.gmailApiCalled, false);
  assert.equal(result.blockers.some((blocker) => blocker.includes('approved')), true);
});

test('gate blocks approved status without approval event actor', () => {
  const result = evaluateSupportSendManualApprovalGate({
    actionType: 'support_reply_send',
    actionStatus: 'approved',
    approvedAt: '2026-07-08T10:00:00.000Z',
    approvalEventId: 'approval_event_123',
    approvalEventActorUserId: null,
  });
  assert.equal(result.eligibleToSend, false);
  assert.equal(result.checks.approvalEventPresent, true);
  assert.equal(result.checks.approvalActorPresent, false);
  assert.equal(result.decision, 'blocked_manual_approval_required');
});

test('gate allows executor eligibility only after full founder/admin approval evidence', () => {
  const result = evaluateSupportSendManualApprovalGate({
    actionType: 'support_reply_send',
    actionStatus: 'approved',
    approvedAt: new Date('2026-07-08T10:00:00.000Z'),
    approvalEventId: 'approval_event_123',
    approvalEventActorUserId: 'founder_user_123',
  });
  assert.equal(result.eligibleToSend, true);
  assert.equal(result.decision, 'approved_to_execute');
  assert.equal(result.checks.actionStatusIsApproved, true);
  assert.equal(result.checks.approvedTimestampPresent, true);
  assert.equal(result.checks.approvalActorPresent, true);
});

test('gate blocks unsupported action types', () => {
  const result = evaluateSupportSendManualApprovalGate({
    actionType: 'content_publish',
    actionStatus: 'approved',
    approvedAt: '2026-07-08T10:00:00.000Z',
    approvalEventActorUserId: 'founder_user_123',
  });
  assert.equal(result.eligibleToSend, false);
  assert.equal(result.decision, 'blocked_unsupported_action_type');
});

test('gate blocks auto-send requests in first support send version', () => {
  const result = evaluateSupportSendManualApprovalGate({
    actionType: 'support_reply_send',
    actionStatus: 'approved',
    approvedAt: '2026-07-08T10:00:00.000Z',
    approvalEventActorUserId: 'founder_user_123',
    autoSendRequested: true,
  });
  assert.equal(result.eligibleToSend, false);
  assert.equal(result.decision, 'blocked_auto_send_not_allowed');
  assert.equal(result.safety.autoReplyAllowed, false);
});

test('force request never bypasses approval', () => {
  const result = evaluateSupportSendManualApprovalGate({
    actionType: 'support_reply_send',
    actionStatus: 'proposed',
    forceRequested: true,
  });
  assert.equal(result.eligibleToSend, false);
  assert.equal(result.safety.forceBypassAllowed, false);
  assert.equal(result.warnings.some((warning) => warning.includes('force') || warning.includes('Force')), true);
});

test('preview is safe and does not send', () => {
  const preview = previewSupportManualApprovalGate({ actionType: 'support_reply_send', actionStatus: 'proposed' });
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.doesNotThrow(() => assertSupportManualApprovalGateOutputSafe(preview));
});

test('example includes blocked and eligible paths without sending', () => {
  const example = buildSupportManualApprovalGateExample();
  assert.equal(example.blockedWithoutApproval.eligibleToSend, false);
  assert.equal(example.eligibleAfterApproval.eligibleToSend, true);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.gmailApiCalled, false);
});

test('safe assertion rejects token-like output', () => {
  assert.throws(() => assertSupportManualApprovalGateOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
});

test('safe assertion rejects raw ticket payload output', () => {
  assert.throws(() => assertSupportManualApprovalGateOutputSafe({ raw_ticket_payload: { body: 'private' } }), /forbidden fragment/);
});
