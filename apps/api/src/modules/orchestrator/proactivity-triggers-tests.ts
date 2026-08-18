import assert from 'node:assert/strict';
import {
  assertProactivityTriggerSafe,
  buildProactivityTriggerExamples,
  buildProactivityTriggerReport,
  buildProactivityTriggerSafety,
  buildProactivityTriggerStatus,
  previewProactivityTrigger,
  PROACTIVITY_TRIGGER_DEFINITIONS,
  PROACTIVITY_TRIGGER_KEYS,
  PROACTIVITY_TRIGGERS_HEALTH_MODE,
} from './proactivity-triggers.model.js';

function testStatus() {
  const status = buildProactivityTriggerStatus();
  assert.equal(PROACTIVITY_TRIGGERS_HEALTH_MODE, 'v2-phase-15-6-proactive-triggers');
  assert.equal(status.healthMode, 'v2-phase-15-6-proactive-triggers');
  assert.equal(status.frameworkOnly, true);
  assert.equal(status.proactiveJobsEnabled, false);
  assert.equal(status.eventListenerEnabled, false);
  assert.equal(status.actionCreationEnabled, false);
  assert.equal(status.notificationSendingEnabled, false);
  assert.equal(status.executorEnabled, false);
  assert.equal(status.autoRunEnabled, false);
  assert.deepEqual(status.supportedTriggers, PROACTIVITY_TRIGGER_KEYS);
}

function testDefinitions() {
  assert.equal(PROACTIVITY_TRIGGER_DEFINITIONS.length, 6);
  for (const key of PROACTIVITY_TRIGGER_KEYS) {
    const definition = PROACTIVITY_TRIGGER_DEFINITIONS.find((item) => item.triggerKey === key);
    assert.ok(definition, `Missing definition for ${key}`);
    assert.ok(definition.requiredSafetyGates.length > 0);
    assert.ok(definition.forbiddenThisPhase.length > 0);
  }
}

function testExamplesAndRouting() {
  const examples = buildProactivityTriggerExamples();
  const roas = previewProactivityTrigger(examples.roas_drop);
  assert.equal(roas.decision, 'eligible_for_future_review');
  assert.equal(roas.triggerKey, 'roas_drop');
  assert.equal(roas.targetRoute, 'ads');
  assert.equal(roas.targetSpecialist, 'ads_specialist');
  assert.equal(roas.wouldCreateActionThisPhase, false);
  assert.equal(roas.wouldExecuteThisPhase, false);

  const support = previewProactivityTrigger(examples.new_support_ticket);
  assert.equal(support.targetRoute, 'support');
  assert.equal(support.targetSpecialist, 'support_specialist');
  assert.equal(support.wouldSendNotificationThisPhase, false);

  const content = previewProactivityTrigger(examples.scheduled_content_slot);
  assert.equal(content.targetRoute, 'content');
  assert.equal(content.wouldInvokeToolThisPhase, false);

  const failed = previewProactivityTrigger(examples.failed_executor_event);
  assert.equal(failed.severity, 'critical');
  assert.equal(failed.targetRoute, 'dev');
}

function testSafetyGates() {
  const paused = previewProactivityTrigger({
    trigger_key: 'roas_drop',
    source: 'metrics_event',
    payload: { roas_delta_percent: -25 },
    master_pause_active: true,
    force: true,
  });
  assert.equal(paused.decision, 'blocked_by_safety_gate');
  assert.ok(paused.issues.some((issue) => issue.toLowerCase().includes('master pause')));
  assert.ok(paused.warnings.some((warning) => warning.toLowerCase().includes('force=true')));
  assert.equal(paused.wouldCreateActionThisPhase, false);
  assert.equal(paused.wouldExecuteThisPhase, false);
}

function testSecretBlocking() {
  const blocked = previewProactivityTrigger({
    trigger_key: 'new_support_ticket',
    source: 'support_ticket',
    payload: { ticket_id: 'ticket_1', access_token: 'secret' },
  });
  assert.equal(blocked.decision, 'blocked_by_safety_gate');
  assert.ok(blocked.issues.some((issue) => issue.includes('access_token')));
}

function testReportAndOutputSafety() {
  const report = buildProactivityTriggerReport();
  assert.equal(report.definitions.length, 6);
  assert.equal(report.safety.noAutoRunEnabled, true);
  assert.equal(report.nextStep, 'Phase 15.7 — Voice Input');
  assertProactivityTriggerSafe(buildProactivityTriggerStatus());
  assertProactivityTriggerSafe(buildProactivityTriggerSafety());
  assertProactivityTriggerSafe(report);
}

testStatus();
testDefinitions();
testExamplesAndRouting();
testSafetyGates();
testSecretBlocking();
testReportAndOutputSafety();

console.log('Phase 15.6 proactivity trigger framework tests passed.');
