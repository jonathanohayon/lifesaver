import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_SENSITIVE_TICKET_GUARD_ACTION_TYPE,
  SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
  SUPPORT_SENSITIVE_TICKET_GUARD_PACKAGE,
  SUPPORT_SENSITIVE_TICKET_GUARD_PHASE,
  SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
  SUPPORT_SENSITIVE_TICKET_LOW_CONFIDENCE_THRESHOLD,
  assertSupportSensitiveTicketGuardOutputSafe,
  buildSupportSensitiveTicketGuardExample,
  buildSupportSensitiveTicketGuardStatus,
  evaluateSupportSensitiveTicketGuard,
  evaluateSupportSensitiveTicketGuardFromPayload,
  extractSupportSensitiveTicketGuardInputFromPayload,
  previewSupportSensitiveTicketGuard,
} from './support-sensitive-ticket-guard.model.js';

const safeInput = {
  actionType: 'support_reply_send',
  provider: 'gmail',
  category: 'shipping',
  confidenceScore: 0.88,
  sensitiveFlag: false,
  escalationRequired: false,
  subject: 'Where is my order?',
  autoSendRequested: false,
  manualApprovalConfirmed: false,
};

const manualApproval = {
  manualApprovalConfirmed: true,
  approvalEventActorUserId: 'founder_user_123',
  approvalEventId: 'action_event_approval_123',
  approvedAt: '2026-07-08T10:00:00.000Z',
};

test('Phase 13.7 constants are correct', () => {
  assert.equal(SUPPORT_SENSITIVE_TICKET_GUARD_PHASE, 'phase_13_7_sensitive_ticket_guard');
  assert.equal(SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE, 'v2-phase-13-7-sensitive-ticket-guard');
  assert.equal(SUPPORT_SENSITIVE_TICKET_GUARD_PACKAGE, 'lifesaver-v0.7.0-phase-13-7-sensitive-ticket-guard.zip');
  assert.equal(SUPPORT_SENSITIVE_TICKET_GUARD_ACTION_TYPE, 'support_reply_send');
  assert.equal(SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER, 'gmail');
  assert.equal(SUPPORT_SENSITIVE_TICKET_LOW_CONFIDENCE_THRESHOLD, 0.7);
});

test('status describes sensitive-ticket guard and safety', () => {
  const status = buildSupportSensitiveTicketGuardStatus();
  assert.equal(status.deliverable, 'sensitive_ticket_protection');
  assert.equal(status.executorMustCheckSensitiveTicketGuard, true);
  assert.equal(status.autoSendBlockedForSensitiveTickets, true);
  assert.equal(status.forceBypassAllowed, false);
  assert.equal(status.previewCallsGmail, false);
  assert.equal(status.previewSendsEmail, false);
  assert.ok(status.alwaysRequireApprovalFor.includes('refund'));
  assert.ok(status.alwaysRequireApprovalFor.includes('low_confidence'));
});

test('allows non-sensitive ticket to continue to later gates without sending', () => {
  const result = evaluateSupportSensitiveTicketGuard(safeInput);
  assert.equal(result.allowedToContinue, true);
  assert.equal(result.sensitiveTicketDetected, false);
  assert.equal(result.decision, 'non_sensitive_ticket_allowed_to_continue');
  assert.equal(result.safety.emailSent, false);
  assert.equal(result.safety.gmailApiCalled, false);
});

test('blocks refund cancellation complaint payment legal unknown and low-confidence tickets without manual approval', () => {
  const cases = [
    { category: 'refund', trigger: 'refund' },
    { category: 'cancellation', trigger: 'cancellation' },
    { category: 'complaint', trigger: 'complaint' },
    { category: 'payment_issue', trigger: 'payment_issue' },
    { category: 'legal_issue', trigger: 'legal_issue' },
    { category: 'unknown_intent', trigger: 'unknown_intent' },
    { category: 'faq', confidenceScore: 0.42, trigger: 'low_confidence' },
  ];

  for (const item of cases) {
    const result = evaluateSupportSensitiveTicketGuard({ ...safeInput, ...item });
    assert.equal(result.allowedToContinue, false, `expected ${item.trigger} to block`);
    assert.equal(result.manualApprovalRequired, true);
    assert.ok(result.triggers.includes(item.trigger as any));
  }
});

