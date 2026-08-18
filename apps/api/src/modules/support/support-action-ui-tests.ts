import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_ACTION_UI_HEALTH_MODE,
  SUPPORT_ACTION_UI_PACKAGE,
  SUPPORT_ACTION_UI_PHASE,
  assertSupportActionUiSafe,
  buildSupportActionUiExample,
  buildSupportActionUiPreview,
  buildSupportActionUiStatus,
} from './support-action-ui.model.js';

const baseInput = {
  ticketId: 'ticket_123',
  threadId: 'gmail_thread_123',
  actionId: 'action_support_reply_123',
  actionStatus: 'proposed',
  customerEmail: 'customer@example.com',
  subject: 'Where is my order?',
  bodySnippet: 'Hi team, where is my order? Please check tracking.',
  suggestedReply: 'Hello, thanks for reaching out. I can help check your order status and tracking details.',
  category: 'shipping',
  confidenceScore: 0.88,
  sensitiveFlag: false,
  escalationRequired: false,
  riskLevel: 'medium',
};

test('Phase 12.9 constants are correct', () => {
  assert.equal(SUPPORT_ACTION_UI_PHASE, 'phase_12_9_ticket_to_action_ui');
  assert.equal(SUPPORT_ACTION_UI_HEALTH_MODE, 'v2-phase-12-9-ticket-to-action-ui');
  assert.equal(SUPPORT_ACTION_UI_PACKAGE, 'lifesaver-v0.7.0-phase-12-9-ticket-to-action-ui.zip');
});

