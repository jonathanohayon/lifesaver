import type {
  SupportSendResultActionResultInsert,
  SupportSendResultLogChecks,
  SupportSendResultLogInput,
  SupportSendResultLogRecord,
  SupportSendResultLogsStatus,
} from './support-send-result-logs.types.js';

export const SUPPORT_SEND_RESULT_LOGS_PHASE = 'phase_13_8_send_result_logs' as const;
export const SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE = 'v2-phase-13-8-send-result-logs' as const;
export const SUPPORT_SEND_RESULT_LOGS_PACKAGE = 'lifesaver-v0.7.0-phase-13-8-send-result-logs.zip' as const;
export const SUPPORT_SEND_RESULT_LOGS_DELIVERABLE = 'support_send_result_log' as const;
export const SUPPORT_SEND_RESULT_LOGS_PROVIDER = 'gmail' as const;

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
];

type JsonObject = Record<string, unknown>;

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function cleanText(value: unknown, max = 700): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function safeId(value: unknown, max = 240): string | null {
  const clean = cleanText(value, max);
  if (!clean) return null;
  if (/access[_-]?token|refresh[_-]?token|bearer\s+/i.test(clean)) return null;
  return clean;
}

function safeIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function finiteStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function extractBodySummary(value: unknown): string | null {
  const body = safeObject(value);
  const id = safeId(body.id);
  const threadId = safeId(body.threadId);
  const error = cleanText(safeObject(body.error).message || body.error || body.message, 260);
  const parts: string[] = [];
  if (id) parts.push(`message_id_present=true`);
  if (threadId) parts.push(`thread_id_present=true`);
  if (error) parts.push(`error=${error}`);
  return parts.length ? parts.join('; ') : null;
}

export function buildSupportSendApiResponseSummary(input: {
  provider?: 'gmail';
  apiStatus?: number | null;
  apiResponseBody?: unknown;
  fallback?: string | null;
}): string {
  const status = finiteStatus(input.apiStatus);
  const bodySummary = extractBodySummary(input.apiResponseBody);
  const fallback = cleanText(input.fallback, 360);
  const parts = [`provider=${input.provider || SUPPORT_SEND_RESULT_LOGS_PROVIDER}`];
  if (status !== null) parts.push(`http_status=${status}`);
  if (bodySummary) parts.push(bodySummary);
  if (!bodySummary && fallback) parts.push(fallback);
  if (parts.length === 1) parts.push('response_summary=not_available');
  return parts.join('; ');
}

function buildResultSummary(params: {
  resultStatus: 'success' | 'failed' | 'blocked';
  externalMessageId: string | null;
  externalThreadId: string | null;
  apiResponseSummary: string;
  failureReason: string | null;
}): string {
  if (params.resultStatus === 'success') {
    return params.externalMessageId
      ? `Gmail support reply sent and logged. External message ID: ${params.externalMessageId}. Thread ID: ${params.externalThreadId || 'not returned'}.`
      : `Gmail support reply sent and logged. External message ID was not returned. Thread ID: ${params.externalThreadId || 'not returned'}.`;
  }
  if (params.resultStatus === 'failed') {
    return `Gmail support reply send failed and result was logged. ${params.failureReason || params.apiResponseSummary}`;
  }
  return `Gmail support reply send was blocked and result was logged. ${params.failureReason || params.apiResponseSummary}`;
}

export function buildSupportSendResultLogEntry(input: SupportSendResultLogInput): SupportSendResultLogRecord {
  const provider = input.provider || SUPPORT_SEND_RESULT_LOGS_PROVIDER;
  const externalMessageId = safeId(input.externalMessageId);
  const externalThreadId = safeId(input.externalThreadId);
  const sentAt = safeIso(input.sentAt) || (input.resultStatus === 'success' ? new Date().toISOString() : null);
  const failureReason = input.resultStatus === 'success' ? null : cleanText(input.failureReason || 'Support send did not complete successfully.', 700);
  const apiResponseSummary = buildSupportSendApiResponseSummary({
    provider,
    apiStatus: input.apiStatus ?? null,
    apiResponseBody: input.apiResponseBody,
    fallback: input.apiResponseSummary || failureReason,
  });

  const checks: SupportSendResultLogChecks = {
    workspaceIdPresent: Boolean(safeId(input.workspaceId)),
    actionIdPresent: Boolean(safeId(input.actionId)),
    executorNamePresent: Boolean(safeId(input.executorName)),
    providerIsGmail: provider === SUPPORT_SEND_RESULT_LOGS_PROVIDER,
    resultStatusValid: ['success', 'failed', 'blocked'].includes(input.resultStatus),
    externalMessageIdStored: Boolean(externalMessageId),
    threadIdStored: Boolean(externalThreadId),
    sentTimestampStored: Boolean(sentAt),
    apiResponseSummaryStored: Boolean(apiResponseSummary),
    failureReasonStoredWhenFailed: input.resultStatus === 'success' || Boolean(failureReason),
    rawTokenReturned: false,
    rawMimeReturned: false,
    providerPayloadReturned: false,
  };

  const metadataJson: JsonObject = {
    phase: SUPPORT_SEND_RESULT_LOGS_PHASE,
    support_send_result_log_health_mode: SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
    provider,
    external_message_id: externalMessageId,
    external_thread_id: externalThreadId,
    sent_at: sentAt,
    api_response_summary: apiResponseSummary,
    failure_reason: failureReason,
    ticket_id: safeId(input.ticketId),
    imported_ticket_id: safeId(input.importedTicketId),
    manual_approval_required: input.manualApprovalRequired !== false,
    external_writes_attempted: Boolean(input.externalWritesAttempted),
    external_writes_succeeded: Boolean(input.externalWritesSucceeded),
    token_returned: false,
    mime_returned: false,
    provider_payload_returned: false,
    ...(safeObject(input.metadataJson)),
  };

  const actionResult: SupportSendResultActionResultInsert = {
    workspaceId: String(input.workspaceId || ''),
    actionId: String(input.actionId || ''),
    executorName: String(input.executorName || ''),
    externalId: externalMessageId,
    externalUrl: null,
    resultStatus: input.resultStatus,
    resultSummary: buildResultSummary({ resultStatus: input.resultStatus, externalMessageId, externalThreadId, apiResponseSummary, failureReason }),
    errorMessage: failureReason,
    metadataJson,
  };

  const record: SupportSendResultLogRecord = {
    version: '0.7.0',
    phase: SUPPORT_SEND_RESULT_LOGS_PHASE,
    healthMode: SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
    deliverable: SUPPORT_SEND_RESULT_LOGS_DELIVERABLE,
    provider,
    actionType: 'support_reply_send',
    actionId: actionResult.actionId,
    workspaceId: actionResult.workspaceId,
    resultStatus: input.resultStatus,
    externalMessageId,
    externalThreadId,
    sentAt,
    apiResponseSummary,
    failureReason,
    checks,
    actionResult,
    safety: {
      resultLogOnly: true,
      emailSentByThisModule: false,
      gmailApiCalledByThisModule: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
      providerPayloadReturned: false,
      browserReceivesProviderPayload: false,
      note: 'Phase 13.8 stores support send result metadata after the executor outcome. It does not call Gmail, does not send email, and does not expose raw OAuth tokens, raw MIME/base64, or raw provider payloads.',
    },
  };

  assertSupportSendResultLogOutputSafe(record);
  return record;
}

