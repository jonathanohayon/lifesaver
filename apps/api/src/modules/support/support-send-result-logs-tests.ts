import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_SEND_RESULT_LOGS_DELIVERABLE,
  SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
  SUPPORT_SEND_RESULT_LOGS_PACKAGE,
  SUPPORT_SEND_RESULT_LOGS_PHASE,
  SUPPORT_SEND_RESULT_LOGS_PROVIDER,
  assertSupportSendResultLogOutputSafe,
  buildSupportSendApiResponseSummary,
  buildSupportSendResultLogEntry,
  buildSupportSendResultLogsExample,
  buildSupportSendResultLogsStatus,
  previewSupportSendResultLog,
} from './support-send-result-logs.model.js';

test('Phase 13.8 constants are correct', () => {
  assert.equal(SUPPORT_SEND_RESULT_LOGS_PHASE, 'phase_13_8_send_result_logs');
  assert.equal(SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE, 'v2-phase-13-8-send-result-logs');
  assert.equal(SUPPORT_SEND_RESULT_LOGS_PACKAGE, 'lifesaver-v0.7.0-phase-13-8-send-result-logs.zip');
  assert.equal(SUPPORT_SEND_RESULT_LOGS_DELIVERABLE, 'support_send_result_log');
  assert.equal(SUPPORT_SEND_RESULT_LOGS_PROVIDER, 'gmail');
});

test('status describes result log storage and safety', () => {
  const status = buildSupportSendResultLogsStatus();
  assert.equal(status.deliverable, 'support_send_result_log');
  assert.equal(status.storesExternalMessageId, true);
  assert.equal(status.storesThreadId, true);
  assert.equal(status.storesSentTimestamp, true);
  assert.equal(status.storesApiResponseSummary, true);
  assert.equal(status.storesFailureReason, true);
  assert.equal(status.previewCallsGmail, false);
  assert.equal(status.previewSendsEmail, false);
  assert.equal(status.nextStep, 'Phase 13.9 — Follow-Up/Rollback Handling');
});

test('builds a success result log with external message id thread id sent timestamp and API summary', () => {
  const log = buildSupportSendResultLogEntry({
    workspaceId: 'workspace_123',
    actionId: 'action_123',
    executorName: 'gmailManualApprovedSupportReplyExecutor',
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_123',
    externalThreadId: 'gmail_thread_123',
    sentAt: '2026-07-08T12:30:00.000Z',
    apiStatus: 200,
    apiResponseBody: { id: 'gmail_msg_123', threadId: 'gmail_thread_123' },
    ticketId: 'ticket_123',
    importedTicketId: 'support_ticket_123',
    externalWritesAttempted: true,
    externalWritesSucceeded: true,
  });
  assert.equal(log.resultStatus, 'success');
  assert.equal(log.externalMessageId, 'gmail_msg_123');
  assert.equal(log.externalThreadId, 'gmail_thread_123');
  assert.equal(log.sentAt, '2026-07-08T12:30:00.000Z');
  assert.match(log.apiResponseSummary, /http_status=200/);
  assert.equal(log.actionResult.externalId, 'gmail_msg_123');
  assert.equal(log.actionResult.metadataJson.external_thread_id, 'gmail_thread_123');
  assert.equal(log.actionResult.metadataJson.sent_at, '2026-07-08T12:30:00.000Z');
  assert.equal(log.actionResult.metadataJson.api_response_summary, log.apiResponseSummary);
  assert.equal(log.actionResult.metadataJson.failure_reason, null);
});

test('builds a failed result log with failure reason and no false success claim', () => {
  const log = buildSupportSendResultLogEntry({
    workspaceId: 'workspace_123',
    actionId: 'action_124',
    executorName: 'gmailManualApprovedSupportReplyExecutor',
    resultStatus: 'failed',
    externalThreadId: 'gmail_thread_123',
    apiStatus: 403,
    apiResponseBody: { error: { message: 'permission denied' } },
    failureReason: 'Gmail API returned 403; no send success was confirmed.',
    externalWritesAttempted: true,
    externalWritesSucceeded: false,
  });
  assert.equal(log.resultStatus, 'failed');
  assert.equal(log.externalMessageId, null);
  assert.equal(log.externalThreadId, 'gmail_thread_123');
  assert.equal(log.failureReason, 'Gmail API returned 403; no send success was confirmed.');
  assert.equal(log.actionResult.resultStatus, 'failed');
  assert.equal(log.actionResult.errorMessage, 'Gmail API returned 403; no send success was confirmed.');
  assert.match(log.apiResponseSummary, /http_status=403/);
  assert.equal(log.checks.failureReasonStoredWhenFailed, true);
});

test('API response summary is safe and compact', () => {
  const summary = buildSupportSendApiResponseSummary({
    apiStatus: 200,
    apiResponseBody: { id: 'gmail_msg_123', threadId: 'gmail_thread_123' },
  });
  assert.match(summary, /provider=gmail/);
  assert.match(summary, /http_status=200/);
  assert.match(summary, /message_id_present=true/);
  assert.match(summary, /thread_id_present=true/);
  assert.equal(summary.includes('gmail_msg_123'), false);
});

test('preview and examples are safe and never send', () => {
  const preview = previewSupportSendResultLog({
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_123',
    externalThreadId: 'gmail_thread_123',
    apiStatus: 200,
  });
  const example = buildSupportSendResultLogsExample();
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.previewCallsGmail, false);
  assert.equal(preview.safety.previewSendsEmail, false);
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.exampleCallsGmail, false);
  assert.doesNotThrow(() => assertSupportSendResultLogOutputSafe(preview));
  assert.doesNotThrow(() => assertSupportSendResultLogOutputSafe(example));
});

test('safe assertion rejects token and raw MIME-like output', () => {
  assert.throws(() => assertSupportSendResultLogOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
  assert.throws(() => assertSupportSendResultLogOutputSafe({ raw_mime: 'To: x' }), /forbidden fragment/);
});
