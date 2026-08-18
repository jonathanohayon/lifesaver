export type SupportSendResultLogStatus = 'success' | 'failed' | 'blocked';
export type SupportSendResultLogProvider = 'gmail';

export interface SupportSendResultLogInput {
  workspaceId: string;
  actionId: string;
  provider?: SupportSendResultLogProvider;
  executorName: string;
  resultStatus: SupportSendResultLogStatus;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  sentAt?: string | Date | null;
  apiStatus?: number | null;
  apiResponseSummary?: string | null;
  apiResponseBody?: unknown;
  failureReason?: string | null;
  requestPreview?: unknown;
  ticketId?: string | null;
  importedTicketId?: string | null;
  manualApprovalRequired?: boolean;
  externalWritesAttempted?: boolean;
  externalWritesSucceeded?: boolean;
  metadataJson?: Record<string, unknown>;
}

export interface SupportSendResultLogChecks {
  workspaceIdPresent: boolean;
  actionIdPresent: boolean;
  executorNamePresent: boolean;
  providerIsGmail: boolean;
  resultStatusValid: boolean;
  externalMessageIdStored: boolean;
  threadIdStored: boolean;
  sentTimestampStored: boolean;
  apiResponseSummaryStored: boolean;
  failureReasonStoredWhenFailed: boolean;
  rawTokenReturned: false;
  rawMimeReturned: false;
  providerPayloadReturned: false;
}

export interface SupportSendResultActionResultInsert {
  workspaceId: string;
  actionId: string;
  executorName: string;
  externalId: string | null;
  externalUrl: null;
  resultStatus: SupportSendResultLogStatus;
  resultSummary: string;
  errorMessage: string | null;
  metadataJson: Record<string, unknown>;
}

export interface SupportSendResultLogRecord {
  version: '0.7.0';
  phase: 'phase_13_8_send_result_logs';
  healthMode: 'v2-phase-13-8-send-result-logs';
  deliverable: 'support_send_result_log';
  provider: SupportSendResultLogProvider;
  actionType: 'support_reply_send';
  actionId: string;
  workspaceId: string;
  resultStatus: SupportSendResultLogStatus;
  externalMessageId: string | null;
  externalThreadId: string | null;
  sentAt: string | null;
  apiResponseSummary: string;
  failureReason: string | null;
  checks: SupportSendResultLogChecks;
  actionResult: SupportSendResultActionResultInsert;
  safety: {
    previewOnly?: boolean;
    resultLogOnly: true;
    emailSentByThisModule: false;
    gmailApiCalledByThisModule: false;
    rawTokenReturned: false;
    rawMimeReturned: false;
    providerPayloadReturned: false;
    browserReceivesProviderPayload: false;
    note: string;
  };
}

export interface SupportSendResultLogsStatus {
  phase: 'V2 Phase 13.8 — Send Result Logs';
  healthMode: 'v2-phase-13-8-send-result-logs';
  deliverable: 'support_send_result_log';
  actionType: 'support_reply_send';
  provider: 'gmail';
  storesExternalMessageId: true;
  storesThreadId: true;
  storesSentTimestamp: true;
  storesApiResponseSummary: true;
  storesFailureReason: true;
  integratedWithManualApprovedExecutor: true;
  manualApprovalRequiredStill: true;
  autoSendEnabled: false;
  bulkSendEnabled: false;
  noDatabaseMigrationRequired: true;
  previewCallsGmail: false;
  previewSendsEmail: false;
  rawTokenReturnedToBrowser: false;
  rawMimeReturnedToBrowser: false;
  providerPayloadReturnedToBrowser: false;
  nextStep: 'Phase 13.9 — Follow-Up/Rollback Handling';
}
