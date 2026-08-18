export type SharedContentAutoRunDailyCapDecision =
  | 'allowed_for_future_auto_run_review'
  | 'blocked_daily_cap_exceeded'
  | 'blocked_invalid_cap';

export type SharedContentAutoRunDailyCapSummary = {
  phase: 'phase_11_3_max_posts_per_day_enforcement';
  healthMode: 'v2-phase-11-3-max-posts-per-day-enforcement';
  deliverable: 'daily_post_cap_check';
  platform: 'linkedin';
  actionType: 'content_publish';
  maxPostsPerDay: number;
  projectedTotalToday: number;
  remainingToday: number;
  capExceeded: boolean;
  decision: SharedContentAutoRunDailyCapDecision;
  autoRunAllowedNow: false;
};

export const CONTENT_AUTO_RUN_DAILY_CAP_SHARED_PHASE = 'phase_11_3_max_posts_per_day_enforcement' as const;
export const CONTENT_AUTO_RUN_DAILY_CAP_SHARED_HEALTH_MODE = 'v2-phase-11-3-max-posts-per-day-enforcement' as const;
export const CONTENT_AUTO_RUN_DAILY_CAP_DEFAULT_MAX_POSTS_PER_DAY = 1 as const;
