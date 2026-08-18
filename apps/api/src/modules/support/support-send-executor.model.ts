import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { env } from '../../config/env.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import type { GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import { getWorkspaceActionForUser, insertActionLifecycleEvent } from '../actions/actions.repository.js';
import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';
import { redactSupportTextForLogs } from './support-privacy-safeguards.model.js';
import { evaluateSupportSendManualApprovalGate } from './support-manual-approval-gate.model.js';
import {
  SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE,
  evaluateSupportThreadAssociation,
  normalizeSupportThreadAssociationTicketRow,
} from './support-thread-association.model.js';
import {
  SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
  evaluateSupportBulkSendGuardFromPayload,
} from './support-bulk-send-guard.model.js';
import {
  SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
  evaluateSupportSensitiveTicketGuardFromPayload,
} from './support-sensitive-ticket-guard.model.js';
import {
  SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
  buildSupportSendResultLogEntry,
} from './support-send-result-logs.model.js';
import { findSupportTicketForThreadAssociation } from './support-thread-association.repository.js';
import type { SupportThreadAssociationTicketInput } from './support-thread-association.types.js';
import {
  findLatestSupportReplyApprovalEvent,
  insertSupportSendActionResult,
  transitionSupportReplyActionStatus,
  type SupportSendApprovedEventRow,
} from './support-send-executor.repository.js';
import type {
  GmailSendClient,
  GmailSendClientResponse,
  GmailSendCredential,
  GmailSendRequest,
  NormalizedSupportReplySendPayload,
  SupportSendExecutionResult,
  SupportSendExecutorChecks,
  SupportSendExecutorStatus,
  SupportSendRequestPreview,
} from './support-send-executor.types.js';

export const SUPPORT_SEND_EXECUTOR_PHASE = 'phase_13_2_send_reply_executor' as const;
export const SUPPORT_SEND_EXECUTOR_HEALTH_MODE = 'v2-phase-13-2-send-reply-executor' as const;
export const SUPPORT_SEND_EXECUTOR_PACKAGE = 'lifesaver-v0.7.0-phase-13-2-send-reply-executor.zip' as const;
export const SUPPORT_SEND_EXECUTOR_NAME = 'gmailManualApprovedSupportReplyExecutor' as const;
export const SUPPORT_SEND_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/gmail.send' as const;

type JsonObject = Record<string, unknown>;

type ExecuteOptions = {
  client?: GmailSendClient;
  credentialProvider?: (workspaceId: string) => Promise<GmailSendCredential>;
  bypassFeatureFlagForTests?: boolean;
  bypassDatabaseForTests?: boolean;
  actionProvider?: (input: { workspaceId: string; userId: string; actionId: string }) => Promise<WorkspaceActionDetailRow | null>;
  approvalEventProvider?: (input: { workspaceId: string; actionId: string }) => Promise<SupportSendApprovedEventRow | null>;
  pauseStateProvider?: (workspaceId: string) => Promise<GlobalPauseBackendState>;
  transitionStatus?: (input: { workspaceId: string; actionId: string; fromStatuses: ActionStatus[]; toStatus: Extract<ActionStatus, 'executing' | 'executed' | 'failed'> }) => Promise<{ previous_status: ActionStatus } | null>;
  insertEvent?: typeof insertActionLifecycleEvent;
  insertResult?: typeof insertSupportSendActionResult;
  threadAssociationTicketProvider?: (input: { workspaceId: string; provider: 'gmail'; ticketId: string; threadId: string }) => Promise<SupportThreadAssociationTicketInput | null>;
};

const categoryValues = ['faq', 'shipping', 'complaint', 'refund', 'cancellation', 'payment_issue', 'sensitive', 'escalation'] as const;

const supportReplyPayloadSchema = z.object({
  action_type: z.literal('support_reply_send'),
  schema_version: z.literal('support_reply_send.v1'),
  source: z.string().trim().min(1).max(120).default('support_draft_to_action'),
  intent_summary: z.string().trim().max(500).default('Send an approved support reply.'),
  idempotency_hint: z.string().trim().max(240).default('support-reply-send'),
  data: z.object({
    support_provider: z.literal('gmail').default('gmail'),
    ticket_id: z.string().trim().min(1).max(180),
    thread_id: z.string().trim().min(1).max(240),
    reply_body: z.string().trim().min(1).max(8000),
    customer_email: z.string().trim().email().max(320),
    customer_name: z.string().trim().max(180).optional(),
    subject: z.string().trim().max(500).optional(),
    category: z.enum(categoryValues).default('faq'),
    confidence_score: z.number().min(0).max(1).default(0.7),
    sensitive_flag: z.boolean().default(false),
    escalation_required: z.boolean().default(false),
    approval_notes: z.string().trim().max(1200).optional(),
    source_draft_id: z.string().trim().max(180).optional(),
    send_email_enabled: z.boolean().optional().default(false),
    external_api_called: z.boolean().optional().default(false),
    auto_reply_enabled: z.boolean().optional().default(false),
  }).strict(),
}).strict();

const actionBodySchema = z.object({
  force: z.boolean().optional().default(false),
}).default({ force: false });

