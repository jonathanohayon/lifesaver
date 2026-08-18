export type SupportFaqAutoReplyDecision =
  | 'eligible_future_auto_reply_manual_gate_active'
  | 'blocked_unsupported_action_type'
  | 'blocked_unsupported_provider'
  | 'blocked_non_faq_category'
  | 'blocked_low_confidence'
  | 'blocked_ticket_not_low_risk'
  | 'blocked_missing_or_exceeded_cap'
  | 'blocked_missing_explicit_rule'
  | 'blocked_bulk_send'
  | 'blocked_thread_not_verified';

export type SupportFaqRiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface SupportFaqAutoReplyExplicitRuleInput {
  id?: string | null;
  name?: string | null;
  enabled?: boolean;
  actionType?: string | null;
  provider?: string | null;
  category?: string | null;
  decision?: 'ask' | 'auto_approve' | 'block' | string | null;
  allowAutoReply?: boolean;
  minConfidenceScore?: number | null;
  maxRiskLevel?: SupportFaqRiskLevel | string | null;
}

export interface SupportFaqAutoReplyCapInput {
  maxSupportAutoRepliesPerDay?: number | null;
  sentSupportAutoRepliesToday?: number | null;
  maxSupportAutoRepliesPerHour?: number | null;
  sentSupportAutoRepliesThisHour?: number | null;
}

export interface SupportFaqAutoReplyPolicyInput {
  actionType?: string | null;
  provider?: string | null;
  category?: string | null;
  confidenceScore?: number | null;
  riskLevel?: SupportFaqRiskLevel | string | null;
  sensitiveFlag?: boolean | null;
  escalationRequired?: boolean | null;
  recipientCount?: number | null;
  threadAssociationVerified?: boolean | null;
  explicitRule?: SupportFaqAutoReplyExplicitRuleInput | null;
  capUsage?: SupportFaqAutoReplyCapInput | null;
}

export interface SupportFaqAutoReplyPolicyChecks {
  actionTypeIsSupportReplySend: boolean;
  providerIsGmail: boolean;
  categoryIsFaq: boolean;
  confidenceHigh: boolean;
  ticketLowRisk: boolean;
  sensitiveFlagOff: boolean;
  escalationNotRequired: boolean;
  capConfigured: boolean;
  capNotExceeded: boolean;
  explicitRulePresent: boolean;
  explicitRuleEnabled: boolean;
  explicitRuleAllowsAutoReply: boolean;
  explicitRuleDecisionAutoApprove: boolean;
  explicitRuleScopeMatches: boolean;
  singleRecipientOnly: boolean;
  threadAssociationVerified: boolean;
}

export interface SupportFaqAutoReplyPolicyStatus {
  phase: 'V2 Phase 13.5 — FAQ Auto-Reply Policy';
  healthMode: 'v2-phase-13-5-faq-auto-reply-policy';
  deliverable: 'faq_auto_reply_policy';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  evaluationOnly: true;
  autoSendEnabledNow: false;
  manualApprovalStillRequiredThisPhase: true;
  requiredCategory: 'faq';
  minimumConfidenceScore: number;
  requiredRiskLevel: 'low';
  requiresExplicitRule: true;
  requiresCapNotExceeded: true;
  requiresThreadAssociation: true;
  bulkSendAllowed: false;
  previewCallsGmail: false;
  previewSendsEmail: false;
  rawProviderPayloadReturned: false;
  rawTokenReturned: false;
  rawMimeReturned: false;
  nextStep: 'Phase 13.6 — No Bulk Sends';
}

export interface SupportFaqAutoReplyPolicyResult {
  version: '0.7.0';
  phase: 'phase_13_5_faq_auto_reply_policy';
  healthMode: 'v2-phase-13-5-faq-auto-reply-policy';
  deliverable: 'faq_auto_reply_policy';
  selectedConnector: 'gmail';
  actionType: string | null;
  provider: string;
  category: string | null;
  confidenceScore: number | null;
  riskLevel: string | null;
  eligibleForFutureAutoReply: boolean;
  autoSendNow: false;
  decision: SupportFaqAutoReplyDecision;
  checks: SupportFaqAutoReplyPolicyChecks;
  blockers: string[];
  warnings: string[];
  policySummary: {
    explicitRuleId: string | null;
    explicitRuleName: string | null;
    minimumConfidenceScore: number;
    maxSupportAutoRepliesPerDay: number | null;
    sentSupportAutoRepliesToday: number | null;
    maxSupportAutoRepliesPerHour: number | null;
    sentSupportAutoRepliesThisHour: number | null;
  };
  safeSummary: string;
  safety: {
    evaluationOnly: true;
    autoSendEnabledNow: false;
    manualApprovalStillRequiredThisPhase: true;
    emailSent: false;
    gmailApiCalled: false;
    bulkSendAllowed: false;
    rawProviderPayloadReturned: false;
    rawTokenReturned: false;
    rawMimeReturned: false;
    note: string;
  };
}
