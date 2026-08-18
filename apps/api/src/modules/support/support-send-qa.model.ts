import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';
import type { GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import {
  SUPPORT_SEND_EXECUTOR_NAME,
  SUPPORT_SEND_REQUIRED_SCOPE,
  executeManualApprovedGmailSupportReplySend,
} from './support-send-executor.model.js';
import type { SupportThreadAssociationTicketInput } from './support-thread-association.types.js';
import type {
  SupportSendQaCheckResult,
  SupportSendQaReport,
  SupportSendQaStatus,
} from './support-send-qa.types.js';

export const SUPPORT_SEND_QA_PHASE = 'phase_13_10_support_send_qa' as const;
export const SUPPORT_SEND_QA_HEALTH_MODE = 'v2-phase-13-10-support-send-qa' as const;
export const SUPPORT_SEND_QA_PACKAGE = 'lifesaver-v0.7.0-phase-13-10-support-send-qa.zip' as const;
export const SUPPORT_SEND_QA_DELIVERABLE = 'support_send_qa_report' as const;
export const SUPPORT_SEND_QA_PROVIDER = 'gmail' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
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
  'raw_provider_payload',
  'raw_ticket_payload',
  'raw_mime',
  'raw_base64',
  'bearer ',
  'test-access-token-value-long-enough',
];

type JsonObject = Record<string, unknown>;

const approvedAt = new Date('2026-07-08T12:00:00.000Z');

const basePayload = {
  action_type: 'support_reply_send',
  schema_version: 'support_reply_send.v1',
  source: 'support_draft_to_action',
  intent_summary: 'Review and approve a drafted shipping support reply.',
  idempotency_hint: 'support-reply:ticket_qa_123:phase-13-10',
  data: {
    support_provider: 'gmail',
    ticket_id: 'ticket_qa_123',
    thread_id: 'gmail_thread_qa_123',
    customer_email: 'customer@example.com',
    subject: 'Where is my order?',
    reply_body: 'Hello, thank you for reaching out. Your tracking is moving normally and should update again shortly.',
    category: 'shipping',
    confidence_score: 0.9,
    sensitive_flag: false,
    escalation_required: false,
    send_email_enabled: false,
    external_api_called: false,
    auto_reply_enabled: false,
  },
} as const;

function mockAction(overrides: Partial<WorkspaceActionDetailRow> = {}): WorkspaceActionDetailRow {
  return {
    id: 'action_qa_123',
    workspace_id: 'workspace_qa_123',
    created_by_user_id: 'user_creator_qa',
    action_type: 'support_reply_send',
    title: 'Approve support reply QA',
    description: 'Drafted support reply for QA.',
    status: 'approved',
    risk_level: 'medium',
    approval_required: true,
    policy_decision: 'ask',
    policy_decision_snapshot_json: {},
    policy_evaluated_at: null,
    idempotency_key: 'support-reply:ticket_qa_123:phase-13-10',
    action_hash: 'hash_qa_123',
    payload_json: basePayload as unknown as JsonObject,
    created_at: new Date('2026-07-08T11:55:00.000Z'),
    updated_at: new Date('2026-07-08T12:00:00.000Z'),
    approved_at: approvedAt,
    executed_at: null,
    ...overrides,
  };
}

function mockPause(overrides: Partial<GlobalPauseBackendState> = {}): GlobalPauseBackendState {
  return {
    workspaceId: 'workspace_qa_123',
    pauseAllAutonomy: false,
    pauseContentActions: false,
    pauseSupportActions: false,
    pauseAdsActions: false,
    pauseResearchActions: false,
    pauseDevActions: false,
    updatedBy: null,
    updatedAt: null,
    enforcement: {
      autoApprovalAllowed: true,
      executorExecutionAllowed: true,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'ok',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      support: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      ads: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      research: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      dev: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
    },
    emergencySafeMode: {
      version: '0.6.0',
      phase: 'v0.6.0 Phase 5.9 Emergency Safe Mode',
      active: false,
      source: 'environment',
      envKey: 'EMERGENCY_SAFE_MODE',
      reason: null,
      adminWarningVisible: false,
      executionBlocked: false,
      autoApprovalAllowed: false,
      executorExecutionAllowed: false,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      checkedAt: new Date('2026-07-08T12:00:00.000Z').toISOString(),
      safety: {
        externalWritesAttempted: false,
        executorRan: false,
        resumeDoesNotExecuteWaitingActions: true,
        note: 'Phase 13.10 QA mock emergency safe mode state.',
      },
    },
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'Mock pause state for Phase 13.10 QA.',
    },
    ...overrides,
  };
}

