import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/AppError.js';
import { createActionNotFoundError, createInvalidStatusTransitionError, createWorkspaceForbiddenError } from './actions.errors.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import type {
  ActionPolicyDecision,
  ActionRiskLevel,
  ActionStatus,
  ApproveActionInput,
  ApproveActionResponse,
  RejectActionInput,
  RejectActionResponse,
  CancelActionInput,
  CancelActionResponse,
  CreateProposedActionInput,
  CreateProposedActionResult,
  ExistingActionDuplicateRow,
  WorkspaceActionDetailResponse,
  WorkspaceActionDetailRow,
  WorkspaceActionEventRow,
  WorkspaceActionListFilters,
  WorkspaceActionListItem,
  WorkspaceActionListResponse,
  WorkspaceActionPayloadPreview,
  WorkspaceActionResultRow,
  WorkspaceActionSummaryRow,
  WorkspaceActionStatusHistoryItem,
  WorkspaceActionResultSummaryItem,
} from './actions.types.js';
import {
  approveWorkspaceActionForUser,
  countWorkspaceActionsForUser,
  findExistingActionDuplicate,
  getActiveActionWorkspaceMembership,
  getWorkspaceActionForUser,
  insertActionCreatedEvent,
  insertPolicyEvaluatedEvent,
  insertActionLifecycleEvent,
  persistActionPolicyDecisionSnapshot,
  insertProposedActionRecord,
  listWorkspaceActionEventsForUser,
  listWorkspaceActionResultsForUser,
  listWorkspaceActionsForUser,
  rejectWorkspaceActionForUser,
  cancelWorkspaceActionForUser,
} from './actions.repository.js';
import { getCategoryPauseState, getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import { evaluateActionPolicy, enforceActionPolicyEvaluation } from '../policies/policy.evaluator.js';
import { buildPolicyDecisionSnapshot, summarizePolicyDecisionSnapshot } from '../policies/policy.decision-records.js';
import {
  assertCanApproveWorkspaceAction,
  assertCanCancelWorkspaceAction,
  assertCanRejectWorkspaceAction,
  assertCanViewWorkspaceActions,
  canApproveActionRisk,
  canApproveAnyAction,
} from './actions.permission-guard.js';
import {
  ACTION_MODULE_PHASE,
  ACTION_POLICY_DECISION_VALUES,
  ACTION_RISK_LEVEL_VALUES,
  ACTION_STATUS_VALUES,
  ACTION_TYPE_VALUES,
  isSupportedActionType,
  isSupportedRiskLevel,
  normalizeActionListPagination,
} from './actions.validation.js';

export type ActionsModuleStatus = {
  version: string;
  phase: string;
  module: string;
  purpose: string;
  currentScope: string;
  registeredFiles: string[];
  supportedActionTypes: readonly string[];
  supportedStatuses: readonly string[];
  supportedRiskLevels: readonly string[];
  enabledCapabilities: string[];
  deliberatelyDisabledCapabilities: string[];
  approvalRoleModel: Array<{
    role: string;
    canViewWorkspaceActions: boolean;
    canApproveLowMediumHigh: boolean;
    canApproveCritical: boolean;
    notes: string;
  }>;
  safetyRules: string[];
  nextPhase: string;
};


const REQUIRED_PAYLOAD_DATA_FIELDS: Record<string, string[]> = {
  content_publish: ['platform', 'caption'],
  support_reply_send: ['ticket_id', 'thread_id', 'reply_body'],
  ad_budget_adjust: ['platform', 'campaign_id', 'current_budget', 'proposed_budget', 'change_amount', 'currency'],
  ad_pause: ['platform', 'target_level', 'target_id', 'current_status', 'proposed_status', 'reason'],
  research_task: ['question', 'objective'],
  dev_task: ['task_summary', 'area'],
  notification_send: ['channel', 'recipient_user_id', 'message'],
  rollback_action: ['original_action_id', 'rollback_type', 'reason'],
};

const DEFAULT_ACTION_RISK_BY_TYPE: Record<string, ActionRiskLevel> = {
  content_publish: 'low',
  support_reply_send: 'medium',
  ad_budget_adjust: 'high',
  ad_pause: 'high',
  research_task: 'low',
  dev_task: 'medium',
  notification_send: 'low',
  rollback_action: 'high',
};

const APPROVABLE_STATUSES: ActionStatus[] = ['proposed', 'approval_required', 'auto_approved'];
const REJECTABLE_STATUSES: ActionStatus[] = ['proposed', 'approval_required'];
const CANCELLABLE_STATUSES: ActionStatus[] = ['proposed', 'approval_required', 'auto_approved', 'approved', 'queued'];

function normalizeApprovalNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 1000) : null;
}

function normalizeRejectionReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 1000) : null;
}

function normalizeCancelReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 1000) : null;
}

function explainNotApprovableStatus(status: ActionStatus): { code: string; message: string } {
  switch (status) {
    case 'rejected':
      return { code: 'ACTION_REJECTED', message: 'Rejected actions cannot be approved. Create a new corrected proposed action instead.' };
    case 'cancelled':
      return { code: 'ACTION_CANCELLED', message: 'Cancelled actions cannot be approved. Create a new proposed action instead.' };
    case 'queued':
    case 'executing':
    case 'executed':
      return { code: 'ACTION_ALREADY_EXECUTED', message: 'This action has already moved beyond approval and cannot be approved again.' };
    case 'failed':
      return { code: 'ACTION_FAILED', message: 'Failed actions cannot be approved again. Use a new action or future rollback flow.' };
    case 'rollback_requested':
    case 'rolled_back':
      return { code: 'ACTION_ROLLBACK_STATE', message: 'Rollback-state actions cannot be approved through the normal approval endpoint.' };
    default:
      return { code: 'INVALID_STATUS_TRANSITION', message: `Actions with status ${status} cannot be approved from this endpoint.` };
  }
}

function explainNotRejectableStatus(status: ActionStatus): { code: string; message: string } {
  switch (status) {
    case 'rejected':
      return { code: 'ACTION_ALREADY_REJECTED', message: 'This action has already been rejected.' };
    case 'approved':
      return { code: 'ACTION_ALREADY_APPROVED', message: 'Approved actions should be cancelled before execution, not rejected. Use the future cancel endpoint when available.' };
    case 'cancelled':
      return { code: 'ACTION_CANCELLED', message: 'Cancelled actions cannot be rejected.' };
    case 'auto_approved':
      return { code: 'ACTION_AUTO_APPROVED', message: 'Auto-approved actions should be cancelled before queueing, not rejected.' };
    case 'queued':
    case 'executing':
    case 'executed':
      return { code: 'ACTION_ALREADY_EXECUTED', message: 'This action has already moved beyond rejection and cannot be rejected.' };
    case 'failed':
      return { code: 'ACTION_FAILED', message: 'Failed actions cannot be rejected.' };
    case 'rollback_requested':
    case 'rolled_back':
      return { code: 'ACTION_ROLLBACK_STATE', message: 'Rollback-state actions cannot be rejected through the normal rejection endpoint.' };
    default:
      return { code: 'INVALID_STATUS_TRANSITION', message: `Actions with status ${status} cannot be rejected from this endpoint.` };
  }
}

