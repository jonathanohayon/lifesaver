export type SupportSendQaCheckId =
  | 'safe_approved_send'
  | 'no_duplicate_send'
  | 'correct_thread'
  | 'logs_stored'
  | 'sensitive_ticket_blocked';

export type SupportSendQaCheckStatus = 'pass' | 'fail';

export interface SupportSendQaCheckResult {
  id: SupportSendQaCheckId;
  label: string;
  status: SupportSendQaCheckStatus;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface SupportSendQaReport {
  version: '0.7.0';
  phase: 'phase_13_10_support_send_qa';
  healthMode: 'v2-phase-13-10-support-send-qa';
  deliverable: 'support_send_qa_report';
  provider: 'gmail';
  actionType: 'support_reply_send';
  overallStatus: 'pass' | 'fail';
  generatedAt: string;
  checks: SupportSendQaCheckResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
    oneSafeApprovedSendVerified: boolean;
    noDuplicateSendVerified: boolean;
    correctThreadVerified: boolean;
    logsStoredVerified: boolean;
    sensitiveTicketBlockedVerified: boolean;
  };
  safety: {
    qaUsesMockGmailClient: true;
    liveGmailSendPerformedByQa: false;
    autoSendEnabled: false;
    bulkSendEnabled: false;
    manualApprovalStillRequired: true;
    rawTokenReturned: false;
    rawMimeReturned: false;
    rawProviderPayloadReturned: false;
    noDatabaseMigrationRequired: true;
    note: string;
  };
}

export interface SupportSendQaStatus {
  phase: 'V2 Phase 13.10 — Support Send QA';
  healthMode: 'v2-phase-13-10-support-send-qa';
  deliverable: 'support_send_qa_report';
  actionType: 'support_reply_send';
  provider: 'gmail';
  qaChecks: SupportSendQaCheckId[];
  verifiesOneSafeApprovedSend: true;
  verifiesNoDuplicateSend: true;
  verifiesCorrectThread: true;
  verifiesLogsStored: true;
  verifiesSensitiveTicketBlocked: true;
  qaUsesMockGmailClient: true;
  liveGmailSendPerformedByQa: false;
  manualApprovalRequiredStill: true;
  autoSendEnabled: false;
  bulkSendEnabled: false;
  noDatabaseMigrationRequired: true;
  rawTokenReturnedToBrowser: false;
  rawMimeReturnedToBrowser: false;
  providerPayloadReturnedToBrowser: false;
  nextStep: 'Phase 14.1 — Ads Connector Audit';
}
