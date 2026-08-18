import assert from 'node:assert/strict';
import {
  buildSupportPrivacySafeguardsExample,
  buildSupportPrivacySafeguardsPreview,
  buildSupportPrivacySafeguardsStatus,
  redactSupportTextForLogs,
  SUPPORT_PRIVACY_SAFEGUARDS_HEALTH_MODE,
} from './support-privacy-safeguards.model.js';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('status reports phase 12.6 privacy safeguards only', () => {
  const status = buildSupportPrivacySafeguardsStatus();
  assert.equal(status.healthMode, SUPPORT_PRIVACY_SAFEGUARDS_HEALTH_MODE);
  assert.equal(status.redactSensitiveDataInLogs, true);
  assert.equal(status.customerPrivateDataMinimized, true);
  assert.equal(status.fullRawTicketPayloadInAdminLogs, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
});

test('redacts email addresses, card-like numbers, and OTP codes', () => {
  const result = redactSupportTextForLogs('Email me at jane@example.com. Card 4242 4242 4242 4242. OTP 123456.', 400);
  assert.match(result.value || '', /\[REDACTED_EMAIL\]/);
  assert.match(result.value || '', /\[REDACTED_CARD\]/);
  assert.match(result.value || '', /\[REDACTED_CODE\]/);
  assert.ok(result.reasons.includes('email_address'));
  assert.ok(result.reasons.includes('credit_card_like_number'));
  assert.ok(result.reasons.includes('otp_or_security_code'));
});

test('redacts OAuth and API secret-like text', () => {
  const result = redactSupportTextForLogs('Authorization: Bearer abc123 access_token=secret client_secret=shhh api_key=xyz', 400);
  const serialized = JSON.stringify(result).toLowerCase();
  assert.ok(!serialized.includes('abc123'));
  assert.ok(!serialized.includes('access_token=secret'));
  assert.ok(!serialized.includes('client_secret=shhh'));
  assert.ok(!serialized.includes('shhh')); 
  assert.ok(!serialized.includes('xyz'));
  assert.ok(result.reasons.includes('authorization_header'));
});

test('preview returns safe admin log and omits raw ticket payload', () => {
  const preview = buildSupportPrivacySafeguardsPreview({
    event: 'support_ticket_imported',
    ticketId: 'ticket_1',
    threadId: 'thread_1',
    customerEmail: 'customer@example.com',
    customerName: 'Jane Customer',
    subject: 'Refund request for card 4242424242424242',
    body: 'My email is customer@example.com and I entered verification code 123456.',
    category: 'refund',
    sensitiveFlag: true,
    rawTicketPayload: { giant: 'provider payload should never be returned' },
  });
  assert.equal(preview.safeLog.providerPayloadReturned, false);
  assert.equal(preview.safeLog.fullTicketBodyReturned, false);
  assert.equal(preview.safeLog.customerEmailHint, 'cu***@example.com');
  assert.match(preview.safeLog.subjectPreview || '', /\[REDACTED_CARD\]/);
  assert.match(preview.safeLog.bodySnippetPreview || '', /\[REDACTED_EMAIL\]/);
  assert.ok(preview.safeLog.redactionReasons.includes('raw_ticket_payload_omitted_from_admin_log'));
});

test('preview is safe when no private data is detected', () => {
  const preview = buildSupportPrivacySafeguardsPreview({
    ticketId: 'ticket_2',
    threadId: 'thread_2',
    subject: 'Where is my order?',
    bodySnippet: 'Can you share tracking please?',
    category: 'shipping',
  });
  assert.equal(preview.decision, 'safe_log_ready');
  assert.equal(preview.safeLog.safeForAdminLog, true);
  assert.equal(preview.safety.emailSendAdded, false);
});

test('example is redacted and browser-safe', () => {
  const example = buildSupportPrivacySafeguardsExample();
  const serialized = JSON.stringify(example).toLowerCase();
  assert.ok(!serialized.includes('private.customer@example.com'));
  assert.ok(!serialized.includes('4242 4242'));
  assert.ok(!serialized.includes('123456'));
  assert.equal(example.safeLog.providerPayloadReturned, false);
});

test('safe output does not include forbidden secret fragments', () => {
  const preview = buildSupportPrivacySafeguardsPreview({
    ticketId: 'ticket_3',
    threadId: 'thread_3',
    subject: 'Support issue',
    bodySnippet: 'authorization: bearer sk_test_123 access_token=hidden',
  });
  const serialized = JSON.stringify(preview).toLowerCase();
  for (const fragment of ['access_token=hidden', 'authorization: bearer sk_test_123', 'raw_provider_payload']) {
    assert.ok(!serialized.includes(fragment), `forbidden fragment leaked: ${fragment}`);
  }
});

console.log('support-privacy-safeguards:test — 7 passed, 0 failed');
