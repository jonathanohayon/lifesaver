import assert from 'node:assert/strict';
import {
  buildExecutionResultLogsSafetySummary,
  buildSandboxExecutionResultLogRecord,
  EXECUTION_RESULT_LOGS_PHASE,
  persistSandboxExecutionResultLog,
  summarizeResultLogDecision,
} from './executor.result-logs.js';
import { runApproveToExecuteSandboxLifecycle } from './executor.sandbox-lifecycle.js';

async function main() {
  const content = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008701',
    actionId: '00000000-0000-0000-0000-000000008702',
    actionType: 'content_publish',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: '00000000-0000-0000-0000-000000008703',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'content_publish',
      source: 'admin',
      intent_summary: 'Publish an Instagram post in sandbox.',
      data: {
        platform: 'instagram',
        caption: 'Certainly, sir. This is a safe sandbox post for result log testing.',
        post_type: 'feed',
      },
    },
  });

  const record = buildSandboxExecutionResultLogRecord(content);
  assert.equal(record.action_id, content.actionId, 'Record should target the lifecycle action id.');
  assert.equal(record.workspace_id, content.workspaceId, 'Record should target the lifecycle workspace id.');
  assert.equal(record.executor_name, 'sandboxContentExecutor', 'Record should store executor_name.');
  assert.equal(record.result_status, 'success', 'Successful sandbox execution should map to success.');
  assert.equal(record.error_message, null, 'Successful sandbox execution should not store an error message.');
  assert.match(String(record.external_id), /^sandbox-post-/, 'Record should include fake external post id.');
  assert.match(String(record.external_url), /^https:\/\/sandbox\.lifesaveragent\.com\//, 'Record should include fake sandbox URL only.');
  assert.equal(record.rollback_supported, true, 'Content sandbox executor supports sandbox rollback.');
  assert.equal(record.metadata_json.phase, EXECUTION_RESULT_LOGS_PHASE, 'Metadata should carry Phase 8.7 phase.');
  assert.equal(record.metadata_json.sandbox_only, true, 'Metadata should confirm sandbox only.');
  assert.equal(record.metadata_json.external_writes_attempted, false, 'Metadata should confirm no external writes attempted.');
  assert.deepEqual(record.metadata_json.lifecycle_status_path, ['proposed', 'approved', 'executing', 'executed'], 'Metadata should include lifecycle path.');

  const previewPersistence = await persistSandboxExecutionResultLog(content, { persist: false });
  assert.equal(previewPersistence.phase, EXECUTION_RESULT_LOGS_PHASE, 'Persistence preview should carry Phase 8.7 phase.');
  assert.equal(previewPersistence.targetTable, 'action_results', 'Result log target table should be action_results.');
  assert.equal(previewPersistence.stored, false, 'Preview persistence must not write to DB.');
  assert.equal(previewPersistence.skippedReason, 'persistence_not_requested', 'Preview call should explain skip reason.');
  assert.equal(previewPersistence.recordPreview.result_status, 'success', 'Preview record should still show success.');
  assert.equal(previewPersistence.safety.exposesRollbackPayloadToBrowser, false, 'Safety summary should keep rollback payload out of browser.');

  const unsupported = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008704',
    actionId: '00000000-0000-0000-0000-000000008705',
    actionType: 'research_task',
    currentStatus: 'proposed',
    riskLevel: 'low',
    approvedByUserId: '00000000-0000-0000-0000-000000008706',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'research_task',
      source: 'admin',
      intent_summary: 'Research in sandbox.',
      data: { question: 'What changed?', objective: 'Summary only.' },
    },
  });

  const blockedRecord = buildSandboxExecutionResultLogRecord(unsupported);
  assert.equal(blockedRecord.executor_name, 'sandboxLifecycleGuard', 'Unsupported action should be stored under lifecycle guard executor.');
  assert.equal(blockedRecord.result_status, 'blocked', 'Unsupported action should map to blocked action_results status.');
  assert(blockedRecord.error_message, 'Blocked result should include safe error message.');
  assert.equal(blockedRecord.rollback_supported, false, 'Blocked unsupported action should not support rollback.');

  const validationFailed = await runApproveToExecuteSandboxLifecycle({
    workspaceId: '00000000-0000-0000-0000-000000008707',
    actionId: '00000000-0000-0000-0000-000000008708',
    actionType: 'support_reply_send',
    currentStatus: 'proposed',
    riskLevel: 'medium',
    approvedByUserId: '00000000-0000-0000-0000-000000008709',
    policyDecision: 'ask',
    payloadJson: {
      schema_version: 'action-payload/v0.6.0',
      action_type: 'support_reply_send',
      source: 'admin',
      intent_summary: 'Invalid support reply payload.',
      data: { ticket_id: 'TICKET-1' },
    },
  });

  const failedRecord = buildSandboxExecutionResultLogRecord(validationFailed);
  assert.equal(failedRecord.result_status, 'failed', 'Validation failure should map to failed action_results status.');
  assert(failedRecord.error_message, 'Failed validation should include safe error message.');
  assert.equal(failedRecord.external_id, null, 'Validation failure should not include fake external id.');

  const sentence = summarizeResultLogDecision(record);
  assert.match(sentence, /action_results/i, 'Summary sentence should mention action_results.');
  assert.match(sentence, /sandboxContentExecutor/, 'Summary sentence should mention executor name.');

  const safety = buildExecutionResultLogsSafetySummary();
  assert.equal(safety.storesInActionResults, true, 'Safety summary should confirm action_results storage support.');
  assert.equal(safety.visibleThroughActionDetailResultSummary, true, 'Safety summary should confirm UI visibility path.');
  assert.equal(safety.browserReceivesRollbackPayload, false, 'Browser must not receive rollback payload.');
  assert.equal(safety.externalWritesEnabled, false, 'Phase 8.7 must not enable external writes.');

  console.log('executor:result-logs:test — 18 passed, 0 failed');
}

main().catch((error) => {
  console.error('executor:result-logs:test failed');
  console.error(error);
  process.exit(1);
});