function mockTicket(overrides: Partial<SupportThreadAssociationTicketInput> = {}): SupportThreadAssociationTicketInput {
  return {
    id: 'support_ticket_qa_123',
    workspaceId: 'workspace_qa_123',
    provider: 'gmail',
    externalMessageId: 'gmail_message_qa_123',
    externalThreadId: 'gmail_thread_qa_123',
    customerEmail: 'customer@example.com',
    fromEmailHint: 'customer@example.com',
    subject: 'Where is my order?',
    status: 'open',
    updatedAt: new Date('2026-07-08T11:58:00.000Z').toISOString(),
    ...overrides,
  };
}

function passFail(condition: boolean): 'pass' | 'fail' {
  return condition ? 'pass' : 'fail';
}

function cleanEvidence(value: unknown): JsonObject {
  const serialized = JSON.stringify(value);
  const parsed = JSON.parse(serialized) as JsonObject;
  assertSupportSendQaOutputSafe(parsed);
  return parsed;
}

function buildCheck(params: {
  id: SupportSendQaCheckResult['id'];
  label: string;
  condition: boolean;
  summary: string;
  evidence: JsonObject;
}): SupportSendQaCheckResult {
  return {
    id: params.id,
    label: params.label,
    status: passFail(params.condition),
    summary: params.summary,
    evidence: cleanEvidence(params.evidence),
  };
}

