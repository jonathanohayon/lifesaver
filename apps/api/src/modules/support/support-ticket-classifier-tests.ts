import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_TICKET_CLASSIFIER_HEALTH_MODE,
  SUPPORT_TICKET_CLASSIFIER_PACKAGE,
  SUPPORT_TICKET_CLASSIFIER_PHASE,
  assertSupportTicketClassifierSafe,
  buildSupportTicketClassifierExample,
  buildSupportTicketClassifierPreview,
  buildSupportTicketClassifierStatus,
  classifySupportTicket,
  supportClassifierCategories,
} from './support-ticket-classifier.model.js';

const baseTicket = {
  ticketId: 'ticket_123',
  customerEmail: 'customer@example.com',
  subject: 'Question',
  bodySnippet: 'How do I update my order?',
  threadId: 'gmail_thread_123',
  sensitiveFlag: false,
};

test('Phase 12.4 constants are correct', () => {
  assert.equal(SUPPORT_TICKET_CLASSIFIER_PHASE, 'phase_12_4_ticket_classification');
  assert.equal(SUPPORT_TICKET_CLASSIFIER_HEALTH_MODE, 'v2-phase-12-4-ticket-classification');
  assert.equal(SUPPORT_TICKET_CLASSIFIER_PACKAGE, 'lifesaver-v0.7.0-phase-12-4-ticket-classification.zip');
});

test('status confirms classifier and no Gmail/send/action execution', () => {
  const status = buildSupportTicketClassifierStatus();
  assert.equal(status.deliverable, 'ticket_classifier');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.classifierAdded, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.supportReplyActionAdded, false);
  assert.equal(status.supportAutoReplyAdded, false);
});

test('category list contains all requested classifier categories', () => {
  assert.deepEqual(supportClassifierCategories.sort(), ['faq', 'shipping', 'complaint', 'refund', 'cancellation', 'payment_issue', 'sensitive', 'escalation'].sort());
});

test('classifies FAQ tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Product question', bodySnippet: 'How do I use this product and what is your policy?' });
  assert.equal(result.category, 'faq');
  assert.equal(result.categoryLabel, 'FAQ');
  assert.equal(result.escalationRequired, false);
});

test('classifies shipping tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Where is my order?', bodySnippet: 'Please send tracking. Delivery is delayed.' });
  assert.equal(result.category, 'shipping');
  assert.ok(result.matchedSignals.includes('tracking_or_delivery'));
});

test('classifies complaint tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Complaint', bodySnippet: 'I am angry and this was a terrible bad experience.' });
  assert.equal(result.category, 'complaint');
  assert.equal(result.severity, 'high');
});

test('classifies refund tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Refund request', bodySnippet: 'I want my money back please refund this order.' });
  assert.equal(result.category, 'refund');
});

test('classifies cancellation tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Cancel order', bodySnippet: 'Please cancel my order and do not ship it.' });
  assert.equal(result.category, 'cancellation');
});

test('classifies payment issue tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Payment failed', bodySnippet: 'My card was declined at checkout and I see a billing issue.' });
  assert.equal(result.category, 'payment_issue');
});

test('classifies sensitive tickets and marks escalation', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Login code', bodySnippet: 'My password is test123 and my card number is 4111111111111111.' });
  assert.equal(result.category, 'sensitive');
  assert.equal(result.sensitiveFlag, true);
  assert.equal(result.escalationRequired, true);
  assert.equal(result.severity, 'critical');
});

test('input sensitive flag overrides to sensitive', () => {
  const result = classifySupportTicket({ ...baseTicket, sensitiveFlag: true });
  assert.equal(result.category, 'sensitive');
  assert.equal(result.matchedSignals.includes('input_sensitive_flag'), true);
});

test('classifies escalation tickets', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Legal action', bodySnippet: 'I will contact my lawyer and issue a chargeback immediately.' });
  assert.equal(result.category, 'escalation');
  assert.equal(result.escalationRequired, true);
  assert.equal(result.severity, 'critical');
});

test('sensitive has priority over refund/payment categories', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Refund and card number', bodySnippet: 'Refund me, my card number is 4111111111111111.' });
  assert.equal(result.category, 'sensitive');
});

test('unknown low-risk ticket defaults to FAQ/manual triage', () => {
  const result = classifySupportTicket({ ...baseTicket, subject: 'Hello', bodySnippet: 'Checking in about my message.' });
  assert.equal(result.category, 'faq');
  assert.ok(result.matchedSignals.includes('default_low_risk_faq_review'));
});

test('example builder is safe and no-send', () => {
  const example = buildSupportTicketClassifierExample();
  assert.equal(example.result.externalApiCalled, false);
  assert.equal(example.result.emailSent, false);
  assert.equal(example.result.category, 'shipping');
  assert.doesNotThrow(() => assertSupportTicketClassifierSafe(example));
});

test('preview is validation-only and safe', () => {
  const preview = buildSupportTicketClassifierPreview(baseTicket);
  assert.equal(preview.valid, true);
  assert.equal(preview.result.externalApiCalled, false);
  assert.equal(preview.result.emailSent, false);
});

test('invalid extra raw provider payload is rejected by strict input schema', () => {
  assert.throws(() => classifySupportTicket({ ...baseTicket, rawProviderPayload: { id: 'msg_1' } }), /Unrecognized key/);
});

test('output safety rejects token/secret fragments', () => {
  assert.throws(() => assertSupportTicketClassifierSafe({ reason: 'access_token leaked' }), /forbidden fragment/);
});