function explainNotCancellableStatus(status: ActionStatus): { code: string; message: string } {
  switch (status) {
    case 'cancelled':
      return { code: 'ACTION_ALREADY_CANCELLED', message: 'This action has already been cancelled.' };
    case 'rejected':
      return { code: 'ACTION_REJECTED', message: 'Rejected actions cannot be cancelled. They are already stopped.' };
    case 'executing':
      return { code: 'ACTION_EXECUTING', message: 'This action is already executing. Future executor phases must use a rollback or emergency pause flow instead of normal cancellation.' };
    case 'executed':
      return { code: 'ACTION_ALREADY_EXECUTED', message: 'Executed actions cannot be cancelled from this endpoint. Use a future rollback flow if rollback is supported.' };
    case 'failed':
      return { code: 'ACTION_FAILED', message: 'Failed actions cannot be cancelled. Review the result log or use a future rollback/retry flow.' };
    case 'rollback_requested':
    case 'rolled_back':
      return { code: 'ACTION_ROLLBACK_STATE', message: 'Rollback-state actions cannot be cancelled through the normal cancellation endpoint.' };
    default:
      return { code: 'INVALID_STATUS_TRANSITION', message: `Actions with status ${status} cannot be cancelled from this endpoint.` };
  }
}


function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function findForbiddenPayloadPaths(value: unknown, basePath = 'payload'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenPayloadPaths(item, `${basePath}.${index}`));
  }

  if (!value || typeof value !== 'object') return [];

  const paths: string[] = [];
  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${basePath}.${key}`;
    if (isSecretLikeKey(key)) paths.push(childPath);
    paths.push(...findForbiddenPayloadPaths(childValue, childPath));
  }

  return paths;
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 180);
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 1200) : null;
}

function buildActionHash(input: {
  workspaceId: string;
  actionType: string;
  payloadJson: Record<string, unknown>;
  title: string;
}): string {
  const payload = safeJsonObject(input.payloadJson);
  const data = safeJsonObject(payload.data);
  const hashShape = {
    workspace_id: input.workspaceId,
    action_type: input.actionType,
    title: input.title,
    schema_version: payload.schema_version ?? null,
    source: payload.source ?? null,
    intent_summary: payload.intent_summary ?? null,
    data,
  };

  return createHash('sha256').update(stableStringify(hashShape)).digest('hex');
}

function buildIdempotencyKey(input: {
  workspaceId: string;
  actionType: string;
  explicitKey?: string | null;
  payloadJson: Record<string, unknown>;
}): string {
  const explicit = typeof input.explicitKey === 'string' ? input.explicitKey.trim() : '';
  if (explicit) return explicit.slice(0, 240);

  const payload = safeJsonObject(input.payloadJson);
  const hint = typeof payload.idempotency_hint === 'string' ? payload.idempotency_hint.trim() : '';
  if (hint) {
    return `generated:${input.workspaceId}:${input.actionType}:${createHash('sha256').update(hint).digest('hex')}`.slice(0, 240);
  }

  return `generated:${input.workspaceId}:${input.actionType}:${randomUUID()}`.slice(0, 240);
}

function normalizePolicyDecision(value: unknown): ActionPolicyDecision {
  return ACTION_POLICY_DECISION_VALUES.includes(value as ActionPolicyDecision) ? value as ActionPolicyDecision : 'ask';
}

function validateCreateProposedActionInput(input: CreateProposedActionInput): {
  title: string;
  description: string | null;
  riskLevel: ActionRiskLevel;
  approvalRequired: boolean;
  policyDecision: ActionPolicyDecision;
  payloadJson: Record<string, unknown>;
  idempotencyKey: string;
  actionHash: string;
} {
  if (!input.workspaceId) {
    throw new AppError(400, 'ACTION_WORKSPACE_REQUIRED', 'workspaceId is required to create a proposed action.');
  }

  if (!isSupportedActionType(input.actionType)) {
    throw new AppError(400, 'INVALID_ACTION_TYPE', 'Unsupported V2 action type.');
  }

  const title = normalizeTitle(input.title);
  if (!title) {
    throw new AppError(400, 'ACTION_TITLE_REQUIRED', 'Action title is required.');
  }

  const payloadJson = safeJsonObject(input.payloadJson);
  const payloadActionType = typeof payloadJson.action_type === 'string' ? payloadJson.action_type : input.actionType;
  if (payloadActionType !== input.actionType) {
    throw new AppError(400, 'ACTION_PAYLOAD_TYPE_MISMATCH', 'payload_json.action_type must match action_type.');
  }

  const data = safeJsonObject(payloadJson.data);
  const missingFields = (REQUIRED_PAYLOAD_DATA_FIELDS[input.actionType] || []).filter((field) => {
    const value = data[field];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });

  if (missingFields.length > 0) {
    throw new AppError(400, 'ACTION_PAYLOAD_REQUIRED_FIELDS_MISSING', `Action payload is missing required data fields: ${missingFields.join(', ')}.`);
  }

  const forbiddenPaths = findForbiddenPayloadPaths(payloadJson);
  if (forbiddenPaths.length > 0) {
    throw new AppError(400, 'ACTION_PAYLOAD_CONTAINS_FORBIDDEN_SECRET_FIELDS', `Action payload contains forbidden secret-like fields: ${forbiddenPaths.slice(0, 5).join(', ')}.`);
  }

  const riskLevel = isSupportedRiskLevel(input.riskLevel || '')
    ? input.riskLevel as ActionRiskLevel
    : DEFAULT_ACTION_RISK_BY_TYPE[input.actionType] || 'medium';

  const approvalRequired = input.approvalRequired !== false;
  const policyDecision = normalizePolicyDecision(input.policyDecision);
  const idempotencyKey = buildIdempotencyKey({
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    explicitKey: input.idempotencyKey,
    payloadJson,
  });
  const actionHash = typeof input.actionHash === 'string' && input.actionHash.trim()
    ? input.actionHash.trim().slice(0, 128)
    : buildActionHash({ workspaceId: input.workspaceId, actionType: input.actionType, payloadJson, title });

  return {
    title,
    description: normalizeDescription(input.description),
    riskLevel,
    approvalRequired,
    policyDecision,
    payloadJson,
    idempotencyKey,
    actionHash,
  };
}

function serializeCreatedOrDuplicateAction(row: WorkspaceActionSummaryRow | ExistingActionDuplicateRow): WorkspaceActionListItem {
  return serializeActionSummary(row);
}

function buildCreateProposedActionResult(params: {
  created: boolean;
  duplicateReason: 'none' | 'idempotency_key' | 'action_hash';
  row: WorkspaceActionSummaryRow | ExistingActionDuplicateRow;
  globalPauseActive?: boolean;
  category?: string;
  categoryPaused?: boolean;
  autoApprovalAllowed?: boolean;
  executorExecutionAllowed?: boolean;
  autonomyNote?: string;
}): CreateProposedActionResult {
  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    created: params.created,
    duplicateDetected: !params.created,
    duplicateReason: params.duplicateReason,
    action: serializeCreatedOrDuplicateAction(params.row),
    autonomy: {
      pauseAllAutonomy: params.globalPauseActive === true,
      category: params.category || 'system',
      categoryPaused: params.categoryPaused === true,
      autoApprovalAllowed: params.autoApprovalAllowed === false ? false : true,
      executorExecutionAllowed: params.executorExecutionAllowed === false ? false : true,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      note: params.autonomyNote || 'Global pause state was not active for this createProposedAction result. Proposed actions still require later approval/policy/executor phases before any real-world action can occur.',
    },
    safety: {
      status: 'proposed',
      approvalRequired: params.row.approval_required,
      policyDecision: params.row.policy_decision,
      canExecuteFromThisService: false,
      externalWritesEnabled: false,
      note: 'createProposedAction creates an internal proposed action record and action_created audit event only. If pause_all_autonomy or the relevant category pause is active, the service forces policy_decision=ask and approval_required=true. It cannot approve, auto-approve, queue, execute, publish, send, spend, pause, refund, or write to external platforms.',
    },
  };
}

const SECRET_KEY_PATTERNS = [
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'token',
  'password',
  'secret',
  'authorization',
  'cookie',
  'database_url',
  'DATABASE_URL',
  'CLAUDE_API_KEY',
  'TRIPLE_WHALE_API_KEY',
  'APP_ENCRYPTION_KEY',
  'WORKER_SHARED_SECRET',
];

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function truncateText(value: unknown, maxLength = 600): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}…`;
}

