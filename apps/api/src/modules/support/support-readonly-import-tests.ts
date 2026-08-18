import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_READONLY_IMPORT_HEALTH_MODE,
  SUPPORT_READONLY_IMPORT_PACKAGE,
  SUPPORT_READONLY_IMPORT_PHASE,
  assertNoSecretLikeProviderPayload,
  assertSupportTicketSafeForBrowser,
  buildSupportImportPreview,
  buildSupportReadonlyImportStatus,
  inferSupportCategory,
  inferSupportPriority,
  inferSupportSentiment,
  maskEmailHint,
  normalizeGmailReadonlyMessage,
  parseSupportImportMessages,
} from './support-readonly-import.model.js';

const baseMessage = {
  provider: 'gmail' as const,
  externalMessageId: 'msg_123',
  externalThreadId: 'thread_123',
  fromEmail: 'customer@example.com',
  fromName: 'Jane Customer',
  subject: 'Where is my order?',
  snippet: 'Hello, can you please share shipping tracking for order #1001?',
  receivedAt: '2026-07-07T10:00:00.000Z',
  labelIds: ['INBOX', 'support'],
  rawProviderPayload: { id: 'msg_123', threadId: 'thread_123', internalDate: '1783428000000' },
};

test('Phase 12.2 constants are correct', () => {
  assert.equal(SUPPORT_READONLY_IMPORT_PHASE, 'phase_12_2_read_only_support_connector_first');
  assert.equal(SUPPORT_READONLY_IMPORT_HEALTH_MODE, 'v2-phase-12-2-read-only-support-connector-first');
  assert.equal(SUPPORT_READONLY_IMPORT_PACKAGE, 'lifesaver-v0.7.0-phase-12-2-read-only-support-connector-first.zip');
});

test('status confirms read-only import and no sending/external Gmail API call', () => {
  const status = buildSupportReadonlyImportStatus();
  assert.equal(status.deliverable, 'read_only_ticket_import');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.readOnlyImportAdded, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.gmailModifyAdded, false);
  assert.equal(status.autoReplyAdded, false);
  assert.equal(status.browserReceivesRawProviderPayload, false);
});

test('email hints are masked for browser-safe output', () => {
  assert.equal(maskEmailHint('customer@example.com'), 'c*****@example.com');
  assert.equal(maskEmailHint('ab@example.com'), 'a*@example.com');
  assert.equal(maskEmailHint('plain-text'), 'plain-text');
});

test('normalizes Gmail readonly message into support ticket', () => {
  const { ticket, rawProviderPayload } = normalizeGmailReadonlyMessage(baseMessage);
  assert.equal(ticket.provider, 'gmail');
  assert.equal(ticket.externalMessageId, 'msg_123');
  assert.equal(ticket.externalThreadId, 'thread_123');
  assert.equal(ticket.fromEmailHint, 'c*****@example.com');
  assert.equal(ticket.category, 'shipping');
  assert.equal(ticket.priority, 'normal');
  assert.equal(ticket.sentiment, 'neutral');
  assert.equal(ticket.rawPayloadSeparated, true);
  assert.deepEqual(rawProviderPayload, baseMessage.rawProviderPayload);
  assert.doesNotThrow(() => assertSupportTicketSafeForBrowser(ticket));
});

test('category inference covers key support categories', () => {
  assert.equal(inferSupportCategory({ subject: 'Refund request', snippet: '', labelIds: [] }), 'refunds');
  assert.equal(inferSupportCategory({ subject: 'I want to return this', snippet: '', labelIds: [] }), 'returns');
  assert.equal(inferSupportCategory({ subject: 'Tracking number please', snippet: '', labelIds: [] }), 'shipping');
  assert.equal(inferSupportCategory({ subject: 'Product question', snippet: '', labelIds: [] }), 'product_question');
});

test('priority and sentiment inference are conservative', () => {
  assert.equal(inferSupportPriority({ subject: 'Urgent legal chargeback', snippet: '', labelIds: [] }), 'urgent');
  assert.equal(inferSupportPriority({ subject: 'Lost package complaint', snippet: '', labelIds: [] }), 'high');
  assert.equal(inferSupportSentiment({ subject: 'Thank you', snippet: 'Great help' }), 'positive');
  assert.equal(inferSupportSentiment({ subject: 'Bad experience', snippet: 'I am frustrated' }), 'negative');
});

test('preview does not import or send anything', () => {
  const preview = buildSupportImportPreview({ messages: [baseMessage] });
  assert.equal(preview.imported, false);
  assert.equal(preview.externalApiCalled, false);
  assert.equal(preview.emailSent, false);
  assert.equal(preview.normalizedTickets.length, 1);
  assert.doesNotThrow(() => assertSupportTicketSafeForBrowser(preview));
});

test('duplicate messages in same request are ignored with warning', () => {
  const parsed = parseSupportImportMessages({ messages: [baseMessage, baseMessage] });
  assert.equal(parsed.tickets.length, 1);
  assert.equal(parsed.rawPayloads.length, 1);
  assert.equal(parsed.warnings.length, 1);
});

test('rejects secret-like provider payloads', () => {
  assert.throws(
    () => assertNoSecretLikeProviderPayload({ Authorization: 'Bearer access_token_123' }),
    /forbidden secret-like fragment/
  );
});

test('browser safety rejects raw provider payload exposure', () => {
  assert.throws(
    () => assertSupportTicketSafeForBrowser({ rawProviderPayload: { id: 'msg_123' } }),
    /raw provider payload/
  );
});

test('validation requires ISO datetime with offset', () => {
  assert.throws(
    () => normalizeGmailReadonlyMessage({ ...baseMessage, receivedAt: 'not-a-date' }),
    /Invalid datetime/
  );
});

test('only Gmail provider is accepted in Phase 12.2', () => {
  assert.throws(
    () => normalizeGmailReadonlyMessage({ ...baseMessage, provider: 'zendesk' }),
    /Invalid literal value/
  );
});
