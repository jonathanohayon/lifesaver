export type SupportConnectorQaScenarioName =
  | 'ticket_import'
  | 'classification'
  | 'draft_action'
  | 'no_send_safety'
  | 'permission_controls';

export type SupportConnectorQaScenarioStatus = 'passed' | 'failed' | 'manual_review_required';

export type SupportConnectorQaPermissionRole = 'owner' | 'admin' | 'operator' | 'viewer' | 'unknown';

export type SupportConnectorQaPermissionCheck = {
  role: SupportConnectorQaPermissionRole;
  canViewTicket: boolean;
  canPreviewDraftAction: boolean;
  canApproveSupportReplyAction: boolean;
  canRejectSupportReplyAction: boolean;
  canExecuteSupportSend: false;
  reason: string;
};

export type SupportConnectorQaScenario = {
  name: SupportConnectorQaScenarioName;
  label: string;
  status: SupportConnectorQaScenarioStatus;
  passed: boolean;
  evidence: string[];
  warnings: string[];
  safety: {
    gmailApiCalled: false;
    emailSent: false;
    externalWritePerformed: false;
    rawProviderPayloadReturned: false;
    rawTicketPayloadReturned: false;
    tokenValueReturned: false;
  };
};

export type SupportConnectorQaReport = {
  phase: 'V2 Phase 12.10 — Support Connector QA';
  healthMode: 'v2-phase-12-10-support-connector-qa';
  deliverable: 'support_connector_qa_report';
  selectedConnector: 'gmail';
  qaMode: 'safe_report_only';
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    manualReviewScenarios: number;
    overallStatus: 'passed' | 'failed' | 'manual_review_required';
  };
  scenarios: SupportConnectorQaScenario[];
  permissionControls: SupportConnectorQaPermissionCheck[];
  safeArtifacts: {
    importedTicketCount: number;
    ticketCategory: string;
    ticketEscalationRequired: boolean;
    draftActionType: 'support_reply_send';
    draftActionPolicyDecision: 'ask';
    approvalRequired: true;
    approveRejectOnly: true;
    sendExecutorPresent: false;
  };
  safety: {
    reportOnly: true;
    gmailOAuthAdded: false;
    gmailApiClientAdded: false;
    gmailExternalApiCalled: false;
    gmailSendScopeRequested: false;
    gmailModifyScopeRequested: false;
    emailSent: false;
    supportSendExecutorAdded: false;
    supportAutoReplyAdded: false;
    actionExecuted: false;
    databaseMigrationAdded: false;
    databaseWritePerformed: false;
    rawProviderPayloadReturned: false;
    rawTicketPayloadReturned: false;
    tokenValueReturned: false;
  };
};

export type SupportConnectorQaStatus = {
  phase: 'V2 Phase 12.10 — Support Connector QA';
  healthMode: 'v2-phase-12-10-support-connector-qa';
  deliverable: 'support_connector_qa_report';
  selectedConnector: 'gmail';
  ticketImportTested: true;
  classificationTested: true;
  draftActionTested: true;
  noSendSafetyTested: true;
  permissionControlsTested: true;
  reportOnly: true;
  gmailOAuthAdded: false;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportSendExecutorAdded: false;
  supportAutoReplyAdded: false;
  rawProviderPayloadReturned: false;
  tokenValueReturned: false;
};
