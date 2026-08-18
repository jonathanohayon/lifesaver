export type ContentAnomalyKind =
  | 'api_failure'
  | 'multiple_failures'
  | 'platform_warning'
  | 'cap_exceeded'
  | 'token_expired'
  | 'unknown';

export type ContentAnomalySeverity = 'info' | 'warning' | 'high' | 'critical';

export type ContentAnomalyEventInput = {
  kind: ContentAnomalyKind | string;
  message?: string;
  occurredAt?: string;
  count?: number;
  platform?: 'linkedin' | string;
  channel?: 'linkedin_member_feed' | string;
  actionId?: string;
  source?: string;
  safeMetadata?: Record<string, unknown>;
};

export type ContentAnomalyStopInput = {
  workspaceId?: string;
  platform?: 'linkedin' | string;
  channel?: 'linkedin_member_feed' | string;
  currentTime?: string;
  contentAutoRunEnabled?: boolean;
  masterPauseActive?: boolean;
  contentPauseActive?: boolean;
  emergencySafeModeActive?: boolean;
  dailyCapExceeded?: boolean;
  hourlyCapExceeded?: boolean;
  platformRateLimited?: boolean;
  apiFailureCountLastHour?: number;
  publishFailureCountLastHour?: number;
  consecutiveFailureCount?: number;
  platformWarningActive?: boolean;
  tokenExpired?: boolean;
  events?: ContentAnomalyEventInput[];
};

export type ContentAnomalyStopReasonCode =
  | 'master_pause_active'
  | 'content_pause_active'
  | 'emergency_safe_mode_active'
  | 'daily_cap_exceeded'
  | 'hourly_cap_exceeded'
  | 'platform_rate_limited'
  | 'api_failure_threshold_exceeded'
  | 'publish_failure_threshold_exceeded'
  | 'consecutive_failure_threshold_exceeded'
  | 'platform_warning_active'
  | 'token_expired'
  | 'event_api_failure'
  | 'event_multiple_failures'
  | 'event_platform_warning'
  | 'event_cap_exceeded';

export type ContentAnomalyStopReason = {
  code: ContentAnomalyStopReasonCode;
  severity: ContentAnomalySeverity;
  message: string;
  source?: string;
  occurredAt?: string | null;
};

export type ContentAnomalyStopDecision = 'no_stop_needed' | 'stop_recommended' | 'content_auto_run_paused';

export type ContentAnomalyStopResult = {
  phase: 'phase_11_8_anomaly_stop';
  healthMode: 'v2-phase-11-8-anomaly-stop';
  deliverable: 'anomaly_stop_behavior';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  decision: ContentAnomalyStopDecision;
  shouldStopContentAutoRun: boolean;
  contentAutoRunWasAlreadyPaused: boolean;
  reason: string;
  reasonCodes: ContentAnomalyStopReasonCode[];
  reasons: ContentAnomalyStopReason[];
  thresholds: {
    apiFailuresPerHour: number;
    publishFailuresPerHour: number;
    consecutiveFailures: number;
  };
  counts: {
    apiFailureCountLastHour: number;
    publishFailureCountLastHour: number;
    consecutiveFailureCount: number;
    eventCount: number;
  };
  recommendedNextSteps: string[];
  safety: {
    anomalyGuardOnly: true;
    doesNotPublish: true;
    doesNotApprove: true;
    externalApiCalled: false;
    noDatabaseWrites: true;
    noPauseMutationInThisPhase: true;
    rawPayloadNotReturned: true;
    tokenNotReturned: true;
    secretsNotReturned: true;
  };
};

export type ContentAnomalyStopStatus = {
  phase: ContentAnomalyStopResult['phase'];
  healthMode: ContentAnomalyStopResult['healthMode'];
  enabled: true;
  deliverable: ContentAnomalyStopResult['deliverable'];
  watches: ['api_failure', 'multiple_failures', 'platform_warning', 'cap_exceeded', 'token_expired'];
  safety: ContentAnomalyStopResult['safety'];
};
