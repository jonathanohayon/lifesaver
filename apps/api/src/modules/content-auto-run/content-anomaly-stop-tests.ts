import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_ANOMALY_STOP_HEALTH_MODE,
  CONTENT_ANOMALY_STOP_PHASE,
  CONTENT_ANOMALY_STOP_THRESHOLDS,
  assertContentAnomalyStopSafe,
  buildContentAnomalyStopStatus,
  evaluateContentAnomalyStop,
} from './content-anomaly-stop.model.js';

test('Phase 11.8 constants are correct', () => {
  assert.equal(CONTENT_ANOMALY_STOP_PHASE, 'phase_11_8_anomaly_stop');
  assert.equal(CONTENT_ANOMALY_STOP_HEALTH_MODE, 'v2-phase-11-8-anomaly-stop');
});

test('status describes anomaly stop behavior', () => {
  const status = buildContentAnomalyStopStatus();
  assert.equal(status.deliverable, 'anomaly_stop_behavior');
  assert.equal(status.watches.includes('api_failure'), true);
  assert.equal(status.watches.includes('platform_warning'), true);
  assert.equal(status.safety.anomalyGuardOnly, true);
});

test('clean lane returns no_stop_needed', () => {
  const result = evaluateContentAnomalyStop({ contentAutoRunEnabled: true });
  assert.equal(result.decision, 'no_stop_needed');
  assert.equal(result.shouldStopContentAutoRun, false);
  assert.equal(result.reasons.length, 0);
});

test('master pause stops lane and records already paused', () => {
  const result = evaluateContentAnomalyStop({ masterPauseActive: true, contentAutoRunEnabled: true });
  assert.equal(result.shouldStopContentAutoRun, true);
  assert.equal(result.contentAutoRunWasAlreadyPaused, true);
  assert.equal(result.decision, 'content_auto_run_paused');
  assert.equal(result.reasonCodes.includes('master_pause_active'), true);
});

test('content pause stops lane', () => {
  const result = evaluateContentAnomalyStop({ contentPauseActive: true });
  assert.equal(result.reasonCodes.includes('content_pause_active'), true);
  assert.equal(result.decision, 'content_auto_run_paused');
});

test('emergency safe mode stops lane', () => {
  const result = evaluateContentAnomalyStop({ emergencySafeModeActive: true });
  assert.equal(result.reasonCodes.includes('emergency_safe_mode_active'), true);
  assert.equal(result.reasons[0].severity, 'critical');
});

test('daily cap exceeded triggers stop recommendation', () => {
  const result = evaluateContentAnomalyStop({ dailyCapExceeded: true, contentAutoRunEnabled: true });
  assert.equal(result.decision, 'stop_recommended');
  assert.equal(result.reasonCodes.includes('daily_cap_exceeded'), true);
});

test('hourly cap exceeded triggers stop recommendation', () => {
  const result = evaluateContentAnomalyStop({ hourlyCapExceeded: true, contentAutoRunEnabled: true });
  assert.equal(result.reasonCodes.includes('hourly_cap_exceeded'), true);
});

test('platform rate limit triggers stop recommendation', () => {
  const result = evaluateContentAnomalyStop({ platformRateLimited: true });
  assert.equal(result.reasonCodes.includes('platform_rate_limited'), true);
  assert.equal(result.recommendedNextSteps.some((step) => step.includes('LinkedIn platform')), true);
});

test('api failure threshold triggers stop', () => {
  const result = evaluateContentAnomalyStop({ apiFailureCountLastHour: CONTENT_ANOMALY_STOP_THRESHOLDS.apiFailuresPerHour });
  assert.equal(result.reasonCodes.includes('api_failure_threshold_exceeded'), true);
  assert.equal(result.counts.apiFailureCountLastHour, CONTENT_ANOMALY_STOP_THRESHOLDS.apiFailuresPerHour);
});

test('publish failure threshold triggers stop', () => {
  const result = evaluateContentAnomalyStop({ publishFailureCountLastHour: CONTENT_ANOMALY_STOP_THRESHOLDS.publishFailuresPerHour });
  assert.equal(result.reasonCodes.includes('publish_failure_threshold_exceeded'), true);
});

