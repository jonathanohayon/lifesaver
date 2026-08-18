export type ContentAutoRunDailyCapDecision = 'allowed_for_future_auto_run_review' | 'blocked_daily_cap_exceeded' | 'blocked_invalid_cap';

export type ContentAutoRunDailyCapInput = {
  workspaceId?: string;
  platform?: 'linkedin' | string;
  actionType?: 'content_publish' | string;
  timezone?: string;
  maxPostsPerDay?: number;
  publishedTodayCount?: number;
  reservedTodayCount?: number;
  proposedNewPosts?: number;
};

export type ContentAutoRunDailyCapResult = {
  phase: 'phase_11_3_max_posts_per_day_enforcement';
  healthMode: 'v2-phase-11-3-max-posts-per-day-enforcement';
  deliverable: 'daily_post_cap_check';
  platform: 'linkedin';
  actionType: 'content_publish';
  capWindow: 'calendar_day_by_workspace_timezone';
  timezone: string;
  maxPostsPerDay: number;
  publishedTodayCount: number;
  reservedTodayCount: number;
  proposedNewPosts: number;
  projectedTotalToday: number;
  remainingToday: number;
  capExceeded: boolean;
  decision: ContentAutoRunDailyCapDecision;
  reason: string;
  autoRunAllowedNow: false;
  safety: {
    capCheckOnly: true;
    autoRunEnabled: false;
    autoApprovalEnabled: false;
    doesNotPublish: true;
    externalApiCalled: false;
    manualApprovalStillRequired: true;
    noDatabaseWrites: true;
    futureAutoRunRequiresAdditionalGates: true;
  };
};

export type ContentAutoRunDailyCapStatus = {
  phase: 'phase_11_3_max_posts_per_day_enforcement';
  healthMode: 'v2-phase-11-3-max-posts-per-day-enforcement';
  enabled: true;
  deliverable: 'daily_post_cap_check';
  supportedPlatform: 'linkedin';
  supportedActionType: 'content_publish';
  capWindow: 'calendar_day_by_workspace_timezone';
  defaultMaxPostsPerDay: number;
  safety: ContentAutoRunDailyCapResult['safety'];
};
