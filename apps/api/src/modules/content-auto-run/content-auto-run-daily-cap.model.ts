import type {
  ContentAutoRunDailyCapInput,
  ContentAutoRunDailyCapResult,
  ContentAutoRunDailyCapStatus,
} from './content-auto-run-daily-cap.types.js';

export const CONTENT_AUTO_RUN_DAILY_CAP_PHASE = 'phase_11_3_max_posts_per_day_enforcement' as const;
export const CONTENT_AUTO_RUN_DAILY_CAP_HEALTH_MODE = 'v2-phase-11-3-max-posts-per-day-enforcement' as const;
export const CONTENT_AUTO_RUN_DEFAULT_MAX_POSTS_PER_DAY = 1 as const;

function toFiniteInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeTimezone(value: unknown): string {
  const timezone = String(value || '').trim();
  if (!timezone) return 'UTC';
  // Keep this intentionally conservative. The runtime should not throw for an untrusted timezone string.
  return timezone.length > 80 ? 'UTC' : timezone;
}

export function buildContentAutoRunDailyCapSafety(): ContentAutoRunDailyCapResult['safety'] {
  return {
    capCheckOnly: true,
    autoRunEnabled: false,
    autoApprovalEnabled: false,
    doesNotPublish: true,
    externalApiCalled: false,
    manualApprovalStillRequired: true,
    noDatabaseWrites: true,
    futureAutoRunRequiresAdditionalGates: true,
  };
}

export function checkContentAutoRunDailyPostCap(input: ContentAutoRunDailyCapInput = {}): ContentAutoRunDailyCapResult {
  const platform = String(input.platform || 'linkedin').toLowerCase();
  const actionType = String(input.actionType || 'content_publish').toLowerCase();
  const timezone = normalizeTimezone(input.timezone);
  const maxPostsPerDay = toFiniteInteger(input.maxPostsPerDay, CONTENT_AUTO_RUN_DEFAULT_MAX_POSTS_PER_DAY);
  const publishedTodayCount = toFiniteInteger(input.publishedTodayCount, 0);
  const reservedTodayCount = toFiniteInteger(input.reservedTodayCount, 0);
  const proposedNewPosts = Math.max(1, toFiniteInteger(input.proposedNewPosts, 1));
  const projectedTotalToday = publishedTodayCount + reservedTodayCount + proposedNewPosts;
  const remainingToday = Math.max(0, maxPostsPerDay - publishedTodayCount - reservedTodayCount);

  let decision: ContentAutoRunDailyCapResult['decision'] = 'allowed_for_future_auto_run_review';
  let reason = 'Projected content volume is within the daily cap for the future narrow auto-run lane.';

  if (maxPostsPerDay <= 0) {
    decision = 'blocked_invalid_cap';
    reason = 'Daily post cap is zero, so future content auto-run is completely blocked.';
  } else if (projectedTotalToday > maxPostsPerDay) {
    decision = 'blocked_daily_cap_exceeded';
    reason = 'Projected content volume would exceed the configured daily post cap.';
  }

  if (platform !== 'linkedin') {
    decision = 'blocked_invalid_cap';
    reason = 'Phase 11.3 daily content auto-run cap check currently supports LinkedIn only.';
  }

  if (actionType !== 'content_publish') {
    decision = 'blocked_invalid_cap';
    reason = 'Phase 11.3 daily content auto-run cap check only supports content_publish actions.';
  }

  const capExceeded = decision === 'blocked_daily_cap_exceeded' || decision === 'blocked_invalid_cap';

  return {
    phase: CONTENT_AUTO_RUN_DAILY_CAP_PHASE,
    healthMode: CONTENT_AUTO_RUN_DAILY_CAP_HEALTH_MODE,
    deliverable: 'daily_post_cap_check',
    platform: 'linkedin',
    actionType: 'content_publish',
    capWindow: 'calendar_day_by_workspace_timezone',
    timezone,
    maxPostsPerDay,
    publishedTodayCount,
    reservedTodayCount,
    proposedNewPosts,
    projectedTotalToday,
    remainingToday,
    capExceeded,
    decision,
    reason,
    autoRunAllowedNow: false,
    safety: buildContentAutoRunDailyCapSafety(),
  };
}

export function buildContentAutoRunDailyCapStatus(): ContentAutoRunDailyCapStatus {
  return {
    phase: CONTENT_AUTO_RUN_DAILY_CAP_PHASE,
    healthMode: CONTENT_AUTO_RUN_DAILY_CAP_HEALTH_MODE,
    enabled: true,
    deliverable: 'daily_post_cap_check',
    supportedPlatform: 'linkedin',
    supportedActionType: 'content_publish',
    capWindow: 'calendar_day_by_workspace_timezone',
    defaultMaxPostsPerDay: CONTENT_AUTO_RUN_DEFAULT_MAX_POSTS_PER_DAY,
    safety: buildContentAutoRunDailyCapSafety(),
  };
}

export function assertContentAutoRunDailyCapSafe(result: ContentAutoRunDailyCapResult): void {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of [
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
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Daily cap check output contains forbidden fragment: ${forbidden}`);
    }
  }

  if (!result.safety.capCheckOnly || result.safety.autoRunEnabled || result.safety.autoApprovalEnabled || !result.safety.manualApprovalStillRequired || result.autoRunAllowedNow) {
    throw new Error('Daily cap check safety flags are invalid for Phase 11.3.');
  }
}
