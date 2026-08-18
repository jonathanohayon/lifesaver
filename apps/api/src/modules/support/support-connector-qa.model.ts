import { z } from 'zod';
import { buildSupportActionUiPreview } from './support-action-ui.model.js';
import { buildSupportDraftActionPreview } from './support-draft-action.model.js';
import { buildSupportImportPreview } from './support-readonly-import.model.js';
import { buildSupportEscalationRulesPreview } from './support-escalation-rules.model.js';
import { buildSupportTicketClassifierPreview } from './support-ticket-classifier.model.js';
import type {
  SupportConnectorQaPermissionCheck,
  SupportConnectorQaPermissionRole,
  SupportConnectorQaReport,
  SupportConnectorQaScenario,
  SupportConnectorQaStatus,
} from './support-connector-qa.types.js';

export const SUPPORT_CONNECTOR_QA_PHASE = 'phase_12_10_support_connector_qa' as const;
export const SUPPORT_CONNECTOR_QA_HEALTH_MODE = 'v2-phase-12-10-support-connector-qa' as const;
export const SUPPORT_CONNECTOR_QA_PACKAGE = 'lifesaver-v0.7.0-phase-12-10-support-connector-qa.zip' as const;

const reportInputSchema = z.object({
  reviewerRole: z.enum(['owner', 'admin', 'operator', 'viewer', 'unknown']).optional().default('owner'),
}).strict().optional();

const FORBIDDEN_QA_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'gmail_client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'gmail.send',
  'gmail.modify',
  'raw_provider_payload',
  'raw_ticket_payload',
  'smtp_password',
  'sendgrid_api_key',
];

function scenarioSafety(): SupportConnectorQaScenario['safety'] {
  return {
    gmailApiCalled: false,
    emailSent: false,
    externalWritePerformed: false,
    rawProviderPayloadReturned: false,
    rawTicketPayloadReturned: false,
    tokenValueReturned: false,
  };
}

function buildScenario(params: Omit<SupportConnectorQaScenario, 'safety'>): SupportConnectorQaScenario {
  return {
    ...params,
    safety: scenarioSafety(),
  };
}

export function buildSupportQaPermissionCheck(role: SupportConnectorQaPermissionRole): SupportConnectorQaPermissionCheck {
  const canApprove = role === 'owner' || role === 'admin';
  const canPreview = role === 'owner' || role === 'admin' || role === 'operator';
  const canViewTicket = role === 'owner' || role === 'admin' || role === 'operator' || role === 'viewer';

  return {
    role,
    canViewTicket,
    canPreviewDraftAction: canPreview,
    canApproveSupportReplyAction: canApprove,
    canRejectSupportReplyAction: canApprove,
    canExecuteSupportSend: false,
    reason: canApprove
      ? 'Owner/admin can approve or reject internal proposed support_reply_send actions, but cannot execute support sending in Phase 12.10.'
      : 'Role can not approve support replies; manual founder/admin approval is required.',
  };
}

