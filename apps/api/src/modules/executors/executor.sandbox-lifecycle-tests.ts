import assert from 'node:assert/strict';
import {
  buildApproveToExecuteSandboxSafetySummary,
  getSandboxExecutorForActionType,
  listApproveToExecuteSandboxActionTypes,
  runApproveToExecuteSandboxLifecycle,
  SANDBOX_LIFECYCLE_PHASE,
} from './executor.sandbox-lifecycle.js';

async function main() {
  const supported = listApproveToExecuteSandboxActionTypes();
  assert.deepEqual(supported.sort(), ['ad_budget_adjust', 'ad_pause', 'content_publish', 'support_reply_send'].sort(), 'Supported sandbox action types should match implemented sandbox executors.');
  assert(getSandboxExecutorForActionType('content_publish'), 'content_publish should resolve a sandbox executor.');
  assert(getSandboxExecutorForActionType('support_reply_send'), 'support_reply_send should resolve a sandbox executor.');
  assert(getSandboxExecutorForActionType('ad_budget_adjust'), 'ad_budget_adjust should resolve a sandbox executor.');
  assert(getSandboxExecutorForActionType('ad_pause'), 'ad_pause should resolve a sandbox executor.');
  assert.equal(getSandboxExecutorForActionType('research_task'), null, 'research_task should remain unsupported for sandbox execution in Phase 8.6.');

  const content = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-content-1',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Publish an Instagram post in sandbox.',
      data: {
        platform: 'instagram',
        caption: 'Certainly, sir. This is a safe sandbox post.',
        post_type: 'feed',
      },
    },
  });

  assert.equal(content.phase, SANDBOX_LIFECYCLE_PHASE, 'Lifecycle phase should be Phase 8.6.');
  assert.equal(content.lifecycle.approved, true, 'Content action should be approved.');
  assert.equal(content.lifecycle.executed, true, 'Content action should execute in sandbox.');
  assert.equal(content.lifecycle.finalStatus, 'executed', 'Content final status should be executed.');
  assert.deepEqual(content.lifecycle.statusPath, ['proposed', 'approved', 'executing', 'executed'], 'Content lifecycle path should be proposed -> approved -> executing -> executed.');
  assert.equal(content.executor.name, 'sandboxContentExecutor', 'Content executor name should match registry.');
  assert.equal(content.executor.executionResult?.result.sandbox_success, true, 'Content sandbox result should be successful.');
  assert.equal(content.executor.executionResult?.externalWritesAttempted, false, 'Content sandbox must not attempt external writes.');
  assert.equal(content.executor.resultStoragePreview?.result_status, 'success', 'Content storage preview should be success.');
  assert.match(String(content.executor.resultStoragePreview?.external_url), /^https:\/\/sandbox\.lifesaveragent\.com\//, 'Content external URL must be sandbox URL.');

  const support = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-support-1',
    actionType: 'support_reply_send',
    currentStatus: 'approval_required',
    riskLevel: 'medium',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'support_reply_send',
      source: 'admin',
      intent_summary: 'Send a support reply in sandbox.',
      data: {
        ticket_id: 'TICKET-1',
        thread_id: 'THREAD-1',
        reply_body: 'Thank you for reaching out. This is a sandbox reply only.',
        support_provider: 'gorgias',
        confidence_score: 0.92,
      },
    },
  });

  assert.equal(support.lifecycle.finalStatus, 'executed', 'Support final status should be executed.');
  assert.equal(support.executor.name, 'sandboxSupportExecutor', 'Support executor name should match registry.');
  assert.equal(support.executor.executionResult?.result.sandbox_success, true, 'Support sandbox result should be successful.');
  assert.equal(support.executor.executionResult?.result.external_email_sent, false, 'Support sandbox must not send email.');

  const adsBudget = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-ads-budget-1',
    actionType: 'ad_budget_adjust',
    currentStatus: 'auto_approved',
    riskLevel: 'high',
    approvedByUserId: 'owner-1',
    policyDecision: 'auto_approve',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_budget_adjust',
      source: 'admin',
      intent_summary: 'Adjust Meta campaign budget in sandbox.',
      data: {
        platform: 'meta',
        campaign_id: 'cmp_123',
        current_budget: 100,
        proposed_budget: 120,
        change_amount: 20,
        change_percent: 20,
        currency: 'USD',
      },
    },
  });

  assert.equal(adsBudget.lifecycle.finalStatus, 'executed', 'Ads budget final status should be executed.');
  assert.equal(adsBudget.executor.name, 'sandboxAdsBudgetExecutor', 'Ads budget executor name should match registry.');
  assert.equal(adsBudget.executor.executionResult?.result.sandbox_success, true, 'Ads budget sandbox result should be successful.');
  assert.equal(adsBudget.executor.executionResult?.result.external_budget_changed, false, 'Ads budget sandbox must not change real budget.');

  const adsPause = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-ads-pause-1',
    actionType: 'ad_pause',
    currentStatus: 'proposed',
    riskLevel: 'high',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_pause',
      source: 'admin',
      intent_summary: 'Pause adset in sandbox.',
      data: {
        platform: 'google_ads',
        target_level: 'adset',
        target_id: 'adset_123',
        current_status: 'active',
        proposed_status: 'paused',
        reason: 'Sandbox safety test.',
      },
    },
  });

  assert.equal(adsPause.lifecycle.finalStatus, 'executed', 'Ads pause final status should be executed.');
  assert.equal(adsPause.executor.name, 'sandboxAdsPauseExecutor', 'Ads pause executor name should match registry.');
  assert.equal(adsPause.executor.executionResult?.result.external_campaign_paused, false, 'Ads pause sandbox must not pause real campaign.');

  const unsupported = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-research-1',
    actionType: 'research_task',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'research_task',
      source: 'admin',
      intent_summary: 'Research in sandbox.',
      data: { question: 'What changed?', objective: 'Summary only.' },
    },
  });

  assert.equal(unsupported.lifecycle.blocked, true, 'Unsupported action types should be blocked.');
  assert.equal(unsupported.lifecycle.finalStatus, 'proposed', 'Unsupported action should not move status.');
  assert.equal(unsupported.executor.found, false, 'Unsupported action should not resolve executor.');

  const invalid = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-invalid-1',
    actionType: 'content_publish',
    currentStatus: 'executed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Invalid status.',
      data: { platform: 'instagram', caption: 'Already executed.' },
    },
  });

  assert.equal(invalid.lifecycle.blocked, true, 'Already executed action should be blocked before lifecycle.');
  assert.equal(invalid.lifecycle.approved, false, 'Invalid status should not approve.');

  const validationFailed = await runApproveToExecuteSandboxLifecycle({
    workspaceId: 'workspace-1',
    actionId: 'action-validation-failed-1',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Invalid payload.',
      data: { platform: 'instagram' },
    },
  });

  assert.equal(validationFailed.lifecycle.approved, true, 'Validation failure happens after approval in sandbox lifecycle.');
  assert.equal(validationFailed.lifecycle.failed, true, 'Invalid payload should fail the sandbox lifecycle.');
  assert.equal(validationFailed.lifecycle.finalStatus, 'failed', 'Invalid payload final status should be failed.');
  assert.equal(validationFailed.executor.validationOk, false, 'Validation should fail.');
  assert.equal(validationFailed.executor.resultStoragePreview?.result_status, 'failed', 'Failure storage preview should be failed.');

  const summary = buildApproveToExecuteSandboxSafetySummary();
  assert.equal(summary.lifecycleDefined, true, 'Safety summary should confirm lifecycle is defined.');
  assert.equal(summary.usesSandboxExecutors, true, 'Safety summary should confirm sandbox executors are used.');
  assert.equal(summary.writesToExternalPlatforms, false, 'Safety summary should confirm no external platform writes.');
  assert.equal(summary.realExecutorsEnabled, false, 'Safety summary should confirm real executors remain disabled.');
  assert.equal(summary.autoRunEnabled, false, 'Safety summary should confirm auto-run remains disabled.');

  console.log('executor:sandbox-lifecycle:test — 16 passed, 0 failed');
}

main().catch((error) => {
  console.error('executor:sandbox-lifecycle:test failed');
  console.error(error);
  process.exit(1);
});