test('status confirms support action UI and no support sending executor', () => {
  const status = buildSupportActionUiStatus();
  assert.equal(status.deliverable, 'support_action_ui');
  assert.equal(status.ticketReviewUiAdded, true);
  assert.equal(status.suggestedReplyReviewAdded, true);
  assert.equal(status.approveRejectControlsAdded, true);
  assert.equal(status.usesExistingInternalApprovalEndpoints, true);
  assert.equal(status.approvalRequiresConfirmation, true);
  assert.equal(status.rejectionRequiresReason, true);
  assert.equal(status.supportSendExecutorAdded, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
});

test('builds review UI packet for proposed support_reply_send action', () => {
  const preview = buildSupportActionUiPreview(baseInput);
  assert.equal(preview.deliverable, 'support_action_ui');
  assert.equal(preview.actionType, 'support_reply_send');
  assert.equal(preview.ticket.ticketId, 'ticket_123');
  assert.equal(preview.ticket.threadId, 'gmail_thread_123');
  assert.equal(preview.ticket.category, 'shipping');
  assert.equal(preview.suggestedReplyPreview?.includes('tracking'), true);
  assert.equal(preview.approvalRequired, true);
  assert.equal(preview.policyDecision, 'ask');
});

test('approve and reject controls are enabled only for proposed actions with an action id', () => {
  const preview = buildSupportActionUiPreview(baseInput);
  assert.equal(preview.reviewControls.approveEnabled, true);
  assert.equal(preview.reviewControls.rejectEnabled, true);
  assert.equal(preview.reviewControls.approveEndpoint, '/api/v1/actions/action_support_reply_123/approve');
  assert.equal(preview.reviewControls.rejectEndpoint, '/api/v1/actions/action_support_reply_123/reject');
  assert.equal(preview.reviewControls.approveRequiresConfirmation, true);
  assert.equal(preview.reviewControls.rejectRequiresReason, true);
});

test('approved actions render read-only disabled controls', () => {
  const preview = buildSupportActionUiPreview({ ...baseInput, actionStatus: 'approved' });
  assert.equal(preview.reviewControls.approveEnabled, false);
  assert.equal(preview.reviewControls.rejectEnabled, false);
  assert.equal(preview.reviewControls.approveEndpoint, null);
  assert.equal(preview.reviewControls.rejectEndpoint, null);
  assert.ok(preview.warnings.some((warning) => warning.includes('not proposed')));
});

test('missing action id disables controls and gives warning', () => {
  const preview = buildSupportActionUiPreview({ ...baseInput, actionId: null, actionStatus: 'proposed' });
  assert.equal(preview.reviewControls.approveEnabled, false);
  assert.equal(preview.reviewControls.rejectEnabled, false);
  assert.ok(preview.warnings.some((warning) => warning.includes('No proposed action ID')));
});

test('customer email is masked in browser-safe ticket preview', () => {
  const preview = buildSupportActionUiPreview(baseInput);
  assert.equal(preview.ticket.customerEmailHint, 'cu***@example.com');
  assert.equal(JSON.stringify(preview.ticket).includes('customer@example.com'), false);
});

test('ticket body and suggested reply previews are redacted for sensitive patterns', () => {
  const preview = buildSupportActionUiPreview({
    ...baseInput,
    bodySnippet: 'Customer email private@example.com, card 4111111111111111, and authorization: bearer secret.',
    suggestedReply: 'Please use OTP 123456 and send to private@example.com.',
  });
  const serialized = JSON.stringify(preview);
  assert.ok(serialized.includes('[REDACTED_EMAIL]'));
  assert.ok(serialized.includes('[REDACTED_CARD]'));
  assert.ok(serialized.includes('[REDACTED_AUTHORIZATION_HEADER]'));
  assert.ok(serialized.includes('[REDACTED_CODE]'));
  assert.equal(serialized.includes('private@example.com'), false);
});

test('sensitive escalation becomes critical and warning-heavy', () => {
  const preview = buildSupportActionUiPreview({
    ...baseInput,
    category: 'escalation',
    bodySnippet: 'I will file a chargeback and call my lawyer.',
    sensitiveFlag: true,
    escalationRequired: true,
    riskLevel: undefined,
    confidenceScore: 0.55,
  });
  assert.equal(preview.ticket.sensitiveFlag, true);
  assert.equal(preview.ticket.escalationRequired, true);
  assert.equal(preview.riskLevel, 'critical');
  assert.ok(preview.founderReviewChecklist.some((item) => item.toLowerCase().includes('owner')));
});

test('refund and payment categories include policy checklist warning', () => {
  const refund = buildSupportActionUiPreview({ ...baseInput, category: 'refund', riskLevel: undefined });
  const payment = buildSupportActionUiPreview({ ...baseInput, category: 'payment_issue', riskLevel: undefined });
  assert.equal(refund.riskLevel, 'high');
  assert.equal(payment.riskLevel, 'high');
  assert.ok(refund.founderReviewChecklist.some((item) => item.toLowerCase().includes('store policy')));
});

test('low confidence classification adds manual verification warning', () => {
  const preview = buildSupportActionUiPreview({ ...baseInput, confidenceScore: 0.42, riskLevel: undefined });
  assert.ok(preview.warnings.some((warning) => warning.toLowerCase().includes('low confidence')));
});

test('safety flags confirm approve/reject cannot execute or send', () => {
  const preview = buildSupportActionUiPreview(baseInput);
  assert.equal(preview.safety.usesExistingInternalApprovalEndpoints, true);
  assert.equal(preview.safety.approveRejectCanExecuteAction, false);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(preview.safety.supportSendExecutorAdded, false);
  assert.equal(preview.safety.supportAutoReplyAdded, false);
  assert.equal(preview.reviewControls.canSendEmail, false);
  assert.equal(preview.reviewControls.canExecuteSupportSend, false);
});

test('strict input rejects raw provider payloads', () => {
  assert.throws(() => buildSupportActionUiPreview({ ...baseInput, rawProviderPayload: { id: 'raw' } }), /Unrecognized key/);
});

test('safe output guard blocks tokens and Gmail send scope strings', () => {
  assert.throws(() => assertSupportActionUiSafe({ leaked: 'access_token=abc' }), /forbidden fragment/);
  assert.throws(() => assertSupportActionUiSafe({ leaked: 'gmail.send' }), /forbidden fragment/);
});

test('example includes proposed, sensitive, and approved states', () => {
  const example = buildSupportActionUiExample();
  assert.equal(example.proposedShippingReply.reviewControls.approveEnabled, true);
  assert.equal(example.sensitiveEscalationReply.riskLevel, 'critical');
  assert.equal(example.approvedReadOnlyState.reviewControls.approveEnabled, false);
  assertSupportActionUiSafe(example);
});

test('invalid action status is rejected', () => {
  assert.throws(() => buildSupportActionUiPreview({ ...baseInput, actionStatus: 'queued' }), /Invalid enum value/);
});

test('invalid category is rejected', () => {
  assert.throws(() => buildSupportActionUiPreview({ ...baseInput, category: 'unknown' }), /Invalid enum value/);
});
