import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_DRAFT_ACTION_HEALTH_MODE,
  SUPPORT_DRAFT_ACTION_PACKAGE,
  SUPPORT_DRAFT_ACTION_PHASE,
  assertSupportDraftActionSafe,
  buildSupportDraftActionExample,
  buildSupportDraftActionPreview,
  buildSupportDraftActionStatus,
} from './support-draft-action.model.js';

const baseDraft = {
  ticketId: 'ticket_123',
  threadId: 'gmail_thread_123',
  customerEmail: 'customer@example.com',
  subject: 'Where is my order?',
  draftReplyBody: 'Hello, thanks for reaching out. I can help check the order status and tracking details for you.',
  category: 'shipping',
  confidenceScore: 0.88,
  sensitiveFlag: false,
  escalationRequired: false,
  sourceDraftId: 'draft_support_123',
};

test('Phase 12.5 constants are correct', () => {
  assert.equal(SUPPORT_DRAFT_ACTION_PHASE, 'phase_12_5_draft_reply_action');
  assert.equal(SUPPORT_DRAFT_ACTION_HEALTH_MODE, 'v2-phase-12-5-draft-reply-action');
  assert.equal(SUPPORT_DRAFT_ACTION_PACKAGE, 'lifesaver-v0.7.0-phase-12-5-draft-reply-action.zip');
});

test('status confirms draft-to-action and no send behavior', () => {
  const status = buildSupportDraftActionStatus();
  assert.equal(status.deliverable, 'support_draft_to_action_flow');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.draftToActionAdded, true);
  assert.equal(status.createsProposedAction, true);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.supportAutoReplyAdded, false);
  assert.equal(status.approvalRequired, true);
});

test('builds a proposed support_reply_send action payload from a support draft', () => {
  const preview = buildSupportDraftActionPreview(baseDraft);
  assert.equal(preview.actionType, 'support_reply_send');
  assert.equal(preview.payload.action_type, 'support_reply_send');
  assert.equal(preview.payload.data.support_provider, 'gmail');
  assert.equal(preview.payload.data.ticket_id, 'ticket_123');
  assert.equal(preview.payload.data.thread_id, 'gmail_thread_123');
  assert.equal(preview.payload.data.reply_body.includes('tracking'), true);
  assert.equal(preview.approvalRequired, true);
  assert.equal(preview.policyDecision, 'ask');
});

test('preview remains safe and cannot send email', () => {
  const preview = buildSupportDraftActionPreview(baseDraft);
  assert.equal(preview.safety.createsProposedActionOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(preview.safety.externalWriteEnabled, false);
  assert.equal(preview.safety.autoReplyEnabled, false);
  assert.equal(preview.safety.rawProviderPayloadReturned, false);
});

test('browser preview masks customer email and avoids raw payload', () => {
  const preview = buildSupportDraftActionPreview(baseDraft);
  assert.equal(preview.browserSafePreview.customerEmailHint, 'cu***@example.com');
  assert.equal(JSON.stringify(preview.browserSafePreview).includes('customer@example.com'), false);
  assert.equal(JSON.stringify(preview).toLowerCase().includes('raw_provider_payload'), false);
});

test('sensitive draft becomes critical manual review', () => {
  const preview = buildSupportDraftActionPreview({
    ...baseDraft,
    subject: 'Password and card',
    draftReplyBody: 'The customer included a password and card number 4111111111111111.',
    category: undefined,
  });
  assert.equal(preview.browserSafePreview.sensitiveFlag, true);
  assert.equal(preview.browserSafePreview.escalationRequired, true);
  assert.equal(preview.riskLevel, 'critical');
  assert.equal(preview.decision, 'manual_review_required');
});

test('refund and payment issue drafts become high risk', () => {
  const refund = buildSupportDraftActionPreview({ ...baseDraft, category: 'refund', draftReplyBody: 'We can review your refund request.' });
  const payment = buildSupportDraftActionPreview({ ...baseDraft, category: 'payment_issue', draftReplyBody: 'We can review this payment issue.' });
  assert.equal(refund.riskLevel, 'high');
  assert.equal(payment.riskLevel, 'high');
});

test('low confidence draft produces warning', () => {
  const preview = buildSupportDraftActionPreview({ ...baseDraft, confidenceScore: 0.42 });
  assert.equal(preview.riskLevel, 'medium');
  assert.ok(preview.warnings.some((warning) => warning.toLowerCase().includes('low confidence')));
});

test('requires draftReplyBody or replyBody', () => {
  assert.throws(() => buildSupportDraftActionPreview({ ...baseDraft, draftReplyBody: null, replyBody: null }), /requires draftReplyBody or replyBody/);
});

test('strict input rejects raw provider payload', () => {
  assert.throws(() => buildSupportDraftActionPreview({ ...baseDraft, rawProviderPayload: { id: 'msg_1' } }), /Unrecognized key/);
});

test('example builder is safe', () => {
  const example = buildSupportDraftActionExample();
  assert.equal(example.payload.data.send_email_enabled, false);
  assert.doesNotThrow(() => assertSupportDraftActionSafe(example));
});

test('output safety rejects secret fragments', () => {
  assert.throws(() => assertSupportDraftActionSafe({ message: 'access_token leaked' }), /forbidden fragment/);
});
