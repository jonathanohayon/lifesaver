import type { ActionStatus } from '../actions/actions.types.js';
import type { SupportClassifierCategory } from './support-ticket-classifier.types.js';

export type SupportSendExecutorStatusValue = 'blocked' | 'failed' | 'executed';
export type SupportSendProvider = 'gmail';

export interface NormalizedSupportReplySendPayload {
  action_type: 'support_reply_send';
  schema_version: 'support_reply_send.v1';
  source: string;
  intent_summary: string;
  idempotency_hint: string;
  data: {
    support_provider: SupportSendProvider;
    ticket_id: string;
    thread_id: string;
    reply_body: string;
    customer_email: string;
    customer_name?: string;
    subject?: string;
    category: SupportClassifierCategory;
    confidence_score: number;
    sensitive_flag: boolean;
    escalation_required: boolean;
    approval_notes?: string;
    source_draft_id?: string;
    send_email_enabled?: boolean;
    external_api_called?: boolean;
    auto_reply_enabled?: boolean;
  };
}

export interface GmailSendCredential {
  accessToken: string;
  grantedScopes: string[];
  mailboxHint?: string | null;
  expiresAt?: string | Date | null;
}

export interface GmailSendRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: {
    raw: string;
    threadId: string;
  };
}

export interface GmailSendClientResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type GmailSendClient = (request: GmailSendRequest) => Promise<GmailSendClientResponse>;

export interface SupportSendExecutorChecks {
  databaseConfigured: boolean;
  featureFlagEnabled: boolean;
  actionFound: boolean;
  actionTypeValid: boolean;
  statusApproved: boolean;
  manualApprovalConfirmed: boolean;
  masterPauseOff: boolean;
  supportPauseOff: boolean;
  emergencySafeModeOff: boolean;
  payloadValid: boolean;
  threadIdPresent: boolean;
  recipientPresent: boolean;
  replyBodyPresent: boolean;
  attachmentsUnsupported: boolean;
  ccBccUnsupported: boolean;
  tokenValid: boolean;
  requiredScopePresent: boolean;
  importedTicketFound: boolean;
  threadAssociationVerified: boolean;
  threadMatchesImportedTicket: boolean;
  customerMatchesImportedTicket: boolean;
  bulkSendGuardPassed: boolean;
  bulkSendDetected: boolean;
  explicitBulkApprovalPresent: boolean;
  sensitiveTicketGuardPassed: boolean;
  sensitiveTicketDetected: boolean;
  lowConfidenceDetected: boolean;
  sensitiveManualApprovalRequired: boolean;
  supportSendResultLogStored: boolean;
  supportSendResultLogHasExternalMessageId: boolean;
  supportSendResultLogHasThreadId: boolean;
  supportSendResultLogHasSentTimestamp: boolean;
  supportSendResultLogHasApiResponseSummary: boolean;
  supportSendResultLogHasFailureReason: boolean;
}


export interface SupportSendRequestPreview {
  provider: 'gmail';
  method: 'users.messages.send';
  userId: 'me';
  threadId: string;
  toHint: string;
  subjectPreview: string | null;
  replyBodyPreview: string;
  rawMimeReturned: false;
  rawBase64Returned: false;
  rawTokenReturned: false;
}

export interface SupportSendExecutionResult {
  version: '0.7.0';
  phase: 'phase_13_2_send_reply_executor';
  healthMode: 'v2-phase-13-2-send-reply-executor';
  executorName: 'gmailManualApprovedSupportReplyExecutor';
  workspaceId: string;
  actionId: string;
  actionType: 'support_reply_send';
  status: SupportSendExecutorStatusValue;
  checks: SupportSendExecutorChecks;
  gmail: {
    apiCalled: boolean;
    apiStatus: number | null;
    externalMessageId: string | null;
    externalThreadId: string | null;
    requestPreview: SupportSendRequestPreview | null;
    rawTokenReturned: false;
    rawMimeReturned: false;
  };
  resultLogStored: boolean;
  statusPath: ActionStatus[];
  message: string;
  safety: {
    manualApprovalRequired: true;
    autoReplyEnabled: false;
    executorFeatureFlagDefaultOff: true;
    externalWritesAttempted: boolean;
    externalWritesSucceeded: boolean;
    browserReceivesRawToken: false;
    browserReceivesRawMime: false;
    attachmentsSupportedInThisPhase: false;
    ccBccSupportedInThisPhase: false;
    note: string;
  };
}

export interface SupportSendExecutorStatus {
  phase: 'V2 Phase 13.2 — Send Reply Executor';
  healthMode: 'v2-phase-13-2-send-reply-executor';
  deliverable: 'manual_approved_support_executor';
  selectedConnector: 'gmail';
  executorName: 'gmailManualApprovedSupportReplyExecutor';
  actionType: 'support_reply_send';
  requiredScope: 'https://www.googleapis.com/auth/gmail.send';
  manualApprovalRequired: true;
  supportPauseRespected: true;
  masterPauseRespected: true;
  emergencySafeModeRespected: true;
  featureFlagDefaultOff: true;
  autoReplyEnabled: false;
  emailSendExecutorAdded: true;
  safeThreadedReplyMode: true;
  threadAssociationRequired: true;
  threadAssociationHealthMode: 'v2-phase-13-4-thread-association';
  bulkSendGuardRequired: true;
  bulkSendGuardHealthMode: 'v2-phase-13-6-no-bulk-sends';
  bulkSendSupportedInThisPhase: false;
  explicitBulkApprovalRequiredForFutureBulkSends: true;
  sensitiveTicketGuardRequired: true;
  sensitiveTicketGuardHealthMode: 'v2-phase-13-7-sensitive-ticket-guard';
  sensitiveTicketsRequireManualApproval: true;
  supportSendResultLogsRequired: true;
  supportSendResultLogsHealthMode: 'v2-phase-13-8-send-result-logs';
  storesExternalMessageId: true;
  storesThreadId: true;
  storesSentTimestamp: true;
  storesApiResponseSummary: true;
  storesFailureReason: true;
  attachmentsSupportedInThisPhase: false;
  ccBccSupportedInThisPhase: false;
  rawMimeReturnedToBrowser: false;
  rawTokenReturnedToBrowser: false;
}
