export type SupportConnectorOption = 'gmail' | 'helpdesk' | 'support_inbox' | 'zendesk' | 'gorgias' | 'help_scout';

export type SupportConnectorDecision = 'selected' | 'deferred';

export interface SupportConnectorComparisonItem {
  connector: SupportConnectorOption;
  label: string;
  decision: SupportConnectorDecision;
  reason: string;
  firstPhaseFitScore: number;
  approvalRisk: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface SupportConnectorScopePlan {
  oauthFlow: 'google_3_legged_oauth_authorization_code';
  initialScopes: string[];
  futureScopesNotRequestedYet: string[];
  restrictedScopes: boolean;
  appVerificationRequiredBeforeProduction: boolean;
  productionSecurityAssessmentLikelyIfRestrictedDataStored: boolean;
  tokenStorage: 'future_encrypted_connector_storage_only';
  tokenExposureAllowedInBrowser: false;
}

export interface SupportConnectorSafetyPlan {
  planningOnly: true;
  gmailApiClientAdded: false;
  oauthRoutesAdded: false;
  tokenStorageAdded: false;
  emailReadAdded: false;
  emailSendAdded: false;
  supportDraftActionConversionAdded: false;
  autoReplyAdded: false;
  externalApiCalled: false;
  noSecretsInBrowser: true;
}

export interface SelectedSupportConnectorPlan {
  packageName: string;
  version: string;
  phase: string;
  healthMode: string;
  deliverable: 'selected_support_connector_plan';
  selectedConnector: SupportConnectorOption;
  selectedConnectorLabel: string;
  selectedInitialMode: 'read_only_support_ticket_import';
  firstSupportedObject: 'gmail_message_as_support_ticket';
  selectionReason: string;
  scopePlan: SupportConnectorScopePlan;
  futureTicketFields: string[];
  futureDraftToActionFlow: string[];
  comparison: SupportConnectorComparisonItem[];
  nextStep: string;
  safety: SupportConnectorSafetyPlan;
}

export interface SupportConnectorPlanStatus {
  phase: string;
  healthMode: string;
  deliverable: 'selected_support_connector_plan';
  selectedConnector: SupportConnectorOption;
  selectedConnectorLabel: string;
  planningOnly: true;
  externalApiCalled: false;
  emailReadAdded: false;
  emailSendAdded: false;
  autoReplyAdded: false;
  nextStep: string;
}
