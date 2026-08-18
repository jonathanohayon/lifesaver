export type SupportWriteScopeRiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type SupportWriteScopeDecision = 'recommended' | 'required_before_real_send' | 'deferred' | 'blocked';

export interface SupportWriteScopeChecklistItem {
  id: string;
  title: string;
  decision: SupportWriteScopeDecision;
  requiredBeforeExecutor: boolean;
  owner: 'founder' | 'developer' | 'both';
  status: 'planned' | 'not_started' | 'blocked_until_future_phase';
  notes: string[];
}

export interface SupportWriteScopeMethodPlan {
  selectedMethod: 'gmail_users_messages_send';
  directSendEndpoint: 'users.messages.send';
  draftSendEndpointDeferred: 'users.drafts.send';
  messageFormat: 'rfc_2822_mime_base64url_raw_message';
  userId: 'me';
  initialReplyMode: 'threaded_reply_using_original_thread_headers';
  attachmentsAllowedInitially: false;
  ccBccAllowedInitially: false;
}

export interface SupportWriteScopePermissionPlan {
  connector: 'gmail';
  existingReadScope: 'https://www.googleapis.com/auth/gmail.readonly';
  minimumSendScopeToAddLater: 'https://www.googleapis.com/auth/gmail.send';
  allowedForPhase131PlanningOnly: string[];
  notRequestedInPhase131: string[];
  forbiddenBroadScope: 'https://mail.google.com/';
  scopeClassification: {
    gmailSend: 'sensitive';
    gmailReadonly: 'restricted';
    gmailCompose: 'restricted';
    gmailModify: 'restricted';
    mailGoogleCom: 'restricted_and_too_broad';
  };
  oauthConsentImpact: string[];
}

export interface SupportWriteScopeSafetyPlan {
  checklistOnly: true;
  gmailApiClientAdded: false;
  oauthRouteAdded: false;
  tokenStorageChanged: false;
  sendScopeRequestedNow: false;
  gmailSendExecutorAdded: false;
  emailSendingAdded: false;
  autoReplyAdded: false;
  externalApiCalled: false;
  rawEmailPayloadReturned: false;
  noSecretsInBrowser: true;
}

export interface SupportWriteScopeChecklist {
  packageName: string;
  version: '0.7.0';
  phase: 'V2 Phase 13.1 — Write Scope Setup';
  healthMode: 'v2-phase-13-1-write-scope-setup';
  deliverable: 'support_write_scope_checklist';
  purpose: string;
  selectedConnector: 'gmail';
  currentStableMode: 'read_only_support_ticket_import';
  nextExecutorMode: 'approved_support_reply_send_only';
  permissionPlan: SupportWriteScopePermissionPlan;
  methodPlan: SupportWriteScopeMethodPlan;
  checklist: SupportWriteScopeChecklistItem[];
  hardBlocksBeforeRealSend: string[];
  safety: SupportWriteScopeSafetyPlan;
  nextStep: string;
}

export interface SupportWriteScopeStatus {
  phase: SupportWriteScopeChecklist['phase'];
  healthMode: SupportWriteScopeChecklist['healthMode'];
  deliverable: SupportWriteScopeChecklist['deliverable'];
  selectedConnector: 'gmail';
  checklistOnly: true;
  sendScopeRequestedNow: false;
  gmailSendExecutorAdded: false;
  emailSendingAdded: false;
  autoReplyAdded: false;
  requiredFutureScope: 'https://www.googleapis.com/auth/gmail.send';
  nextStep: string;
}

export interface SupportWriteScopeGateInput {
  readOnlyConnectorStable?: boolean;
  oauthConsentUpdated?: boolean;
  founderApprovedSendScope?: boolean;
  encryptedTokenStorageReady?: boolean;
  proposedActionApprovalRequired?: boolean;
  noAutoReply?: boolean;
  noBroadMailScope?: boolean;
  supportPrivacySafeguardsActive?: boolean;
  escalationRulesActive?: boolean;
}

export interface SupportWriteScopeGateResult {
  eligibleForFutureSendExecutorBuild: boolean;
  riskLevel: SupportWriteScopeRiskLevel;
  missingGates: string[];
  warnings: string[];
  safeSummary: string;
}
