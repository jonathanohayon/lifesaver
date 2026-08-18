import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_AUTO_RUN_CHANNEL_TIME_HEALTH_MODE,
  CONTENT_AUTO_RUN_CHANNEL_TIME_PHASE,
  assertContentAutoRunChannelTimeSafe,
  buildContentAutoRunChannelTimeStatus,
  checkContentAutoRunChannelTimeRestrictions,
} from './content-auto-run-channel-time.model.js';

test('Phase 11.4 constants are correct', () => {
  assert.equal(CONTENT_AUTO_RUN_CHANNEL_TIME_PHASE, 'phase_11_4_allowed_channels_times');
  assert.equal(CONTENT_AUTO_RUN_CHANNEL_TIME_HEALTH_MODE, 'v2-phase-11-4-allowed-channels-times');
});

test('status describes channel/time restrictions and safety state', () => {
  const status = buildContentAutoRunChannelTimeStatus();
  assert.equal(status.deliverable, 'channel_time_restrictions');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.equal(status.supportedChannel, 'linkedin_member_feed');
  assert.equal(status.supportedActionType, 'content_publish');
  assert.equal(status.safety.restrictionCheckOnly, true);
  assert.equal(status.safety.autoRunEnabled, false);
});

test('allows future auto-run review inside default LinkedIn business window', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'UTC',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
  assert.equal(result.restrictionsSatisfied, true);
  assert.equal(result.withinAllowedWindow, true);
  assert.equal(result.autoRunAllowedNow, false);
});

test('blocks outside allowed publishing window', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'UTC',
    scheduledTime: '2026-07-06T20:00:00.000Z',
  });
  assert.equal(result.decision, 'blocked_outside_time_window');
  assert.equal(result.restrictionsSatisfied, false);
  assert.equal(result.withinAllowedWindow, false);
});

test('blocks unsupported platform', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    platform: 'instagram',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'blocked_platform_not_allowed');
  assert.equal(result.platformAllowed, false);
});

test('blocks unsupported channel', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    channel: 'linkedin_company_page',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'blocked_channel_not_allowed');
  assert.equal(result.channelAllowed, false);
});

test('blocks unsupported action type', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    actionType: 'support_reply_send',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'blocked_invalid_action_type');
});

test('allows configured all-day window when input window covers the time', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    scheduledTime: '2026-07-06T23:30:00.000Z',
    allowedWindows: [{ label: 'all_day_test', startTime: '00:00', endTime: '23:59', days: ['all'] }],
  });
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
  assert.equal(result.matchedWindow?.label, 'all_day_test');
});

test('supports cross-midnight publishing windows', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    scheduledTime: '2026-07-06T23:30:00.000Z',
    allowedWindows: [{ label: 'late_window', startTime: '22:00', endTime: '02:00', days: ['all'] }],
  });
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
  assert.equal(result.matchedWindow?.label, 'late_window');
});

test('blocks invalid time window formats', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    scheduledTime: '2026-07-06T10:00:00.000Z',
    allowedWindows: [{ label: 'bad_window', startTime: '99:00', endTime: '18:00', days: ['all'] }],
  });
  assert.equal(result.decision, 'blocked_invalid_time_window');
});

test('blocks identical start/end time windows', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    scheduledTime: '2026-07-06T10:00:00.000Z',
    allowedWindows: [{ label: 'zero_window', startTime: '09:00', endTime: '09:00', days: ['all'] }],
  });
  assert.equal(result.decision, 'blocked_invalid_time_window');
});

test('honors day-of-week restrictions', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'UTC',
    scheduledTime: '2026-07-06T10:00:00.000Z', // Monday
    allowedWindows: [{ label: 'tuesday_only', startTime: '09:00', endTime: '18:00', days: ['tue'] }],
  });
  assert.equal(result.localDay, 'mon');
  assert.equal(result.decision, 'blocked_outside_time_window');
});

test('normalizes platform and channel casing safely', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    platform: 'LinkedIn',
    channel: 'LINKEDIN_MEMBER_FEED',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
});

test('custom allowed lists can block LinkedIn by configuration', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    allowedPlatforms: ['instagram'],
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.decision, 'blocked_platform_not_allowed');
});

test('timezone conversion uses configured workspace timezone', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'Asia/Karachi',
    scheduledTime: '2026-07-06T05:30:00.000Z',
  });
  assert.equal(result.localTime, '10:30');
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
});

test('invalid timezone safely falls back without throwing', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'Definitely/NotAZone',
    scheduledTime: '2026-07-06T10:00:00.000Z',
  });
  assert.equal(result.localTime, '10:00');
});

test('safety assertion passes for a normal result', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({ scheduledTime: '2026-07-06T10:00:00.000Z' });
  assert.doesNotThrow(() => assertContentAutoRunChannelTimeSafe(result));
});

test('output never marks auto-run allowed now in Phase 11.4', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({ scheduledTime: '2026-07-06T10:00:00.000Z' });
  assert.equal(result.autoRunAllowedNow, false);
  assert.equal(result.safety.manualApprovalStillRequired, true);
});

test('safe output does not contain secret-like fragments', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({
    timezone: 'Asia/Karachi',
    scheduledTime: '2026-07-06T05:30:00.000Z',
  });
  assert.doesNotThrow(() => assertContentAutoRunChannelTimeSafe(result));
});

test('restriction check remains read-only and non-publishing', () => {
  const result = checkContentAutoRunChannelTimeRestrictions({ scheduledTime: '2026-07-06T10:00:00.000Z' });
  assert.equal(result.safety.restrictionCheckOnly, true);
  assert.equal(result.safety.doesNotPublish, true);
  assert.equal(result.safety.externalApiCalled, false);
  assert.equal(result.safety.noDatabaseWrites, true);
});