function maskEmail(value: unknown): string | null {
  if (typeof value !== 'string' || !value.includes('@')) return null;
  const [name, domain] = value.split('@');
  const safeName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function isSecretLikeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function redactPreviewValue(value: unknown, redactedFields: string[], path = 'value'): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item, index) => redactPreviewValue(item, redactedFields, `${path}.${index}`));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      const childPath = `${path}.${key}`;
      if (isSecretLikeKey(key)) {
        output[key] = '[REDACTED]';
        redactedFields.push(childPath);
        continue;
      }
      output[key] = redactPreviewValue(childValue, redactedFields, childPath);
    }
    return output;
  }

  if (typeof value === 'string') return truncateText(value, 500);
  return value;
}

function buildGenericPayloadPreview(payload: Record<string, unknown>, redactedFields: string[]): Record<string, unknown> {
  const data = safeJsonObject(payload.data);
  const preview: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSecretLikeKey(key)) {
      preview[key] = '[REDACTED]';
      redactedFields.push(`data.${key}`);
      continue;
    }
    preview[key] = redactPreviewValue(value, redactedFields, `data.${key}`);
  }
  return preview;
}

function buildPayloadPreview(row: WorkspaceActionDetailRow): WorkspaceActionPayloadPreview {
  const payload = safeJsonObject(row.payload_json);
  const data = safeJsonObject(payload.data);
  const redactedFields: string[] = [];
  let preview: Record<string, unknown> = {};

  switch (row.action_type) {
    case 'content_publish':
      preview = {
        platform: data.platform ?? null,
        captionPreview: truncateText(data.caption, 700),
        postType: data.post_type ?? null,
        mediaUrlPresent: Boolean(data.media_url),
        mediaAssetIdPresent: Boolean(data.media_asset_id),
        hashtags: Array.isArray(data.hashtags) ? data.hashtags.slice(0, 20) : [],
        scheduledTime: data.scheduled_time ?? null,
        callToActionUrlPresent: Boolean(data.call_to_action_url),
        approvalNotesPreview: truncateText(data.approval_notes, 400),
      };
      break;
    case 'support_reply_send':
      preview = {
        supportProvider: data.support_provider ?? null,
        ticketId: data.ticket_id ?? null,
        threadId: data.thread_id ?? null,
        customerEmailHint: maskEmail(data.customer_email),
        customerNamePresent: Boolean(data.customer_name),
        subjectPreview: truncateText(data.subject, 200),
        replyBodyPreview: truncateText(data.reply_body, 900),
        category: data.category ?? null,
        confidenceScore: data.confidence_score ?? null,
        sensitiveFlag: Boolean(data.sensitive_flag),
        escalationRequired: Boolean(data.escalation_required),
        approvalNotesPreview: truncateText(data.approval_notes, 400),
      };
      if (data.customer_email) redactedFields.push('data.customer_email');
      if (data.customer_name) redactedFields.push('data.customer_name');
      break;
    case 'ad_budget_adjust':
      preview = {
        platform: data.platform ?? null,
        campaignId: data.campaign_id ?? null,
        adsetId: data.adset_id ?? null,
        currentBudget: data.current_budget ?? null,
        proposedBudget: data.proposed_budget ?? null,
        changeAmount: data.change_amount ?? null,
        changePercent: data.change_percent ?? null,
        currency: data.currency ?? null,
        currentBudgetPeriod: data.current_budget_period ?? null,
        proposedBudgetPeriod: data.proposed_budget_period ?? null,
        reasonPreview: truncateText(data.reason, 500),
        metricWindow: data.metric_window ?? null,
        hasPerformanceSnapshot: Boolean(data.performance_snapshot),
        rollbackBudget: data.rollback_budget ?? null,
      };
      break;
    case 'ad_pause':
      preview = {
        platform: data.platform ?? null,
        targetLevel: data.target_level ?? null,
        targetId: data.target_id ?? null,
        campaignId: data.campaign_id ?? null,
        adsetId: data.adset_id ?? null,
        adId: data.ad_id ?? null,
        currentStatus: data.current_status ?? null,
        proposedStatus: data.proposed_status ?? null,
        reasonPreview: truncateText(data.reason, 500),
        metricWindow: data.metric_window ?? null,
        rollbackStatus: data.rollback_status ?? null,
      };
      break;
    case 'research_task':
      preview = {
        questionPreview: truncateText(data.question, 500),
        objectivePreview: truncateText(data.objective, 500),
        allowedSources: Array.isArray(data.allowed_sources) ? data.allowed_sources.slice(0, 20) : [],
        outputFormat: data.output_format ?? null,
        dueAt: data.due_at ?? null,
        confidenceRequired: data.confidence_required ?? null,
      };
      break;
    case 'dev_task':
      preview = {
        taskSummaryPreview: truncateText(data.task_summary, 500),
        area: data.area ?? null,
        filesExpected: Array.isArray(data.files_expected) ? data.files_expected.slice(0, 30) : [],
        acceptanceCriteria: Array.isArray(data.acceptance_criteria) ? data.acceptance_criteria.slice(0, 20) : [],
        testCommands: Array.isArray(data.test_commands) ? data.test_commands.slice(0, 20) : [],
      };
      break;
    case 'notification_send':
      preview = {
        channel: data.channel ?? null,
        templateKey: data.template_key ?? null,
        recipientHint: data.recipient_email ? maskEmail(data.recipient_email) : data.recipient_hint ?? null,
        subjectPreview: truncateText(data.subject, 200),
        messagePreview: truncateText(data.message, 700),
        deepLinkPath: data.deep_link_path ?? null,
      };
      if (data.recipient_email) redactedFields.push('data.recipient_email');
      break;
    case 'rollback_action':
      preview = {
        targetActionId: data.target_action_id ?? null,
        rollbackType: data.rollback_type ?? null,
        rollbackReasonPreview: truncateText(data.rollback_reason, 500),
        requestedBy: data.requested_by ?? null,
        originalExecutorName: data.original_executor_name ?? null,
      };
      break;
    default:
      preview = buildGenericPayloadPreview(payload, redactedFields);
  }

  preview = redactPreviewValue(preview, redactedFields, 'preview') as Record<string, unknown>;

  return {
    schemaVersion: typeof payload.schema_version === 'string' ? payload.schema_version : null,
    actionType: typeof payload.action_type === 'string' ? payload.action_type : row.action_type,
    source: typeof payload.source === 'string' ? payload.source : null,
    intentSummary: truncateText(payload.intent_summary, 500),
    dataKeys: Object.keys(data).sort(),
    preview,
    redactedFields: Array.from(new Set(redactedFields)).sort(),
    includesFullPayloadJson: false,
    note: 'This is a safe payload preview only. Full raw payload_json is intentionally not returned by this Phase 4.10 package.',
  };
}

