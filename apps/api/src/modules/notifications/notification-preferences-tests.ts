import assert from 'node:assert/strict';
import {
  assertSafeNotificationPreferencesResponse,
  defaultNotificationPreferences,
  mergeNotificationPreferencePatch,
  parseHhmmToMinutes,
  quietHoursCrossesMidnight,
  toSafeNotificationPreferences,
} from './notification-preferences.model.js';
import type { NotificationPreferenceRow } from './notification-preferences.types.js';

function row(overrides: Partial<NotificationPreferenceRow> = {}): NotificationPreferenceRow {
  const now = new Date('2026-07-06T12:00:00.000Z');
  return {
    workspace_id: '00000000-0000-0000-0000-000000000001',
    in_app_enabled: true,
    email_enabled: false,
    slack_enabled: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    quiet_hours_timezone: 'America/New_York',
    approval_escalation_minutes: 60,
    repeat_escalation_minutes: 120,
    max_escalations: 3,
    updated_by: null,
    metadata: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function expectThrows(fn: () => unknown, fragment: string) {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.match(String((error as Error).message), new RegExp(fragment));
  }
  assert.equal(thrown, true, `Expected error containing ${fragment}`);
}

const tests: Array<[string, () => void]> = [
  ['default preferences enable in-app only', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.channels.inApp.enabled, true);
    assert.equal(safe.channels.email.enabled, false);
    assert.equal(safe.channels.slack.enabled, false);
  }],
  ['default model is storage-only and does not send notifications', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.safety.modelOnly, true);
    assert.equal(safe.safety.sendsEmailInThisPhase, false);
    assert.equal(safe.safety.sendsSlackInThisPhase, false);
    assert.equal(safe.safety.createsInAppRowsInThisPhase, false);
  }],
  ['email preference can be enabled as stored preference only', () => {
    const merged = mergeNotificationPreferencePatch(row(), 'workspace-1', { channels: { email: true } });
    const safe = toSafeNotificationPreferences(merged);
    assert.equal(safe.channels.email.enabled, true);
    assert.equal(safe.channels.email.deliveryImplemented, false);
  }],
  ['in-app preference can be disabled deliberately', () => {
    const merged = mergeNotificationPreferencePatch(row(), 'workspace-1', { channels: { inApp: false } });
    assert.equal(merged.in_app_enabled, false);
  }],
  ['Slack cannot be enabled in Phase 10.1', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { channels: { slack: true } }), 'Slack notifications are planned');
  }],
  ['Slack false is accepted and remains false', () => {
    const merged = mergeNotificationPreferencePatch(row(), 'workspace-1', { channels: { slack: false } });
    assert.equal(merged.slack_enabled, false);
  }],
  ['HH:mm parser handles midnight', () => {
    assert.equal(parseHhmmToMinutes('00:00'), 0);
  }],
  ['HH:mm parser handles end of day', () => {
    assert.equal(parseHhmmToMinutes('23:59'), 1439);
  }],
  ['invalid quiet hours start is rejected', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { quietHours: { start: '25:00' } }), 'quietHours.start');
  }],
  ['invalid quiet hours end is rejected', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { quietHours: { end: '8am' } }), 'quietHours.end');
  }],
  ['quiet hours can cross midnight', () => {
    assert.equal(quietHoursCrossesMidnight('22:00', '08:00'), true);
  }],
  ['quiet hours can stay within same day', () => {
    assert.equal(quietHoursCrossesMidnight('09:00', '17:00'), false);
  }],
  ['quiet hours response includes timezone', () => {
    const safe = toSafeNotificationPreferences(row({ quiet_hours_timezone: 'Asia/Karachi' }));
    assert.equal(safe.quietHours.timezone, 'Asia/Karachi');
  }],
  ['approval escalation lower bound is enforced', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { escalation: { approvalEscalationMinutes: 4 } }), 'greater than or equal');
  }],
  ['approval escalation upper bound is enforced', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { escalation: { approvalEscalationMinutes: 1441 } }), 'less than or equal');
  }],
  ['repeat escalation range is enforced', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { escalation: { repeatEscalationMinutes: 1 } }), 'greater than or equal');
  }],
  ['max escalation range is enforced', () => {
    expectThrows(() => mergeNotificationPreferencePatch(row(), 'workspace-1', { escalation: { maxEscalations: 11 } }), 'less than or equal');
  }],
  ['valid escalation values are stored', () => {
    const merged = mergeNotificationPreferencePatch(row(), 'workspace-1', { escalation: { approvalEscalationMinutes: 30, repeatEscalationMinutes: 90, maxEscalations: 2 } });
    assert.equal(merged.approval_escalation_minutes, 30);
    assert.equal(merged.repeat_escalation_minutes, 90);
    assert.equal(merged.max_escalations, 2);
  }],
  ['safe response never exposes secrets', () => {
    const safe = toSafeNotificationPreferences(row({ metadata: { note: 'safe metadata only' } }));
    assertSafeNotificationPreferencesResponse(safe);
  }],
  ['safe response blocks forbidden secret-like fragments', () => {
    expectThrows(() => assertSafeNotificationPreferencesResponse(toSafeNotificationPreferences(row({ metadata: { bad: 'access_token' } }))), 'forbidden fragment');
  }],
  ['trigger actionNeedsApproval is modeled', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.triggers.actionNeedsApproval, true);
  }],
  ['action failure and rollback review triggers are modeled for later phases', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.triggers.actionFailed, true);
    assert.equal(safe.triggers.rollbackNeedsReview, true);
  }],
  ['external services are not called by the model', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.safety.externalServicesCalled, false);
  }],
  ['auto-run remains disabled', () => {
    const safe = defaultNotificationPreferences('workspace-1');
    assert.equal(safe.safety.autoRunEnabled, false);
  }],
  ['patch preserves existing values when omitted', () => {
    const merged = mergeNotificationPreferencePatch(row({ email_enabled: true, approval_escalation_minutes: 45 }), 'workspace-1', { quietHours: { enabled: true } });
    assert.equal(merged.email_enabled, true);
    assert.equal(merged.approval_escalation_minutes, 45);
    assert.equal(merged.quiet_hours_enabled, true);
  }],
  ['metadata marks Phase 10.1 as model-only', () => {
    const merged = mergeNotificationPreferencePatch(row(), 'workspace-1', { channels: { email: true } });
    assert.equal(merged.metadata?.modelOnly, true);
    assert.equal(merged.metadata?.externalServicesCalled, false);
  }],
];

let failed = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS notification-preferences:test — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL notification-preferences:test — ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`notification-preferences:test — ${tests.length - failed} passed, ${failed} failed`);
  process.exit(1);
}

console.log(`notification-preferences:test — ${tests.length} passed, 0 failed`);
