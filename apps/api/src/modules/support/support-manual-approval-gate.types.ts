export type SupportManualApprovalGateDecision =
  | 'approved_to_execute'
  | 'blocked_manual_approval_required'
  | 'blocked_unsupported_action_type'
  | 'blocked_auto_send_not_allowed';

export type SupportManualApprovalGateRisk = 'low' | 'medium' | 'high' | 'blocked';

export interface SupportManualApprovalGateInput {
  actionType?: string | null;
  actionStatus?: string | null;
  approvedAt?: string | Date | null;
  approvalEventId?: string | null;
  approvalEventActorUserId?: string | null;
  executorName?: string | null;
  forceRequested?: boolean;
  autoSendRequested?: boolean;
}

export interface SupportManualApprovalGateChecks {
  actionTypeIsSupportReplySend: boolean;
  actionStatusIsApproved: boolean;
  approvedTimestampPresent: boolean;
  approvalEventPresent: boolean;
  approvalActorPresent: boolean;
  autoSendRequested: boolean;
  forceDoesNotBypassApproval: boolean;
  founderApprovalRequired: true;
}

export interface SupportManualApprovalGateResult {
  version: '0.7.0';
  phase: 'phase_13_3_manual_approval_first';
  healthMode: 'v2-phase-13-3-manual-approval-first';
  deliverable: 'all_support_sends_approval_gated';
  policyId: 'support_send_manual_approval_first_v1';
  selectedConnector: 'gmail';
  actionType: string | null;
  executorName: string | null;
  eligibleToSend: boolean;
  decision: SupportManualApprovalGateDecision;
  riskLevel: SupportManualApprovalGateRisk;
  checks: SupportManualApprovalGateChecks;
  blockers: string[];
  warnings: string[];
  safeSummary: string;
  safety: {
    emailSent: false;
    gmailApiCalled: false;
    autoReplyAllowed: false;
    forceBypassAllowed: false;
    manualFounderApprovalRequired: true;
    rawTicketPayloadReturned: false;
    rawTokenReturned: false;
    note: string;
  };
}

export interface SupportManualApprovalGateStatus {
  phase: 'V2 Phase 13.3 — Manual Approval First';
  healthMode: 'v2-phase-13-3-manual-approval-first';
  deliverable: 'all_support_sends_approval_gated';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  policyId: 'support_send_manual_approval_first_v1';
  manualApprovalRequiredForEverySupportSend: true;
  autoSendEnabled: false;
  forceBypassAllowed: false;
  executorMustCheckApprovalEvent: true;
  executorMustCheckApprovedStatus: true;
  executorMustCheckApprovedTimestamp: true;
  gmailApiCallAllowedWithoutApproval: false;
  emailSendingAllowedWithoutApproval: false;
  nextStep: string;
}
