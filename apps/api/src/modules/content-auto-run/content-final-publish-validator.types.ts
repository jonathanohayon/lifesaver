import type { ContentAutoApprovalDecisionInput, ContentAutoApprovalDecisionRecord } from './content-auto-approval-decision.types.js';

export type ContentFinalPublishValidationGateName =
  | 'auto_approval_decision_auto_approved'
  | 'rule_still_enabled'
  | 'master_pause_off'
  | 'content_pause_off'
  | 'emergency_safe_mode_off'
  | 'token_connected'
  | 'token_not_expired'
  | 'required_scope_present'
  | 'cap_not_exceeded'
  | 'content_safe'
  | 'channel_time_allowed'
  | 'platform_supported'
  | 'media_type_allowed';

export type ContentFinalPublishValidationGateResult = {
  gate: ContentFinalPublishValidationGateName;
  passed: boolean;
  reason: string;
  sourceDecision?: string;
};

export type ContentFinalPublishValidationDecision = 'ready_for_executor_handoff' | 'blocked_before_publish';

export type ContentFinalPublishValidatorInput = ContentAutoApprovalDecisionInput & {
  ruleStillEnabled?: boolean;
  tokenConnected?: boolean;
  tokenExpiresAt?: string | null;
  tokenHasRequiredScope?: boolean;
  requiredScope?: string;
  currentTime?: string;
};

export type ContentFinalPublishValidationResult = {
  phase: 'phase_11_6_pre_publish_final_validation';
  healthMode: 'v2-phase-11-6-pre-publish-final-validation';
  deliverable: 'final_publish_validator';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  actionType: 'content_publish';
  decision: ContentFinalPublishValidationDecision;
  readyForExecutorHandoff: boolean;
  autoPublishExecuted: false;
  publishCalled: false;
  externalApiCalled: false;
  reason: string;
  requiredScope: string;
  tokenStatusSummary: {
    tokenConnected: boolean;
    tokenExpiresAt: string | null;
    tokenExpired: boolean;
    requiredScopePresent: boolean;
    rawTokenReturned: false;
  };
  gates: ContentFinalPublishValidationGateResult[];
  gateSummary: {
    totalGates: number;
    passedGates: number;
    failedGates: number;
  };
  autoApprovalDecisionSnapshot: {
    finalDecision: ContentAutoApprovalDecisionRecord['finalDecision'];
    matchedPolicyRuleKey: string | null;
    riskLevel: ContentAutoApprovalDecisionRecord['policyDecisionSnapshot']['riskLevel'];
    riskScore: number;
    dailyCapDecision: ContentAutoApprovalDecisionRecord['policyDecisionSnapshot']['dailyCapDecision'];
    channelTimeDecision: ContentAutoApprovalDecisionRecord['policyDecisionSnapshot']['channelTimeDecision'];
  };
  safety: {
    validatorOnly: true;
    doesNotPublish: true;
    externalApiCalled: false;
    noDatabaseWrites: true;
    noActionStatusMutation: true;
    noTokenDecryption: true;
    rawTokenNotReturned: true;
    rawPayloadNotReturned: true;
    finalGateBeforeAnyFutureExecutor: true;
  };
};

export type ContentFinalPublishValidationStatus = {
  phase: ContentFinalPublishValidationResult['phase'];
  healthMode: ContentFinalPublishValidationResult['healthMode'];
  enabled: true;
  deliverable: ContentFinalPublishValidationResult['deliverable'];
  supportedPlatform: 'linkedin';
  supportedChannel: 'linkedin_member_feed';
  supportedActionType: 'content_publish';
  requiredScope: string;
  requiredGateNames: ContentFinalPublishValidationGateName[];
  safety: ContentFinalPublishValidationResult['safety'];
};
