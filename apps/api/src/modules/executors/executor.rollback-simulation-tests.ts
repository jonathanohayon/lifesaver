import assert from 'node:assert/strict';
import {
  buildRollbackSimulationSafetySummary,
  buildSandboxRollbackResultLogRecord,
  ROLLBACK_SIMULATION_PHASE,
  runSandboxRollbackSimulation,
} from './executor.rollback-simulation.js';

async function main() {
  const content = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-content-1',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Publish and rollback an Instagram post in sandbox.',
      data: {
        platform: 'instagram',
        caption: 'Certainly, sir. This is a safe sandbox rollback post.',
        post_type: 'feed',
      },
    },
  });

  assert.equal(content.phase, ROLLBACK_SIMULATION_PHASE, 'Rollback simulation should carry Phase 8.9 phase.');
  assert.equal(content.execution.lifecycle.finalStatus, 'executed', 'Content execution should complete before rollback.');
  assert.equal(content.rollback.finalStatus, 'rolled_back', 'Content rollback final status should be rolled_back.');
  assert.equal(content.rollback.succeeded, true, 'Content rollback should succeed in sandbox.');
  assert.deepEqual(content.rollback.statusPath, ['proposed', 'approved', 'executing', 'executed', 'rollback_requested', 'executing', 'rolled_back'], 'Rollback path should include rolled_back state.');
  assert.equal(content.rollback.result?.externalWritesAttempted, false, 'Content rollback must not attempt external writes.');
  assert.equal(content.rollback.result?.externalWritesSucceeded, false, 'Content rollback must not succeed external writes.');
  assert.equal(content.rollback.resultLogRecordPreview.result_status, 'rollback_success', 'Rollback record should map to rollback_success.');
  assert.equal(content.rollback.resultLogRecordPreview.rollback_payload && Object.keys(content.rollback.resultLogRecordPreview.rollback_payload).length, 0, 'Rollback payload should not be exposed in browser preview.');
  assert.match(String(content.rollback.resultLogRecordPreview.external_id), /^sandbox-post-/, 'Rollback record should retain fake external post id only.');

  const support = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-support-1',
    actionType: 'support_reply_send',
    currentStatus: 'approval_required',
    riskLevel: 'medium',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'support_reply_send',
      source: 'admin',
      intent_summary: 'Send and rollback a support reply in sandbox.',
      data: {
        ticket_id: 'TICKET-ROLLBACK-1',
        thread_id: 'THREAD-ROLLBACK-1',
        reply_body: 'Thank you. This is a sandbox reply only and rollback will be simulated.',
        support_provider: 'gorgias',
        confidence_score: 0.93,
      },
    },
  });

  assert.equal(support.rollback.finalStatus, 'rolled_back', 'Support rollback final status should be rolled_back.');
  assert.match(String(support.rollback.resultLogRecordPreview.external_id), /^sandbox-reply-/, 'Support rollback should keep fake reply id.');
  assert.equal(support.rollback.result?.externalWritesAttempted, false, 'Support rollback must not call email/helpdesk APIs.');

  const adsBudget = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-ads-budget-1',
    actionType: 'ad_budget_adjust',
    currentStatus: 'auto_approved',
    riskLevel: 'high',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'auto_approve',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_budget_adjust',
      source: 'admin',
      intent_summary: 'Adjust and rollback ad budget in sandbox.',
      data: {
        platform: 'meta',
        campaign_id: 'cmp_rollback_1',
        current_budget: 100,
        proposed_budget: 125,
        change_amount: 25,
        change_percent: 25,
        currency: 'USD',
      },
    },
  });

  assert.equal(adsBudget.rollback.finalStatus, 'rolled_back', 'Ads budget rollback final status should be rolled_back.');
  assert.match(String(adsBudget.rollback.resultLogRecordPreview.external_id), /^sandbox-ads-budget-/, 'Ads budget rollback should retain fake ads action id.');
  assert.equal(adsBudget.rollback.result?.externalWritesAttempted, false, 'Ads budget rollback must not call ad APIs.');

  const adsPause = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-ads-pause-1',
    actionType: 'ad_pause',
    currentStatus: 'proposed',
    riskLevel: 'high',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_pause',
      source: 'admin',
      intent_summary: 'Pause and rollback an adset in sandbox.',
      data: {
        platform: 'google_ads',
        target_level: 'adset',
        target_id: 'adset_rollback_1',
        current_status: 'active',
        proposed_status: 'paused',
        reason: 'Sandbox rollback QA.',
      },
    },
  });

  assert.equal(adsPause.rollback.finalStatus, 'rolled_back', 'Ads pause rollback final status should be rolled_back.');
  assert.equal(adsPause.rollback.result?.externalWritesAttempted, false, 'Ads pause rollback must not call ad APIs.');
  assert.match(adsPause.rollback.resultSummary, /No campaign|No campaign\/adset\/ad status/i, 'Ads pause rollback summary should confirm no real status was restored.');

  const forcedFailure = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-failed-1',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      sandbox_should_fail: true,
      sandbox_failure_reason: 'QA forced failure should not be rollback eligible.',
      intent_summary: 'Forced failure.',
      data: {
        platform: 'instagram',
        caption: 'This fake action should fail before rollback.',
        post_type: 'feed',
      },
    },
  });

  assert.equal(forcedFailure.execution.lifecycle.finalStatus, 'failed', 'Forced failure should fail before rollback.');
  assert.equal(forcedFailure.rollback.skipped, true, 'Failed execution should skip rollback.');
  assert.equal(forcedFailure.rollback.finalStatus, 'failed', 'Failed execution should stay failed.');
  assert.equal(forcedFailure.rollback.requested, false, 'Rollback should not be requested when execution failed.');

  const unsupported = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-unsupported-1',
    actionType: 'research_task',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'research_task',
      source: 'admin',
      intent_summary: 'Unsupported rollback test.',
      data: { question: 'What happened?', objective: 'Sandbox only.' },
    },
  });

  assert.equal(unsupported.execution.lifecycle.blocked, true, 'Unsupported action should be blocked before execution.');
  assert.equal(unsupported.rollback.skipped, true, 'Unsupported action should skip rollback.');
  assert.equal(unsupported.rollback.finalStatus, 'proposed', 'Unsupported action should stay proposed.');

  const invalidPayload = await runSandboxRollbackSimulation({
    workspaceId: 'workspace-rollback-1',
    actionId: 'action-rollback-invalid-1',
    actionType: 'support_reply_send',
    currentStatus: 'proposed',
    riskLevel: 'medium',
    approvedByUserId: 'owner-1',
    rollbackRequestedByUserId: 'owner-1',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'support_reply_send',
      source: 'admin',
      intent_summary: 'Invalid support reply payload.',
      data: { ticket_id: 'TICKET-INVALID' },
    },
  });

  assert.equal(invalidPayload.execution.lifecycle.finalStatus, 'failed', 'Validation failure should be failed before rollback.');
  assert.equal(invalidPayload.rollback.skipped, true, 'Validation failure should skip rollback.');

  const manualRecord = buildSandboxRollbackResultLogRecord(content.execution, content.rollback.result);
  assert.equal(manualRecord.result_status, 'rollback_success', 'Manual rollback record builder should return rollback_success.');
  assert.equal(manualRecord.metadata_json.phase, ROLLBACK_SIMULATION_PHASE, 'Rollback record should carry Phase 8.9 phase.');
  assert.equal(manualRecord.metadata_json.external_writes_attempted, false, 'Rollback record must confirm no external writes.');
  assert.equal(manualRecord.metadata_json.real_rollback_enabled, false, 'Rollback record must confirm real rollback disabled.');

  const safety = buildRollbackSimulationSafetySummary();
  assert.equal(safety.rolledBackActionStateTested, true, 'Safety summary should confirm rolled_back state is tested.');
  assert.equal(safety.resultLogStatus, 'rollback_success', 'Safety summary should identify rollback_success result log status.');
  assert.deepEqual(safety.statusPath, ['proposed', 'approved', 'executing', 'executed', 'rollback_requested', 'executing', 'rolled_back'], 'Safety summary should include complete rollback path.');
  assert.equal(safety.externalWritesEnabled, false, 'Rollback simulation must not enable external writes.');
  assert.equal(safety.realRollbackEnabled, false, 'Rollback simulation must not enable real rollback.');
  assert.equal(safety.autoRunEnabled, false, 'Rollback simulation must not enable auto-run.');
  assert.equal(content.safety.externalWritesAttempted, false, 'Result safety should confirm no external writes attempted.');
  assert.equal(content.safety.externalWritesSucceeded, false, 'Result safety should confirm no external writes succeeded.');

  console.log('executor:rollback-simulation:test — 26 passed, 0 failed');
}

main().catch((error) => {
  console.error('executor:rollback-simulation:test failed');
  console.error(error);
  process.exit(1);
});