function serializeActionSummary(row: WorkspaceActionSummaryRow): WorkspaceActionListItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdByUserId: row.created_by_user_id,
    actionType: row.action_type,
    title: row.title,
    description: row.description,
    status: row.status,
    riskLevel: row.risk_level,
    approvalRequired: row.approval_required,
    policyDecision: row.policy_decision,
    policyDecisionSnapshotSummary: summarizePolicyDecisionSnapshot(row.policy_decision_snapshot_json),
    policyEvaluatedAt: iso(row.policy_evaluated_at),
    idempotencyKey: row.idempotency_key,
    actionHash: row.action_hash,
    createdAt: iso(row.created_at) || '',
    updatedAt: iso(row.updated_at) || '',
    approvedAt: iso(row.approved_at),
    executedAt: iso(row.executed_at),
    hasPayload: false,
  };
}

function serializeActionDetailSummary(row: WorkspaceActionDetailRow): WorkspaceActionDetailResponse['action'] {
  return {
    ...serializeActionSummary(row),
    hasPayload: true,
  };
}

function serializeStatusHistory(row: WorkspaceActionEventRow): WorkspaceActionStatusHistoryItem {
  const redactedFields: string[] = [];
  const metadataPreview = redactPreviewValue(safeJsonObject(row.metadata_json), redactedFields, 'metadata') as Record<string, unknown>;
  if (redactedFields.length > 0) {
    metadataPreview.redactedFields = Array.from(new Set(redactedFields)).sort();
  }

  return {
    id: row.id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorUserId: row.actor_user_id,
    message: row.message,
    metadataPreview,
    createdAt: iso(row.created_at) || '',
  };
}

function serializeResultSummary(row: WorkspaceActionResultRow): WorkspaceActionResultSummaryItem {
  const redactedFields: string[] = [];
  const metadataPreview = redactPreviewValue(safeJsonObject(row.metadata_json), redactedFields, 'metadata') as Record<string, unknown>;
  if (redactedFields.length > 0) {
    metadataPreview.redactedFields = Array.from(new Set(redactedFields)).sort();
  }

  return {
    id: row.id,
    executorName: row.executor_name,
    resultStatus: row.result_status,
    resultSummary: row.result_summary,
    errorMessage: row.error_message ? truncateText(row.error_message, 700) : null,
    externalId: row.external_id,
    externalUrl: row.external_url,
    rollbackSupported: row.rollback_supported,
    rollbackPayloadIncluded: false,
    metadataPreview,
    createdAt: iso(row.created_at) || '',
    updatedAt: iso(row.updated_at) || '',
  };
}

export function getActionsModuleStatus(): ActionsModuleStatus {
  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    module: 'actions',
    purpose: 'Provide the clean backend actions module for V2 approval queue APIs while preserving V1 read + advise + draft-only safety.',
    currentScope: 'Phase 7.4 adds the Support Rules UI form at /rules.html. It gives the founder a safe local-preview form for ticket category, confidence threshold, auto-reply preference, escalation categories, max replies/day, and sensitive-ticket exclusions while preserving the Phase 7.3 content form, Phase 7.2 wizard, and completed Phase 6.10 policy test foundation.',
    registeredFiles: [
      'actions.types.ts',
      'actions.repository.ts',
      'actions.service.ts',
      'actions.controller.ts',
      'actions.routes.ts',
      'actions.validation.ts',
      'actions.permission-guard.ts',
      'actions.backend-tests.ts',
    ],
    supportedActionTypes: ACTION_TYPE_VALUES,
    supportedStatuses: ACTION_STATUS_VALUES,
    supportedRiskLevels: ACTION_RISK_LEVEL_VALUES,
    enabledCapabilities: [
      'module status endpoint',
      'workspace-scoped action list endpoint',
      'workspace-scoped action detail endpoint',
      'internal createProposedAction service with duplicate protection',
      'POST /api/v1/actions/:id/approve role-gated internal approval endpoint',
      'POST /api/v1/actions/:id/reject role-gated internal rejection endpoint',
      'POST /api/v1/actions/:id/cancel role-gated internal cancellation endpoint',
      'centralized Phase 3.8 permission guard for view/approve/reject/cancel decisions',
      'Phase 3.10 backend test runner remains available for ACTION_NOT_FOUND, ACTION_ALREADY_EXECUTED, ACTION_REJECTED, APPROVAL_FORBIDDEN, INVALID_STATUS_TRANSITION, and workspace isolation paths',
      'requestId included in action error responses and x-request-id response header',
      'owner/admin/member/viewer customer role matrix with critical action owner-only approval by default',
      'approved, rejected, and cancelled event logging without queueing, executing, or rolling back',
      'double-click approval/rejection/cancellation no-op responses when action is already in the target state',
      'action_created event logging for newly proposed actions',
      'safe payload preview without returning full payload_json',
      'status history from action_events',
      'executor result summaries from action_results',
      'status/action_type/risk_level filters for list endpoint',
      'Phase 4.10 UI includes loading/empty/error states, focus-visible styling, skip link, dialog focus trap, reduced-motion support, and no-horizontal-overflow safeguards',
      'Phase 5.9 emergency safe mode and pause controls remain active and continue to block future auto-approval/execution when pause states are active',
      'Phase 6.1 policy table storage is available for evaluator lookup',
      'Phase 7.3 content rules UI links the completed policy foundation to a founder-facing content rule preview form',
      'Phase 6.2 default-ask policy behavior still forces ask/manual-review when no enabled policy rule matches',
      'createProposedAction now calls evaluateActionPolicy(action) so caller-requested auto_approve cannot self-authorize autonomy without an enabled matched policy rule',
      'Phase 4.10 UI can display QA/accessibility-tested risk badges/warnings and call POST /api/v1/actions/:id/reject after explicit reject-with-reason modal',
      'limit/offset pagination for list endpoint',
      'shared action type/status/risk validation constants',
      'role approval helper functions for future endpoints',
      'workspace-safe repository foundation from Phase 2.8',
    ],
    deliberatelyDisabledCapabilities: [
      'rollback request endpoint until a future rollback phase',
      'real external execution until later approved V2 phases',
      'real external write connectors until later approved V2 phases',
    ],
    approvalRoleModel: [
      {
        role: 'owner',
        canViewWorkspaceActions: true,
        canApproveLowMediumHigh: true,
        canApproveCritical: true,
        notes: 'Owner is the default highest customer workspace authority. Critical approval should still use confirmation UX later.',
      },
      {
        role: 'admin',
        canViewWorkspaceActions: true,
        canApproveLowMediumHigh: true,
        canApproveCritical: false,
        notes: 'Admin can approve normal actions later, but critical actions should remain owner-only unless a future policy explicitly changes it.',
      },
      {
        role: 'member',
        canViewWorkspaceActions: true,
        canApproveLowMediumHigh: false,
        canApproveCritical: false,
        notes: 'Member can review workspace actions later but cannot approve execution by default.',
      },
      {
        role: 'viewer',
        canViewWorkspaceActions: true,
        canApproveLowMediumHigh: false,
        canApproveCritical: false,
        notes: 'Viewer is read-only.',
      },
      {
        role: 'super_admin',
        canViewWorkspaceActions: false,
        canApproveLowMediumHigh: false,
        canApproveCritical: false,
        notes: 'Internal admin monitoring should be redacted by default and must not expose secrets or execute customer actions.',
      },
    ],
    safetyRules: [
      'V1 remains read + advise + draft only.',
      'GET /api/v1/actions is list-only and cannot approve, reject, cancel, queue, or execute anything.',
      'GET /api/v1/actions/:id is detail-only and cannot approve, reject, cancel, queue, or execute anything.',
      'POST /api/v1/actions/:id/approve can only set eligible internal actions to approved and log an approved event.',
      'POST /api/v1/actions/:id/reject can only set eligible internal actions to rejected and log a rejected event.',
      'POST /api/v1/actions/:id/cancel can only set eligible internal actions to cancelled and log a cancelled event.',
      'Normal approve/reject/cancel endpoints remain internal and do not publish, send, spend, pause, refund, rollback, or write to external platforms.',
      'List responses do not include payload_json.',
      'Detail responses include a redacted payload preview, not full raw payload_json.',
      'If pause_all_autonomy is active, future policy layers must not auto-approve and future executor layers must not execute.'
      ,'If a content/support/ads/research/dev category pause is active, future policy layers must not auto-approve that category and future executor layers must not execute that category.',
      'Existing proposed actions remain reviewable while global pause is active.',
      'Safe new proposed actions may still be created while global pause is active, but they must stay ask/manual-review only.',
      'Approved does not mean real-world execution.',
      'Auto-approved does not mean real-world execution.',
      'Phase 8.10 adds Safe Demo QA and confirms the full sandbox flow from draft to result log remains safe.',
      'Every action query must be scoped by workspace_id and authenticated membership.',
      'Admin monitoring must not expose raw secrets, raw API keys, or unnecessary payload details.',
      'Only the content_publish, support_reply_send, ad_budget_adjust, and ad_pause sandbox executor implementations exist, and they return fake result data only. Phase 8.10 adds Safe Demo QA for the full sandbox flow, while Phase 8.9 already tested rolled_back status after sandbox execution, but no real executor, external write connector, database-backed policy editor, auto-run policy editor, or real execution is enabled. EMERGENCY_SAFE_MODE can block future execution even if an action was previously approved.',
      'Executed actions cannot be cancelled from the normal cancel endpoint; future rollback flow is required where supported.',
    ],
    nextPhase: 'Phase 8.10 — Sandbox Executor QA',
  };
}

