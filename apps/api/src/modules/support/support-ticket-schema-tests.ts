import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_TICKET_SCHEMA_HEALTH_MODE,
  SUPPORT_TICKET_SCHEMA_PACKAGE,
  SUPPORT_TICKET_SCHEMA_PHASE,
  assertSupportTicketSchemaSafe,
  buildSupportTicketSchemaExample,
  buildSupportTicketSchemaPreview,
  buildSupportTicketSchemaStatus,
  inferSensitiveReasons,
  maskCustomerEmail,
  normalizeSupportTicketSchema,
  redactSensitiveBodySnippet,
  supportTicketSchemaFields,
} from './support-ticket-schema.model.js';

const baseTicket = {
  ticketId: 'ticket_123',
  customerEmail: 'customer@example.com',
  subject: 'Where is my order?',
  bodySnippet: 'Hello, can you please share the tracking update for order #1001?',
  threadId: 'gmail_thread_123',
  status: 'open' as const,
  category: 'shipping' as const,
  sensitiveFlag: false,
};

test('Phase 12.3 constants are correct', () => {
  assert.equal(SUPPORT_TICKET_SCHEMA_PHASE, 'phase_12_3_ticket_data_model');
  assert.equal(SUPPORT_TICKET_SCHEMA_HEALTH_MODE, 'v2-phase-12-3-ticket-data-model');
  assert.equal(SUPPORT_TICKET_SCHEMA_PACKAGE, 'lifesaver-v0.7.0-phase-12-3-ticket-data-model.zip');
});

test('status confirms support ticket schema and no send/external Gmail API call', () => {
  const status = buildSupportTicketSchemaStatus();
  assert.equal(status.deliverable, 'support_ticket_schema');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.ticketSchemaAdded, true);
  assert.equal(status.migrationAdded, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.supportReplyActionAdded, false);
});

test('field list contains all required user-requested schema fields', () => {
  const keys = supportTicketSchemaFields.map((field) => field.key).sort();
  assert.deepEqual(keys, ['body_snippet', 'category', 'customer_email', 'sensitive_flag', 'status', 'subject', 'thread_id', 'ticket_id'].sort());
});

test('normalizes canonical support ticket schema', () => {
  const record = normalizeSupportTicketSchema(baseTicket);
  assert.equal(record.ticketId, 'ticket_123');
  assert.equal(record.customerEmail, 'customer@example.com');
  assert.equal(record.customerEmailHint, 'c*****@example.com');
  assert.equal(record.subject, 'Where is my order?');
  assert.equal(record.bodySnippet, baseTicket.bodySnippet);
  assert.equal(record.threadId, 'gmail_thread_123');
  assert.equal(record.status, 'open');
  assert.equal(record.category, 'shipping');
  assert.equal(record.sensitiveFlag, false);
  assert.equal(record.rawProviderPayloadSeparated, true);
  assert.equal(record.safeForBrowser, true);
});

test('customer email hint masking is stable', () => {
  assert.equal(maskCustomerEmail('customer@example.com'), 'c*****@example.com');
  assert.equal(maskCustomerEmail('ab@example.com'), 'a*@example.com');
});

test('sensitive flag turns on for payment/security/identity/compliance terms', () => {
  const record = normalizeSupportTicketSchema({
    ...baseTicket,
    bodySnippet: 'My credit card number is 4111111111111111 and my password is secret123',
  });
  assert.equal(record.sensitiveFlag, true);
  assert.ok(record.sensitiveReasons.includes('payment_or_banking'));
  assert.ok(record.sensitiveReasons.includes('account_security'));
  assert.match(record.bodySnippet ?? '', /\[redacted-number\]/);
});

test('refund category is treated as sensitive workflow context', () => {
  const record = normalizeSupportTicketSchema({ ...baseTicket, category: 'refunds' });
  assert.equal(record.sensitiveFlag, true);
  assert.ok(record.sensitiveReasons.includes('refund_or_payment_workflow'));
});

test('inferSensitiveReasons detects secret-like text', () => {
  const reasons = inferSensitiveReasons({ bodySnippet: 'please use this api key abc123' });
  assert.ok(reasons.includes('secret_like_text'));
});

test('redaction protects obvious secret-like body snippets', () => {
  const redacted = redactSensitiveBodySnippet('access token abc123 password is demo123');
  assert.equal(redacted?.includes('abc123'), false);
  assert.equal(redacted?.includes('demo123'), false);
});

test('example builder is safe and does not send/call APIs', () => {
  const example = buildSupportTicketSchemaExample();
  assert.equal(example.externalApiCalled, false);
  assert.equal(example.emailSent, false);
  assert.equal(example.fields.length, 8);
  assert.doesNotThrow(() => assertSupportTicketSchemaSafe(example));
});

test('preview is validation-only and no-send', () => {
  const preview = buildSupportTicketSchemaPreview(baseTicket);
  assert.equal(preview.valid, true);
  assert.equal(preview.externalApiCalled, false);
  assert.equal(preview.emailSent, false);
  assert.equal(preview.record.ticketId, 'ticket_123');
});

test('ticket id can be generated from thread id when not provided', () => {
  const record = normalizeSupportTicketSchema({ ...baseTicket, ticketId: null });
  assert.equal(record.ticketId, 'ticket_gmail_thread_123');
});

test('invalid email is rejected', () => {
  assert.throws(() => normalizeSupportTicketSchema({ ...baseTicket, customerEmail: 'not-an-email' }), /Invalid email/);
});

test('invalid status is rejected', () => {
  assert.throws(() => normalizeSupportTicketSchema({ ...baseTicket, status: 'sent' }), /Invalid enum value/);
});

test('invalid category is rejected', () => {
  assert.throws(() => normalizeSupportTicketSchema({ ...baseTicket, category: 'random' }), /Invalid enum value/);
});

test('browser safety rejects raw payload exposure', () => {
  assert.throws(() => assertSupportTicketSchemaSafe({ raw_provider_payload: { id: 'msg_123' } }), /forbidden fragment/);
});
