export type SupportRollbackPolicyResultStatus = 'success' | 'failed' | 'blocked' | 'unknown';
export type SupportRollbackPolicyProvider = 'gmail';
export type SupportRollbackPolicyDecision =
  | 'draft_correction_follow_up'
  | 'draft_apology_follow_up'
  | 'mark_for_human_review'
  | 'retry_or_human_review'
  | 'no_customer_follow_up_needed';

export type SupportRollbackReason =
  | 'wrong_information'
  | 'wrong_customer'
  | 'tone_issue'
  | 'missing_context'
  | 'sent_by_mistake'
  | 'escalation_after_send'
  | 'api_failed'
  | 'customer_unhappy'
  | 'legal_sensitive'
  | 'refund_or_payment'
  | 'generic_correction'
  | 'unknown';

export interface SupportRollbackPolicyInput {
  provider?: SupportRollbackPolicyProvider;
  resultStatus?: SupportRollbackPolicyResultStatus;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  sentAt?: string | Date | null;
  ticketId?: string | null;
  ticketCategory?: string | null;
  confidenceScore?: number | null;
  issueReason?: SupportRollbackReason | string | null;
  correctionText?: string | null;
  customerEmail?: string | null;
  originalReplyPreview?: string | null;
  failureReason?: string | null;
  humanReviewAlreadyQueued?: boolean | null;
  supportSendResultLog?: unknown;
}

export interface SupportRollbackPolicyChecks {
  providerIsGmail: boolean;
  emailUndoSupported: false;
  externalMessageIdKnown: boolean;
  threadIdKnown: boolean;
  sentTimestampKnown: boolean;
  resultStatusKnown: boolean;
  customerVisibleSendConfirmed: boolean;
  correctionDraftRecommended: boolean;
  apologyFollowUpRecommended: boolean;
  humanReviewRequired: boolean;
  rawTokenReturned: false;
  rawMimeReturned: false;
  rawProviderPayloadReturned: false;
  rawTicketPayloadReturned: false;
}

export interface SupportRollbackPolicyRecoveryPlan {
  trueRollbackAvailable: false;
  undoOrUnsendAttempted: false;
  draftCorrection: boolean;
  draftApologyFollowUp: boolean;
  markForHumanReview: boolean;
  retryAsNewManualAction: boolean;
  createActionNow: false;
  sendNow: false;
  requiresManualApprovalBeforeAnyFollowUpSend: true;
  followUpBodyPreview: string | null;
  humanReviewReason: string;
}

export interface SupportRollbackPolicyFutureActionPreview {
  actionType: 'support_reply_send';
  provider: 'gmail';
  threadId: string | null;
  ticketId: string | null;
  customerEmailHint: string | null;
  replyBodyPreview: string | null;
  approvalRequired: true;
  autoSendAllowed: false;
  createdNow: false;
  sentNow: false;
}

export interface SupportRollbackPolicyEvaluation {
  version: '0.7.0';
  phase: 'phase_13_9_follow_up_rollback_handling';
  healthMode: 'v2-phase-13-9-follow-up-rollback-handling';
  deliverable: 'support_rollback_policy';
  provider: SupportRollbackPolicyProvider;
  actionType: 'support_reply_send';
  decision: SupportRollbackPolicyDecision;
  reason: string;
  canUndoEmail: false;
  allowedRollbackMeanings: ['draft_correction', 'draft_apology_follow_up', 'mark_for_human_review'];
  checks: SupportRollbackPolicyChecks;
  recoveryPlan: SupportRollbackPolicyRecoveryPlan;
  futureActionPreview: SupportRollbackPolicyFutureActionPreview | null;
  safety: {
    policyOnly: true;
    noGmailApiCall: true;
    noEmailSent: true;
    noUnsendAttempted: true;
    noMessageDeleteAttempted: true;
    autoSendEnabled: false;
    bulkSendEnabled: false;
    manualApprovalRequiredForFollowUp: true;
    rawTokenReturned: false;
    rawMimeReturned: false;
    providerPayloadReturned: false;
    rawTicketPayloadReturned: false;
    note: string;
  };
}

export interface SupportRollbackPolicyStatus {
  phase: 'V2 Phase 13.9 — Follow-Up/Rollback Handling';
  healthMode: 'v2-phase-13-9-follow-up-rollback-handling';
  deliverable: 'support_rollback_policy';
  provider: 'gmail';
  actionType: 'support_reply_send';
  emailUndoSupported: false;
  rollbackMeansDraftCorrection: true;
  rollbackMeansDraftApologyFollowUp: true;
  rollbackMeansMarkForHumanReview: true;
  previewCallsGmail: false;
  previewSendsEmail: false;
  previewDeletesEmail: false;
  createsActionAutomatically: false;
  manualApprovalRequiredForFollowUp: true;
  autoSendEnabled: false;
  bulkSendEnabled: false;
  noDatabaseMigrationRequired: true;
  rawTokenReturnedToBrowser: false;
  rawMimeReturnedToBrowser: false;
  providerPayloadReturnedToBrowser: false;
  rawTicketPayloadReturnedToBrowser: false;
  nextStep: 'Phase 13.10 — Support Send QA';
}