export function buildSupportSendResultLogsStatus(): SupportSendResultLogsStatus {
  return {
    phase: 'V2 Phase 13.8 — Send Result Logs',
    healthMode: SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
    deliverable: SUPPORT_SEND_RESULT_LOGS_DELIVERABLE,
    actionType: 'support_reply_send',
    provider: SUPPORT_SEND_RESULT_LOGS_PROVIDER,
    storesExternalMessageId: true,
    storesThreadId: true,
    storesSentTimestamp: true,
    storesApiResponseSummary: true,
    storesFailureReason: true,
    integratedWithManualApprovedExecutor: true,
    manualApprovalRequiredStill: true,
    autoSendEnabled: false,
    bulkSendEnabled: false,
    noDatabaseMigrationRequired: true,
    previewCallsGmail: false,
    previewSendsEmail: false,
    rawTokenReturnedToBrowser: false,
    rawMimeReturnedToBrowser: false,
    providerPayloadReturnedToBrowser: false,
    nextStep: 'Phase 13.9 — Follow-Up/Rollback Handling',
  };
}

export function buildSupportSendResultLogsExample() {
  const success = buildSupportSendResultLogEntry({
    workspaceId: 'workspace_123',
    actionId: 'action_123',
    executorName: 'gmailManualApprovedSupportReplyExecutor',
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_123',
    externalThreadId: 'gmail_thread_123',
    sentAt: '2026-07-08T12:30:00.000Z',
    apiStatus: 200,
    apiResponseBody: { id: 'gmail_msg_123', threadId: 'gmail_thread_123' },
    ticketId: 'ticket_123',
    importedTicketId: 'support_ticket_123',
    manualApprovalRequired: true,
    externalWritesAttempted: true,
    externalWritesSucceeded: true,
  });
  const failed = buildSupportSendResultLogEntry({
    workspaceId: 'workspace_123',
    actionId: 'action_124',
    executorName: 'gmailManualApprovedSupportReplyExecutor',
    resultStatus: 'failed',
    externalThreadId: 'gmail_thread_124',
    apiStatus: 403,
    apiResponseBody: { error: { message: 'permission denied' } },
    failureReason: 'Gmail API returned 403; support reply was not confirmed as sent.',
    ticketId: 'ticket_124',
    manualApprovalRequired: true,
    externalWritesAttempted: true,
    externalWritesSucceeded: false,
  });
  return {
    status: buildSupportSendResultLogsStatus(),
    successExample: success,
    failedExample: failed,
    safety: {
      exampleSendsEmail: false,
      exampleCallsGmail: false,
      providerPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function previewSupportSendResultLog(input: unknown) {
  const body = safeObject(input);
  return {
    previewOnly: true,
    resultLog: buildSupportSendResultLogEntry({
      workspaceId: String(body.workspaceId || 'workspace_preview'),
      actionId: String(body.actionId || 'action_preview'),
      executorName: String(body.executorName || 'gmailManualApprovedSupportReplyExecutor'),
      resultStatus: (['success', 'failed', 'blocked'].includes(String(body.resultStatus)) ? body.resultStatus : 'success') as 'success' | 'failed' | 'blocked',
      externalMessageId: body.externalMessageId as string | null | undefined,
      externalThreadId: body.externalThreadId as string | null | undefined,
      sentAt: body.sentAt as string | null | undefined,
      apiStatus: finiteStatus(body.apiStatus),
      apiResponseSummary: cleanText(body.apiResponseSummary),
      apiResponseBody: body.apiResponseBody,
      failureReason: cleanText(body.failureReason),
      ticketId: body.ticketId as string | null | undefined,
      importedTicketId: body.importedTicketId as string | null | undefined,
      manualApprovalRequired: body.manualApprovalRequired !== false,
      externalWritesAttempted: body.externalWritesAttempted === true,
      externalWritesSucceeded: body.externalWritesSucceeded === true,
    }),
    safety: {
      previewCallsGmail: false,
      previewSendsEmail: false,
      providerPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function assertSupportSendResultLogOutputSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support send result log output contains forbidden fragment: ${fragment}`);
    }
  }
}