export async function listActionsForCurrentWorkspace(params: {
  workspaceId: string;
  userId: string;
  filters: WorkspaceActionListFilters;
}): Promise<WorkspaceActionListResponse> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to list V2 actions.');
  }

  const pagination = normalizeActionListPagination(params.filters);
  const membership = await getActiveActionWorkspaceMembership({
    workspaceId: params.workspaceId,
    userId: params.userId,
  });

  if (!membership) {
    throw createWorkspaceForbiddenError({ workspaceId: params.workspaceId, userId: params.userId } as any);
  }
  assertCanViewWorkspaceActions(membership);

  const effectiveFilters: WorkspaceActionListFilters = {
    status: params.filters.status,
    actionType: params.filters.actionType,
    riskLevel: params.filters.riskLevel,
    limit: pagination.limit,
    offset: pagination.offset,
  };

  const [rows, total] = await Promise.all([
    listWorkspaceActionsForUser({
      workspaceId: params.workspaceId,
      userId: params.userId,
      filters: effectiveFilters,
    }),
    countWorkspaceActionsForUser({
      workspaceId: params.workspaceId,
      userId: params.userId,
      filters: effectiveFilters,
    }),
  ]);

  const nextOffset = pagination.offset + rows.length;

  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    workspaceId: params.workspaceId,
    userRole: membership.workspace_role,
    filters: {
      status: params.filters.status ?? null,
      actionType: params.filters.actionType ?? null,
      riskLevel: params.filters.riskLevel ?? null,
    },
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      returned: rows.length,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    },
    items: rows.map(serializeActionSummary),
    safety: {
      listViewIncludesPayloadJson: false,
      canApproveFromThisEndpoint: false,
      canExecuteFromThisEndpoint: false,
      externalWritesEnabled: false,
      note: 'This endpoint is read-only and summary-only. Use GET /api/v1/actions/:id for safe detail review; execution remains disabled until later approved phases.',
    },
  };
}

export async function getActionDetailForCurrentWorkspace(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
}): Promise<WorkspaceActionDetailResponse> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to view V2 action details.');
  }

  const membership = await getActiveActionWorkspaceMembership({
    workspaceId: params.workspaceId,
    userId: params.userId,
  });

  if (!membership) {
    throw createWorkspaceForbiddenError({ workspaceId: params.workspaceId, userId: params.userId } as any);
  }
  assertCanViewWorkspaceActions(membership);

  const action = await getWorkspaceActionForUser({
    workspaceId: params.workspaceId,
    userId: params.userId,
    actionId: params.actionId,
  });

  if (!action) {
    throw createActionNotFoundError({ actionId: params.actionId, workspaceId: params.workspaceId } as any);
  }

  const [events, results] = await Promise.all([
    listWorkspaceActionEventsForUser({
      workspaceId: params.workspaceId,
      userId: params.userId,
      actionId: params.actionId,
      limit: 200,
    }),
    listWorkspaceActionResultsForUser({
      workspaceId: params.workspaceId,
      userId: params.userId,
      actionId: params.actionId,
      limit: 50,
    }),
  ]);

  const canApprove = canApproveActionRisk(membership.workspace_role, action.risk_level);

  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    workspaceId: params.workspaceId,
    userRole: membership.workspace_role,
    action: serializeActionDetailSummary(action),
    payloadPreview: buildPayloadPreview(action),
    risk: {
      level: action.risk_level,
      approvalRequired: action.approval_required,
      canCurrentRoleApproveInFuture: canApprove,
      note: canApprove
        ? 'This role is approval-capable for this risk level under the Phase 3.8 guard. Approval still does not queue, execute, rollback, or write externally.'
        : 'This role is not allowed to approve this risk level by the Phase 3.8 guard. Member/viewer cannot approve, and critical actions require owner approval by default.',
    },
    policy: {
      decision: action.policy_decision,
      evaluatedAt: iso(action.policy_evaluated_at),
      decisionSnapshot: summarizePolicyDecisionSnapshot(action.policy_decision_snapshot_json),
      fullDecisionSnapshotForAudit: action.policy_decision_snapshot_json,
      note: 'Phase 7.3 adds a safe content rules preview form and keeps Phase 6.8 policy decision snapshots on real proposed actions. Policy editing, execution, content publishing, and external writes remain disabled until later approved V2 phases.',
    },
    statusHistory: events.map(serializeStatusHistory),
    resultSummary: results.map(serializeResultSummary),
    safety: {
      detailIncludesFullPayloadJson: false,
      canApproveFromThisEndpoint: false,
      canExecuteFromThisEndpoint: false,
      externalWritesEnabled: false,
      note: 'This endpoint is read-only. It returns safe review information, status history, and result summaries only. It cannot publish, send, spend, pause, refund, or write to external platforms.',
    },
  };
}


