import type { ApprovedContentStyleEvaluation } from './approved-content-style-profile.types.js';
import type { ContentRiskLevel, ContentRiskScoreResult } from './content-risk-score.types.js';
import type { ContentAutoRunDailyCapResult } from './content-auto-run-daily-cap.types.js';
import type { ContentAutoRunChannelTimeResult, ContentAutoRunAllowedWindow } from './content-auto-run-channel-time.types.js';

export type ContentAutoApprovalGateName =
  | 'policy_auto_approval_rule_matched'
  | 'master_pause_off'
  | 'content_pause_off'
  | 'emergency_safe_mode_off'
  | 'action_type_supported'
  | 'platform_supported'
  | 'style_profile_matched'
  | 'risk_score_eligible'
  | 'daily_post_cap_available'
  | 'channel_time_allowed'
  | 'media_type_allowed';

export type ContentAutoApprovalGateSeverity = 'pass' | 'ask' | 'block';

export type ContentAutoApprovalGateResult = {
  gate: ContentAutoApprovalGateName;
  passed: boolean;
  severity: ContentAutoApprovalGateSeverity;
  reason: string;
  sourceDecision?: string;
};

export type ContentAutoApprovalDecision =
  | 'auto_approved'
  | 'manual_review_required'
  | 'blocked';

export type ContentAutoApprovalDecisionInput = {
  workspaceId?: string;
  actionId?: string;
  actionType?: 'content_publish' | string;
  platform?: 'linkedin' | string;
  channel?: 'linkedin_member_feed' | string;
  caption: string;
  hashtags?: string[];
  mediaType?: 'none' | 'link' | 'image' | 'video' | 'document' | string;
  linkUrl?: string;
  offerSourceAttached?: boolean;
  verifiedMetricSourceAttached?: boolean;
  complianceNoteAttached?: boolean;
  policyAutoApprovalRuleMatched?: boolean;
  masterPauseActive?: boolean;
  contentPauseActive?: boolean;
  emergencySafeModeActive?: boolean;
  timezone?: string;
  currentTime?: string;
  scheduledTime?: string;
  maxPostsPerDay?: number;
  publishedTodayCount?: number;
  reservedTodayCount?: number;
  proposedNewPosts?: number;
  allowedPlatforms?: string[];
  allowedChannels?: string[];
  allowedWindows?: ContentAutoRunAllowedWindow[];
};

export type ContentAutoApprovalDecisionRecord = {
  phase: 'phase_11_5_auto_approval_decision';
  healthMode: 'v2-phase-11-5-auto-approval-decision';
  deliverable: 'auto_approval_decision_record';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  actionType: 'content_publish';
  finalDecision: ContentAutoApprovalDecision;
  autoApproved: boolean;
  autoPublishAllowedNow: false;
  decisionRecordedInDatabase: false;
  reason: string;
  matchedPolicyRuleKey: string | null;
  gates: ContentAutoApprovalGateResult[];
  gateSummary: {
    totalGates: number;
    passedGates: number;
    failedGates: number;
    blockingFailures: number;
    askFailures: number;
  };
  policyDecisionSnapshot: {
    decision: ContentAutoApprovalDecision;
    reason: string;
    evaluatedAt: string;
    matchedPolicyRuleKey: string | null;
    styleDecision: ApprovedContentStyleEvaluation['decision'];
    riskDecision: ContentRiskScoreResult['decision'];
    dailyCapDecision: ContentAutoRunDailyCapResult['decision'];
    channelTimeDecision: ContentAutoRunChannelTimeResult['decision'];
    riskLevel: ContentRiskLevel;
    riskScore: number;
  };
  safeContentSummary: {
    captionCharacters: number;
    hashtagCount: number;
    mediaType: string;
    hasLinkUrl: boolean;
    scheduledTimeProvided: boolean;
  };
  componentResults: {
    style: ApprovedContentStyleEvaluation;
    risk: ContentRiskScoreResult;
    dailyCap: ContentAutoRunDailyCapResult;
    channelTime: ContentAutoRunChannelTimeResult;
  };
  safety: {
    decisionRecordOnly: true;
    autoApprovalDecisionCanBeReturned: true;
    autoPublishEnabled: false;
    doesNotPublish: true;
    externalApiCalled: false;
    noDatabaseWrites: true;
    doesNotMutateActionStatus: true;
    noTokenAccess: true;
    rawPayloadNotReturned: true;
    futureExecutorGateStillRequired: true;
  };
};

export type ContentAutoApprovalDecisionStatus = {
  phase: ContentAutoApprovalDecisionRecord['phase'];
  healthMode: ContentAutoApprovalDecisionRecord['healthMode'];
  enabled: true;
  deliverable: ContentAutoApprovalDecisionRecord['deliverable'];
  supportedPlatform: 'linkedin';
  supportedChannel: 'linkedin_member_feed';
  supportedActionType: 'content_publish';
  requiredGateNames: ContentAutoApprovalGateName[];
  safety: ContentAutoApprovalDecisionRecord['safety'];
};