export function assertSupportConnectorQaSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_QA_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support connector QA output contains forbidden fragment: ${fragment}`);
    }
  }
  if (serialized.includes('customer@example.com')) {
    throw new Error('Support connector QA output must mask example customer email addresses.');
  }
}

export function buildSupportConnectorQaStatus(): SupportConnectorQaStatus {
  return {
    phase: 'V2 Phase 12.10 — Support Connector QA',
    healthMode: SUPPORT_CONNECTOR_QA_HEALTH_MODE,
    deliverable: 'support_connector_qa_report',
    selectedConnector: 'gmail',
    ticketImportTested: true,
    classificationTested: true,
    draftActionTested: true,
    noSendSafetyTested: true,
    permissionControlsTested: true,
    reportOnly: true,
    gmailOAuthAdded: false,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportSendExecutorAdded: false,
    supportAutoReplyAdded: false,
    rawProviderPayloadReturned: false,
    tokenValueReturned: false,
  };
}

export function buildSupportConnectorQaReport(input?: unknown): SupportConnectorQaReport {
  const parsed = reportInputSchema.parse(input) || { reviewerRole: 'owner' as const };

  const importPreview = buildSupportImportPreview({
    messages: [
      {
        externalMessageId: 'gmail_msg_qa_001',
        externalThreadId: 'gmail_thread_qa_001',
        fromEmail: 'customer@example.com',
        fromName: 'Customer QA',
        subject: 'Refund request for delayed order',
        snippet: 'Hi team, my package is delayed and I want to request a refund. Please help.',
        receivedAt: '2026-07-07T10:00:00.000Z',
        labelIds: ['INBOX', 'UNREAD'],
        rawProviderPayload: {
          provider: 'gmail',
          raw_payload_stored_separately: true,
          qa_fixture: true,
        },
      },
    ],
  });

  const importedTicket = importPreview.normalizedTickets[0];
  if (!importedTicket) {
    throw new Error('Support connector QA requires a normalized ticket fixture.');
  }

  const classificationPreview = buildSupportTicketClassifierPreview({
    ticketId: 'ticket_qa_001',
    customerEmail: 'customer@example.com',
    subject: importedTicket.subject,
    bodySnippet: importedTicket.snippet,
    threadId: importedTicket.externalThreadId,
    sensitiveFlag: false,
  });

  const escalationPreview = buildSupportEscalationRulesPreview({
    ticketId: 'ticket_qa_001',
    threadId: importedTicket.externalThreadId,
    customerEmail: 'customer@example.com',
    subject: importedTicket.subject,
    bodySnippet: importedTicket.snippet,
    category: classificationPreview.result.category,
    sensitiveFlag: classificationPreview.result.sensitiveFlag,
    classifierConfidence: classificationPreview.result.confidence,
  });

  const draftActionPreview = buildSupportDraftActionPreview({
    ticketId: 'ticket_qa_001',
    threadId: importedTicket.externalThreadId,
    customerEmail: 'customer@example.com',
    customerName: 'Customer QA',
    subject: importedTicket.subject,
    draftReplyBody: 'Hello, thank you for reaching out. I understand the delayed order concern. I have prepared this for founder review before any refund-related reply is sent.',
    category: classificationPreview.result.category,
    confidenceScore: classificationPreview.result.confidence,
    sensitiveFlag: classificationPreview.result.sensitiveFlag,
    escalationRequired: escalationPreview.result.escalationRequired,
    sourceDraftId: 'draft_support_qa_001',
    approvalNotes: 'QA fixture: refund-related support reply must remain founder-reviewed.',
  });

  const actionUiPreview = buildSupportActionUiPreview({
    ticketId: 'ticket_qa_001',
    threadId: importedTicket.externalThreadId,
    actionId: 'action_support_reply_qa_001',
    actionStatus: 'proposed',
    customerEmail: 'customer@example.com',
    subject: importedTicket.subject,
    bodySnippet: importedTicket.snippet,
    suggestedReply: draftActionPreview.browserSafePreview.replyBodyPreview,
    category: classificationPreview.result.category,
    confidenceScore: classificationPreview.result.confidence,
    sensitiveFlag: classificationPreview.result.sensitiveFlag,
    escalationRequired: escalationPreview.result.escalationRequired,
    riskLevel: draftActionPreview.riskLevel,
  });

  const permissionControls = [
    buildSupportQaPermissionCheck('owner'),
    buildSupportQaPermissionCheck('admin'),
    buildSupportQaPermissionCheck('operator'),
    buildSupportQaPermissionCheck('viewer'),
    buildSupportQaPermissionCheck(parsed.reviewerRole as SupportConnectorQaPermissionRole),
  ];

  const scenarios: SupportConnectorQaScenario[] = [
    buildScenario({
      name: 'ticket_import',
      label: 'Ticket import',
      status: importPreview.normalizedTickets.length === 1 && importPreview.emailSent === false && importPreview.externalApiCalled === false ? 'passed' : 'failed',
      passed: importPreview.normalizedTickets.length === 1 && importPreview.emailSent === false && importPreview.externalApiCalled === false,
      evidence: [
        `Normalized ${importPreview.normalizedTickets.length} Gmail read-only ticket fixture.`,
        `Raw provider payload separated: ${importedTicket.rawPayloadSeparated === true}.`,
        `Browser-safe email hint: ${importedTicket.fromEmailHint ?? 'none'}.`,
      ],
      warnings: importPreview.warnings,
    }),
    buildScenario({
      name: 'classification',
      label: 'Ticket classification',
      status: classificationPreview.result.category === 'refund' && escalationPreview.result.escalationRequired === true ? 'passed' : 'failed',
      passed: classificationPreview.result.category === 'refund' && escalationPreview.result.escalationRequired === true,
      evidence: [
        `Category: ${classificationPreview.result.category}.`,
        `Confidence: ${classificationPreview.result.confidence}.`,
        `Escalation required: ${escalationPreview.result.escalationRequired}.`,
      ],
      warnings: classificationPreview.warnings,
    }),
    buildScenario({
      name: 'draft_action',
      label: 'Draft action',
      status: draftActionPreview.actionType === 'support_reply_send' && draftActionPreview.approvalRequired === true ? 'passed' : 'failed',
      passed: draftActionPreview.actionType === 'support_reply_send' && draftActionPreview.approvalRequired === true,
      evidence: [
        `Action type: ${draftActionPreview.actionType}.`,
        `Policy decision: ${draftActionPreview.policyDecision}.`,
        `Risk level: ${draftActionPreview.riskLevel}.`,
        `Creates proposed action only: ${draftActionPreview.safety.createsProposedActionOnly}.`,
      ],
      warnings: draftActionPreview.warnings,
    }),
    buildScenario({
      name: 'no_send_safety',
      label: 'No-send safety',
      status:
        draftActionPreview.safety.emailSent === false &&
        draftActionPreview.safety.gmailApiCalled === false &&
        draftActionPreview.safety.externalWriteEnabled === false &&
        actionUiPreview.reviewControls.canSendEmail === false
          ? 'passed'
          : 'failed',
      passed:
        draftActionPreview.safety.emailSent === false &&
        draftActionPreview.safety.gmailApiCalled === false &&
        draftActionPreview.safety.externalWriteEnabled === false &&
        actionUiPreview.reviewControls.canSendEmail === false,
      evidence: [
        `Email sent: ${draftActionPreview.safety.emailSent}.`,
        `Gmail API called: ${draftActionPreview.safety.gmailApiCalled}.`,
        `External write enabled: ${draftActionPreview.safety.externalWriteEnabled}.`,
        `Review UI can send email: ${actionUiPreview.reviewControls.canSendEmail}.`,
      ],
      warnings: [],
    }),
    buildScenario({
      name: 'permission_controls',
      label: 'Permission controls',
      status:
        permissionControls.some((permission) => permission.role === 'owner' && permission.canApproveSupportReplyAction === true) &&
        permissionControls.some((permission) => permission.role === 'viewer' && permission.canApproveSupportReplyAction === false) &&
        permissionControls.every((permission) => permission.canExecuteSupportSend === false)
          ? 'passed'
          : 'failed',
      passed:
        permissionControls.some((permission) => permission.role === 'owner' && permission.canApproveSupportReplyAction === true) &&
        permissionControls.some((permission) => permission.role === 'viewer' && permission.canApproveSupportReplyAction === false) &&
        permissionControls.every((permission) => permission.canExecuteSupportSend === false),
      evidence: [
        'Owner/admin can approve or reject internal proposed actions only.',
        'Viewer can not approve or reject support reply actions.',
        'No role can execute support sending in Phase 12.10.',
      ],
      warnings: [],
    }),
  ];

  const passedScenarios = scenarios.filter((scenario) => scenario.passed).length;
  const failedScenarios = scenarios.filter((scenario) => !scenario.passed).length;
  const manualReviewScenarios = scenarios.filter((scenario) => scenario.status === 'manual_review_required').length;

  const report: SupportConnectorQaReport = {
    phase: 'V2 Phase 12.10 — Support Connector QA',
    healthMode: SUPPORT_CONNECTOR_QA_HEALTH_MODE,
    deliverable: 'support_connector_qa_report',
    selectedConnector: 'gmail',
    qaMode: 'safe_report_only',
    summary: {
      totalScenarios: scenarios.length,
      passedScenarios,
      failedScenarios,
      manualReviewScenarios,
      overallStatus: failedScenarios > 0 ? 'failed' : manualReviewScenarios > 0 ? 'manual_review_required' : 'passed',
    },
    scenarios,
    permissionControls,
    safeArtifacts: {
      importedTicketCount: importPreview.normalizedTickets.length,
      ticketCategory: classificationPreview.result.category,
      ticketEscalationRequired: escalationPreview.result.escalationRequired,
      draftActionType: draftActionPreview.actionType,
      draftActionPolicyDecision: draftActionPreview.policyDecision,
      approvalRequired: true,
      approveRejectOnly: true,
      sendExecutorPresent: false,
    },
    safety: {
      reportOnly: true,
      gmailOAuthAdded: false,
      gmailApiClientAdded: false,
      gmailExternalApiCalled: false,
      gmailSendScopeRequested: false,
      gmailModifyScopeRequested: false,
      emailSent: false,
      supportSendExecutorAdded: false,
      supportAutoReplyAdded: false,
      actionExecuted: false,
      databaseMigrationAdded: false,
      databaseWritePerformed: false,
      rawProviderPayloadReturned: false,
      rawTicketPayloadReturned: false,
      tokenValueReturned: false,
    },
  };

  assertSupportConnectorQaSafe(report);
  return report;
}