test('consecutive failure threshold is critical', () => {
  const result = evaluateContentAnomalyStop({ consecutiveFailureCount: CONTENT_ANOMALY_STOP_THRESHOLDS.consecutiveFailures });
  const reason = result.reasons.find((item) => item.code === 'consecutive_failure_threshold_exceeded');
  assert.equal(reason?.severity, 'critical');
});

test('platform warning active triggers stop', () => {
  const result = evaluateContentAnomalyStop({ platformWarningActive: true });
  assert.equal(result.reasonCodes.includes('platform_warning_active'), true);
});

test('token expired triggers reconnect next step', () => {
  const result = evaluateContentAnomalyStop({ tokenExpired: true });
  assert.equal(result.reasonCodes.includes('token_expired'), true);
  assert.equal(result.recommendedNextSteps.some((step) => step.includes('Reconnect LinkedIn')), true);
});

test('api failure event triggers stop', () => {
  const result = evaluateContentAnomalyStop({
    events: [{ kind: 'api_failure', message: 'API failed safely', occurredAt: '2026-07-06T12:00:00.000Z', source: 'test' }],
  });
  assert.equal(result.reasonCodes.includes('event_api_failure'), true);
  assert.equal(result.reasons[0].occurredAt, '2026-07-06T12:00:00.000Z');
});

test('multiple failures event triggers stop', () => {
  const result = evaluateContentAnomalyStop({ events: [{ kind: 'multiple_failures', count: 4, message: 'Several failures' }] });
  assert.equal(result.reasonCodes.includes('event_multiple_failures'), true);
});

test('platform warning event triggers stop', () => {
  const result = evaluateContentAnomalyStop({ events: [{ kind: 'platform_warning', message: 'Platform warning' }] });
  assert.equal(result.reasonCodes.includes('event_platform_warning'), true);
});

test('cap exceeded event triggers stop', () => {
  const result = evaluateContentAnomalyStop({ events: [{ kind: 'cap_exceeded', message: 'Cap hit' }] });
  assert.equal(result.reasonCodes.includes('event_cap_exceeded'), true);
});

test('unknown events are ignored safely', () => {
  const result = evaluateContentAnomalyStop({ events: [{ kind: 'unknown', message: 'Ignore me' }] });
  assert.equal(result.shouldStopContentAutoRun, false);
});

test('multiple reasons are all retained', () => {
  const result = evaluateContentAnomalyStop({ dailyCapExceeded: true, platformRateLimited: true, tokenExpired: true });
  assert.equal(result.reasons.length, 3);
  assert.equal(result.reasonCodes.includes('daily_cap_exceeded'), true);
  assert.equal(result.reasonCodes.includes('platform_rate_limited'), true);
  assert.equal(result.reasonCodes.includes('token_expired'), true);
});

test('result is safe and does not mutate pause in this phase', () => {
  const result = evaluateContentAnomalyStop({ dailyCapExceeded: true });
  assert.equal(result.safety.doesNotPublish, true);
  assert.equal(result.safety.noDatabaseWrites, true);
  assert.equal(result.safety.noPauseMutationInThisPhase, true);
  assert.doesNotThrow(() => assertContentAnomalyStopSafe(result));
});

test('safe assertion rejects secret-like output', () => {
  const result = evaluateContentAnomalyStop({ dailyCapExceeded: true });
  result.reasons[0].message = 'contains access_token accidentally';
  assert.throws(() => assertContentAnomalyStopSafe(result), /forbidden fragment/);
});

test('negative and invalid counts normalize to zero', () => {
  const result = evaluateContentAnomalyStop({ apiFailureCountLastHour: -5, publishFailureCountLastHour: Number.NaN, consecutiveFailureCount: -1 });
  assert.equal(result.counts.apiFailureCountLastHour, 0);
  assert.equal(result.counts.publishFailureCountLastHour, 0);
  assert.equal(result.counts.consecutiveFailureCount, 0);
  assert.equal(result.shouldStopContentAutoRun, false);
});

test('contentAutoRunEnabled false marks lane already paused when anomaly exists', () => {
  const result = evaluateContentAnomalyStop({ contentAutoRunEnabled: false, dailyCapExceeded: true });
  assert.equal(result.contentAutoRunWasAlreadyPaused, true);
  assert.equal(result.decision, 'content_auto_run_paused');
});