function baseExecutionOptions(overrides: Parameters<typeof executeManualApprovedGmailSupportReplySend>[1] = {}) {
  const events: unknown[] = [];
  const results: unknown[] = [];
  let gmailCallCount = 0;
  const options: Parameters<typeof executeManualApprovedGmailSupportReplySend>[1] = {
    bypassDatabaseForTests: true,
    bypassFeatureFlagForTests: true,
    actionProvider: async () => mockAction(),
    approvalEventProvider: async () => ({ id: 'approval_event_qa_123', actor_user_id: 'user_founder_qa', created_at: approvedAt }),
    pauseStateProvider: async () => mockPause(),
    threadAssociationTicketProvider: async () => mockTicket(),
    credentialProvider: async () => ({
      accessToken: 'phase-13-10-mock-token-not-returned',
      grantedScopes: [SUPPORT_SEND_REQUIRED_SCOPE],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    transitionStatus: async (input: { toStatus: ActionStatus }) => ({ previous_status: (input.toStatus === 'executing' ? 'approved' : 'executing') as ActionStatus }),
    insertEvent: async (event: unknown) => { events.push(event); return true; },
    insertResult: async (result: unknown) => { results.push(result); return true; },
    client: async () => {
      gmailCallCount += 1;
      return { status: 200, headers: {}, body: { id: 'gmail_msg_qa_123', threadId: 'gmail_thread_qa_123' } };
    },
    ...overrides,
  };
  return {
    options,
    events,
    results,
    getGmailCallCount: () => gmailCallCount,
  };
}

async function runSafeApprovedSendCheck(): Promise<SupportSendQaCheckResult> {
  const { options, events, results, getGmailCallCount } = baseExecutionOptions();
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_123' }, options);
  const storedResult = results[0] as JsonObject | undefined;
  const condition = result.status === 'executed'
    && result.gmail.apiCalled === true
    && result.gmail.externalMessageId === 'gmail_msg_qa_123'
    && result.gmail.externalThreadId === 'gmail_thread_qa_123'
    && result.checks.manualApprovalConfirmed === true
    && result.safety.externalWritesSucceeded === true
    && getGmailCallCount() === 1
    && events.length >= 2;
  return buildCheck({
    id: 'safe_approved_send',
    label: 'One safe approved send',
    condition,
    summary: condition
      ? 'A single manually approved support reply executed through the mocked Gmail client and produced safe metadata.'
      : 'The safe approved send QA scenario did not satisfy all expected execution gates.',
    evidence: {
      status: result.status,
      statusPath: result.statusPath,
      apiCalled: result.gmail.apiCalled,
      gmailCallCount: getGmailCallCount(),
      externalMessageId: result.gmail.externalMessageId,
      externalThreadId: result.gmail.externalThreadId,
      manualApprovalConfirmed: result.checks.manualApprovalConfirmed,
      eventsRecorded: events.length,
      resultLogStored: result.resultLogStored,
      storedResultStatus: storedResult?.resultStatus,
      externalWritesSucceeded: result.safety.externalWritesSucceeded,
      rawTokenReturned: result.gmail.rawTokenReturned,
      rawMimeReturned: result.gmail.rawMimeReturned,
    },
  });
}

async function runNoDuplicateSendCheck(): Promise<SupportSendQaCheckResult> {
  const events: unknown[] = [];
  const results: unknown[] = [];
  let gmailCallCount = 0;
  let currentStatus: ActionStatus = 'approved';
  const options: Parameters<typeof executeManualApprovedGmailSupportReplySend>[1] = {
    bypassDatabaseForTests: true,
    bypassFeatureFlagForTests: true,
    actionProvider: async () => mockAction({ status: currentStatus, approved_at: approvedAt }),
    approvalEventProvider: async () => ({ id: 'approval_event_qa_dup', actor_user_id: 'user_founder_qa', created_at: approvedAt }),
    pauseStateProvider: async () => mockPause(),
    threadAssociationTicketProvider: async () => mockTicket(),
    credentialProvider: async () => ({ accessToken: 'phase-13-10-mock-token-not-returned', grantedScopes: [SUPPORT_SEND_REQUIRED_SCOPE], expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    insertEvent: async (event: unknown) => { events.push(event); return true; },
    insertResult: async (result: unknown) => { results.push(result); return true; },
    client: async () => {
      gmailCallCount += 1;
      return { status: 200, headers: {}, body: { id: 'gmail_msg_qa_dup', threadId: 'gmail_thread_qa_123' } };
    },
    transitionStatus: async (input: { fromStatuses: ActionStatus[]; toStatus: ActionStatus }) => {
      if (!input.fromStatuses.includes(currentStatus)) return null;
      const previous = currentStatus;
      currentStatus = input.toStatus;
      return { previous_status: previous };
    },
  };

  const first = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_dup' }, options);
  const second = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_dup' }, options);
  const condition = first.status === 'executed'
    && second.status === 'blocked'
    && second.gmail.apiCalled === false
    && gmailCallCount === 1
    && String(currentStatus) === 'executed';

  return buildCheck({
    id: 'no_duplicate_send',
    label: 'No duplicate send',
    condition,
    summary: condition
      ? 'A second execution attempt for the same approved action was blocked before the mocked Gmail client could be called again.'
      : 'Duplicate-send protection did not block the second execution attempt as expected.',
    evidence: {
      firstStatus: first.status,
      secondStatus: second.status,
      secondMessage: second.message,
      gmailCallCount,
      finalActionStatus: currentStatus,
      secondApiCalled: second.gmail.apiCalled,
      resultRowsRecorded: results.length,
      eventsRecorded: events.length,
    },
  });
}

async function runCorrectThreadCheck(): Promise<SupportSendQaCheckResult> {
  const { options, getGmailCallCount } = baseExecutionOptions({
    threadAssociationTicketProvider: async () => mockTicket({ externalThreadId: 'gmail_thread_wrong_999' }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_wrong_thread' }, options);
  const condition = result.status === 'blocked'
    && result.checks.importedTicketFound === true
    && result.checks.threadMatchesImportedTicket === false
    && result.checks.threadAssociationVerified === false
    && result.gmail.apiCalled === false
    && getGmailCallCount() === 0;

  return buildCheck({
    id: 'correct_thread',
    label: 'Correct thread required',
    condition,
    summary: condition
      ? 'A mismatched imported Gmail thread was blocked before the mocked Gmail client could be called.'
      : 'Thread association QA did not block the mismatched thread scenario as expected.',
    evidence: {
      status: result.status,
      importedTicketFound: result.checks.importedTicketFound,
      threadAssociationVerified: result.checks.threadAssociationVerified,
      threadMatchesImportedTicket: result.checks.threadMatchesImportedTicket,
      apiCalled: result.gmail.apiCalled,
      gmailCallCount: getGmailCallCount(),
      message: result.message,
    },
  });
}

async function runLogsStoredCheck(): Promise<SupportSendQaCheckResult> {
  const { options, results } = baseExecutionOptions();
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_logs' }, options);
  const stored = results[0] as JsonObject | undefined;
  const metadata = (stored?.metadataJson || {}) as JsonObject;
  const condition = result.status === 'executed'
    && result.resultLogStored === true
    && result.checks.supportSendResultLogStored === true
    && result.checks.supportSendResultLogHasExternalMessageId === true
    && result.checks.supportSendResultLogHasThreadId === true
    && result.checks.supportSendResultLogHasSentTimestamp === true
    && result.checks.supportSendResultLogHasApiResponseSummary === true
    && metadata.support_send_result_log_health_mode === 'v2-phase-13-8-send-result-logs'
    && metadata.external_message_id === 'gmail_msg_qa_123'
    && metadata.external_thread_id === 'gmail_thread_qa_123'
    && typeof metadata.sent_at === 'string'
    && typeof metadata.api_response_summary === 'string';

  return buildCheck({
    id: 'logs_stored',
    label: 'Logs stored',
    condition,
    summary: condition
      ? 'The support send result log contains the external message ID, thread ID, sent timestamp, API response summary, and safe metadata.'
      : 'The support send result log did not include every required Phase 13.8/13.10 field.',
    evidence: {
      status: result.status,
      resultLogStored: result.resultLogStored,
      supportSendResultLogStored: result.checks.supportSendResultLogStored,
      hasExternalMessageId: result.checks.supportSendResultLogHasExternalMessageId,
      hasThreadId: result.checks.supportSendResultLogHasThreadId,
      hasSentTimestamp: result.checks.supportSendResultLogHasSentTimestamp,
      hasApiResponseSummary: result.checks.supportSendResultLogHasApiResponseSummary,
      metadataHealthMode: metadata.support_send_result_log_health_mode,
      externalMessageId: metadata.external_message_id,
      externalThreadId: metadata.external_thread_id,
      sentAtType: typeof metadata.sent_at,
      apiResponseSummaryType: typeof metadata.api_response_summary,
      providerPayloadReturned: metadata.provider_payload_returned === true,
    },
  });
}

async function runSensitiveTicketBlockedCheck(): Promise<SupportSendQaCheckResult> {
  const refundPayload = {
    ...basePayload,
    data: {
      ...basePayload.data,
      ticket_id: 'ticket_qa_refund',
      subject: 'Refund request',
      reply_body: 'Hello, I can help review the refund policy and next steps.',
      category: 'refund',
      confidence_score: 0.62,
      sensitive_flag: true,
      escalation_required: true,
    },
  } as const;
  const { options, getGmailCallCount } = baseExecutionOptions({
    actionProvider: async () => mockAction({
      id: 'action_qa_sensitive',
      status: 'proposed',
      approved_at: null,
      payload_json: refundPayload as unknown as JsonObject,
    }),
    approvalEventProvider: async () => null,
    threadAssociationTicketProvider: async () => mockTicket({
      id: 'support_ticket_qa_refund',
      externalThreadId: 'gmail_thread_qa_123',
      subject: 'Refund request',
      status: 'open',
    }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'workspace_qa_123', userId: 'user_founder_qa', actionId: 'action_qa_sensitive' }, options);
  const condition = result.status === 'blocked'
    && result.checks.manualApprovalConfirmed === false
    && result.gmail.apiCalled === false
    && getGmailCallCount() === 0;

  return buildCheck({
    id: 'sensitive_ticket_blocked',
    label: 'Sensitive ticket blocked without approval',
    condition,
    summary: condition
      ? 'A refund/low-confidence support reply without manual approval was blocked before any Gmail call.'
      : 'Sensitive-ticket QA did not block the unapproved refund/low-confidence scenario as expected.',
    evidence: {
      status: result.status,
      manualApprovalConfirmed: result.checks.manualApprovalConfirmed,
      apiCalled: result.gmail.apiCalled,
      gmailCallCount: getGmailCallCount(),
      message: result.message,
      note: 'Sensitive tickets may only proceed after founder/admin approval evidence is present; this QA verifies the blocked path.',
    },
  });
}

export function buildSupportSendQaStatus(): SupportSendQaStatus {
  return {
    phase: 'V2 Phase 13.10 — Support Send QA',
    healthMode: SUPPORT_SEND_QA_HEALTH_MODE,
    deliverable: SUPPORT_SEND_QA_DELIVERABLE,
    actionType: 'support_reply_send',
    provider: SUPPORT_SEND_QA_PROVIDER,
    qaChecks: ['safe_approved_send', 'no_duplicate_send', 'correct_thread', 'logs_stored', 'sensitive_ticket_blocked'],
    verifiesOneSafeApprovedSend: true,
    verifiesNoDuplicateSend: true,
    verifiesCorrectThread: true,
    verifiesLogsStored: true,
    verifiesSensitiveTicketBlocked: true,
    qaUsesMockGmailClient: true,
    liveGmailSendPerformedByQa: false,
    manualApprovalRequiredStill: true,
    autoSendEnabled: false,
    bulkSendEnabled: false,
    noDatabaseMigrationRequired: true,
    rawTokenReturnedToBrowser: false,
    rawMimeReturnedToBrowser: false,
    providerPayloadReturnedToBrowser: false,
    nextStep: 'Phase 14.1 — Ads Connector Audit',
  };
}

export async function buildSupportSendQaReport(): Promise<SupportSendQaReport> {
  const checks = [
    await runSafeApprovedSendCheck(),
    await runNoDuplicateSendCheck(),
    await runCorrectThreadCheck(),
    await runLogsStoredCheck(),
    await runSensitiveTicketBlockedCheck(),
  ];
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.length - passed;
  const report: SupportSendQaReport = {
    version: '0.7.0',
    phase: SUPPORT_SEND_QA_PHASE,
    healthMode: SUPPORT_SEND_QA_HEALTH_MODE,
    deliverable: SUPPORT_SEND_QA_DELIVERABLE,
    provider: SUPPORT_SEND_QA_PROVIDER,
    actionType: 'support_reply_send',
    overallStatus: failed === 0 ? 'pass' : 'fail',
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      passed,
      failed,
      total: checks.length,
      oneSafeApprovedSendVerified: checks.find((check) => check.id === 'safe_approved_send')?.status === 'pass',
      noDuplicateSendVerified: checks.find((check) => check.id === 'no_duplicate_send')?.status === 'pass',
      correctThreadVerified: checks.find((check) => check.id === 'correct_thread')?.status === 'pass',
      logsStoredVerified: checks.find((check) => check.id === 'logs_stored')?.status === 'pass',
      sensitiveTicketBlockedVerified: checks.find((check) => check.id === 'sensitive_ticket_blocked')?.status === 'pass',
    },
    safety: {
      qaUsesMockGmailClient: true,
      liveGmailSendPerformedByQa: false,
      autoSendEnabled: false,
      bulkSendEnabled: false,
      manualApprovalStillRequired: true,
      rawTokenReturned: false,
      rawMimeReturned: false,
      rawProviderPayloadReturned: false,
      noDatabaseMigrationRequired: true,
      note: 'Phase 13.10 is a QA/report layer. It verifies the manual-approved support send path with a mocked Gmail client by default. It does not perform a live Gmail send, does not enable auto-send, does not enable bulk sending, and does not expose raw OAuth tokens, raw MIME/base64, or raw provider payloads.',
    },
  };
  assertSupportSendQaOutputSafe(report);
  return report;
}

export async function buildSupportSendQaExample() {
  const report = await buildSupportSendQaReport();
  return {
    status: buildSupportSendQaStatus(),
    report,
    safety: report.safety,
  };
}

export async function previewSupportSendQaReport() {
  return {
    previewOnly: true,
    report: await buildSupportSendQaReport(),
    safety: {
      previewCallsLiveGmail: false,
      previewSendsEmail: false,
      usesMockGmailClient: true,
      rawTokenReturned: false,
      rawMimeReturned: false,
      providerPayloadReturned: false,
    },
  };
}

export function assertSupportSendQaOutputSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support send QA output contains forbidden fragment: ${fragment}`);
    }
  }
}
