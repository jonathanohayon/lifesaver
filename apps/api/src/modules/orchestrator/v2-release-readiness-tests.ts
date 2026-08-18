import assert from 'node:assert/strict';
import {
  getV2ReleaseReadinessExample,
  getV2ReleaseReadinessReport,
  getV2ReleaseReadinessStatus,
  previewV2ReleaseReadiness,
  V2_RELEASE_CHECKS,
  V2_RELEASE_READINESS_HEALTH_MODE,
  V2_RELEASE_READINESS_SAFETY,
} from './v2-release-readiness.model.js';

function run() {
  const status = getV2ReleaseReadinessStatus();
  assert.equal(V2_RELEASE_READINESS_HEALTH_MODE, 'v2-phase-15-10-v2-release-readiness');
  assert.equal(status.healthMode, 'v2-phase-15-10-v2-release-readiness');
  assert.equal(status.deliverable, 'v2_operator_release_checklist');
  assert.equal(status.checklistDefined, true);
  assert.equal(status.roadmapPhase15Complete, true);
  assert.equal(status.autoRunEnabledByThisPhase, false);
  assert.equal(status.externalConnectorCallEnabled, false);

  const keys = V2_RELEASE_CHECKS.map((check) => check.key);
  assert.deepEqual(keys, [
    'v1_still_works',
    'approval_queue_works',
    'policy_engine_works',
    'master_pause_works',
    'sandbox_executor_works',
    'real_executor_works',
    'audit_logs_work',
    'rollback_supported_where_available',
    'no_hidden_autonomy',
    'client_acceptance_passed',
  ]);

  const empty = previewV2ReleaseReadiness({});
  assert.equal(empty.decision, 'not_ready');
  assert.equal(empty.passCount, 0);
  assert.equal(empty.failCount, 10);
  assert.equal(empty.clientSignOffReady, false);
  assert.equal(empty.wouldExecuteAnythingThisPhase, false);
  assert.equal(empty.wouldCallExternalConnectorThisPhase, false);
  assert.equal(empty.wouldEnableAutoRunThisPhase, false);

  const partial = previewV2ReleaseReadiness({
    evidence: {
      v1_login_passed: true,
      v1_metrics_passed: true,
      approval_queue_passed: true,
      policy_engine_passed: true,
      master_pause_passed: true,
    },
  });
  assert.equal(partial.decision, 'not_ready');
  assert.ok(partial.warningCount >= 1);
  assert.ok(partial.failCount >= 1);
  assert.ok(partial.warnings.some((warning) => warning.includes('V1 still works')));

  const ready = previewV2ReleaseReadiness(getV2ReleaseReadinessExample());
  assert.equal(ready.decision, 'ready_for_client_acceptance');
  assert.equal(ready.passCount, 10);
  assert.equal(ready.warningCount, 0);
  assert.equal(ready.failCount, 0);
  assert.equal(ready.clientSignOffReady, true);
  assert.equal(ready.issues.length, 0);

  const forced = previewV2ReleaseReadiness({ ...getV2ReleaseReadinessExample(), force: true });
  assert.equal(forced.decision, 'ready_for_client_acceptance');
  assert.ok(forced.warnings.some((warning) => warning.includes('force=true is ignored')));

  const secretInput = previewV2ReleaseReadiness({
    ...getV2ReleaseReadinessExample(),
    access_token: 'secret-token-should-never-be-needed',
  });
  assert.equal(secretInput.decision, 'not_ready');
  assert.ok(secretInput.issues.some((issue) => issue.includes('Secret-like fields')));

  const report = getV2ReleaseReadinessReport();
  assert.equal(report.healthMode, 'v2-phase-15-10-v2-release-readiness');
  assert.equal(report.deliverable, 'v2_operator_release_checklist');
  assert.equal(report.checks.length, 10);
  assert.ok(report.apiEndpoints.includes('GET /api/v1/orchestrator/v2-release-readiness/status'));
  assert.ok(report.apiEndpoints.includes('GET /api/v1/orchestrator/v2-release-readiness/checklist'));
  assert.ok(report.apiEndpoints.includes('POST /api/v1/orchestrator/v2-release-readiness/preview'));
  assert.ok(report.recommendedRegressionCommands.includes('npm run phase15:v2-release-readiness:test'));
  assert.ok(report.recommendedRegressionCommands.includes('npm run phase14:ads-safety-qa:test'));
  assert.ok(report.liveChecks.includes('https://lifesaveragent.com/api/v1/orchestrator/v2-release-readiness/status'));

  assert.deepEqual(V2_RELEASE_READINESS_SAFETY, {
    checklistOnly: true,
    noSchedulerEnabled: true,
    noNotificationSend: true,
    noActionCreation: true,
    noActionApproval: true,
    noExecutorCall: true,
    noAutoRun: true,
    noExternalConnectorCall: true,
    noContentPublishing: true,
    noSupportSending: true,
    noAdsMutation: true,
    noClaudeCallFromModule: true,
    noRawSecretsReturned: true,
    noDatabaseMigrationRequired: true,
  });

  console.log('PASS phase15:v2-release-readiness:test');
}

run();
