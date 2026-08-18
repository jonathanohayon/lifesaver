import assert from 'node:assert/strict';
import {
  buildNotificationTriggerEvaluation,
  defaultNotificationTriggerPreferences,
  evaluateNotificationTriggersForAction,
} from './notification-triggers.model.js';

function baseAction(overrides: Record<string, unknown> = {}) {
  return {
    actionId: 'action_123',
    workspaceId: 'workspace_123',
    title: 'Approve LinkedIn founder update',
    actionType: 'content_publish',
    status: 'proposed',
    riskLevel: 'medium',
    approvalRequired: true,
    policyDecision: 'ask',
    createdAt: '2026-07-06T10:00:00.000Z',
    updatedAt: '2026-07-06T10:05:00.000Z',
    ...overrides,
  };
}

const now = new Date('2026-07-06T12:00:00.000Z');
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`FAILED: ${name}`);
    throw error;
  }
}

test('action proposed creates action_proposed trigger', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction(), defaultNotificationTriggerPreferences(), now);
  assert.ok(triggers.some((trigger) => trigger.triggerType === 'action_proposed'));
});

test('failed action creates action_failed trigger', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ status: 'failed', approvalRequired: false, lastEventMessage: 'LinkedIn returned a safe failure summary.' }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].triggerType, 'action_failed');
  assert.equal(triggers[0].priority, 'urgent');
});

test('execution_failed event creates action_failed trigger even if status is not failed', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ status: 'approved', approvalRequired: false, lastEventType: 'execution_failed' }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].triggerType, 'action_failed');
});

test('high-risk waiting action creates high_risk_action_waiting trigger', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ riskLevel: 'high' }), defaultNotificationTriggerPreferences(), now);
  assert.ok(triggers.some((trigger) => trigger.triggerType === 'high_risk_action_waiting'));
});

test('critical waiting action is urgent', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ riskLevel: 'critical' }), defaultNotificationTriggerPreferences(), now);
  const highRisk = triggers.find((trigger) => trigger.triggerType === 'high_risk_action_waiting');
  assert.equal(highRisk?.priority, 'urgent');
});

test('approval reminder triggers after escalation window', () => {
  const preferences = { ...defaultNotificationTriggerPreferences(), approvalEscalationMinutes: 60, maxEscalations: 3 };
  const triggers = evaluateNotificationTriggersForAction(baseAction({ createdAt: '2026-07-06T10:30:00.000Z' }), preferences, now);
  assert.ok(triggers.some((trigger) => trigger.triggerType === 'approval_reminder_needed'));
});

test('approval reminder does not trigger before escalation window', () => {
  const preferences = { ...defaultNotificationTriggerPreferences(), approvalEscalationMinutes: 180, maxEscalations: 3 };
  const triggers = evaluateNotificationTriggersForAction(baseAction({ createdAt: '2026-07-06T11:00:00.000Z' }), preferences, now);
  assert.equal(triggers.some((trigger) => trigger.triggerType === 'approval_reminder_needed'), false);
});

test('approval reminder respects max escalations', () => {
  const preferences = { ...defaultNotificationTriggerPreferences(), approvalEscalationMinutes: 60, maxEscalations: 1 };
  const triggers = evaluateNotificationTriggersForAction(baseAction({ reminderCount: 1 }), preferences, now);
  assert.equal(triggers.some((trigger) => trigger.triggerType === 'approval_reminder_needed'), false);
});

test('non approval action does not create proposed trigger', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ status: 'approved', approvalRequired: false }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers.length, 0);
});

test('email candidate follows preference but does not send', () => {
  const preferences = { ...defaultNotificationTriggerPreferences(), emailEnabled: true };
  const triggers = evaluateNotificationTriggersForAction(baseAction(), preferences, now);
  assert.equal(triggers[0].channels.emailCandidate, true);
  assert.equal(triggers[0].safety.sendsEmailInThisPhase, false);
});

