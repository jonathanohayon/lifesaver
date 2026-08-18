import assert from 'node:assert/strict';
import {
  buildSafeDemoQaLifecycleInput,
  buildSafeDemoQaSafetySummary,
  runSafeDemoQaReport,
  SAFE_DEMO_QA_PHASE,
} from './executor.safe-demo-qa.js';

async function main() {
  const input = buildSafeDemoQaLifecycleInput();
  assert.equal(input.currentStatus, 'proposed', 'Demo lifecycle should start as proposed.');
  assert.equal(input.actionType, 'content_publish', 'Default safe demo should use content publish.');
  assert.equal(input.metadata?.live_domain, 'https://lifesaveragent.com', 'Safe demo should use current live domain metadata.');

  const contentReport = await runSafeDemoQaReport();
  assert.equal(contentReport.phase, SAFE_DEMO_QA_PHASE, 'Report should carry Phase 8.10 phase.');
  assert.equal(contentReport.title, 'Sandbox Executor QA Report', 'Report should use correct deliverable title.');
  assert.equal(contentReport.flow, 'Draft -> Proposed Action -> Approval -> Sandbox Execution -> Result Log', 'Report should document full flow.');
  assert.equal(contentReport.liveDomain, 'https://lifesaveragent.com', 'Report should reference live Render domain.');
  assert.equal(contentReport.qaPassed, true, 'Default safe demo QA should pass.');
  assert.equal(contentReport.steps.length, 5, 'Safe demo should contain five visible QA steps.');
  assert.deepEqual(contentReport.steps.map((step) => step.name), ['draft', 'proposed_action', 'approval', 'sandbox_execution', 'result_log'], 'Steps should follow requested flow order.');
  assert.deepEqual(contentReport.lifecycle.lifecycle.statusPath, ['proposed', 'approved', 'executing', 'executed'], 'Lifecycle should reach executed through approved path.');
  assert.equal(contentReport.lifecycle.safety.externalWritesAttempted, false, 'Lifecycle must not attempt external writes.');
  assert.equal(contentReport.lifecycle.safety.autoRunEnabled, false, 'Lifecycle must not enable auto-run.');
  assert.equal(contentReport.resultLog.targetTable, 'action_results', 'Result log target should be action_results.');
  assert.equal(contentReport.resultLog.recordPreview.result_status, 'success', 'Successful demo should produce success result log preview.');
  assert.equal(contentReport.resultLog.recordPreview.action_id, contentReport.actionId, 'Result log should reference the same action id.');
  assert.equal(contentReport.resultLog.recordPreview.metadata_json.external_writes_attempted, false, 'Result log metadata should confirm no external writes.');
  assert.equal(contentReport.resultLog.safety.exposesRollbackPayloadToBrowser, false, 'Rollback payloads must not be exposed to browser.');
  assert.equal(contentReport.safety.externalWritesAttempted, false, 'Report safety should confirm no external writes attempted.');
  assert.equal(contentReport.safety.realExecutorsEnabled, false, 'Report safety should confirm real executors remain disabled.');

  const supportReport = await runSafeDemoQaReport({
    actionId: 'action-safe-demo-support-1',
    actionType: 'support_reply_send',
  });
  assert.equal(supportReport.qaPassed, true, 'Support safe demo QA should pass.');
  assert.equal(supportReport.actionType, 'support_reply_send', 'Support report should use support action type.');
  assert.equal(supportReport.lifecycle.executor.name, 'sandboxSupportExecutor', 'Support report should use sandbox support executor.');
  assert.equal(supportReport.lifecycle.executor.executionResult?.result.external_email_sent, false, 'Support demo must not send email.');

  const adsReport = await runSafeDemoQaReport({
    actionId: 'action-safe-demo-ads-1',
    actionType: 'ad_budget_adjust',
  });
  assert.equal(adsReport.qaPassed, true, 'Ads safe demo QA should pass.');
  assert.equal(adsReport.actionType, 'ad_budget_adjust', 'Ads report should use ads action type.');
  assert.equal(adsReport.lifecycle.executor.name, 'sandboxAdsBudgetExecutor', 'Ads report should use sandbox ads budget executor.');
  assert.equal(adsReport.lifecycle.executor.executionResult?.result.external_budget_changed, false, 'Ads demo must not change real budget.');

  const failedReport = await runSafeDemoQaReport({
    actionId: 'action-safe-demo-forced-failure-1',
    sandboxShouldFail: true,
  });
  assert.equal(failedReport.qaPassed, false, 'Forced fake failure should not pass complete safe demo QA.');
  assert.equal(failedReport.lifecycle.lifecycle.finalStatus, 'failed', 'Forced fake failure should produce failed final status.');
  assert.equal(failedReport.resultLog.recordPreview.result_status, 'failed', 'Forced fake failure should create failed result log preview.');
  assert.equal(failedReport.safety.externalWritesAttempted, false, 'Forced fake failure should still not attempt external writes.');

  const safety = buildSafeDemoQaSafetySummary();
  assert.equal(safety.sandboxExecutorQaReport, true, 'Safety summary should confirm QA report deliverable.');
  assert.equal(safety.demonstratesCompleteV2FlowSafely, true, 'Safety summary should confirm complete safe V2 flow.');
  assert.deepEqual(safety.flow, ['draft', 'proposed_action', 'approval', 'sandbox_execution', 'result_log'], 'Safety flow should match requested flow.');
  assert.equal(safety.externalWritesEnabled, false, 'Safety summary should confirm external writes remain disabled.');
  assert.equal(safety.realExecutorsEnabled, false, 'Safety summary should confirm real executors remain disabled.');
  assert.equal(safety.autoRunEnabled, false, 'Safety summary should confirm auto-run remains disabled.');
  assert.equal(safety.liveDomain, 'https://lifesaveragent.com', 'Safety summary should use current live domain.');

  console.log('executor:safe-demo-qa:test — 28 passed, 0 failed');
}

main().catch((error) => {
  console.error('executor:safe-demo-qa:test — failed');
  console.error(error);
  process.exit(1);
});
