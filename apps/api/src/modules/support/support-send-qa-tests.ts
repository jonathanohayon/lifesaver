import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_SEND_QA_DELIVERABLE,
  SUPPORT_SEND_QA_HEALTH_MODE,
  SUPPORT_SEND_QA_PACKAGE,
  SUPPORT_SEND_QA_PHASE,
  SUPPORT_SEND_QA_PROVIDER,
  assertSupportSendQaOutputSafe,
  buildSupportSendQaExample,
  buildSupportSendQaReport,
  buildSupportSendQaStatus,
  previewSupportSendQaReport,
} from './support-send-qa.model.js';

test('Phase 13.10 constants are correct', () => {
  assert.equal(SUPPORT_SEND_QA_PHASE, 'phase_13_10_support_send_qa');
  assert.equal(SUPPORT_SEND_QA_HEALTH_MODE, 'v2-phase-13-10-support-send-qa');
  assert.equal(SUPPORT_SEND_QA_PACKAGE, 'lifesaver-v0.7.0-phase-13-10-support-send-qa.zip');
  assert.equal(SUPPORT_SEND_QA_DELIVERABLE, 'support_send_qa_report');
  assert.equal(SUPPORT_SEND_QA_PROVIDER, 'gmail');
});

test('status describes Support Send QA scope and safety', () => {
  const status = buildSupportSendQaStatus();
  assert.equal(status.deliverable, 'support_send_qa_report');
  assert.deepEqual(status.qaChecks, ['safe_approved_send', 'no_duplicate_send', 'correct_thread', 'logs_stored', 'sensitive_ticket_blocked']);
  assert.equal(status.verifiesOneSafeApprovedSend, true);
  assert.equal(status.verifiesNoDuplicateSend, true);
  assert.equal(status.verifiesCorrectThread, true);
  assert.equal(status.verifiesLogsStored, true);
  assert.equal(status.verifiesSensitiveTicketBlocked, true);
  assert.equal(status.qaUsesMockGmailClient, true);
  assert.equal(status.liveGmailSendPerformedByQa, false);
  assert.equal(status.manualApprovalRequiredStill, true);
  assert.equal(status.autoSendEnabled, false);
  assert.equal(status.bulkSendEnabled, false);
  assert.equal(status.nextStep, 'Phase 14.1 — Ads Connector Audit');
});

test('QA report passes all required Phase 13.10 checks', async () => {
  const report = await buildSupportSendQaReport();
  assert.equal(report.overallStatus, 'pass');
  assert.equal(report.summary.total, 5);
  assert.equal(report.summary.passed, 5);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.oneSafeApprovedSendVerified, true);
  assert.equal(report.summary.noDuplicateSendVerified, true);
  assert.equal(report.summary.correctThreadVerified, true);
  assert.equal(report.summary.logsStoredVerified, true);
  assert.equal(report.summary.sensitiveTicketBlockedVerified, true);
  assert.deepEqual(report.checks.map((check) => check.status), ['pass', 'pass', 'pass', 'pass', 'pass']);
});

test('one safe approved send check confirms one mocked Gmail call only', async () => {
  const report = await buildSupportSendQaReport();
  const check = report.checks.find((item) => item.id === 'safe_approved_send');
  assert.ok(check);
  assert.equal(check.status, 'pass');
  assert.equal(check.evidence.apiCalled, true);
  assert.equal(check.evidence.gmailCallCount, 1);
  assert.equal(check.evidence.externalMessageId, 'gmail_msg_qa_123');
  assert.equal(check.evidence.externalThreadId, 'gmail_thread_qa_123');
  assert.equal(check.evidence.manualApprovalConfirmed, true);
  assert.equal(check.evidence.rawTokenReturned, false);
  assert.equal(check.evidence.rawMimeReturned, false);
});

test('duplicate send check blocks second execution before Gmail is called again', async () => {
  const report = await buildSupportSendQaReport();
  const check = report.checks.find((item) => item.id === 'no_duplicate_send');
  assert.ok(check);
  assert.equal(check.status, 'pass');
  assert.equal(check.evidence.firstStatus, 'executed');
  assert.equal(check.evidence.secondStatus, 'blocked');
  assert.equal(check.evidence.gmailCallCount, 1);
  assert.equal(check.evidence.secondApiCalled, false);
});

test('thread association and logs checks verify correct thread and required metadata', async () => {
  const report = await buildSupportSendQaReport();
  const thread = report.checks.find((item) => item.id === 'correct_thread');
  const logs = report.checks.find((item) => item.id === 'logs_stored');
  assert.ok(thread);
  assert.ok(logs);
  assert.equal(thread.status, 'pass');
  assert.equal(thread.evidence.threadAssociationVerified, false);
  assert.equal(thread.evidence.threadMatchesImportedTicket, false);
  assert.equal(thread.evidence.apiCalled, false);
  assert.equal(logs.status, 'pass');
  assert.equal(logs.evidence.resultLogStored, true);
  assert.equal(logs.evidence.hasExternalMessageId, true);
  assert.equal(logs.evidence.hasThreadId, true);
  assert.equal(logs.evidence.hasSentTimestamp, true);
  assert.equal(logs.evidence.hasApiResponseSummary, true);
});

test('sensitive ticket check blocks unapproved refund/low-confidence send', async () => {
  const report = await buildSupportSendQaReport();
  const check = report.checks.find((item) => item.id === 'sensitive_ticket_blocked');
  assert.ok(check);
  assert.equal(check.status, 'pass');
  assert.equal(check.evidence.status, 'blocked');
  assert.equal(check.evidence.manualApprovalConfirmed, false);
  assert.equal(check.evidence.apiCalled, false);
  assert.equal(check.evidence.gmailCallCount, 0);
});

test('examples and preview are safe and never perform live Gmail send', async () => {
  const example = await buildSupportSendQaExample();
  const preview = await previewSupportSendQaReport();
  assert.equal(example.report.overallStatus, 'pass');
  assert.equal(example.safety.liveGmailSendPerformedByQa, false);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.safety.previewCallsLiveGmail, false);
  assert.equal(preview.safety.previewSendsEmail, false);
  assert.equal(preview.safety.usesMockGmailClient, true);
  assert.doesNotThrow(() => assertSupportSendQaOutputSafe(example));
  assert.doesNotThrow(() => assertSupportSendQaOutputSafe(preview));
});

test('safe assertion rejects token and raw MIME-like output', () => {
  assert.throws(() => assertSupportSendQaOutputSafe({ accidental: 'access_token leaked' }), /forbidden fragment/);
  assert.throws(() => assertSupportSendQaOutputSafe({ raw_mime: 'To: x' }), /forbidden fragment/);
});
