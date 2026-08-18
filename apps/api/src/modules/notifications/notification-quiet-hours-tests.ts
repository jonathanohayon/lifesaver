import assert from 'node:assert/strict';
import {
  buildQuietHoursPreview,
  defaultQuietHoursPreferences,
  enforceQuietHoursForNotification,
  findQuietHoursNextOpenAt,
  isQuietHoursActiveAt,
  parseQuietHoursHhmm,
  quietHoursCrossesMidnight,
} from './notification-quiet-hours.model.js';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    actionId: 'action_123',
    workspaceId: 'workspace_123',
    title: 'Approve LinkedIn founder update',
    actionType: 'content_publish',
    riskLevel: 'medium',
    priority: 'normal' as const,
    triggerType: 'action_proposed' as const,
    channels: {
      inAppCandidate: true,
      emailCandidate: true,
      slackCandidate: false as const,
    },
    ...overrides,
  };
}

const quietPreferences = {
  ...defaultQuietHoursPreferences(),
  inAppEnabled: true,
  emailEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'UTC',
};

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

test('HH:mm parser converts valid time to minutes', () => {
  assert.equal(parseQuietHoursHhmm('22:30'), 1350);
});

test('HH:mm parser rejects invalid time', () => {
  assert.throws(() => parseQuietHoursHhmm('25:00'));
});

test('quiet-hours window crossing midnight is detected', () => {
  assert.equal(quietHoursCrossesMidnight('22:00', '08:00'), true);
  assert.equal(quietHoursCrossesMidnight('09:00', '17:00'), false);
});

test('quiet hours are active during cross-midnight window before midnight', () => {
  assert.equal(isQuietHoursActiveAt(quietPreferences, new Date('2026-07-06T23:00:00.000Z')), true);
});

test('quiet hours are active during cross-midnight window after midnight', () => {
  assert.equal(isQuietHoursActiveAt(quietPreferences, new Date('2026-07-06T03:00:00.000Z')), true);
});

test('quiet hours are inactive outside cross-midnight window', () => {
  assert.equal(isQuietHoursActiveAt(quietPreferences, new Date('2026-07-06T12:00:00.000Z')), false);
});

test('non-critical email is delayed during quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.quietHours.activeNow, true);
  assert.equal(decision.critical.isCritical, false);
  assert.equal(decision.channels.email.allowedNow, false);
  assert.equal(decision.channels.email.delayed, true);
  assert.ok(decision.channels.email.delayedUntil);
});

test('non-critical in-app alert is also delayed during quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.channels.inApp.allowedNow, false);
  assert.equal(decision.channels.inApp.delayed, true);
});

test('critical risk bypasses quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput({ riskLevel: 'critical', priority: 'urgent' }), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.critical.isCritical, true);
  assert.equal(decision.channels.email.allowedNow, true);
  assert.equal(decision.channels.email.criticalOverride, true);
});

test('action_failed trigger bypasses quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput({ triggerType: 'action_failed', priority: 'urgent' }), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.critical.isCritical, true);
  assert.equal(decision.channels.inApp.allowedNow, true);
});

test('email can be used outside quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T12:00:00.000Z'));
  assert.equal(decision.quietHours.activeNow, false);
  assert.equal(decision.channels.email.allowedNow, true);
  assert.equal(decision.channels.email.delayed, false);
});

test('disabled email is not a candidate even outside quiet hours', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), { ...quietPreferences, emailEnabled: false }, new Date('2026-07-06T12:00:00.000Z'));
  assert.equal(decision.channels.email.candidate, false);
  assert.equal(decision.channels.email.allowedNow, false);
});

test('Slack remains disabled and planned later', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T12:00:00.000Z'));
  assert.equal(decision.channels.slack.candidate, false);
  assert.equal(decision.channels.slack.allowedNow, false);
});

test('next open time is calculated when quiet hours are active', () => {
  const next = findQuietHoursNextOpenAt(quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.ok(next);
  assert.equal(isQuietHoursActiveAt(quietPreferences, new Date(next as string)), false);
});

test('non-cross-midnight quiet hours are active inside same-day window', () => {
  const preferences = { ...quietPreferences, quietHoursStart: '13:00', quietHoursEnd: '15:00' };
  assert.equal(isQuietHoursActiveAt(preferences, new Date('2026-07-06T14:00:00.000Z')), true);
  assert.equal(isQuietHoursActiveAt(preferences, new Date('2026-07-06T16:00:00.000Z')), false);
});

test('quiet hours disabled allows candidates immediately', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), { ...quietPreferences, quietHoursEnabled: false }, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.quietHours.enabled, false);
  assert.equal(decision.channels.email.allowedNow, true);
});

test('preview counts delayed and critical override decisions', () => {
  const preview = buildQuietHoursPreview({
    workspaceId: 'workspace_123',
    preferences: quietPreferences,
    now: new Date('2026-07-06T23:00:00.000Z'),
    candidates: [
      baseInput(),
      baseInput({ actionId: 'action_critical', riskLevel: 'critical', priority: 'urgent' }),
    ],
  });
  assert.equal(preview.phase, 'phase_10_7_quiet_hours_enforcement');
  assert.equal(preview.counts.candidatesEvaluated, 2);
  assert.equal(preview.counts.delayedByQuietHours, 1);
  assert.equal(preview.counts.criticalOverrides, 1);
});

test('unsafe title is redacted', () => {
  const decision = enforceQuietHoursForNotification(baseInput({ title: 'access_token=secret should not show' }), quietPreferences, new Date('2026-07-06T12:00:00.000Z'));
  assert.equal(decision.title, '[redacted unsafe text]');
});

test('quiet-hours output does not send email or call services', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.safety.sendsEmailInThisPhase, false);
  assert.equal(decision.safety.callsExternalServices, false);
});

test('quiet-hours output cannot approve or execute actions', () => {
  const decision = enforceQuietHoursForNotification(baseInput(), quietPreferences, new Date('2026-07-06T23:00:00.000Z'));
  assert.equal(decision.safety.canApproveAction, false);
  assert.equal(decision.safety.canExecuteAction, false);
});

test('quiet-hours output never exposes raw payload fragments', () => {
  const preview = buildQuietHoursPreview({ workspaceId: 'workspace_123', candidates: [baseInput()], preferences: quietPreferences, now: new Date('2026-07-06T23:00:00.000Z') });
  const serialized = JSON.stringify(preview).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'payload_json', 'rollback_payload']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});

console.log(`notification-quiet-hours:test — ${passed} passed, 0 failed`);