export async function createProposedAction(input: CreateProposedActionInput): Promise<CreateProposedActionResult> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to create V2 proposed actions.');
  }

  const normalized = validateCreateProposedActionInput(input);

  const membership = input.createdByUserId
    ? await getActiveActionWorkspaceMembership({
        workspaceId: input.workspaceId,
        userId: input.createdByUserId,
      })
    : null;

  if (input.createdByUserId && !membership) {
    throw new AppError(403, 'ACTION_WORKSPACE_FORBIDDEN', 'The proposed action creator is not an active member of this workspace.');
  }

  const globalPauseState = await getGlobalPauseStateForWorkspace(input.workspaceId);
  const categoryPauseState = getCategoryPauseState({
    pauseState: globalPauseState,
    actionType: input.actionType,
  });
  const policyEvaluation = await evaluateActionPolicy({
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    payloadJson: normalized.payloadJson,
    riskLevel: normalized.riskLevel,
    requestedDecision: normalized.policyDecision,
    source: input.source || 'createProposedAction',
    knownPauseState: globalPauseState,
    knownCategoryPauseState: categoryPauseState,
  });
  const effectiveNormalized = enforceActionPolicyEvaluation({
    normalized,
    policyEvaluation,
  });
  const preliminaryPolicyDecisionSnapshot = buildPolicyDecisionSnapshot({
    evaluation: policyEvaluation,
    actionId: null,
  });

  const existing = await findExistingActionDuplicate({
    workspaceId: input.workspaceId,
    idempotencyKey: effectiveNormalized.idempotencyKey,
    actionHash: effectiveNormalized.actionHash,
  });

  if (existing) {
    return buildCreateProposedActionResult({
      created: false,
      duplicateReason: existing.duplicate_match_reason,
      row: existing,
      globalPauseActive: globalPauseState.pauseAllAutonomy,
      category: categoryPauseState.category,
      categoryPaused: categoryPauseState.categoryPaused,
      autoApprovalAllowed: categoryPauseState.autoApprovalAllowed,
      executorExecutionAllowed: categoryPauseState.executorExecutionAllowed,
      autonomyNote: categoryPauseState.reason,
    });
  }

  let inserted: WorkspaceActionSummaryRow;
  try {
    inserted = await insertProposedActionRecord({
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId || null,
      actionType: input.actionType,
      title: normalized.title,
      description: normalized.description,
      payloadJson: effectiveNormalized.payloadJson,
      status: 'proposed',
      riskLevel: effectiveNormalized.riskLevel,
      approvalRequired: effectiveNormalized.approvalRequired,
      policyDecision: effectiveNormalized.policyDecision,
      policyDecisionSnapshotJson: preliminaryPolicyDecisionSnapshot,
      policyEvaluatedAt: policyEvaluation.evaluatedAt,
      idempotencyKey: effectiveNormalized.idempotencyKey,
      actionHash: effectiveNormalized.actionHash,
    });
  } catch (error) {
    const pgCode = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    if (pgCode === '23505') {
      const duplicateAfterRace = await findExistingActionDuplicate({
        workspaceId: input.workspaceId,
        idempotencyKey: effectiveNormalized.idempotencyKey,
        actionHash: effectiveNormalized.actionHash,
      });

      if (duplicateAfterRace) {
        return buildCreateProposedActionResult({
          created: false,
          duplicateReason: duplicateAfterRace.duplicate_match_reason,
          row: duplicateAfterRace,
          globalPauseActive: globalPauseState.pauseAllAutonomy,
          category: categoryPauseState.category,
          categoryPaused: categoryPauseState.categoryPaused,
          autoApprovalAllowed: categoryPauseState.autoApprovalAllowed,
          executorExecutionAllowed: categoryPauseState.executorExecutionAllowed,
          autonomyNote: categoryPauseState.reason,
        });
      }
    }
    throw error;
  }

  const finalPolicyDecisionSnapshot = buildPolicyDecisionSnapshot({
    evaluation: policyEvaluation,
    actionId: inserted.id,
  });
  const persistedPolicyRow = await persistActionPolicyDecisionSnapshot({
    actionId: inserted.id,
    workspaceId: inserted.workspace_id,
    policyDecision: effectiveNormalized.policyDecision,
    approvalRequired: effectiveNormalized.approvalRequired,
    snapshotJson: finalPolicyDecisionSnapshot,
    evaluatedAt: policyEvaluation.evaluatedAt,
  });
  inserted = persistedPolicyRow || inserted;

  await insertActionCreatedEvent({
    actionId: inserted.id,
    workspaceId: inserted.workspace_id,
    actorUserId: inserted.created_by_user_id,
    toStatus: inserted.status,
    message: input.reason || 'Proposed V2 action created internally. No approval, queueing, execution, or external write was performed.',
    metadataJson: {
      phase: '6.9',
      source: input.source || 'system',
      service: 'createProposedAction',
      policy_evaluator_phase: '6.9',
      policy_evaluator_checked: true,
      policy_evaluator_decision: policyEvaluation.decision,
      policy_evaluator_reason: policyEvaluation.reason,
      policy_evaluator_matched_policy_id: policyEvaluation.matched_policy_id,
      policy_evaluator_match_state: policyEvaluation.matchState,
      policy_evaluator_cap_status: policyEvaluation.cap_status,
      policy_evaluator_checked_policy_count: policyEvaluation.checkedPolicyCount,
      policy_decision_snapshot_persisted: true,
      policy_decision_snapshot_phase: '6.9',
      policy_decision_snapshot_safe_for_admin_audit: true,
      default_ask_applied: policyEvaluation.defaultAskApplied,
      external_write_enabled: false,
      executor_enabled: false,
      approval_api_enabled: false,
      emergency_safe_mode_active: globalPauseState.emergencySafeMode?.active === true,
      emergency_safe_mode_reason: globalPauseState.emergencySafeMode?.reason || null,
      pause_all_autonomy_active: globalPauseState.pauseAllAutonomy,
      pause_category: categoryPauseState.category,
      pause_category_active: categoryPauseState.categoryPaused,
      policy_pause_checked: policyEvaluation.policyCheckedPauseState,
      policy_pause_block_reason: policyEvaluation.pause.blockReason,
      category_pause_forced_ask: categoryPauseState.categoryPaused || categoryPauseState.pauseAllAutonomy || globalPauseState.emergencySafeMode?.active === true,
      category_pause_auto_approval_allowed: categoryPauseState.autoApprovalAllowed,
      category_pause_executor_execution_allowed: categoryPauseState.executorExecutionAllowed,
      idempotency_key_present: Boolean(inserted.idempotency_key),
      action_hash_present: Boolean(inserted.action_hash),
      ...(input.metadata || {}),
    },
  });

  await insertPolicyEvaluatedEvent({
    actionId: inserted.id,
    workspaceId: inserted.workspace_id,
    actorUserId: inserted.created_by_user_id,
    currentStatus: inserted.status,
    message: `Policy decision persisted on action: ${policyEvaluation.decision}.`,
    metadataJson: {
      phase: '6.9',
      service: 'createProposedAction',
      policy_decision: policyEvaluation.decision,
      policy_reason: policyEvaluation.reason,
      matched_policy_id: policyEvaluation.matched_policy_id,
      cap_status: policyEvaluation.cap_status,
      evaluated_at: policyEvaluation.evaluatedAt,
      snapshot_persisted_on_action: true,
      external_write_enabled: false,
      executor_enabled: false,
    },
  });

  return buildCreateProposedActionResult({
    created: true,
    duplicateReason: 'none',
    row: inserted,
    globalPauseActive: globalPauseState.pauseAllAutonomy,
    autonomyNote: policyEvaluation.reason,
  });
}


