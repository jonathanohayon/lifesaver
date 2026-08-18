import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_THREAD_ASSOCIATION_ACTION_TYPE,
  SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE,
  SUPPORT_THREAD_ASSOCIATION_PACKAGE,
  SUPPORT_THREAD_ASSOCIATION_PHASE,
  SUPPORT_THREAD_ASSOCIATION_PROVIDER,
  assertSupportThreadAssociationOutputSafe,
  buildSupportThreadAssociationExample,
  buildSupportThreadAssociationStatus,
  evaluateSupportThreadAssociation,
  normalizeSupportThreadAssociationTicketRow,
  previewSupportThreadAssociation,
} from './support-thread-association.model.js';

const importedTicket = {
  id: 'support_ticket_123',
  workspaceId: 'workspace_123',
  provider: 'gmail',
  externalMessageId: 'gmail_message_123',
  externalThreadId: 'gmail_thread_123',
  customerEmail: 'customer@example.com',
  fromEmailHint: 'customer@example.com',
  subject: 'Where is my order?',
  status: 'open',
  updatedAt: '2026-07-08T10:00:00.000Z',
};

test('Phase 13.4 constants are correct', () => {
  assert.equal(SUPPORT_THREAD_ASSOCIATION_PHASE, 'phase_13_4_thread_association');
  assert.equal(SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE, 'v2-phase-13-4-thread-association');
  assert.equal(SUPPORT_THREAD_ASSOCIATION_PACKAGE, 'lifesaver-v0.7.0-phase-13-4-thread-association.zip');
  assert.equal(SUPPORT_THREAD_ASSOCIATION_ACTION_TYPE, 'support_reply_send');
  assert.equal(SUPPORT_THREAD_ASSOCIATION_PROVIDER, 'gmail');
});

test('status describes thread-safe reply handling', () => {
  const status = buildSupportThreadAssociationStatus();
  assert.equal(status.deliverable, 'thread_safe_reply_handling');
  assert.equal(status.requiresImportedTicketMatch, true);
  assert.equal(status.requiresThreadIdMatch, true);
  assert.equal(status.executorUsesValidatedThreadId, true);
  assert.equal(status.previewCallsGmail, false);
  assert.equal(status.previewSendsEmail, false);
});

test('verifies support reply when imported ticket thread matches payload thread', () => {
  const result = evaluateSupportThreadAssociation({
    actionType: 'support_reply_send',
    provider: 'gmail',
    ticketId: 'support_ticket_123',
    threadId: 'gmail_thread_123',
    customerEmail: 'customer@example.com',
    importedTicket,
  });
  assert.equal(result.verified, true);
  assert.equal(result.decision, 'thread_association_verified');
  assert.equal(result.checks.importedTicketThreadMatches, true);
  assert.equal(result.threadBinding.threadIdSentToGmail, 'gmail_thread_123');
});

test('blocks when imported ticket is missing', () => {
  const result = evaluateSupportThreadAssociation({
    actionType: 'support_reply_send',
    provider: 'gmail',
    ticketId: 'support_ticket_123',
    threadId: 'gmail_thread_123',
    customerEmail: 'customer@example.com',
  });
  assert.equal(result.verified, false);
  assert.equal(result.decision, 'blocked_ticket_not_found');
  assert.equal(result.safety.gmailApiCalled, false);
});

test('blocks wrong Gmail thread association', () => {
  const result = evaluateSupportThreadAssociation({
    actionType: 'support_reply_send',
    provider: 'gmail',
    ticketId: 'support_ticket_123',
    threadId: 'gmail_thread_wrong',
    customerEmail: 'customer@example.com',
    importedTicket,
  });
  assert.equal(result.verified, false);
  assert.equal(result.decision, 'blocked_thread_mismatch');
  assert.equal(result.checks.importedTicketThreadMatches, false);
});

test('blocks mismatched customer when imported ticket customer is known', () => {
  const result = evaluateSupportThreadAssociation({
    actionType: 'support_reply_send',
    provider: 'gmail',
    ticketId: 'support_ticket_123',
    threadId: 'gmail_thread_123',
    customerEmail: 'other@example.com',
    importedTicket,
  });
  assert.equal(result.verified, false);
  assert.equal(result.decision, 'blocked_customer_mismatch');
  assert.equal(result.checks.customerMatchesWhenKnown, false);
});

test('blocks archived and spam tickets', () => {
  for (const status of ['archived', 'spam']) {
    const result = evaluateSupportThreadAssociation({
      actionType: 'support_reply_send',
      provider: 'gmail',
      ticketId: 'support_ticket_123',
      threadId: 'gmail_thread_123',
      customerEmail: 'customer@example.com',
      importedTicket: { ...importedTicket, status },
    });
    assert.equal(result.verified, false);
    assert.equal(result.decision, 'blocked_unsafe_ticket_status');
  }
});

test('preview is safe and does not call Gmail', () => {
  const preview = previewSupportThreadAssociation({
    actionType: 'support_reply_send',
    provider: 'gmail',
    ticketId: 'support_ticket_123',
    threadId: 'gmail_thread_123',
    customerEmail: 'customer@example.com',
    importedTicket,
  });
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.emailSent, false);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.doesNotThrow(() => assertSupportThreadAssociationOutputSafe(preview));
});

test('example includes verified and blocked paths without sending', () => {
  const example = buildSupportThreadAssociationExample();
  assert.equal(example.verified.verified, true);
  assert.equal(example.blockedWrongThread.verified, false);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.gmailApiCalled, false);
});

test('normalizes database ticket row into safe thread association input', () => {
  const normalized = normalizeSupportThreadAssociationTicketRow({
    id: 'support_ticket_123',
    workspace_id: 'workspace_123',
    provider: 'gmail',
    external_thread_id: 'gmail_thread_123',
    external_message_id: 'gmail_message_123',
    customer_email: 'customer@example.com',
    from_email_hint: 'cu***@example.com',
    subject: 'Where is my order?',
    status: 'open',
    updated_at: new Date('2026-07-08T10:00:00.000Z'),
  });
  assert.equal(normalized?.externalThreadId, 'gmail_thread_123');
  assert.equal(normalized?.customerEmail, 'customer@example.com');
});

test('safe assertion rejects raw provider payload and token-like output', () => {
  assert.throws(() => assertSupportThreadAssociationOutputSafe({ raw_provider_payload: { body: 'private' } }), /forbidden fragment/);
  assert.throws(() => assertSupportThreadAssociationOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
});
