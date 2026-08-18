import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE,
  SUPPORT_WRITE_SCOPE_HEALTH_MODE,
  SUPPORT_WRITE_SCOPE_PHASE,
  SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE,
  assertSupportWriteScopeOutputSafe,
  buildSupportWriteScopeChecklist,
  buildSupportWriteScopeChecklistItems,
  buildSupportWriteScopePermissionPlan,
  buildSupportWriteScopeSafetyPlan,
  buildSupportWriteScopeStatus,
  evaluateSupportWriteScopeGates,
} from './support-write-scope.model.js';

test('Phase 13.1 constants are correct', () => {
  assert.equal(SUPPORT_WRITE_SCOPE_PHASE, 'phase_13_1_write_scope_setup');
  assert.equal(SUPPORT_WRITE_SCOPE_HEALTH_MODE, 'v2-phase-13-1-write-scope-setup');
  assert.equal(SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE, 'https://www.googleapis.com/auth/gmail.send');
  assert.equal(SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE, 'https://www.googleapis.com/auth/gmail.readonly');
});

test('safety plan is checklist-only and adds no send behavior', () => {
  const safety = buildSupportWriteScopeSafetyPlan();
  assert.equal(safety.checklistOnly, true);
  assert.equal(safety.gmailApiClientAdded, false);
  assert.equal(safety.oauthRouteAdded, false);
  assert.equal(safety.sendScopeRequestedNow, false);
  assert.equal(safety.gmailSendExecutorAdded, false);
  assert.equal(safety.emailSendingAdded, false);
  assert.equal(safety.autoReplyAdded, false);
  assert.equal(safety.externalApiCalled, false);
});

test('permission plan uses minimum send scope later and blocks broad scopes', () => {
  const plan = buildSupportWriteScopePermissionPlan();
  assert.equal(plan.minimumSendScopeToAddLater, SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE);
  assert.deepEqual(plan.allowedForPhase131PlanningOnly, [SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE]);
  assert.equal(plan.notRequestedInPhase131.includes(SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE), true);
  assert.equal(plan.notRequestedInPhase131.includes('https://www.googleapis.com/auth/gmail.modify'), true);
  assert.equal(plan.notRequestedInPhase131.includes('https://mail.google.com/'), true);
  assert.equal(plan.forbiddenBroadScope, 'https://mail.google.com/');
});

test('scope classifications match current planning assumptions', () => {
  const plan = buildSupportWriteScopePermissionPlan();
  assert.equal(plan.scopeClassification.gmailSend, 'sensitive');
  assert.equal(plan.scopeClassification.gmailReadonly, 'restricted');
  assert.equal(plan.scopeClassification.gmailCompose, 'restricted');
  assert.equal(plan.scopeClassification.gmailModify, 'restricted');
  assert.equal(plan.scopeClassification.mailGoogleCom, 'restricted_and_too_broad');
});

test('checklist includes required gates before real send executor', () => {
  const items = buildSupportWriteScopeChecklistItems();
  const requiredIds = items.filter((item) => item.requiredBeforeExecutor).map((item) => item.id);
  assert.equal(requiredIds.includes('read_only_connector_stable'), true);
  assert.equal(requiredIds.includes('request_minimum_send_scope_only'), true);
  assert.equal(requiredIds.includes('founder_reconsent_required'), true);
  assert.equal(requiredIds.includes('approved_action_only'), true);
  assert.equal(requiredIds.includes('no_auto_send_initially'), true);
  assert.equal(requiredIds.includes('privacy_redaction_before_logs'), true);
  assert.equal(requiredIds.includes('escalation_blocks_send'), true);
});

test('attachments, CC, and BCC are deferred', () => {
  const checklist = buildSupportWriteScopeChecklist();
  assert.equal(checklist.methodPlan.attachmentsAllowedInitially, false);
  assert.equal(checklist.methodPlan.ccBccAllowedInitially, false);
  assert.equal(checklist.checklist.find((item) => item.id === 'attachments_deferred')?.decision, 'deferred');
});

test('method plan is direct messages.send planning only', () => {
  const checklist = buildSupportWriteScopeChecklist();
  assert.equal(checklist.methodPlan.selectedMethod, 'gmail_users_messages_send');
  assert.equal(checklist.methodPlan.directSendEndpoint, 'users.messages.send');
  assert.equal(checklist.methodPlan.draftSendEndpointDeferred, 'users.drafts.send');
  assert.equal(checklist.methodPlan.userId, 'me');
});

test('status is concise and safe', () => {
  const status = buildSupportWriteScopeStatus();
  assert.equal(status.deliverable, 'support_write_scope_checklist');
  assert.equal(status.checklistOnly, true);
  assert.equal(status.sendScopeRequestedNow, false);
  assert.equal(status.gmailSendExecutorAdded, false);
  assert.equal(status.emailSendingAdded, false);
  assert.equal(status.autoReplyAdded, false);
  assert.equal(status.requiredFutureScope, SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE);
  assert.doesNotThrow(() => assertSupportWriteScopeOutputSafe(status));
});

test('full checklist has hard blocks and remains safe', () => {
  const checklist = buildSupportWriteScopeChecklist();
  assert.equal(checklist.hardBlocksBeforeRealSend.some((block) => block.includes('Action is not approved')), true);
  assert.equal(checklist.hardBlocksBeforeRealSend.some((block) => block.includes('broader than gmail.send')), true);
  assert.equal(checklist.safety.emailSendingAdded, false);
  assert.doesNotThrow(() => assertSupportWriteScopeOutputSafe(checklist));
});

test('gate evaluator blocks missing setup', () => {
  const result = evaluateSupportWriteScopeGates({});
  assert.equal(result.eligibleForFutureSendExecutorBuild, false);
  assert.equal(result.riskLevel, 'blocked');
  assert.equal(result.missingGates.length >= 8, true);
  assert.equal(result.safeSummary.includes('not ready'), true);
});

test('gate evaluator allows future executor build only when all gates pass', () => {
  const result = evaluateSupportWriteScopeGates({
    readOnlyConnectorStable: true,
    oauthConsentUpdated: true,
    founderApprovedSendScope: true,
    encryptedTokenStorageReady: true,
    proposedActionApprovalRequired: true,
    noAutoReply: true,
    noBroadMailScope: true,
    supportPrivacySafeguardsActive: true,
    escalationRulesActive: true,
  });
  assert.equal(result.eligibleForFutureSendExecutorBuild, true);
  assert.equal(result.riskLevel, 'low');
  assert.deepEqual(result.missingGates, []);
});

test('gate evaluator warns against broad Gmail scope', () => {
  const result = evaluateSupportWriteScopeGates({ founderApprovedSendScope: true });
  assert.equal(result.warnings.some((warning) => warning.includes('mail.google.com')), true);
});

test('safe assertion rejects token-like output', () => {
  assert.throws(() => assertSupportWriteScopeOutputSafe({ accidental: 'client_secret leaked' }), /forbidden fragment/);
});

test('safe assertion rejects raw MIME output', () => {
  assert.throws(() => assertSupportWriteScopeOutputSafe({ raw_mime: 'From: test@example.com' }), /forbidden fragment/);
});