function buildApproveActionResponse(params: {
  membershipRole: string;
  row: WorkspaceActionSummaryRow;
  fromStatus: ActionStatus;
  approved: boolean;
  alreadyApproved: boolean;
  approvedByUserId: string;
  approvalNote: string | null;
  eventLogged: boolean;
}): ApproveActionResponse {
  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    workspaceId: params.row.workspace_id,
    userRole: params.membershipRole,
    approved: params.approved,
    alreadyApproved: params.alreadyApproved,
    action: serializeActionSummary(params.row),
    transition: {
      fromStatus: params.fromStatus,
      toStatus: 'approved',
    },
    approval: {
      approvedByUserId: params.approvedByUserId,
      approvedAt: iso(params.row.approved_at),
      approvalNote: params.approvalNote,
      eventLogged: params.eventLogged,
    },
    execution: {
      executed: false,
      queued: false,
      executorEnabled: false,
      note: 'Approval is recorded internally only. Executor phases are not enabled yet, so this endpoint does not queue or execute the action.',
    },
    safety: {
      canExecuteFromThisEndpoint: false,
      externalWritesEnabled: false,
      note: 'POST /api/v1/actions/:id/approve only changes internal LIFE.SAVER action status and logs an approved event. It cannot publish content, send support replies, change ad spend, pause campaigns, refund orders, edit products, or write to external platforms.',
    },
  };
}

export async function approveActionForCurrentWorkspace(input: ApproveActionInput): Promise<ApproveActionResponse> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to approve V2 actions.');
  }

  const approvalNote = normalizeApprovalNote(input.approvalNote);
  const membership = await getActiveActionWorkspaceMembership({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (!membership) {
    throw createWorkspaceForbiddenError({ workspaceId: input.workspaceId, userId: input.userId } as any);
  }

  const action = await getWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
  });

  if (!action) {
    throw createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const approvalDecision = assertCanApproveWorkspaceAction(membership, action);

  if (action.status === 'approved') {
    return buildApproveActionResponse({
      membershipRole: membership.workspace_role,
      row: action,
      fromStatus: 'approved',
      approved: false,
      alreadyApproved: true,
      approvedByUserId: input.userId,
      approvalNote,
      eventLogged: false,
    });
  }

  if (!APPROVABLE_STATUSES.includes(action.status)) {
    const explanation = explainNotApprovableStatus(action.status);
    throw createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'approve', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: action.status, attemptedStatus: 'approved', allowedStatuses: APPROVABLE_STATUSES });
  }

  const approvedRow = await approveWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
    approvableStatuses: APPROVABLE_STATUSES,
  });

  if (!approvedRow) {
    const latest = await getWorkspaceActionForUser({
      workspaceId: input.workspaceId,
      userId: input.userId,
      actionId: input.actionId,
    });

    if (latest?.status === 'approved') {
      return buildApproveActionResponse({
        membershipRole: membership.workspace_role,
        row: latest,
        fromStatus: 'approved',
        approved: false,
        alreadyApproved: true,
        approvedByUserId: input.userId,
        approvalNote,
        eventLogged: false,
      });
    }

    const explanation = latest ? explainNotApprovableStatus(latest.status) : { code: 'ACTION_NOT_FOUND', message: 'Action was not found in your current workspace.' };
    throw latest ? createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'approve', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: latest.status, attemptedStatus: 'approved', allowedStatuses: APPROVABLE_STATUSES }) : createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const eventLogged = await insertActionLifecycleEvent({
    actionId: approvedRow.id,
    workspaceId: approvedRow.workspace_id,
    actorUserId: input.userId,
    eventType: 'approved',
    fromStatus: approvedRow.previous_status,
    toStatus: 'approved',
    message: approvalNote || 'Action approved internally. Executor phases are disabled; no queueing, execution, or external write was performed.',
    metadataJson: {
      phase: '3.5',
      endpoint: 'POST /api/v1/actions/:id/approve',
      approved_by_role: membership.workspace_role,
      permission_guard_code: approvalDecision.code,
      permission_guard_reason: approvalDecision.reason,
      risk_level: approvedRow.risk_level,
      execution_enabled: false,
      queued: false,
      external_write_enabled: false,
      double_click_protection: true,
    },
    preventDuplicateEventType: true,
  });

  return buildApproveActionResponse({
    membershipRole: membership.workspace_role,
    row: approvedRow,
    fromStatus: approvedRow.previous_status,
    approved: true,
    alreadyApproved: false,
    approvedByUserId: input.userId,
    approvalNote,
    eventLogged,
  });
}

function buildRejectActionResponse(params: {
  membershipRole: string;
  row: WorkspaceActionSummaryRow;
  fromStatus: ActionStatus;
  rejected: boolean;
  alreadyRejected: boolean;
  rejectedByUserId: string;
  rejectionReason: string | null;
  eventLogged: boolean;
}): RejectActionResponse {
  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    workspaceId: params.row.workspace_id,
    userRole: params.membershipRole,
    rejected: params.rejected,
    alreadyRejected: params.alreadyRejected,
    action: serializeActionSummary(params.row),
    transition: {
      fromStatus: params.fromStatus,
      toStatus: 'rejected',
    },
    rejection: {
      rejectedByUserId: params.rejectedByUserId,
      rejectedAt: iso(params.row.updated_at),
      rejectionReason: params.rejectionReason,
      eventLogged: params.eventLogged,
    },
    execution: {
      executed: false,
      queued: false,
      executorEnabled: false,
      note: 'Rejection is recorded internally only. Executor phases are not enabled yet, so this endpoint does not queue or execute the action.',
    },
    safety: {
      canExecuteFromThisEndpoint: false,
      externalWritesEnabled: false,
      note: 'POST /api/v1/actions/:id/reject only changes internal LIFE.SAVER action status and logs a rejected event. It cannot publish content, send support replies, change ad spend, pause campaigns, refund orders, edit products, or write to external platforms.',
    },
  };
}

