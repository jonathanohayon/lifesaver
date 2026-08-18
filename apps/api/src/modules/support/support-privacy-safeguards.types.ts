export type SupportPrivacyRedactionInput = {
  event?: string | null;
  ticketId?: string | null;
  threadId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
  body?: string | null;
  category?: string | null;
  sensitiveFlag?: boolean | null;
  rawTicketPayload?: unknown;
  adminLogMetadata?: Record<string, unknown> | null;
};

export type SupportPrivacySafeLog = {
  event: string;
  ticketId: string | null;
  threadId: string | null;
  customerEmailHint: string | null;
  customerNameHint: string | null;
  subjectPreview: string | null;
  bodySnippetPreview: string | null;
  category: string | null;
  sensitiveFlag: boolean;
  redactionApplied: boolean;
  redactionReasons: string[];
  privateDataMinimized: true;
  fullTicketBodyReturned: false;
  providerPayloadReturned: false;
  safeForAdminLog: true;
};

export type SupportPrivacySafeguardsPreview = {
  valid: true;
  decision: 'safe_log_ready' | 'sensitive_log_redacted';
  safeLog: SupportPrivacySafeLog;
  blockedFields: string[];
  warnings: string[];
  safety: {
    sensitiveDataRedactedInLogs: true;
    customerPrivateDataMinimized: true;
    fullRawTicketPayloadInAdminLogs: false;
    fullTicketBodyReturned: false;
    providerPayloadReturned: false;
    emailSendAdded: false;
    externalApiCalled: false;
  };
};

export type SupportPrivacySafeguardsStatus = {
  phase: string;
  healthMode: string;
  deliverable: string;
  selectedConnector: 'gmail';
  redactSensitiveDataInLogs: true;
  customerPrivateDataMinimized: true;
  fullRawTicketPayloadInAdminLogs: false;
  browserReturnsSafePreviewOnly: true;
  emailSendAdded: false;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  supportAutoReplyAdded: false;
};
