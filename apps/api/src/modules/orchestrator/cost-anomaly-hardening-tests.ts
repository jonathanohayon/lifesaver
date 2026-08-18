import assert from 'node:assert/strict';
import {
  assertCostAnomalyOutputSafe,
  buildCostAnomalyExample,
  buildCostAnomalyReport,
  buildCostAnomalyStatus,
  COST_ANOMALY_HEALTH_MODE,
  previewCostAnomalyHardening,
} from './cost-anomaly-hardening.model.js';

function testStatus() {
  const status = buildCostAnomalyStatus();
  assert.equal(COST_ANOMALY_HEALTH_MODE, 'v2-phase-15-9-cost-anomaly-hardening');
  assert.equal(status.healthMode, 'v2-phase-15-9-cost-anomaly-hardening');
  assert.equal(status.costCapsDefined, true);
  assert.equal(status.anomalyAlertsDefined, true);
  assert.equal(status.schedulerEnabled, false);
  assert.equal(status.notificationSendingEnabled, false);
  assert.equal(status.actionCreationEnabled, false);
  assert.equal(status.executorEnabled, false);
  assert.equal(status.autoRunEnabled, false);
}

function testWithinCaps() {
  const result = buildCostAnomalyExample();
  assert.equal(result.decision, 'within_caps');
  assert.equal(result.capResults.every((cap) => !cap.exceeded), true);
  assert.equal(result.alerts.every((alert) => !alert.triggered), true);
  assert.equal(result.wouldSendNotificationThisPhase, false);
  assert.equal(result.wouldCreateActionThisPhase, false);
  assert.equal(result.wouldExecuteActionThisPhase, false);
  assert.equal(result.wouldCallClaudeThisPhase, false);
  assert.equal(result.wouldCallExternalConnectorThisPhase, false);
}

function testHardCapsBlock() {
  const result = previewCostAnomalyHardening({
    usage: {
      claude_model_cost_today: 100,
      executor_calls_last_hour: 30,
      auto_actions_last_hour: 9,
      auto_actions_today: 22,
    },
    limits: {
      max_model_cost_per_day: 25,
      max_executor_calls_per_hour: 20,
      max_auto_actions_per_hour: 5,
      max_auto_actions_per_day: 15,
    },
  });
  assert.equal(result.decision, 'blocked_by_cap');
  assert.ok(result.capResults.some((cap) => cap.key === 'max_model_cost_per_day' && cap.exceeded));
  assert.ok(result.alerts.some((alert) => alert.key === 'cap_exceeded' && alert.triggered));
  assert.ok(result.alerts.some((alert) => alert.key === 'unexpected_action_volume' && alert.triggered));
}

function testNotificationWarning() {
  const result = previewCostAnomalyHardening({
    usage: { notification_sends_today: 70 },
    limits: { max_notification_sends_per_day: 50 },
  });
  assert.equal(result.decision, 'warning');
  assert.ok(result.capResults.some((cap) => cap.key === 'max_notification_sends_per_day' && cap.severity === 'warning'));
}

function testApiAndPolicyAlerts() {
  const result = previewCostAnomalyHardening({
    usage: {
      api_failures_last_hour: 5,
      policy_changes_last_hour: 4,
      policy_blocks_last_hour: 12,
    },
    limits: {
      max_api_failures_per_hour: 3,
      max_policy_changes_per_hour: 2,
    },
  });
  assert.equal(result.decision, 'blocked_by_cap');
  assert.ok(result.alerts.some((alert) => alert.key === 'api_failures' && alert.triggered));
  assert.ok(result.alerts.some((alert) => alert.key === 'suspicious_policy_behavior' && alert.triggered));
}

function testSafetyGatesAndForceIgnored() {
  const result = previewCostAnomalyHardening({
    emergency_safe_mode: true,
    master_pause_active: true,
    force: true,
    usage: { auto_actions_last_hour: 100 },
  });
  assert.equal(result.decision, 'blocked_by_safety_gate');
  assert.ok(result.warnings.some((warning) => warning.toLowerCase().includes('master pause')));
  assert.ok(result.warnings.some((warning) => warning.toLowerCase().includes('force=true')));
  assert.equal(result.wouldExecuteActionThisPhase, false);
}

function testSecretBlockingAndOutputSafety() {
  const result = previewCostAnomalyHardening({
    api_key: 'secret',
    claude_api_key: 'secret',
    usage: { claude_model_cost_today: 1 },
  });
  assert.equal(result.decision, 'blocked_by_safety_gate');
  assert.ok(result.issues.some((issue) => issue.includes('api_key')));
  assert.ok(result.issues.some((issue) => issue.includes('claude_api_key')));
  assertCostAnomalyOutputSafe(result);
}

function testReport() {
  const report = buildCostAnomalyReport();
  assert.equal(report.healthMode, 'v2-phase-15-9-cost-anomaly-hardening');
  assert.equal(report.costCaps.length, 5);
  assert.equal(report.anomalyAlerts.length, 4);
  assert.equal(report.safety.noNotificationSend, true);
  assert.equal(report.safety.noClaudeCallFromModule, true);
  assert.equal(report.safety.noExecutorCall, true);
  assert.equal(report.nextStep, 'Phase 15.10 — V2 Release Readiness');
  assertCostAnomalyOutputSafe(report);
}

testStatus();
testWithinCaps();
testHardCapsBlock();
testNotificationWarning();
testApiAndPolicyAlerts();
testSafetyGatesAndForceIgnored();
testSecretBlockingAndOutputSafety();
testReport();

console.log('Phase 15.9 Cost Caps + Anomaly Alerts tests passed.');
