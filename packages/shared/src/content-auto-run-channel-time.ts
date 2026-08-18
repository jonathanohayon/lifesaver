export type SharedContentAutoRunChannelTimeDecision =
  | 'allowed_for_future_auto_run_review'
  | 'blocked_platform_not_allowed'
  | 'blocked_channel_not_allowed'
  | 'blocked_outside_time_window'
  | 'blocked_invalid_time_window'
  | 'blocked_invalid_action_type';

export type SharedContentAutoRunAllowedWindow = {
  label?: string;
  startTime: string;
  endTime: string;
  days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'all'>;
};

export type SharedContentAutoRunChannelTimeSummary = {
  phase: 'phase_11_4_allowed_channels_times';
  healthMode: 'v2-phase-11-4-allowed-channels-times';
  deliverable: 'channel_time_restrictions';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  timezone: string;
  localTime: string;
  allowedPlatforms: string[];
  allowedChannels: string[];
  allowedWindows: SharedContentAutoRunAllowedWindow[];
  restrictionsSatisfied: boolean;
  decision: SharedContentAutoRunChannelTimeDecision;
  autoRunAllowedNow: false;
};

export const CONTENT_AUTO_RUN_CHANNEL_TIME_SHARED_PHASE = 'phase_11_4_allowed_channels_times' as const;
export const CONTENT_AUTO_RUN_CHANNEL_TIME_SHARED_HEALTH_MODE = 'v2-phase-11-4-allowed-channels-times' as const;
export const CONTENT_AUTO_RUN_DEFAULT_ALLOWED_CHANNEL = 'linkedin_member_feed' as const;
export const CONTENT_AUTO_RUN_DEFAULT_ALLOWED_WINDOW = { label: 'default_business_hours', startTime: '09:00', endTime: '18:00', days: ['all'] } as const;
