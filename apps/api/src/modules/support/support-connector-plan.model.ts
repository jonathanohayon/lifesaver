import type { SelectedSupportConnectorPlan, SupportConnectorComparisonItem, SupportConnectorPlanStatus, SupportConnectorSafetyPlan } from './support-connector-plan.types.js';

export const SUPPORT_CONNECTOR_PLAN_PHASE = 'phase_12_1_choose_support_connector' as const;
export const SUPPORT_CONNECTOR_PLAN_HEALTH_MODE = 'v2-phase-12-1-choose-support-connector' as const;
export const SUPPORT_CONNECTOR_PLAN_PACKAGE = 'lifesaver-v0.7.0-phase-12-1-choose-support-connector.zip' as const;
export const SELECTED_SUPPORT_CONNECTOR = 'gmail' as const;
export const SELECTED_SUPPORT_CONNECTOR_LABEL = 'Gmail' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
];

export function buildSupportConnectorSafetyPlan(): SupportConnectorSafetyPlan {
  return {
    planningOnly: true,
    gmailApiClientAdded: false,
    oauthRoutesAdded: false,
    tokenStorageAdded: false,
    emailReadAdded: false,
    emailSendAdded: false,
    supportDraftActionConversionAdded: false,
    autoReplyAdded: false,
    externalApiCalled: false,
    noSecretsInBrowser: true,
  };
}

export function buildSupportConnectorComparison(): SupportConnectorComparisonItem[] {
  return [
    {
      connector: 'gmail',
      label: 'Gmail',
      decision: 'selected',
      reason: 'Best first connector because many founders already use Gmail or Google Workspace, the API is mature, and the first LIFE.SAVER lane can be read-only before any support send executor exists.',
      firstPhaseFitScore: 9,
      approvalRisk: 'medium',
      notes: [
        'Start with support inbox read/import planning only.',
        'Treat Gmail messages as support tickets in the LIFE.SAVER data model.',
        'Do not request send scope yet.',
        'Production requires Google OAuth verification planning before customer launch.',
      ],
    },
    {
      connector: 'helpdesk',
      label: 'Generic Helpdesk',
      decision: 'deferred',
      reason: 'Useful abstraction later, but too broad for the first concrete connector because each helpdesk has different auth, ticket fields, and send semantics.',
      firstPhaseFitScore: 6,
      approvalRisk: 'medium',
      notes: ['Keep a future provider interface in mind.', 'Do not build a generic connector before one real provider is understood.'],
    },
    {
      connector: 'support_inbox',
      label: 'Support Inbox',
      decision: 'deferred',
      reason: 'Good product language, but it is not a concrete integration target. It should become the normalized LIFE.SAVER object model, not the first external connector.',
      firstPhaseFitScore: 5,
      approvalRisk: 'low',
      notes: ['Use support_inbox as future normalized UI terminology.', 'Back it initially with Gmail messages.'],
    },
    {
      connector: 'zendesk',
      label: 'Zendesk',
      decision: 'deferred',
      reason: 'Strong enterprise helpdesk option, but many early ecommerce founders may not use it and setup is heavier than Gmail.',
      firstPhaseFitScore: 7,
      approvalRisk: 'medium',
      notes: ['Good candidate after Gmail abstraction is proven.', 'Requires Zendesk account/domain-specific setup.'],
    },
    {
      connector: 'gorgias',
      label: 'Gorgias',
      decision: 'deferred',
      reason: 'Excellent ecommerce support option, but it should come after the first support connector and normalized support action model are stable.',
      firstPhaseFitScore: 8,
      approvalRisk: 'medium',
      notes: ['Highly relevant for Shopify/DTC later.', 'Better Phase 12+ candidate after Gmail proof.'],
    },
    {
      connector: 'help_scout',
      label: 'Help Scout',
      decision: 'deferred',
      reason: 'Solid support platform, but less universal than Gmail as a first connector for safe support ticket ingestion.',
      firstPhaseFitScore: 6,
      approvalRisk: 'medium',
      notes: ['Defer until provider abstraction is stable.', 'May be simpler than some enterprise tools but still not the first baseline.'],
    },
  ];
}

export function buildSelectedSupportConnectorPlan(): SelectedSupportConnectorPlan {
  return {
    packageName: SUPPORT_CONNECTOR_PLAN_PACKAGE,
    version: '0.7.0',
    phase: 'V2 Phase 12.1 — Choose Support Connector',
    healthMode: SUPPORT_CONNECTOR_PLAN_HEALTH_MODE,
    deliverable: 'selected_support_connector_plan',
    selectedConnector: SELECTED_SUPPORT_CONNECTOR,
    selectedConnectorLabel: SELECTED_SUPPORT_CONNECTOR_LABEL,
    selectedInitialMode: 'read_only_support_ticket_import',
    firstSupportedObject: 'gmail_message_as_support_ticket',
    selectionReason: 'Choose Gmail first. It is the most practical initial support connector for founder testing because it can begin as read-only support-ticket ingestion, while support sending and auto-replies remain blocked until later phases.',
    scopePlan: {
      oauthFlow: 'google_3_legged_oauth_authorization_code',
      initialScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      futureScopesNotRequestedYet: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify'],
      restrictedScopes: true,
      appVerificationRequiredBeforeProduction: true,
      productionSecurityAssessmentLikelyIfRestrictedDataStored: true,
      tokenStorage: 'future_encrypted_connector_storage_only',
      tokenExposureAllowedInBrowser: false,
    },
    futureTicketFields: [
      'external_message_id',
      'thread_id',
      'from_email_hint',
      'subject',
      'received_at',
      'snippet',
      'labels',
      'status',
      'priority',
      'draft_reply_status',
      'workspace_id',
    ],
    futureDraftToActionFlow: [
      'import_gmail_message_as_support_ticket',
      'generate_support_reply_draft',
      'create_support_reply_send_proposed_action',
      'require_founder_approval',
      'later_executor_sends_only_when_phase_allows',
    ],
    comparison: buildSupportConnectorComparison(),
    nextStep: 'Phase 12.2 — Support ticket data model / normalized ticket schema.',
    safety: buildSupportConnectorSafetyPlan(),
  };
}

export function buildSupportConnectorPlanStatus(): SupportConnectorPlanStatus {
  const plan = buildSelectedSupportConnectorPlan();
  return {
    phase: plan.phase,
    healthMode: plan.healthMode,
    deliverable: plan.deliverable,
    selectedConnector: plan.selectedConnector,
    selectedConnectorLabel: plan.selectedConnectorLabel,
    planningOnly: true,
    externalApiCalled: false,
    emailReadAdded: false,
    emailSendAdded: false,
    autoReplyAdded: false,
    nextStep: plan.nextStep,
  };
}

export function assertSupportConnectorPlanSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Support connector plan output contains forbidden fragment: ${fragment}`);
    }
  }
}