test('blocks sensitive and escalation flags/categories without manual approval', () => {
  assert.equal(evaluateSupportSensitiveTicketGuard({ ...safeInput, sensitiveFlag: true }).allowedToContinue, false);
  assert.equal(evaluateSupportSensitiveTicketGuard({ ...safeInput, escalationRequired: true }).allowedToContinue, false);
  assert.equal(evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'sensitive' }).allowedToContinue, false);
  assert.equal(evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'escalation' }).allowedToContinue, false);
});

test('allows sensitive ticket after manual approval includes actor event and timestamp', () => {
  const result = evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'refund', ...manualApproval });
  assert.equal(result.allowedToContinue, true);
  assert.equal(result.decision, 'sensitive_ticket_manual_approval_confirmed');
  assert.equal(result.checks.approvalActorPresent, true);
  assert.equal(result.checks.approvalEventPresent, true);
  assert.equal(result.checks.approvedAtPresent, true);
});

test('blocks sensitive ticket when approval metadata is incomplete', () => {
  const result = evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'refund', manualApprovalConfirmed: true });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.decision, 'blocked_sensitive_ticket_requires_manual_approval');
});

test('blocks sensitive ticket auto-send even with approval metadata', () => {
  const result = evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'refund', autoSendRequested: true, ...manualApproval });
  assert.equal(result.allowedToContinue, false);
  assert.equal(result.decision, 'blocked_auto_send_for_sensitive_ticket');
  assert.equal(result.safety.autoSendAllowed, false);
});

test('detects legal and unknown intent from text signals', () => {
  const legal = evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'shipping', subject: 'I will call my lawyer and sue you' });
  const unknown = evaluateSupportSensitiveTicketGuard({ ...safeInput, category: 'shipping', replyBody: 'I am not sure and need to check this unknown request.' });
  assert.ok(legal.triggers.includes('legal_issue'));
  assert.ok(unknown.triggers.includes('unknown_intent'));
});

test('extracts sensitive guard input from support reply payload shape', () => {
  const extracted = extractSupportSensitiveTicketGuardInputFromPayload({
    action_type: 'support_reply_send',
    data: {
      support_provider: 'gmail',
      category: 'payment_issue',
      confidence_score: 0.82,
      sensitive_flag: false,
      escalation_required: false,
      subject: 'Payment issue',
      reply_body: 'Thanks, we will check the payment.',
      auto_reply_enabled: false,
    },
  });
  assert.equal(extracted.actionType, 'support_reply_send');
  assert.equal(extracted.provider, 'gmail');
  assert.equal(extracted.category, 'payment_issue');
  assert.equal(extracted.confidenceScore, 0.82);
});

test('evaluates raw payload with manual approval context safely', () => {
  const result = evaluateSupportSensitiveTicketGuardFromPayload({
    action_type: 'support_reply_send',
    data: {
      support_provider: 'gmail',
      category: 'complaint',
      confidence_score: 0.91,
      subject: 'Complaint about my order',
    },
  }, manualApproval);
  assert.equal(result.allowedToContinue, true);
  assert.equal(result.decision, 'sensitive_ticket_manual_approval_confirmed');
});

test('blocks unsupported action type and provider', () => {
  const wrongType = evaluateSupportSensitiveTicketGuard({ ...safeInput, actionType: 'content_publish' });
  const wrongProvider = evaluateSupportSensitiveTicketGuard({ ...safeInput, provider: 'zendesk' });
  assert.equal(wrongType.decision, 'blocked_unsupported_action_type');
  assert.equal(wrongProvider.decision, 'blocked_unsupported_provider');
});

test('preview and examples are safe and never send', () => {
  const preview = previewSupportSensitiveTicketGuard({ ...safeInput, category: 'refund' });
  const example = buildSupportSensitiveTicketGuardExample();
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.gmailApiCalled, false);
  assert.doesNotThrow(() => assertSupportSensitiveTicketGuardOutputSafe(preview));
  assert.doesNotThrow(() => assertSupportSensitiveTicketGuardOutputSafe(example));
});

test('safe assertion rejects raw provider payload and token-like output', () => {
  assert.throws(() => assertSupportSensitiveTicketGuardOutputSafe({ raw_provider_payload: { body: 'private' } }), /forbidden fragment/);
  assert.throws(() => assertSupportSensitiveTicketGuardOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
});
