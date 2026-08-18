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

export type ContentAutoApprovalDecision = 'auto_approved' | 'manual_review_required' | 'blocked';

export type ContentAutoApprovalGateResult = {
  gate: ContentAutoApprovalGateName;
  passed: boolean;
  severity: ContentAutoApprovalGateSeverity;
  reason: string;
  sourceDecision?: string;
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
    styleDecision: string;
    riskDecision: string;
    dailyCapDecision: string;
    channelTimeDecision: string;
    riskLevel: string;
    riskScore: number;
  };
  safeContentSummary: {
    captionCharacters: number;
    hashtagCount: number;
    mediaType: string;
    hasLinkUrl: boolean;
    scheduledTimeProvided: boolean;
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
