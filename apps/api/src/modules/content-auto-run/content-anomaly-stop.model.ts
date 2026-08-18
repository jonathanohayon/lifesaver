import type {
  ContentAnomalyEventInput,
  ContentAnomalySeverity,
  ContentAnomalyStopInput,
  ContentAnomalyStopReason,
  ContentAnomalyStopReasonCode,
  ContentAnomalyStopResult,
  ContentAnomalyStopStatus,
} from './content-anomaly-stop.types.js';

export const CONTENT_ANOMALY_STOP_PHASE = 'phase_11_8_anomaly_stop' as const;
export const CONTENT_ANOMALY_STOP_HEALTH_MODE = 'v2-phase-11-8-anomaly-stop' as const;

export const CONTENT_ANOMALY_STOP_THRESHOLDS = {
  apiFailuresPerHour: 3,
  publishFailuresPerHour: 2,
  consecutiveFailures: 2,
} as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'payload_json',
  'raw_payload',
  'rollback_payload',
  'encrypted_',
  'bearer ',
];

function normalizeString(value: unknown, fallback: string, maxLength = 240): string {
  const normalized = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, maxLength);
}

function normalizeKind(value: unknown): string {
  return normalizeString(value, 'unknown', 80).toLowerCase();
}

function safeDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function reason(code: ContentAnomalyStopReasonCode, severity: ContentAnomalySeverity, message: string, source?: string, occurredAt?: string | null): ContentAnomalyStopReason {
  return {
    code,
    severity,
    message: normalizeString(message, 'Anomaly stop reason recorded.', 260),
    ...(source ? { source: normalizeString(source, 'unknown', 80) } : {}),
    ...(occurredAt !== undefined ? { occurredAt } : {}),
  };
}

function reasonsFromEvent(event: ContentAnomalyEventInput): ContentAnomalyStopReason[] {
  const kind = normalizeKind(event.kind);
  const source = normalizeString(event.source, 'event', 80);
  const occurredAt = safeDate(event.occurredAt);
  const eventCount = safeCount(event.count || 1);
  const message = normalizeString(event.message, 'An anomaly event was detected.', 260);

  if (kind === 'api_failure') {
    return [reason('event_api_failure', 'high', message || 'API failure event detected.', source, occurredAt)];
  }
  if (kind === 'multiple_failures') {
    return [reason('event_multiple_failures', eventCount >= 3 ? 'critical' : 'high', message || 'Multiple failure event detected.', source, occurredAt)];
  }
  if (kind === 'platform_warning') {
    return [reason('event_platform_warning', 'critical', message || 'Platform warning event detected.', source, occurredAt)];
  }
  if (kind === 'cap_exceeded') {
    return [reason('event_cap_exceeded', 'high', message || 'Cap exceeded event detected.', source, occurredAt)];
  }
  return [];
}

export function buildContentAnomalyStopSafety(): ContentAnomalyStopResult['safety'] {
  return {
    anomalyGuardOnly: true,
    doesNotPublish: true,
    doesNotApprove: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    noPauseMutationInThisPhase: true,
    rawPayloadNotReturned: true,
    tokenNotReturned: true,
    secretsNotReturned: true,
  };
}

function buildRecommendedNextSteps(shouldStop: boolean, reasons: ContentAnomalyStopReason[]): string[] {
  if (!shouldStop) {
    return [
      'No anomaly stop is required in this preview.',
      'Keep manual approval and final validation gates active before any future auto-run execution.',
    ];
  }

  const steps = [
    'Treat the content auto-run lane as paused until the anomaly is reviewed.',
    'Review failed action result logs before retrying any content action.',
    'Keep manual approval available while investigating the anomaly.',
  ];

  if (reasons.some((item) => item.code.includes('platform_warning') || item.code === 'platform_rate_limited')) {
    steps.push('Check LinkedIn platform status, app limits, and any warning response before re-enabling the lane.');
  }
  if (reasons.some((item) => item.code.includes('token'))) {
    steps.push('Reconnect LinkedIn credentials before any future publish attempt.');
  }
  if (reasons.some((item) => item.code.includes('cap'))) {
    steps.push('Wait for the cap window to reset or reduce the proposed publishing frequency.');
  }
  return steps;
}

function buildReasonSummary(shouldStop: boolean, reasons: ContentAnomalyStopReason[]): string {
  if (!shouldStop) {
    return 'No anomaly stop is required. No API failure, repeated failure, platform warning, cap breach, or token anomaly was detected.';
  }
  const first = reasons[0];
  return `Content auto-run should stop because ${first.message}`;
}

