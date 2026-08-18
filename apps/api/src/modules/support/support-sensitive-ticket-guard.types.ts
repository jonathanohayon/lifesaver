export type SupportSensitiveTicketGuardDecision =
  | 'non_sensitive_ticket_allowed_to_continue'
  | 'sensitive_ticket_manual_approval_confirmed'
  | 'blocked_unsupported_action_type'
  | 'blocked_unsupported_provider'
  | 'blocked_sensitive_ticket_requires_manual_approval'
  | 'blocked_low_confidence_requires_manual_approval'
  | 'blocked_auto_send_for_sensitive_ticket';

export type SupportSensitiveTicketTrigger =
  | 'refund'
  | 'cancellation'
  | 'complaint'
  | 'payment_issue'
  | 'legal_issue'
  | 'unknown_intent'
  | 'low_confidence'
  | 'sensitive_flag'
  | 'escalation_required'
  | 'sensitive_category'
  | 'escalation_category';

export interface SupportSensitiveTicketGuardInput {
  actionType?: string | null;
  provider?: string | null;
  category?: string | null;
  confidenceScore?: number | string | null;
  lowConfidenceThreshold?: number | string | null;
  sensitiveFlag?: boolean | null;
  escalationRequired?: boolean | null;
  riskLevel?: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
  replyBody?: string | null;
  approvalNotes?: string | null;
  manualApprovalConfirmed?: boolean | null;
  approvalEventActorUserId?: string | null;
  approvalEventId?: string | null;
  approvedAt?: string | Date | null;
  autoSendRequested?: boolean | null;
  forceRequested?: boolean | null;
}

export interface SupportSensitiveTicketPayloadExtraction extends SupportSensitiveTicketGuardInput {
  actionType: string | null;
  provider: string;
}

export interface SupportSensitiveTicketGuardChecks {
  actionTypeIsSupportReplySend: boolean;
  providerIsGmail: boolean;
  refundDetected: boolean;
  cancellationDetected: boolean;
  complaintDetected: boolean;
  paymentIssueDetected: boolean;
  legalIssueDetected: boolean;
  unknownIntentDetected: boolean;
  lowConfidenceDetected: boolean;
  sensitiveFlagDetected: boolean;
  escalationRequiredDetected: boolean;
  sensitiveCategoryDetected: boolean;
  escalationCategoryDetected: boolean;
  sensitiveTicketDetected: boolean;
  manualApprovalConfirmed: boolean;
  approvalActorPresent: boolean;
  approvalEventPresent: boolean;
  approvedAtPresent: boolean;
  autoSendRequested: boolean;
  forceBypassRequested: boolean;
}

export interface SupportSensitiveTicketGuardStatus {
  phase: 'V2 Phase 13.7 — Sensitive Ticket Guard';
  healthMode: 'v2-phase-13-7-sensitive-ticket-guard';
  deliverable: 'sensitive_ticket_protection';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  guardOnly: true;
  alwaysRequireApprovalFor: SupportSensitiveTicketTrigger[];
  defaultLowConfidenceThreshold: number;
  executorMustCheckSensitiveTicketGuard: true;
  autoSendBlockedForSensitiveTickets: true;
  forceBypassAllowed: false;
  previewCallsGmail: false;
  previewSendsEmail: false;
  rawProviderPayloadReturned: false;
  rawTokenReturned: false;
  rawMimeReturned: false;
  nextStep: 'Phase 13.8 — Send Result Logs';
}

export interface SupportSensitiveTicketGuardResult {
  version: '0.7.0';
  phase: 'phase_13_7_sensitive_ticket_guard';
  healthMode: 'v2-phase-13-7-sensitive-ticket-guard';
  deliverable: 'sensitive_ticket_protection';
  selectedConnector: 'gmail';
  actionType: string | null;
  provider: string;
  category: string | null;
  confidenceScore: number | null;
  lowConfidenceThreshold: number;
  sensitiveTicketDetected: boolean;
  manualApprovalRequired: boolean;
  allowedToContinue: boolean;
  decision: SupportSensitiveTicketGuardDecision;
  triggers: SupportSensitiveTicketTrigger[];
  checks: SupportSensitiveTicketGuardChecks;
  blockers: string[];
  warnings: string[];
  safeSummary: string;
  safety: {
    guardOnly: true;
    emailSent: false;
    gmailApiCalled: false;
    autoSendAllowed: false;
    forceBypassAllowed: false;
    rawProviderPayloadReturned: false;
    rawTokenReturned: false;
    rawMimeReturned: false;
    note: string;
  };
}