const forbiddenPayloadFragments = [
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
  'raw_mime',
  'cc:',
  'bcc:',
  'attachment',
];

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function compact(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function safeHeader(value: string | null | undefined, fallback = ''): string {
  return String(value || fallback).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function maskEmail(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.includes('@')) return '[REDACTED_EMAIL]';
  const [name, domain] = value.split('@');
  const safeName = name.length <= 2 ? `${name.slice(0, 1) || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseChecks(overrides: Partial<SupportSendExecutorChecks> = {}): SupportSendExecutorChecks {
  return {
    databaseConfigured: isDatabaseConfigured,
    featureFlagEnabled: false,
    actionFound: false,
    actionTypeValid: false,
    statusApproved: false,
    manualApprovalConfirmed: false,
    masterPauseOff: false,
    supportPauseOff: false,
    emergencySafeModeOff: false,
    payloadValid: false,
    threadIdPresent: false,
    recipientPresent: false,
    replyBodyPresent: false,
    attachmentsUnsupported: true,
    ccBccUnsupported: true,
    tokenValid: false,
    requiredScopePresent: false,
    importedTicketFound: false,
    threadAssociationVerified: false,
    threadMatchesImportedTicket: false,
    customerMatchesImportedTicket: false,
    bulkSendGuardPassed: false,
    bulkSendDetected: false,
    explicitBulkApprovalPresent: false,
    sensitiveTicketGuardPassed: false,
    sensitiveTicketDetected: false,
    lowConfidenceDetected: false,
    sensitiveManualApprovalRequired: false,
    supportSendResultLogStored: false,
    supportSendResultLogHasExternalMessageId: false,
    supportSendResultLogHasThreadId: false,
    supportSendResultLogHasSentTimestamp: false,
    supportSendResultLogHasApiResponseSummary: false,
    supportSendResultLogHasFailureReason: false,
    ...overrides,
  };
}

function makeResult(params: {
  workspaceId: string;
  actionId: string;
  status: SupportSendExecutionResult['status'];
  checks: SupportSendExecutorChecks;
  message: string;
  statusPath?: ActionStatus[];
  apiCalled?: boolean;
  apiStatus?: number | null;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  requestPreview?: SupportSendRequestPreview | null;
  resultLogStored?: boolean;
  externalWritesAttempted?: boolean;
  externalWritesSucceeded?: boolean;
}): SupportSendExecutionResult {
  return {
    version: '0.7.0',
    phase: SUPPORT_SEND_EXECUTOR_PHASE,
    healthMode: SUPPORT_SEND_EXECUTOR_HEALTH_MODE,
    executorName: SUPPORT_SEND_EXECUTOR_NAME,
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    actionType: 'support_reply_send',
    status: params.status,
    checks: {
      ...params.checks,
      supportSendResultLogStored: Boolean(params.resultLogStored),
      supportSendResultLogHasExternalMessageId: Boolean(params.externalMessageId),
      supportSendResultLogHasThreadId: Boolean(params.externalThreadId),
      supportSendResultLogHasSentTimestamp: params.status === 'executed' && Boolean(params.resultLogStored),
      supportSendResultLogHasApiResponseSummary: Boolean(params.resultLogStored),
      supportSendResultLogHasFailureReason: params.status === 'failed' && Boolean(params.resultLogStored),
    },
    gmail: {
      apiCalled: Boolean(params.apiCalled),
      apiStatus: params.apiStatus ?? null,
      externalMessageId: params.externalMessageId ?? null,
      externalThreadId: params.externalThreadId ?? null,
      requestPreview: params.requestPreview ?? null,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
    resultLogStored: Boolean(params.resultLogStored),
    statusPath: params.statusPath || [],
    message: params.message,
    safety: {
      manualApprovalRequired: true,
      autoReplyEnabled: false,
      executorFeatureFlagDefaultOff: true,
      externalWritesAttempted: Boolean(params.externalWritesAttempted),
      externalWritesSucceeded: Boolean(params.externalWritesSucceeded),
      browserReceivesRawToken: false,
      browserReceivesRawMime: false,
      attachmentsSupportedInThisPhase: false,
      ccBccSupportedInThisPhase: false,
      note: 'Phase 13.2 adds the manual-approved Gmail support reply executor path. Phase 13.3 centralizes the manual approval gate so every support_reply_send action must be founder/admin approved before Gmail can be called. Phase 13.4 verifies that the approved support reply is bound to the correct imported Gmail thread before Gmail can be called. Phase 13.6 blocks bulk-send shapes before Gmail can be called. Phase 13.7 requires manual approval for sensitive support tickets before Gmail can be called. Phase 13.8 records support send result logs with external message ID, thread ID, sent timestamp, API response summary, and failure reason. The executor is default-off, respects master/support pause and emergency safe mode, sends only a single plain-text threaded reply, and never returns raw OAuth tokens or raw MIME to the browser.',
    },
  };
}

function assertNoForbiddenSupportPayloadFragments(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of forbiddenPayloadFragments) {
    if (serialized.includes(fragment)) {
      throw new AppError(400, 'UNSAFE_SUPPORT_SEND_PAYLOAD', `Support send payload contains unsupported or unsafe fragment: ${fragment}`);
    }
  }
}

function extractPayloadForParser(actionPayload: JsonObject): JsonObject {
  const data = safeObject(actionPayload.data);
  const merged = Object.keys(data).length > 0 ? actionPayload : {
    action_type: 'support_reply_send',
    schema_version: 'support_reply_send.v1',
    source: 'legacy_support_reply_payload',
    intent_summary: 'Send an approved support reply.',
    idempotency_hint: String(actionPayload.idempotency_hint || 'support-reply-send'),
    data: actionPayload,
  };
  return merged;
}

function normalizeSubject(subject: string | undefined): string {
  const clean = safeHeader(subject, 'Support reply');
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

export function buildGmailSupportReplyMime(payload: NormalizedSupportReplySendPayload): string {
  const subject = normalizeSubject(payload.data.subject);
  const to = safeHeader(payload.data.customer_email);
  const body = String(payload.data.reply_body || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  return [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n');
}

export function parseSupportReplySendPayload(input: unknown): NormalizedSupportReplySendPayload {
  assertNoForbiddenSupportPayloadFragments(input);
  const bulkGuard = evaluateSupportBulkSendGuardFromPayload(input);
  if (!bulkGuard.allowedToContinue) {
    throw new AppError(409, 'SUPPORT_BULK_SEND_BLOCKED', `Phase 13.6 bulk send guard blocked this support reply send request: ${bulkGuard.safeSummary}`);
  }
  const parsed = supportReplyPayloadSchema.parse(input) as NormalizedSupportReplySendPayload;
  if (parsed.data.support_provider !== 'gmail') {
    throw new AppError(400, 'UNSUPPORTED_SUPPORT_SEND_PROVIDER', 'Phase 13.2 only supports Gmail support replies.');
  }
  if (parsed.data.auto_reply_enabled === true) {
    throw new AppError(409, 'SUPPORT_AUTO_REPLY_NOT_ALLOWED', 'Phase 13.2 cannot send auto-replies. A founder-approved action is required.');
  }
  if (parsed.data.reply_body.length > 8000) {
    throw new AppError(400, 'SUPPORT_REPLY_BODY_TOO_LONG', 'Support reply body exceeds Phase 13.2 size limits.');
  }
  return parsed;
}

export function buildGmailSupportSendRequest(params: {
  accessToken: string;
  payload: NormalizedSupportReplySendPayload;
}): GmailSendRequest {
  const rawMime = buildGmailSupportReplyMime(params.payload);
  return {
    url: `${env.GMAIL_API_BASE_URL.replace(/\/$/, '')}/gmail/v1/users/me/messages/send`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      raw: base64Url(rawMime),
      threadId: params.payload.data.thread_id,
    },
  };
}

export function buildSupportSendRequestPreview(payload: NormalizedSupportReplySendPayload): SupportSendRequestPreview {
  const redacted = redactSupportTextForLogs(payload.data.reply_body, 500);
  return {
    provider: 'gmail',
    method: 'users.messages.send',
    userId: 'me',
    threadId: payload.data.thread_id,
    toHint: maskEmail(payload.data.customer_email),
    subjectPreview: compact(payload.data.subject || null, 160),
    replyBodyPreview: redacted.value || '',
    rawMimeReturned: false,
    rawBase64Returned: false,
    rawTokenReturned: false,
  };
}

function normalizeHeaderMap(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

async function defaultGmailSendClient(request: GmailSendRequest): Promise<GmailSendClientResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_error) {
      body = { raw: text.slice(0, 500) };
    }
  }

  return {
    status: response.status,
    headers: normalizeHeaderMap(response.headers),
    body,
  };
}

async function defaultCredentialProvider(_workspaceId: string): Promise<GmailSendCredential> {
  throw new AppError(409, 'SUPPORT_GMAIL_SEND_CREDENTIAL_NOT_CONNECTED', 'Gmail send credential storage/OAuth is not connected yet. Connect Gmail with the send scope before enabling the support send executor.');
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown support send error.');
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'SUPPORT_SEND_EXECUTOR_FAILED';
}

function extractGmailMessageId(response: GmailSendClientResponse): string | null {
  const body = safeObject(response.body);
  const id = body.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function extractGmailThreadId(response: GmailSendClientResponse, fallback: string): string | null {
  const body = safeObject(response.body);
  const threadId = body.threadId;
  return typeof threadId === 'string' && threadId.trim() ? threadId.trim() : fallback || null;
}

function getActionPayload(action: WorkspaceActionDetailRow): JsonObject {
  return safeObject(action.payload_json);
}

async function insertBlockedResult(params: {
  workspaceId: string;
  actionId: string;
  summary: string;
  errorMessage: string;
  insertResult?: typeof insertSupportSendActionResult;
  metadata?: JsonObject;
}): Promise<boolean> {
  const inserter = params.insertResult || insertSupportSendActionResult;
  return inserter({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    executorName: SUPPORT_SEND_EXECUTOR_NAME,
    externalId: null,
    externalUrl: null,
    resultStatus: 'blocked',
    resultSummary: params.summary,
    errorMessage: params.errorMessage,
    metadataJson: {
      phase: SUPPORT_SEND_EXECUTOR_PHASE,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      raw_token_returned: false,
      raw_mime_returned: false,
      ...safeObject(params.metadata),
    },
  });
}

async function failExecutingAction(params: {
  workspaceId: string;
  actionId: string;
  userId: string;
  message: string;
  transitionStatus: NonNullable<ExecuteOptions['transitionStatus']>;
  insertEvent: NonNullable<ExecuteOptions['insertEvent']>;
  metadata?: JsonObject;
}): Promise<void> {
  const failed = await params.transitionStatus({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    fromStatuses: ['executing'],
    toStatus: 'failed',
  });

  await params.insertEvent({
    actionId: params.actionId,
    workspaceId: params.workspaceId,
    actorUserId: params.userId,
    eventType: 'execution_failed',
    fromStatus: failed?.previous_status || 'executing',
    toStatus: 'failed',
    message: params.message,
    metadataJson: {
      phase: SUPPORT_SEND_EXECUTOR_PHASE,
      executor_name: SUPPORT_SEND_EXECUTOR_NAME,
      external_writes_attempted: true,
      external_writes_succeeded: false,
      raw_token_returned: false,
      raw_mime_returned: false,
      ...safeObject(params.metadata),
    },
  });
}

export function parseSupportSendExecutionBody(input: unknown): { force: boolean } {
  return actionBodySchema.parse(input || {});
}

export function buildSupportSendExecutorStatus(): SupportSendExecutorStatus {
  return {
    phase: 'V2 Phase 13.2 — Send Reply Executor',
    healthMode: SUPPORT_SEND_EXECUTOR_HEALTH_MODE,
    deliverable: 'manual_approved_support_executor',
    selectedConnector: 'gmail',
    executorName: SUPPORT_SEND_EXECUTOR_NAME,
    actionType: 'support_reply_send',
    requiredScope: SUPPORT_SEND_REQUIRED_SCOPE,
    manualApprovalRequired: true,
    supportPauseRespected: true,
    masterPauseRespected: true,
    emergencySafeModeRespected: true,
    featureFlagDefaultOff: true,
    autoReplyEnabled: false,
    emailSendExecutorAdded: true,
    safeThreadedReplyMode: true,
    threadAssociationRequired: true,
    threadAssociationHealthMode: SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE,
    bulkSendGuardRequired: true,
    bulkSendGuardHealthMode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
    bulkSendSupportedInThisPhase: false,
    explicitBulkApprovalRequiredForFutureBulkSends: true,
    sensitiveTicketGuardRequired: true,
    sensitiveTicketGuardHealthMode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
    sensitiveTicketsRequireManualApproval: true,
    supportSendResultLogsRequired: true,
    supportSendResultLogsHealthMode: SUPPORT_SEND_RESULT_LOGS_HEALTH_MODE,
    storesExternalMessageId: true,
    storesThreadId: true,
    storesSentTimestamp: true,
    storesApiResponseSummary: true,
    storesFailureReason: true,
    attachmentsSupportedInThisPhase: false,
    ccBccSupportedInThisPhase: false,
    rawMimeReturnedToBrowser: false,
    rawTokenReturnedToBrowser: false,
  };
}

export function buildSupportSendExecutorExample() {
  const payload = parseSupportReplySendPayload({
    action_type: 'support_reply_send',
    schema_version: 'support_reply_send.v1',
    source: 'support_draft_to_action',
    intent_summary: 'Review and approve a drafted shipping support reply.',
    idempotency_hint: 'support-reply:ticket_123:example',
    data: {
      support_provider: 'gmail',
      ticket_id: 'ticket_123',
      thread_id: 'gmail_thread_123',
      customer_email: 'customer@example.com',
      subject: 'Where is my order?',
      reply_body: 'Hello, thank you for reaching out. I checked the tracking details and your order is moving normally. Please reply here if anything looks wrong.',
      category: 'shipping',
      confidence_score: 0.87,
      sensitive_flag: false,
      escalation_required: false,
      send_email_enabled: false,
      external_api_called: false,
      auto_reply_enabled: false,
    },
  });

  return {
    payloadPreview: buildSupportSendRequestPreview(payload),
    status: buildSupportSendExecutorStatus(),
    safety: {
      exampleSendsEmail: false,
      rawMimeReturned: false,
      rawTokenReturned: false,
      requiresApprovedActionBeforeExecution: true,
    },
  };
}

export function buildSupportSendPreview(input: unknown) {
  const bulkGuard = evaluateSupportBulkSendGuardFromPayload(input);
  const sensitiveTicketGuard = evaluateSupportSensitiveTicketGuardFromPayload(input, { manualApprovalConfirmed: false, autoSendRequested: false });
  const payload = parseSupportReplySendPayload(input);
  return {
    valid: true,
    bulkSendGuard: {
      healthMode: bulkGuard.healthMode,
      allowedToContinue: bulkGuard.allowedToContinue,
      bulkSendDetected: bulkGuard.bulkSendDetected,
      decision: bulkGuard.decision,
    },
    sensitiveTicketGuard: {
      healthMode: sensitiveTicketGuard.healthMode,
      allowedToContinue: sensitiveTicketGuard.allowedToContinue,
      sensitiveTicketDetected: sensitiveTicketGuard.sensitiveTicketDetected,
      manualApprovalRequired: sensitiveTicketGuard.manualApprovalRequired,
      decision: sensitiveTicketGuard.decision,
      triggers: sensitiveTicketGuard.triggers,
    },
    requestPreview: buildSupportSendRequestPreview(payload),
    checksPreview: {
      actionType: payload.action_type,
      provider: payload.data.support_provider,
      threadIdPresent: payload.data.thread_id.length > 0,
      recipientPresent: payload.data.customer_email.length > 0,
      replyBodyPresent: payload.data.reply_body.length > 0,
      attachmentsUnsupported: true,
      ccBccUnsupported: true,
    },
    safety: {
      previewOnly: true,
      gmailApiCalled: false,
      emailSent: false,
      rawMimeReturned: false,
      rawBase64Returned: false,
      rawTokenReturned: false,
    },
  };
}

export function decodeGmailRawForTests(raw: string): string {
  return fromBase64Url(raw);
}

export async function executeManualApprovedGmailSupportReplySend(
  input: { workspaceId: string; userId: string; actionId: string; force?: boolean },
  options: ExecuteOptions = {},
): Promise<SupportSendExecutionResult> {
  const databaseReady = isDatabaseConfigured || options.bypassDatabaseForTests === true;
  let checks = baseChecks({ databaseConfigured: databaseReady });
  const featureFlagEnabled = env.SUPPORT_SEND_EXECUTOR_ENABLED || options.bypassFeatureFlagForTests === true;
  checks = { ...checks, featureFlagEnabled };

  const insertResultFn = options.insertResult || insertSupportSendActionResult;
  const insertEventFn = options.insertEvent || insertActionLifecycleEvent;
  const transitionStatusFn = options.transitionStatus || transitionSupportReplyActionStatus;

  if (!databaseReady) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      message: 'Database is required before the support send executor can verify action approval, pause state, and audit logs.',
    });
  }

  if (!featureFlagEnabled) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send executor is disabled by environment flag.',
      errorMessage: 'SUPPORT_SEND_EXECUTOR_ENABLED is false.',
      insertResult: insertResultFn,
      metadata: { block_code: 'SUPPORT_SEND_EXECUTOR_DISABLED' },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      resultLogStored: stored,
      message: 'Support reply sending is disabled. Set SUPPORT_SEND_EXECUTOR_ENABLED=true only for an approved manual support send test.',
    });
  }

  const actionProvider = options.actionProvider || getWorkspaceActionForUser;
  const action = await actionProvider({ workspaceId: input.workspaceId, userId: input.userId, actionId: input.actionId });

  if (!action) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      message: 'Action not found in the current workspace, or current user cannot access it.',
    });
  }

  checks = {
    ...checks,
    actionFound: true,
    actionTypeValid: action.action_type === 'support_reply_send',
    statusApproved: action.status === 'approved',
  };

  if (action.action_type !== 'support_reply_send') {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Support send executor blocked a non-support reply action.',
      errorMessage: 'Only support_reply_send actions can use the Gmail support send executor.',
      insertResult: insertResultFn,
      metadata: { action_type: action.action_type },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      resultLogStored: stored,
      message: 'Only support_reply_send actions are eligible for the Gmail support send executor.',
    });
  }

  const approvalProvider = options.approvalEventProvider || findLatestSupportReplyApprovalEvent;
  const approvalEvent = await approvalProvider({ workspaceId: input.workspaceId, actionId: input.actionId });
  const approvalGate = evaluateSupportSendManualApprovalGate({
    actionType: action.action_type,
    actionStatus: action.status,
    approvedAt: action.approved_at,
    approvalEventId: approvalEvent?.id || null,
    approvalEventActorUserId: approvalEvent?.actor_user_id || null,
    executorName: SUPPORT_SEND_EXECUTOR_NAME,
    forceRequested: input.force === true,
    autoSendRequested: false,
  });
  const manuallyApproved = approvalGate.eligibleToSend;
  checks = { ...checks, manualApprovalConfirmed: manuallyApproved };

  if (!manuallyApproved) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send blocked because Phase 13.3 manual approval gate was not satisfied.',
      errorMessage: 'Action must be approved with a recorded founder/admin approval event before support reply sending.',
      insertResult: insertResultFn,
      metadata: {
        current_status: action.status,
        approved_at_present: Boolean(action.approved_at),
        approval_event_found: Boolean(approvalEvent),
        approval_gate_policy_id: approvalGate.policyId,
        approval_gate_decision: approvalGate.decision,
        approval_gate_blockers: approvalGate.blockers.slice(0, 5),
        force_bypass_allowed: false,
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: [action.status],
      resultLogStored: stored,
      message: 'Manual founder/admin approval is required before Gmail support reply sending.',
    });
  }

  const pauseProvider = options.pauseStateProvider || getGlobalPauseStateForWorkspace;
  const pauseState = await pauseProvider(input.workspaceId);
  const masterPauseOff = !pauseState.pauseAllAutonomy;
  const supportPauseOff = !pauseState.pauseSupportActions;
  const emergencySafeModeOff = !pauseState.emergencySafeMode.active;
  checks = { ...checks, masterPauseOff, supportPauseOff, emergencySafeModeOff };

  if (!masterPauseOff || !supportPauseOff || !emergencySafeModeOff) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send blocked by pause or emergency safe mode.',
      errorMessage: 'Master pause, support pause, or emergency safe mode is active.',
      insertResult: insertResultFn,
      metadata: {
        pause_all_autonomy: pauseState.pauseAllAutonomy,
        pause_support_actions: pauseState.pauseSupportActions,
        emergency_safe_mode_active: pauseState.emergencySafeMode.active,
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: 'Support reply sending is blocked because master pause, support pause, or emergency safe mode is active.',
    });
  }

  let payload: NormalizedSupportReplySendPayload;
  try {
    const parserPayload = extractPayloadForParser(getActionPayload(action));
    const bulkGuard = evaluateSupportBulkSendGuardFromPayload(parserPayload);
    const sensitiveTicketGuard = evaluateSupportSensitiveTicketGuardFromPayload(parserPayload, {
      manualApprovalConfirmed: manuallyApproved,
      approvalEventActorUserId: approvalEvent?.actor_user_id || null,
      approvalEventId: approvalEvent?.id || null,
      approvedAt: action.approved_at,
      autoSendRequested: false,
      forceRequested: input.force === true,
    });
    if (!sensitiveTicketGuard.allowedToContinue) {
      throw new AppError(409, 'SUPPORT_SENSITIVE_TICKET_GUARD_BLOCKED', `Phase 13.7 sensitive ticket guard blocked this support reply send request: ${sensitiveTicketGuard.safeSummary}`);
    }
    payload = parseSupportReplySendPayload(parserPayload);
    checks = {
      ...checks,
      payloadValid: true,
      threadIdPresent: Boolean(payload.data.thread_id),
      recipientPresent: Boolean(payload.data.customer_email),
      replyBodyPresent: Boolean(payload.data.reply_body),
      bulkSendGuardPassed: bulkGuard.allowedToContinue,
      bulkSendDetected: bulkGuard.bulkSendDetected,
      explicitBulkApprovalPresent: bulkGuard.explicitBulkApprovalPresent,
      sensitiveTicketGuardPassed: sensitiveTicketGuard.allowedToContinue,
      sensitiveTicketDetected: sensitiveTicketGuard.sensitiveTicketDetected,
      lowConfidenceDetected: sensitiveTicketGuard.checks.lowConfidenceDetected,
      sensitiveManualApprovalRequired: sensitiveTicketGuard.manualApprovalRequired,
    };
  } catch (error) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send blocked because the support reply payload is invalid or unsupported.',
      errorMessage: safeErrorMessage(error),
      insertResult: insertResultFn,
      metadata: { block_code: errorCode(error) },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: safeErrorMessage(error),
    });
  }

  const ticketProvider = options.threadAssociationTicketProvider || (async (ticketInput: { workspaceId: string; provider: 'gmail'; ticketId: string; threadId: string }) => {
    const row = await findSupportTicketForThreadAssociation(ticketInput);
    return normalizeSupportThreadAssociationTicketRow(row);
  });
  const importedTicket = await ticketProvider({
    workspaceId: input.workspaceId,
    provider: payload.data.support_provider,
    ticketId: payload.data.ticket_id,
    threadId: payload.data.thread_id,
  });
  const threadAssociation = evaluateSupportThreadAssociation({
    actionType: action.action_type,
    provider: payload.data.support_provider,
    ticketId: payload.data.ticket_id,
    threadId: payload.data.thread_id,
    customerEmail: payload.data.customer_email,
    subject: payload.data.subject || null,
    importedTicket,
  });
  checks = {
    ...checks,
    importedTicketFound: threadAssociation.checks.importedTicketFound,
    threadAssociationVerified: threadAssociation.verified,
    threadMatchesImportedTicket: threadAssociation.checks.importedTicketThreadMatches,
    customerMatchesImportedTicket: threadAssociation.checks.customerMatchesWhenKnown,
  };

  if (!threadAssociation.verified) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send blocked because Phase 13.4 thread association was not verified.',
      errorMessage: 'Support reply payload must match an imported Gmail support ticket thread before sending.',
      insertResult: insertResultFn,
      metadata: {
        block_code: 'SUPPORT_THREAD_ASSOCIATION_NOT_VERIFIED',
        thread_association_health_mode: threadAssociation.healthMode,
        thread_association_decision: threadAssociation.decision,
        thread_association_blockers: threadAssociation.blockers.slice(0, 5),
        ticket_id: payload.data.ticket_id,
        thread_id: payload.data.thread_id,
        imported_ticket_found: threadAssociation.checks.importedTicketFound,
        imported_ticket_id: threadAssociation.threadBinding.importedTicketId,
        imported_external_thread_id: threadAssociation.threadBinding.importedExternalThreadId,
        raw_provider_payload_returned: false,
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: 'Support reply sending is blocked because the approved action is not safely associated with the imported Gmail thread.',
    });
  }

  let credential: GmailSendCredential;
  try {
    const provider = options.credentialProvider || defaultCredentialProvider;
    credential = await provider(input.workspaceId);
    const requiredScopePresent = Array.isArray(credential.grantedScopes) && credential.grantedScopes.includes(SUPPORT_SEND_REQUIRED_SCOPE);
    const expiresAt = credential.expiresAt ? new Date(credential.expiresAt).getTime() : null;
    const tokenNotExpired = expiresAt === null || !Number.isFinite(expiresAt) || expiresAt > Date.now();
    checks = { ...checks, tokenValid: Boolean(credential.accessToken && tokenNotExpired), requiredScopePresent };
    if (!credential.accessToken || !tokenNotExpired) {
      throw new AppError(409, 'SUPPORT_GMAIL_SEND_TOKEN_INVALID', 'Gmail send token is missing or expired. Reconnect before sending support replies.');
    }
    if (!requiredScopePresent) {
      throw new AppError(409, 'SUPPORT_GMAIL_SEND_SCOPE_MISSING', `Stored Gmail credential does not include ${SUPPORT_SEND_REQUIRED_SCOPE}.`);
    }
  } catch (error) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Gmail support send blocked because the connector token is not valid for sending.',
      errorMessage: safeErrorMessage(error),
      insertResult: insertResultFn,
      metadata: { block_code: errorCode(error) },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: safeErrorMessage(error),
    });
  }

  const executing = await transitionStatusFn({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['approved'],
    toStatus: 'executing',
  });

  if (!executing) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      message: 'Action could not be moved from approved to executing. It may have already been executed, cancelled, or changed by another request.',
    });
  }

  await insertEventFn({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'execution_started',
    fromStatus: executing.previous_status,
    toStatus: 'executing',
    message: 'Manual-approved Gmail support reply sending started. External email send is about to be attempted.',
    metadataJson: {
      phase: SUPPORT_SEND_EXECUTOR_PHASE,
      executor_name: SUPPORT_SEND_EXECUTOR_NAME,
      provider: 'gmail',
      manual_approval_required: true,
      approval_gate_policy_id: approvalGate.policyId,
      approved_event_id: approvalEvent?.id || null,
      ticket_id: payload.data.ticket_id,
      thread_id: payload.data.thread_id,
      imported_ticket_id: threadAssociation.threadBinding.importedTicketId,
      thread_association_verified: threadAssociation.verified,
      thread_association_health_mode: threadAssociation.healthMode,
      bulk_send_guard_health_mode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
      bulk_send_detected: checks.bulkSendDetected,
      sensitive_ticket_guard_health_mode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
      sensitive_ticket_detected: checks.sensitiveTicketDetected,
      sensitive_manual_approval_required: checks.sensitiveManualApprovalRequired,
      customer_email_hint: maskEmail(payload.data.customer_email),
      external_writes_attempted_yet: false,
      raw_token_returned: false,
      raw_mime_returned: false,
    },
  });

  const request = buildGmailSupportSendRequest({ accessToken: credential.accessToken, payload });
  const requestPreview = buildSupportSendRequestPreview(payload);
  const client = options.client || defaultGmailSendClient;
  let response: GmailSendClientResponse;

  try {
    response = await client(request);
  } catch (error) {
    const message = `Gmail support send request failed before a successful send confirmation: ${safeErrorMessage(error)}`;
    await failExecutingAction({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      userId: input.userId,
      message,
      transitionStatus: transitionStatusFn,
      insertEvent: insertEventFn,
      metadata: { error_code: errorCode(error), ticket_id: payload.data.ticket_id, thread_id: payload.data.thread_id, thread_association_verified: threadAssociation.verified },
    });
    const resultLog = buildSupportSendResultLogEntry({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      executorName: SUPPORT_SEND_EXECUTOR_NAME,
      resultStatus: 'failed',
      externalThreadId: payload.data.thread_id,
      apiResponseSummary: 'Gmail support send request failed before a success response was received.',
      failureReason: message,
      requestPreview,
      ticketId: payload.data.ticket_id,
      importedTicketId: threadAssociation.threadBinding.importedTicketId,
      manualApprovalRequired: true,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      metadataJson: {
        phase: SUPPORT_SEND_EXECUTOR_PHASE,
        request_preview: requestPreview,
        thread_association_verified: threadAssociation.verified,
      },
    });
    const stored = await insertResultFn(resultLog.actionResult);
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'failed',
      checks,
      apiCalled: true,
      requestPreview,
      resultLogStored: stored,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      statusPath: ['approved', 'executing', 'failed'],
      message,
    });
  }

  const success = response.status >= 200 && response.status < 300;
  const externalMessageId = success ? extractGmailMessageId(response) : null;
  const externalThreadId = success ? extractGmailThreadId(response, payload.data.thread_id) : null;

  if (!success) {
    const message = `Gmail API returned ${response.status}; LIFE.SAVER marked the support reply action failed and did not claim the reply was sent.`;
    await failExecutingAction({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      userId: input.userId,
      message,
      transitionStatus: transitionStatusFn,
      insertEvent: insertEventFn,
      metadata: { gmail_status: response.status, ticket_id: payload.data.ticket_id, thread_id: payload.data.thread_id, thread_association_verified: threadAssociation.verified },
    });
    const resultLog = buildSupportSendResultLogEntry({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      executorName: SUPPORT_SEND_EXECUTOR_NAME,
      resultStatus: 'failed',
      externalThreadId: payload.data.thread_id,
      apiStatus: response.status,
      apiResponseBody: response.body,
      apiResponseSummary: 'Gmail support reply send failed. No success result was claimed.',
      failureReason: message,
      requestPreview,
      ticketId: payload.data.ticket_id,
      importedTicketId: threadAssociation.threadBinding.importedTicketId,
      manualApprovalRequired: true,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      metadataJson: {
        phase: SUPPORT_SEND_EXECUTOR_PHASE,
        request_preview: requestPreview,
        thread_association_verified: threadAssociation.verified,
      },
    });
    const stored = await insertResultFn(resultLog.actionResult);
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'failed',
      checks,
      apiCalled: true,
      apiStatus: response.status,
      requestPreview,
      resultLogStored: stored,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      statusPath: ['approved', 'executing', 'failed'],
      message,
    });
  }

  const executed = await transitionStatusFn({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['executing'],
    toStatus: 'executed',
  });

  const sentAt = nowIso();
  await insertEventFn({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'execution_finished',
    fromStatus: executed?.previous_status || 'executing',
    toStatus: 'executed',
    message: externalMessageId
      ? `Gmail support reply sent successfully. External message ID: ${externalMessageId}.`
      : 'Gmail support reply sent successfully. Gmail did not return a standard message ID.',
    metadataJson: {
      phase: SUPPORT_SEND_EXECUTOR_PHASE,
      executor_name: SUPPORT_SEND_EXECUTOR_NAME,
      provider: 'gmail',
      gmail_status: response.status,
      external_message_id_present: Boolean(externalMessageId),
      external_thread_id_present: Boolean(externalThreadId),
      ticket_id: payload.data.ticket_id,
      thread_id: payload.data.thread_id,
      imported_ticket_id: threadAssociation.threadBinding.importedTicketId,
      thread_association_verified: threadAssociation.verified,
      thread_association_health_mode: threadAssociation.healthMode,
      bulk_send_guard_health_mode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
      bulk_send_detected: checks.bulkSendDetected,
      sensitive_ticket_guard_health_mode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
      sensitive_ticket_detected: checks.sensitiveTicketDetected,
      sensitive_manual_approval_required: checks.sensitiveManualApprovalRequired,
      sent_at: sentAt,
      external_writes_attempted: true,
      external_writes_succeeded: true,
      raw_token_returned: false,
      raw_mime_returned: false,
    },
  });

  const resultLog = buildSupportSendResultLogEntry({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    executorName: SUPPORT_SEND_EXECUTOR_NAME,
    resultStatus: 'success',
    externalMessageId,
    externalThreadId,
    sentAt,
    apiStatus: response.status,
    apiResponseBody: response.body,
    apiResponseSummary: 'Manual-approved Gmail support reply sent successfully.',
    requestPreview,
    ticketId: payload.data.ticket_id,
    importedTicketId: threadAssociation.threadBinding.importedTicketId,
    manualApprovalRequired: true,
    externalWritesAttempted: true,
    externalWritesSucceeded: true,
    metadataJson: {
      phase: SUPPORT_SEND_EXECUTOR_PHASE,
      thread_id: payload.data.thread_id,
      thread_association_verified: threadAssociation.verified,
      thread_association_health_mode: threadAssociation.healthMode,
      bulk_send_guard_health_mode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
      bulk_send_detected: checks.bulkSendDetected,
      sensitive_ticket_guard_health_mode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
      sensitive_ticket_detected: checks.sensitiveTicketDetected,
      sensitive_manual_approval_required: checks.sensitiveManualApprovalRequired,
      request_preview: requestPreview,
      approval_gate_policy_id: approvalGate.policyId,
      approved_event_id: approvalEvent?.id || null,
    },
  });
  const stored = await insertResultFn(resultLog.actionResult);

  return makeResult({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    status: 'executed',
    checks,
    apiCalled: true,
    apiStatus: response.status,
    externalMessageId,
    externalThreadId,
    requestPreview,
    resultLogStored: stored,
    externalWritesAttempted: true,
    externalWritesSucceeded: true,
    statusPath: ['approved', 'executing', 'executed'],
    message: externalMessageId
      ? `Manual-approved Gmail support reply sent successfully. External message ID: ${externalMessageId}.`
      : 'Manual-approved Gmail support reply sent successfully.',
  });
}