export function evaluateContentAnomalyStop(input: ContentAnomalyStopInput): ContentAnomalyStopResult {
  const apiFailureCountLastHour = safeCount(input.apiFailureCountLastHour);
  const publishFailureCountLastHour = safeCount(input.publishFailureCountLastHour);
  const consecutiveFailureCount = safeCount(input.consecutiveFailureCount);
  const events = Array.isArray(input.events) ? input.events : [];

  const reasons: ContentAnomalyStopReason[] = [];

  if (input.masterPauseActive) reasons.push(reason('master_pause_active', 'critical', 'Master pause is active. Content auto-run must remain stopped.'));
  if (input.contentPauseActive) reasons.push(reason('content_pause_active', 'critical', 'Content category pause is active. Content auto-run must remain stopped.'));
  if (input.emergencySafeModeActive) reasons.push(reason('emergency_safe_mode_active', 'critical', 'Emergency safe mode is active. Content auto-run must remain stopped.'));
  if (input.dailyCapExceeded) reasons.push(reason('daily_cap_exceeded', 'high', 'Daily content publish cap is exceeded.'));
  if (input.hourlyCapExceeded) reasons.push(reason('hourly_cap_exceeded', 'high', 'Hourly content publish cap is exceeded.'));
  if (input.platformRateLimited) reasons.push(reason('platform_rate_limited', 'high', 'Platform rate limit or 429 condition was detected.'));
  if (apiFailureCountLastHour >= CONTENT_ANOMALY_STOP_THRESHOLDS.apiFailuresPerHour) {
    reasons.push(reason('api_failure_threshold_exceeded', 'high', `API failures in the last hour reached ${apiFailureCountLastHour}.`));
  }
  if (publishFailureCountLastHour >= CONTENT_ANOMALY_STOP_THRESHOLDS.publishFailuresPerHour) {
    reasons.push(reason('publish_failure_threshold_exceeded', 'high', `Publish failures in the last hour reached ${publishFailureCountLastHour}.`));
  }
  if (consecutiveFailureCount >= CONTENT_ANOMALY_STOP_THRESHOLDS.consecutiveFailures) {
    reasons.push(reason('consecutive_failure_threshold_exceeded', 'critical', `Consecutive publish failures reached ${consecutiveFailureCount}.`));
  }
  if (input.platformWarningActive) reasons.push(reason('platform_warning_active', 'critical', 'A platform warning is active.'));
  if (input.tokenExpired) reasons.push(reason('token_expired', 'high', 'LinkedIn token is expired or no longer valid.'));

  for (const event of events) {
    reasons.push(...reasonsFromEvent(event));
  }

  const shouldStopContentAutoRun = reasons.length > 0;
  const contentAutoRunWasAlreadyPaused = input.contentAutoRunEnabled === false || input.masterPauseActive === true || input.contentPauseActive === true || input.emergencySafeModeActive === true;

  return {
    phase: CONTENT_ANOMALY_STOP_PHASE,
    healthMode: CONTENT_ANOMALY_STOP_HEALTH_MODE,
    deliverable: 'anomaly_stop_behavior',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    decision: shouldStopContentAutoRun
      ? contentAutoRunWasAlreadyPaused
        ? 'content_auto_run_paused'
        : 'stop_recommended'
      : 'no_stop_needed',
    shouldStopContentAutoRun,
    contentAutoRunWasAlreadyPaused,
    reason: buildReasonSummary(shouldStopContentAutoRun, reasons),
    reasonCodes: reasons.map((item) => item.code),
    reasons,
    thresholds: { ...CONTENT_ANOMALY_STOP_THRESHOLDS },
    counts: {
      apiFailureCountLastHour,
      publishFailureCountLastHour,
      consecutiveFailureCount,
      eventCount: events.length,
    },
    recommendedNextSteps: buildRecommendedNextSteps(shouldStopContentAutoRun, reasons),
    safety: buildContentAnomalyStopSafety(),
  };
}

export function buildContentAnomalyStopStatus(): ContentAnomalyStopStatus {
  return {
    phase: CONTENT_ANOMALY_STOP_PHASE,
    healthMode: CONTENT_ANOMALY_STOP_HEALTH_MODE,
    enabled: true,
    deliverable: 'anomaly_stop_behavior',
    watches: ['api_failure', 'multiple_failures', 'platform_warning', 'cap_exceeded', 'token_expired'],
    safety: buildContentAnomalyStopSafety(),
  };
}

export function assertContentAnomalyStopSafe(result: ContentAnomalyStopResult): void {
  if (!result.safety.anomalyGuardOnly || !result.safety.doesNotPublish || !result.safety.noDatabaseWrites || !result.safety.noPauseMutationInThisPhase) {
    throw new Error('Content anomaly stop safety flags are invalid.');
  }
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content anomaly stop output contains forbidden fragment: ${forbidden}`);
    }
  }
}
