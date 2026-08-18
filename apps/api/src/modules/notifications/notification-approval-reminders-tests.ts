import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApprovalReminderPreview, defaultApprovalReminderPreferences, evaluateApprovalReminder } from './notification-approval-reminders.model.js';

const now = new Date('2026-07-06T12:00:00.000Z');
const baseAction = (overrides = {}) => ({
  actionId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
  title: 'Review LinkedIn post',
  actionType: 'content_publish',
  status: 'proposed',
  riskLevel: 'medium',
  approvalRequired: true,
  createdAt: '2026-07-06T10:30:00.000Z',
  reminderCount: 0,
  ...overrides,
});

const preferences = { ...defaultApprovalReminderPreferences(), approvalEscalationMinutes: 60, repeatEscalationMinutes: 120, maxEscalations: 3, emailEnabled: true };

test('first reminder becomes due after approval escalation window', () => {
  const reminder = evaluateApprovalReminder(baseAction(), preferences, now);
  assert.equal(reminder.reminderDue, true);
  assert.equal(reminder.reviewUrl.includes('actions.html?actionId='), true);
  assert.equal(reminder.channels.emailCandidate, true);
});

test('first reminder is not due before approval escalation window', () => {
  const reminder = evaluateApprovalReminder(baseAction({ createdAt: '2026-07-06T11:30:00.000Z' }), preferences, now);
  assert.equal(reminder.reminderDue, false);
  assert.equal(reminder.timing.nextReminderAt, '2026-07-06T12:30:00.000Z');
});

test('repeat reminder waits for repeat escalation window after last reminder', () => {
  const reminder = evaluateApprovalReminder(baseAction({ reminderCount: 1, lastReminderAt: '2026-07-06T11:00:00.000Z' }), preferences, now);
  assert.equal(reminder.reminderDue, false);
  assert.equal(reminder.timing.nextReminderAt, '2026-07-06T13:00:00.000Z');
});

test('repeat reminder becomes due after repeat window', () => {
  const reminder = evaluateApprovalReminder(baseAction({ reminderCount: 1, lastReminderAt: '2026-07-06T09:30:00.000Z' }), preferences, now);
  assert.equal(reminder.reminderDue, true);
  assert.equal(reminder.priority, 'elevated');
});

test('max escalations suppresses reminder', () => {
  const reminder = evaluateApprovalReminder(baseAction({ reminderCount: 3, lastReminderAt: '2026-07-06T08:00:00.000Z' }), preferences, now);
  assert.equal(reminder.reminderDue, false);
  assert.equal(reminder.timing.nextReminderAt, null);
});

test('non-approval status is not eligible', () => {
  const reminder = evaluateApprovalReminder(baseAction({ status: 'approved' }), preferences, now);
  assert.equal(reminder.reminderDue, false);
});

test('preview includes only due reminders and safe counts', () => {
  const preview = buildApprovalReminderPreview({
    workspaceId: '33333333-3333-4333-8333-333333333333',
    candidates: [baseAction(), baseAction({ actionId: '44444444-4444-4444-8444-444444444444', createdAt: '2026-07-06T11:50:00.000Z' })],
    preferences,
    now,
  });
  assert.equal(preview.phase, 'phase_10_6_reminder_escalation_logic');
  assert.equal(preview.counts.candidatesEvaluated, 2);
  assert.equal(preview.counts.remindersDue, 1);
  assert.equal(preview.safety.sendsEmailInThisPhase, false);
});

test('reminder output never exposes secrets or payload JSON', () => {
  const preview = buildApprovalReminderPreview({ workspaceId: '33333333-3333-4333-8333-333333333333', candidates: [baseAction()], preferences, now });
  const serialized = JSON.stringify(preview).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'payload_json', 'rollback_payload']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});
