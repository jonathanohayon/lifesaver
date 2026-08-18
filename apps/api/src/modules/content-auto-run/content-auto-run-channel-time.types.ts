export type ContentAutoRunAllowedDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'all';

export type ContentAutoRunAllowedWindow = {
  label?: string;
  startTime: string;
  endTime: string;
  days?: ContentAutoRunAllowedDay[];
};

export type ContentAutoRunChannelTimeDecision =
  | 'allowed_for_future_auto_run_review'
  | 'blocked_platform_not_allowed'
  | 'blocked_channel_not_allowed'
  | 'blocked_outside_time_window'
  | 'blocked_invalid_time_window'
  | 'blocked_invalid_action_type';

export type ContentAutoRunChannelTimeInput = {
  workspaceId?: string;
  platform?: 'linkedin' | string;
  channel?: 'linkedin_member_feed' | string;
  actionType?: 'content_publish' | string;
  timezone?: string;
  currentTime?: string;
  scheduledTime?: string;
  allowedPlatforms?: string[];
  allowedChannels?: string[];
  allowedWindows?: ContentAutoRunAllowedWindow[];
};

export type ContentAutoRunChannelTimeResult = {
  phase: 'phase_11_4_allowed_channels_times';
  healthMode: 'v2-phase-11-4-allowed-channels-times';
  deliverable: 'channel_time_restrictions';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  actionType: 'content_publish';
  timezone: string;
  referenceTime: string;
  localTime: string;
  localDay: ContentAutoRunAllowedDay;
  allowedPlatforms: string[];
  allowedChannels: string[];
  allowedWindows: ContentAutoRunAllowedWindow[];
  matchedWindow: ContentAutoRunAllowedWindow | null;
  platformAllowed: boolean;
  channelAllowed: boolean;
  withinAllowedWindow: boolean;
  restrictionsSatisfied: boolean;
  decision: ContentAutoRunChannelTimeDecision;
  reason: string;
  autoRunAllowedNow: false;
  safety: {
    restrictionCheckOnly: true;
    autoRunEnabled: false;
    autoApprovalEnabled: false;
    doesNotPublish: true;
    externalApiCalled: false;
    manualApprovalStillRequired: true;
    noDatabaseWrites: true;
    futureAutoRunRequiresAdditionalGates: true;
  };
};

export type ContentAutoRunChannelTimeStatus = {
  phase: 'phase_11_4_allowed_channels_times';
  healthMode: 'v2-phase-11-4-allowed-channels-times';
  enabled: true;
  deliverable: 'channel_time_restrictions';
  supportedPlatform: 'linkedin';
  supportedChannel: 'linkedin_member_feed';
  supportedActionType: 'content_publish';
  defaultTimezone: 'UTC';
  defaultAllowedPlatforms: string[];
  defaultAllowedChannels: string[];
  defaultAllowedWindows: ContentAutoRunAllowedWindow[];
  safety: ContentAutoRunChannelTimeResult['safety'];
};
