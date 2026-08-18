import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_CONNECTOR_QA_HEALTH_MODE,
  SUPPORT_CONNECTOR_QA_PACKAGE,
  SUPPORT_CONNECTOR_QA_PHASE,
  assertSupportConnectorQaSafe,
  buildSupportConnectorQaReport,
  buildSupportConnectorQaStatus,
  buildSupportQaPermissionCheck,
} from './support-connector-qa.model.js';

test('Phase 12.10 constants are correct', () => {
  assert.equal(SUPPORT_CONNECTOR_QA_PHASE, 'phase_12_10_support_connector_qa');
  assert.equal(SUPPORT_CONNECTOR_QA_HEALTH_MODE, 'v2-phase-12-10-support-connector-qa');
  assert.equal(SUPPORT_CONNECTOR_QA_PACKAGE, 'lifesaver-v0.7.0-phase-12-10-support-connector-qa.zip');
});

test('status confirms QA report only and no support sending', () => {
  const status = buildSupportConnectorQaStatus();
  assert.equal(status.deliverable, 'support_connector_qa_report');
  assert.equal(status.ticketImportTested, true);
  assert.equal(status.classificationTested, true);
  assert.equal(status.draftActionTested, true);
  assert.equal(status.noSendSafetyTested, true);
  assert.equal(status.permissionControlsTested, true);
  assert.equal(status.reportOnly, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.supportSendExecutorAdded, false);
});

test('QA report passes all requested scenarios', () => {
  const report = buildSupportConnectorQaReport();
  assert.equal(report.summary.totalScenarios, 5);
  assert.equal(report.summary.passedScenarios, 5);
  assert.equal(report.summary.failedScenarios, 0);
  assert.equal(report.summary.overallStatus, 'passed');
  assert.deepEqual(report.scenarios.map((scenario) => scenario.name), [
    'ticket_import',
    'classification',
    'draft_action',
    'no_send_safety',
    'permission_controls',
  ]);
});

test('ticket import scenario confirms read-only normalized import fixture', () => {
  const report = buildSupportConnectorQaReport();
  const scenario = report.scenarios.find((item) => item.name === 'ticket_import');
  assert.equal(scenario?.passed, true);
  assert.ok(scenario?.evidence.some((line) => line.includes('Normalized 1')));
  assert.ok(scenario?.evidence.some((line) => line.includes('Raw provider payload separated: true')));
  assert.equal(report.safeArtifacts.importedTicketCount, 1);
});

test('classification scenario detects refund and escalation', () => {
  const report = buildSupportConnectorQaReport();
  const scenario = report.scenarios.find((item) => item.name === 'classification');
  assert.equal(scenario?.passed, true);
  assert.equal(report.safeArtifacts.ticketCategory, 'refund');
  assert.equal(report.safeArtifacts.ticketEscalationRequired, true);
});

test('draft action scenario confirms support_reply_send proposed action only', () => {
  const report = buildSupportConnectorQaReport();
  const scenario = report.scenarios.find((item) => item.name === 'draft_action');
  assert.equal(scenario?.passed, true);
  assert.equal(report.safeArtifacts.draftActionType, 'support_reply_send');
  assert.equal(report.safeArtifacts.draftActionPolicyDecision, 'ask');
  assert.equal(report.safeArtifacts.approvalRequired, true);
  assert.equal(report.safeArtifacts.sendExecutorPresent, false);
});

test('no-send safety scenario confirms no email/Gmail/write execution', () => {
  const report = buildSupportConnectorQaReport();
  const scenario = report.scenarios.find((item) => item.name === 'no_send_safety');
  assert.equal(scenario?.passed, true);
  assert.equal(scenario?.safety.emailSent, false);
  assert.equal(scenario?.safety.gmailApiCalled, false);
  assert.equal(scenario?.safety.externalWritePerformed, false);
  assert.equal(report.safety.emailSent, false);
  assert.equal(report.safety.gmailExternalApiCalled, false);
  assert.equal(report.safety.actionExecuted, false);
});

test('permission controls allow only owner/admin approval and no execution', () => {
  const owner = buildSupportQaPermissionCheck('owner');
  const admin = buildSupportQaPermissionCheck('admin');
  const operator = buildSupportQaPermissionCheck('operator');
  const viewer = buildSupportQaPermissionCheck('viewer');
  assert.equal(owner.canApproveSupportReplyAction, true);
  assert.equal(admin.canApproveSupportReplyAction, true);
  assert.equal(operator.canApproveSupportReplyAction, false);
  assert.equal(viewer.canApproveSupportReplyAction, false);
  assert.equal(owner.canExecuteSupportSend, false);
  assert.equal(admin.canExecuteSupportSend, false);
  assert.equal(operator.canExecuteSupportSend, false);
  assert.equal(viewer.canExecuteSupportSend, false);
});

test('QA report exposes no raw customer email, raw payloads, tokens, or Gmail send scope', () => {
  const report = buildSupportConnectorQaReport();
  const serialized = JSON.stringify(report).toLowerCase();
  assert.equal(serialized.includes('customer@example.com'), false);
  assert.equal(serialized.includes('raw_provider_payload'), false);
  assert.equal(serialized.includes('access_token'), false);
  assert.equal(serialized.includes('gmail.send'), false);
  assert.doesNotThrow(() => assertSupportConnectorQaSafe(report));
});

test('every scenario carries explicit false external-write safety flags', () => {
  const report = buildSupportConnectorQaReport();
  for (const scenario of report.scenarios) {
    assert.equal(scenario.safety.gmailApiCalled, false);
    assert.equal(scenario.safety.emailSent, false);
    assert.equal(scenario.safety.externalWritePerformed, false);
    assert.equal(scenario.safety.rawProviderPayloadReturned, false);
    assert.equal(scenario.safety.rawTicketPayloadReturned, false);
    assert.equal(scenario.safety.tokenValueReturned, false);
  }
});

test('reviewerRole input can be parsed without exposing extra power', () => {
  const viewerReport = buildSupportConnectorQaReport({ reviewerRole: 'viewer' });
  const viewer = viewerReport.permissionControls.find((permission) => permission.role === 'viewer');
  assert.equal(viewer?.canViewTicket, true);
  assert.equal(viewer?.canApproveSupportReplyAction, false);
  assert.equal(viewer?.canExecuteSupportSend, false);
});

test('invalid report input is rejected', () => {
  assert.throws(() => buildSupportConnectorQaReport({ reviewerRole: 'super_admin' }), /Invalid enum value/);
});

test('strict report input rejects unknown keys', () => {
  assert.throws(() => buildSupportConnectorQaReport({ reviewerRole: 'owner', rawProviderPayload: {} }), /Unrecognized key/);
});

test('safe output guard blocks forbidden fragments', () => {
  assert.throws(() => assertSupportConnectorQaSafe({ leaked: 'access_token=secret' }), /forbidden fragment/);
  assert.throws(() => assertSupportConnectorQaSafe({ leaked: 'gmail.send' }), /forbidden fragment/);
  assert.throws(() => assertSupportConnectorQaSafe({ leaked: 'customer@example.com' }), /mask example customer email/);
});

test('top-level safety confirms Phase 12.10 has no migration or database write', () => {
  const report = buildSupportConnectorQaReport();
  assert.equal(report.safety.databaseMigrationAdded, false);
  assert.equal(report.safety.databaseWritePerformed, false);
  assert.equal(report.safety.gmailOAuthAdded, false);
  assert.equal(report.safety.supportAutoReplyAdded, false);
});