test('quiet hours only marks possible email delay', () => {
  const preferences = { ...defaultNotificationTriggerPreferences(), emailEnabled: true, quietHoursEnabled: true };
  const triggers = evaluateNotificationTriggersForAction(baseAction(), preferences, now);
  assert.equal(triggers[0].timing.quietHoursMayDelayEmail, true);
});

test('Slack remains planned later', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction(), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].channels.slackCandidate, false);
  assert.equal(triggers[0].safety.sendsSlackInThisPhase, false);
});

test('trigger outputs do not approve or execute', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction(), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].safety.canApproveAction, false);
  assert.equal(triggers[0].safety.canExecuteAction, false);
});

test('trigger outputs do not create notification rows in this phase', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction(), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].safety.createsNotificationRowsInThisPhase, false);
});

test('unsafe title is redacted', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ title: 'access_token=secret should not show' }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].title, '[redacted unsafe text]');
});

test('unsafe failure message is redacted', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ status: 'failed', approvalRequired: false, lastEventMessage: 'authorization bearer abc' }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].reason, '[redacted unsafe text]');
});

test('review URL points to secure approval queue action detail', () => {
  const triggers = evaluateNotificationTriggersForAction(baseAction({ actionId: 'action_123' }), defaultNotificationTriggerPreferences(), now);
  assert.equal(triggers[0].reviewUrl, './actions.html?actionId=action_123&source=notification_trigger&linkMode=review_only');
});

test('evaluation counts trigger types correctly', () => {
  const evaluation = buildNotificationTriggerEvaluation({
    workspaceId: 'workspace_123',
    now,
    candidates: [
      baseAction(),
      baseAction({ actionId: 'action_456', status: 'failed', approvalRequired: false }),
      baseAction({ actionId: 'action_789', riskLevel: 'high' }),
    ],
  });
  assert.equal(evaluation.counts.candidatesEvaluated, 3);
  assert.equal(evaluation.counts.actionFailed, 1);
  assert.ok(evaluation.counts.highRiskWaiting >= 1);
  assert.equal(evaluation.safety.sendsEmailInThisPhase, false);
});

test('evaluation can produce zero triggers safely', () => {
  const evaluation = buildNotificationTriggerEvaluation({
    workspaceId: 'workspace_123',
    now,
    candidates: [baseAction({ status: 'executed', approvalRequired: false })],
  });
  assert.equal(evaluation.counts.triggersCreated, 0);
  assert.equal(evaluation.safety.callsExternalServices, false);
});

test('invalid candidate fails validation', () => {
  assert.throws(() => evaluateNotificationTriggersForAction({ ...baseAction(), title: '' }, defaultNotificationTriggerPreferences(), now));
});

test('invalid preferences fail validation', () => {
  assert.throws(() => evaluateNotificationTriggersForAction(baseAction(), { ...defaultNotificationTriggerPreferences(), slackEnabled: true as false }, now));
});

test('trigger service never exposes payload_json fragment', () => {
  const evaluation = buildNotificationTriggerEvaluation({ workspaceId: 'workspace_123', now, candidates: [baseAction()] });
  assert.equal(JSON.stringify(evaluation).toLowerCase().includes('payload_json'), false);
});

test('trigger service never exposes raw_payload fragment', () => {
  const evaluation = buildNotificationTriggerEvaluation({ workspaceId: 'workspace_123', now, candidates: [baseAction()] });
  assert.equal(JSON.stringify(evaluation).toLowerCase().includes('raw_payload'), false);
});

test('trigger service safety flags remain locked', () => {
  const evaluation = buildNotificationTriggerEvaluation({ workspaceId: 'workspace_123', now, candidates: [baseAction()] });
  assert.equal(evaluation.safety.triggerServiceOnly, true);
  assert.equal(evaluation.safety.autoApprovalEnabled, false);
  assert.equal(evaluation.safety.autoExecutionEnabled, false);
});

console.log(`notification-triggers:test — ${passed} passed, 0 failed`);
