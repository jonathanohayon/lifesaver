export type SupportBulkSendGuardDecision =
  | 'single_recipient_send_allowed_to_continue'
  | 'blocked_unsupported_action_type'
  | 'blocked_unsupported_provider'
  | 'blocked_bulk_send_requires_explicit_approval'
  | 'blocked_bulk_send_not_supported_this_phase'
  | 'blocked_bulk_approval_scope_invalid'
  | 'blocked_missing_single_thread_binding';

export interface SupportBulkApprovalInput {
  approvalId?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | Date | null;
  approvalScope?: 'bulk_support_send' | 'single_support_send' | string | null;
  maxRecipientCount?: number | string | null;
  reason?: string | null;
}

export interface SupportBulkSendGuardInput {
  actionType?: string | null;
  provider?: string | null;
  recipientCount?: number | string | null;
  threadCount?: number | string | null;
  ticketCount?: number | string | null;
  messageCount?: number | string | null;
  hasCc?: boolean | null;
  hasBcc?: boolean | null;
  hasAttachments?: boolean | null;
  bulkModeRequested?: boolean | null;
  sendAllRequested?: boolean | null;
  audienceSegmentPresent?: boolean | null;
  templateSendRequested?: boolean | null;
  explicitBulkApproval?: SupportBulkApprovalInput | null;
}

export interface SupportBulkSendPayloadExtraction {
  actionType: string | null;
  provider: string;
  recipientCount: number;
  threadCount: number;
  ticketCount: number;
  messageCount: number;
  hasCc: boolean;
  hasBcc: boolean;
  hasAttachments: boolean;
  bulkModeRequested: boolean;
  sendAllRequested: boolean;
  audienceSegmentPresent: boolean;
  templateSendRequested: boolean;
}

export interface SupportBulkSendGuardChecks {
  actionTypeIsSupportReplySend: boolean;
  providerIsGmail: boolean;
  recipientCountKnown: boolean;
  singleRecipientOnly: boolean;
  singleThreadOnly: boolean;
  singleTicketOnly: boolean;
  singleMessageOnly: boolean;
  noCc: boolean;
  noBcc: boolean;
  noAttachments: boolean;
  noBulkMode: boolean;
  noSendAll: boolean;
  noAudienceSegment: boolean;
  noTemplateBatchSend: boolean;
  bulkSendDetected: boolean;
  explicitBulkApprovalPresent: boolean;
  explicitBulkApprovalActorPresent: boolean;
  explicitBulkApprovalTimestampPresent: boolean;
  explicitBulkApprovalScopeValid: boolean;
  explicitBulkApprovalLimitCoversRecipients: boolean;
  currentPhaseSupportsBulkSend: false;
}

export interface SupportBulkSendGuardStatus {
  phase: 'V2 Phase 13.6 — No Bulk Sends';
  healthMode: 'v2-phase-13-6-no-bulk-sends';
  deliverable: 'bulk_send_guard';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  singleRecipientExecutorOnly: true;
  bulkSendSupportedThisPhase: false;
  explicitBulkApprovalRequiredForFutureBulkSends: true;
  executorMustCheckBulkGuard: true;
  previewCallsGmail: false;
  previewSendsEmail: false;
  rawProviderPayloadReturned: false;
  rawTokenReturned: false;
  rawMimeReturned: false;
  nextStep: 'Phase 13.7 — Sensitive Ticket Guard';
}

export interface SupportBulkSendGuardResult {
  version: '0.7.0';
  phase: 'phase_13_6_no_bulk_sends';
  healthMode: 'v2-phase-13-6-no-bulk-sends';
  deliverable: 'bulk_send_guard';
  selectedConnector: 'gmail';
  actionType: string | null;
  provider: string;
  allowedToContinue: boolean;
  bulkSendDetected: boolean;
  explicitBulkApprovalRequired: boolean;
  explicitBulkApprovalPresent: boolean;
  decision: SupportBulkSendGuardDecision;
  checks: SupportBulkSendGuardChecks;
  counts: {
    recipientCount: number | null;
    threadCount: number | null;
    ticketCount: number | null;
    messageCount: number | null;
  };
  blockers: string[];
  warnings: string[];
  safeSummary: string;
  safety: {
    guardOnly: true;
    emailSent: false;
    gmailApiCalled: false;
    bulkSendSupportedThisPhase: false;
    currentExecutorSingleRecipientOnly: true;
    rawProviderPayloadReturned: false;
    rawTokenReturned: false;
    rawMimeReturned: false;
    note: string;
  };
}
