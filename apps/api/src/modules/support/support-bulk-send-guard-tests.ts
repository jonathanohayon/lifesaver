import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_BULK_SEND_GUARD_ACTION_TYPE,
  SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
  SUPPORT_BULK_SEND_GUARD_PACKAGE,
  SUPPORT_BULK_SEND_GUARD_PHASE,
  SUPPORT_BULK_SEND_GUARD_PROVIDER,
  assertSupportBulkSendGuardOutputSafe,
  buildSupportBulkSendGuardExample,
  buildSupportBulkSendGuardStatus,
  evaluateSupportBulkSendGuard,
  evaluateSupportBulkSendGuardFromPayload,
  extractSupportBulkSendGuardInputFromPayload,
  previewSupportBulkSendGuard,
} from './support-bulk-send-guard.model.js';

const singleInput = {
  actionType: 'support_reply_send',
  provider: 'gmail',
  recipientCount: 1,
  threadCount: 1,
  ticketCount: 1,
  messageCount: 1,
  hasCc: false,
  hasBcc: false,
  hasAttachments: false,
  bulkModeRequested: false,
  sendAllRequested: false,
  audienceSegmentPresent: false,
  templateSendRequested: false,
};

test('Phase 13.6 constants are correct', () => {
  assert.equal(SUPPORT_BULK_SEND_GUARD_PHASE, 'phase_13_6_no_bulk_sends');
  assert.equal(SUPPORT_BULK_SEND_GUARD_HEALTH_MODE, 'v2-phase-13-6-no-bulk-sends');
  assert.equal(SUPPORT_BULK_SEND_GUARD_PACKAGE, 'lifesaver-v0.7.0-phase-13-6-no-bulk-sends.zip');
  assert.equal(SUPPORT_BULK_SEND_GUARD_ACTION_TYPE, 'support_reply_send');
  assert.equal(SUPPORT_BULK_SEND_GUARD_PROVIDER, 'gmail');
});

test('status describes no-bulk-send guard', () => {
  const status = buildSupportBulkSendGuardStatus();
  assert.equal(status.deliverable, 'bulk_send_guard');
  assert.equal(status.singleRecipientExecutorOnly, true);
  assert.equal(status.bulkSendSupportedThisPhase, false);
  assert.equal(status.explicitBulkApprovalRequiredForFutureBulkSends, true);
  assert.equal(status.executorMustCheckBulkGuard, true);
  assert.equal(status.previewCallsGmail, false);
  assert.equal(status.previewSendsEmail, false);
});

test('allows one recipient to continue to later gates without sending', () => {
  const result = evaluateSupportBulkSendGuard(singleInput);
  assert.equal(result.allowedToContinue, true);
  assert.equal(result.bulkSendDetected, false);
  assert.equal(result.decision, 'single_recipient_send_allowed_to_continue');
  assert.equal(result.safety.emailSent, false);
  assert.equal(result.safety.gmailApiCalled, false);
});

test('blocks multiple recipients without explicit bulk approval', () => {
  const result = evaluateSupportBulkSendGuard({ ...singleInput, recipientCount: 2 });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.bulkSendDetected, true);
  assert.equal(result.decision, 'blocked_bulk_send_requires_explicit_approval');
});

test('bulk remains blocked in this phase even with valid explicit bulk approval metadata', () => {
  const result = evaluateSupportBulkSendGuard({
    ...singleInput,
    recipientCount: 10,
    threadCount: 10,
    ticketCount: 10,
    bulkModeRequested: true,
    explicitBulkApproval: {
      approvalId: 'bulk_approval_123',
      approvedByUserId: 'founder_user_123',
      approvedAt: '2026-07-08T10:00:00.000Z',
      approvalScope: 'bulk_support_send',
      maxRecipientCount: 10,
    },
  });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.decision, 'blocked_bulk_send_not_supported_this_phase');
  assert.equal(result.safety.bulkSendSupportedThisPhase, false);
});

test('blocks invalid explicit bulk approval scope', () => {
  const result = evaluateSupportBulkSendGuard({
    ...singleInput,
    recipientCount: 4,
    explicitBulkApproval: {
      approvalId: 'bulk_approval_123',
      approvedByUserId: 'founder_user_123',
      approvedAt: '2026-07-08T10:00:00.000Z',
      approvalScope: 'single_support_send',
      maxRecipientCount: 4,
    },
  });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.decision, 'blocked_bulk_approval_scope_invalid');
});

test('blocks unsupported action type and provider', () => {
  const wrongType = evaluateSupportBulkSendGuard({ ...singleInput, actionType: 'content_publish' });
  const wrongProvider = evaluateSupportBulkSendGuard({ ...singleInput, provider: 'zendesk' });
  assert.equal(wrongType.decision, 'blocked_unsupported_action_type');
  assert.equal(wrongProvider.decision, 'blocked_unsupported_provider');
});

test('blocks cc bcc attachments send-all audience and template batch signals', () => {
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, hasCc: true }).allowedToContinue, false);
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, hasBcc: true }).allowedToContinue, false);
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, hasAttachments: true }).allowedToContinue, false);
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, sendAllRequested: true }).allowedToContinue, false);
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, audienceSegmentPresent: true }).allowedToContinue, false);
  assert.equal(evaluateSupportBulkSendGuard({ ...singleInput, templateSendRequested: true }).allowedToContinue, false);
});

test('extracts bulk signals from support reply payload shape', () => {
  const extracted = extractSupportBulkSendGuardInputFromPayload({
    action_type: 'support_reply_send',
    data: {
      support_provider: 'gmail',
      customer_email: 'customer@example.com',
      thread_id: 'gmail_thread_123',
      ticket_id: 'ticket_123',
    },
  });
  assert.equal(extracted.recipientCount, 1);
  assert.equal(extracted.threadCount, 1);
  assert.equal(extracted.ticketCount, 1);

  const bulk = extractSupportBulkSendGuardInputFromPayload({
    action_type: 'support_reply_send',
    data: {
      support_provider: 'gmail',
      recipients: ['a@example.com', 'b@example.com'],
      thread_ids: ['thread_1', 'thread_2'],
      ticket_ids: ['ticket_1', 'ticket_2'],
      bulk_mode: true,
    },
  });
  assert.equal(bulk.recipientCount, 2);
  assert.equal(bulk.threadCount, 2);
  assert.equal(bulk.ticketCount, 2);
  assert.equal(bulk.bulkModeRequested, true);
});

test('evaluates raw payload and blocks bulk signals safely', () => {
  const result = evaluateSupportBulkSendGuardFromPayload({
    action_type: 'support_reply_send',
    data: {
      support_provider: 'gmail',
      recipients: ['a@example.com', 'b@example.com'],
      thread_ids: ['thread_1', 'thread_2'],
      ticket_ids: ['ticket_1', 'ticket_2'],
    },
  });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.bulkSendDetected, true);
});

test('preview and examples are safe and never send', () => {
  const preview = previewSupportBulkSendGuard(singleInput);
  const example = buildSupportBulkSendGuardExample();
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.gmailApiCalled, false);
  assert.doesNotThrow(() => assertSupportBulkSendGuardOutputSafe(preview));
  assert.doesNotThrow(() => assertSupportBulkSendGuardOutputSafe(example));
});

test('safe assertion rejects raw provider payload and token-like output', () => {
  assert.throws(() => assertSupportBulkSendGuardOutputSafe({ raw_provider_payload: { body: 'private' } }), /forbidden fragment/);
  assert.throws(() => assertSupportBulkSendGuardOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
});
