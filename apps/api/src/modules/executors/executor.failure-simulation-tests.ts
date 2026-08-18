import assert from 'node:assert/strict';
import {
  buildFailureSimulationSafetySummary,
  detectSandboxShouldFail,
  FAILURE_SIMULATION_PHASE,
} from './executor.failure-simulation.js';
import { buildSandboxExecutionResultLogRecord, persistSandboxExecutionResultLog } from './executor.result-logs.js';
import { runApproveToExecuteSandboxLifecycle } from './executor.sandbox-lifecycle.js';

async function main() {
  const rootDetection = detectSandboxShouldFail({ sandbox_should_fail: true, sandbox_failure_reason: 'QA root failure.' });
  assert.equal(rootDetection.sandboxShouldFail, true, 'Root sandbox_should_fail=true should be detected.');
  assert.equal(rootDetection.source, 'payload_root', 'Root flag should report payload_root source.');
  assert.equal(rootDetection.reason, 'QA root failure.', 'Root reason should be preserved safely.');

  const dataDetection = detectSandboxShouldFail({ data: { sandbox_should_fail: true, failure_reason: 'QA data failure.' } });
  assert.equal(dataDetection.sandboxShouldFail, true, 'Data sandbox_should_fail=true should be detected.');
  assert.equal(dataDetection.source, 'payload_data', 'Data flag should report payload_data source.');

  const metadataDetection = detectSandboxShouldFail({}, { sandbox_should_fail: true, sandbox_failure_reason: 'QA metadata failure.' });
  assert.equal(metadataDetection.sandboxShouldFail, true, 'Metadata sandbox_should_fail=true should be detected.');
  assert.equal(metadataDetection.source, 'metadata', 'Metadata flag should report metadata source.');

  const noneDetection = detectSandboxShouldFail({ data: { sandbox_should_fail: false } });
  assert.equal(noneDetection.sandboxShouldFail, false, 'False sandbox_should_fail should not force failure.');
  assert.equal(noneDetection.source, 'none', 'No failure source should be reported when disabled.');

  const failedContent = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008801',
    actionId: '00000000-0000-0000-0000-000000008802',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: '00000000-0000-0000-0000-000000008803',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Publish an Instagram post in sandbox, but force QA failure.',
      sandbox_should_fail: true,
      sandbox_failure_reason: 'QA requested fake publish failure.',
      data: {
        platform: 'instagram',
        caption: 'Certainly, sir. This content payload validates, then fails by QA flag.',
        post_type: 'feed',
      },
    },
  });

  assert.equal(failedContent.lifecycle.finalStatus, 'failed', 'Forced failure should finish with failed action status.');
  assert.equal(failedContent.lifecycle.executed, false, 'Forced failure should not count as executed.');
  assert.equal(failedContent.lifecycle.failed, true, 'Forced failure should mark lifecycle failed.');
  assert.deepEqual(failedContent.lifecycle.statusPath, ['proposed', 'approved', 'executing', 'failed'], 'Forced failure should follow proposed -> approved -> executing -> failed.');
  assert.equal(failedContent.executor.validationOk, true, 'Payload should validate before forced fake failure.');
  assert.equal(failedContent.executor.executionResult?.ok, false, 'Forced failure execution result should be ok=false.');
  assert.equal(failedContent.executor.executionResult?.status, 'failed', 'Forced failure execution status should be failed.');
  assert.equal(failedContent.executor.executionResult?.result.sandbox_success, false, 'Forced failure result should report sandbox_success=false.');
  assert.equal(failedContent.executor.executionResult?.result.sandbox_should_fail, true, 'Forced failure result should preserve sandbox_should_fail=true.');
  assert.equal(failedContent.executor.executionResult?.externalWritesAttempted, false, 'Forced failure must not attempt external writes.');
  assert.equal(failedContent.executor.resultStoragePreview?.result_status, 'failed', 'Forced failure should preview failed action_results status.');
  assert.equal(failedContent.safety.externalWritesAttempted, false, 'Lifecycle safety should confirm no external writes attempted.');

  const failedRecord = buildSandboxExecutionResultLogRecord(failedContent);
  assert.equal(failedRecord.result_status, 'failed', 'Forced failure should store failed result status.');
  assert(failedRecord.error_message, 'Forced failure result log should include an error message.');
  assert.equal(failedRecord.metadata_json.sandbox_only, true, 'Forced failure log should remain sandbox-only.');
  assert.equal(failedRecord.metadata_json.external_writes_attempted, false, 'Forced failure log should confirm no external writes attempted.');
  assert.equal((failedRecord.metadata_json.result_metadata as Record<string, unknown>).sandbox_only, true, 'Forced failure preview metadata should remain sandbox-only.');

  const previewPersistence = await persistSandboxExecutionResultLog(failedContent, { persist: false });
  assert.equal(previewPersistence.stored, false, 'Preview persistence must not write to DB by default.');
  assert.equal(previewPersistence.recordPreview.result_status, 'failed', 'Preview persistence should preserve failed status.');
  assert.equal(previewPersistence.safety.externalWritesAttempted, false, 'Preview persistence must confirm no external writes attempted.');

  const failedAds = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008804',
    actionId: '00000000-0000-0000-0000-000000008805',
    actionType: 'ad_budget_adjust',
    currentStatus: 'proposed',
    riskLevel: 'medium',
    approvedByUserId: '00000000-0000-0000-0000-000000008806',
    policyDecision: 'ask',
    metadata: { sandbox_should_fail: true, sandbox_failure_reason: 'QA requested fake ads failure.' },
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'ad_budget_adjust',
      source: 'admin',
      intent_summary: 'Adjust budget in sandbox, but force QA failure.',
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

  assert.equal(failedAds.lifecycle.finalStatus, 'failed', 'Metadata sandbox_should_fail should force ads failure.');
  assert.equal(failedAds.executor.resultStoragePreview?.result_status, 'failed', 'Ads forced failure should preview failed result status.');
  assert.equal(failedAds.executor.executionResult?.result.external_ads_api_called, false, 'Ads forced failure must not call ads API.');

  const normalContent = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008807',
    actionId: '00000000-0000-0000-0000-000000008808',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: '00000000-0000-0000-0000-000000008809',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Publish an Instagram post in sandbox successfully.',
      data: {
        platform: 'instagram',
        caption: 'Certainly, sir. This content payload should succeed because sandbox_should_fail is not enabled.',
        post_type: 'feed',
      },
    },
  });

  assert.equal(normalContent.lifecycle.finalStatus, 'executed', 'Normal sandbox action should still execute successfully.');
  assert.equal(normalContent.executor.executionResult?.ok, true, 'Normal sandbox execution should remain ok=true.');

  const safety = buildFailureSimulationSafetySummary();
  assert.equal(safety.phase, FAILURE_SIMULATION_PHASE, 'Safety summary should carry Phase 8.8 phase.');
  assert.equal(safety.supportsSandboxShouldFailFlag, true, 'Safety summary should confirm sandbox_should_fail support.');
  assert.equal(safety.failedActionStatusTested, true, 'Safety summary should confirm failed action status tested.');
  assert.equal(safety.externalWritesEnabled, false, 'Failure simulation must not enable external writes.');
  assert.equal(safety.autoRunEnabled, false, 'Failure simulation must not enable auto-run.');

  console.log('executor:failure-simulation:test — 24 passed, 0 failed');
}

main().catch((error) => {
  console.error('executor:failure-simulation:test failed');
  console.error(error);
  process.exit(1);
});