export async function rejectActionForCurrentWorkspace(input: RejectActionInput): Promise<RejectActionResponse> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to reject V2 actions.');
  }

  const rejectionReason = normalizeRejectionReason(input.rejectionReason);
  const membership = await getActiveActionWorkspaceMembership({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (!membership) {
    throw createWorkspaceForbiddenError({ workspaceId: input.workspaceId, userId: input.userId } as any);
  }

  const action = await getWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
  });

  if (!action) {
    throw createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const rejectionDecision = assertCanRejectWorkspaceAction(membership, action);

  if (action.status === 'rejected') {
    return buildRejectActionResponse({
      membershipRole: membership.workspace_role,
      row: action,
      fromStatus: 'rejected',
      rejected: false,
      alreadyRejected: true,
      rejectedByUserId: input.userId,
      rejectionReason,
      eventLogged: false,
    });
  }

  if (!REJECTABLE_STATUSES.includes(action.status)) {
    const explanation = explainNotRejectableStatus(action.status);
    throw createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'reject', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: action.status, attemptedStatus: 'rejected', allowedStatuses: REJECTABLE_STATUSES });
  }

  const rejectedRow = await rejectWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
    rejectableStatuses: REJECTABLE_STATUSES,
  });

  if (!rejectedRow) {
    const latest = await getWorkspaceActionForUser({
      workspaceId: input.workspaceId,
      userId: input.userId,
      actionId: input.actionId,
    });

    if (latest?.status === 'rejected') {
      return buildRejectActionResponse({
        membershipRole: membership.workspace_role,
        row: latest,
        fromStatus: 'rejected',
        rejected: false,
        alreadyRejected: true,
        rejectedByUserId: input.userId,
        rejectionReason,
        eventLogged: false,
      });
    }

    const explanation = latest ? explainNotRejectableStatus(latest.status) : { code: 'ACTION_NOT_FOUND', message: 'Action was not found in your current workspace.' };
    throw latest ? createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'reject', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: latest.status, attemptedStatus: 'rejected', allowedStatuses: REJECTABLE_STATUSES }) : createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const eventLogged = await insertActionLifecycleEvent({
    actionId: rejectedRow.id,
    workspaceId: rejectedRow.workspace_id,
    actorUserId: input.userId,
    eventType: 'rejected',
    fromStatus: rejectedRow.previous_status,
    toStatus: 'rejected',
    message: rejectionReason || 'Action rejected internally. Executor phases are disabled; no queueing, execution, or external write was performed.',
    metadataJson: {
      phase: '3.6',
      endpoint: 'POST /api/v1/actions/:id/reject',
      rejected_by_role: membership.workspace_role,
      permission_guard_code: rejectionDecision.code,
      permission_guard_reason: rejectionDecision.reason,
      risk_level: rejectedRow.risk_level,
      rejection_reason_present: Boolean(rejectionReason),
      execution_enabled: false,
      queued: false,
      external_write_enabled: false,
      double_click_protection: true,
    },
    preventDuplicateEventType: true,
  });

  return buildRejectActionResponse({
    membershipRole: membership.workspace_role,
    row: rejectedRow,
    fromStatus: rejectedRow.previous_status,
    rejected: true,
    alreadyRejected: false,
    rejectedByUserId: input.userId,
    rejectionReason,
    eventLogged,
  });
}


function buildCancelActionResponse(params: {
  membershipRole: string;
  row: WorkspaceActionSummaryRow;
  fromStatus: ActionStatus;
  cancelled: boolean;
  alreadyCancelled: boolean;
  cancelledByUserId: string;
  cancelReason: string | null;
  eventLogged: boolean;
}): CancelActionResponse {
  return {
    version: '0.6.0',
    phase: ACTION_MODULE_PHASE,
    workspaceId: params.row.workspace_id,
    userRole: params.membershipRole,
    cancelled: params.cancelled,
    alreadyCancelled: params.alreadyCancelled,
    action: serializeActionSummary(params.row),
    transition: {
      fromStatus: params.fromStatus,
      toStatus: 'cancelled',
    },
    cancellation: {
      cancelledByUserId: params.cancelledByUserId,
      cancelledAt: iso(params.row.updated_at),
      cancelReason: params.cancelReason,
      eventLogged: params.eventLogged,
    },
    execution: {
      executed: false,
      queued: false,
      executorEnabled: false,
      rollbackRequired: false,
      note: 'Cancellation is recorded internally only. Executor phases are not enabled yet, so this endpoint does not execute, queue, or rollback anything.',
    },
    safety: {
      canExecuteFromThisEndpoint: false,
      externalWritesEnabled: false,
      executedActionsCancellableFromThisEndpoint: false,
      note: 'POST /api/v1/actions/:id/cancel only changes internal LIFE.SAVER action status and logs a cancelled event. It cannot publish content, send support replies, change ad spend, pause campaigns, refund orders, edit products, write to external platforms, or cancel already executed real-world actions.',
    },
  };
}

export async function cancelActionForCurrentWorkspace(input: CancelActionInput): Promise<CancelActionResponse> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to cancel V2 actions.');
  }

  const cancelReason = normalizeCancelReason(input.cancelReason);
  const membership = await getActiveActionWorkspaceMembership({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (!membership) {
    throw createWorkspaceForbiddenError({ workspaceId: input.workspaceId, userId: input.userId } as any);
  }

  const action = await getWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
  });

  if (!action) {
    throw createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const cancelDecision = assertCanCancelWorkspaceAction(membership, action);

  if (action.status === 'cancelled') {
    return buildCancelActionResponse({
      membershipRole: membership.workspace_role,
      row: action,
      fromStatus: 'cancelled',
      cancelled: false,
      alreadyCancelled: true,
      cancelledByUserId: input.userId,
      cancelReason,
      eventLogged: false,
    });
  }

  if (!CANCELLABLE_STATUSES.includes(action.status)) {
    const explanation = explainNotCancellableStatus(action.status);
    throw createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'cancel', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: action.status, attemptedStatus: 'cancelled', allowedStatuses: CANCELLABLE_STATUSES });
  }

  const cancelledRow = await cancelWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
    cancellableStatuses: CANCELLABLE_STATUSES,
  });

  if (!cancelledRow) {
    const latest = await getWorkspaceActionForUser({
      workspaceId: input.workspaceId,
      userId: input.userId,
      actionId: input.actionId,
    });

    if (latest?.status === 'cancelled') {
      return buildCancelActionResponse({
        membershipRole: membership.workspace_role,
        row: latest,
        fromStatus: 'cancelled',
        cancelled: false,
        alreadyCancelled: true,
        cancelledByUserId: input.userId,
        cancelReason,
        eventLogged: false,
      });
    }

    const explanation = latest ? explainNotCancellableStatus(latest.status) : { code: 'ACTION_NOT_FOUND', message: 'Action was not found in your current workspace.' };
    throw latest ? createInvalidStatusTransitionError({ code: explanation.code, message: explanation.message, operation: 'cancel', actionId: input.actionId, workspaceId: input.workspaceId, currentStatus: latest.status, attemptedStatus: 'cancelled', allowedStatuses: CANCELLABLE_STATUSES }) : createActionNotFoundError({ actionId: input.actionId, workspaceId: input.workspaceId } as any);
  }

  const eventLogged = await insertActionLifecycleEvent({
    actionId: cancelledRow.id,
    workspaceId: cancelledRow.workspace_id,
    actorUserId: input.userId,
    eventType: 'cancelled',
    fromStatus: cancelledRow.previous_status,
    toStatus: 'cancelled',
    message: cancelReason || 'Action cancelled internally before execution. Executor phases are disabled; no queueing, execution, rollback, or external write was performed.',
    metadataJson: {
      phase: '3.7',
      endpoint: 'POST /api/v1/actions/:id/cancel',
      cancelled_by_role: membership.workspace_role,
      permission_guard_code: cancelDecision.code,
      permission_guard_reason: cancelDecision.reason,
      risk_level: cancelledRow.risk_level,
      cancel_reason_present: Boolean(cancelReason),
      previous_status: cancelledRow.previous_status,
      execution_enabled: false,
      queued: false,
      external_write_enabled: false,
      rollback_required: false,
      double_click_protection: true,
    },
    preventDuplicateEventType: true,
  });

  return buildCancelActionResponse({
    membershipRole: membership.workspace_role,
    row: cancelledRow,
    fromStatus: cancelledRow.previous_status,
    cancelled: true,
    alreadyCancelled: false,
    cancelledByUserId: input.userId,
    cancelReason,
    eventLogged,
  });
}

export function canWorkspaceRoleApproveAction(role: string | null | undefined, riskLevel: ActionRiskLevel): boolean {
  return canApproveActionRisk(role, riskLevel);
}

export function canWorkspaceRoleApproveAnyAction(role: string | null | undefined): boolean {
  return canApproveAnyAction(role);
}
