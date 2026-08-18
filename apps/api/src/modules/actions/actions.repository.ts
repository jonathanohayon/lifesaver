import { isDatabaseConfigured, query } from '../../db/pool.js';
import type {
  ActionRiskLevel,
  ActionStatus,
  ActionType,
  ApproveWorkspaceActionRow,
  RejectWorkspaceActionRow,
  CancelWorkspaceActionRow,
  CreateProposedActionDbInput,
  ExistingActionDuplicateRow,
  InternalAdminActionMonitorRow,
  WorkspaceActionDetailRow,
  WorkspaceActionEventRow,
  WorkspaceActionListFilters,
  WorkspaceActionMembershipRow,
  WorkspaceActionResultRow,
  WorkspaceActionSummaryRow,
} from './actions.types.js';

const ACTION_SUMMARY_SELECT = `
  a.id,
  a.workspace_id,
  a.created_by_user_id,
  a.action_type,
  a.title,
  a.description,
  a.status,
  a.risk_level,
  a.approval_required,
  a.policy_decision,
  COALESCE(a.policy_decision_snapshot_json, '{}'::jsonb) AS policy_decision_snapshot_json,
  a.policy_evaluated_at,
  a.idempotency_key,
  a.action_hash,
  a.created_at,
  a.updated_at,
  a.approved_at,
  a.executed_at
`;

function clampLimit(value: number | undefined, fallback = 50, max = 100): number {
  if (!Number.isFinite(value || 0)) return fallback;
  const parsed = Math.floor(Number(value));
  if (parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeOffset(value: number | undefined): number {
  if (!Number.isFinite(value || 0)) return 0;
  const parsed = Math.floor(Number(value));
  return parsed > 0 ? parsed : 0;
}

function buildActionFilterSql(filters: WorkspaceActionListFilters, startingParamIndex: number): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let index = startingParamIndex;

  if (filters.status) {
    conditions.push(`a.status = $${index}`);
    params.push(filters.status);
    index += 1;
  }

  if (filters.actionType) {
    conditions.push(`a.action_type = $${index}`);
    params.push(filters.actionType);
    index += 1;
  }

  if (filters.riskLevel) {
    conditions.push(`a.risk_level = $${index}`);
    params.push(filters.riskLevel);
    index += 1;
  }

  return {
    sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
    params,
  };
}


const ACTIVE_DUPLICATE_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
  'approved',
  'queued',
  'executing',
  'executed',
  'rollback_requested',
  'rolled_back',
] as const;

export async function findExistingActionDuplicate(params: {
  workspaceId: string;
  idempotencyKey: string;
  actionHash: string;
}): Promise<ExistingActionDuplicateRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ExistingActionDuplicateRow>(
    `SELECT
       ${ACTION_SUMMARY_SELECT},
       CASE
         WHEN a.idempotency_key = $2 THEN 'idempotency_key'
         ELSE 'action_hash'
       END AS duplicate_match_reason
     FROM actions a
     WHERE a.workspace_id = $1
       AND (
         a.idempotency_key = $2
         OR (
           a.action_hash = $3
           AND a.status = ANY($4::text[])
         )
       )
     ORDER BY
       CASE WHEN a.idempotency_key = $2 THEN 0 ELSE 1 END,
       a.created_at DESC
     LIMIT 1;`,
    [params.workspaceId, params.idempotencyKey, params.actionHash, [...ACTIVE_DUPLICATE_STATUSES]]
  );

  return result.rows[0] ?? null;
}

export async function insertProposedActionRecord(input: CreateProposedActionDbInput): Promise<WorkspaceActionSummaryRow> {
  if (!isDatabaseConfigured) throw new Error('DATABASE_URL is not configured.');

  const result = await query<WorkspaceActionSummaryRow>(
    `INSERT INTO actions (
       workspace_id,
       created_by_user_id,
       action_type,
       title,
       description,
       payload_json,
       status,
       risk_level,
       approval_required,
       policy_decision,
       policy_decision_snapshot_json,
       policy_evaluated_at,
       idempotency_key,
       action_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12::timestamptz, $13, $14)
     RETURNING ${ACTION_SUMMARY_SELECT};`,
    [
      input.workspaceId,
      input.createdByUserId,
      input.actionType,
      input.title,
      input.description,
      JSON.stringify(input.payloadJson),
      input.status,
      input.riskLevel,
      input.approvalRequired,
      input.policyDecision,
      JSON.stringify(input.policyDecisionSnapshotJson || {}),
      input.policyEvaluatedAt,
      input.idempotencyKey,
      input.actionHash,
    ]
  );

  return result.rows[0];
}


export async function persistActionPolicyDecisionSnapshot(params: {
  actionId: string;
  workspaceId: string;
  policyDecision: string;
  approvalRequired: boolean;
  snapshotJson: Record<string, unknown>;
  evaluatedAt: string | null;
}): Promise<WorkspaceActionSummaryRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<WorkspaceActionSummaryRow>(
    `UPDATE actions
     SET policy_decision = $3,
         approval_required = $4,
         policy_decision_snapshot_json = $5::jsonb,
         policy_evaluated_at = $6::timestamptz,
         updated_at = NOW()
     WHERE id = $1
       AND workspace_id = $2
     RETURNING ${ACTION_SUMMARY_SELECT};`,
    [
      params.actionId,
      params.workspaceId,
      params.policyDecision,
      params.approvalRequired,
      JSON.stringify(params.snapshotJson || {}),
      params.evaluatedAt,
    ]
  );

  return result.rows[0] ?? null;
}

export async function insertPolicyEvaluatedEvent(params: {
  actionId: string;
  workspaceId: string;
  actorUserId: string | null;
  currentStatus: ActionStatus;
  message: string;
  metadataJson?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO action_events (
       action_id,
       workspace_id,
       actor_user_id,
       event_type,
       from_status,
       to_status,
       message,
       metadata_json
     )
     VALUES ($1, $2, $3, 'policy_evaluated', $4, $4, $5, $6::jsonb);`,
    [
      params.actionId,
      params.workspaceId,
      params.actorUserId,
      params.currentStatus,
      params.message,
      JSON.stringify(params.metadataJson || {}),
    ]
  );
}

export async function insertActionCreatedEvent(params: {
  actionId: string;
  workspaceId: string;
  actorUserId: string | null;
  toStatus: ActionStatus;
  message: string;
  metadataJson?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO action_events (
       action_id,
       workspace_id,
       actor_user_id,
       event_type,
       from_status,
       to_status,
       message,
       metadata_json
     )
     SELECT $1, $2, $3, 'action_created', NULL, $4, $5, $6::jsonb
     WHERE NOT EXISTS (
       SELECT 1
       FROM action_events
       WHERE action_id = $1
         AND event_type = 'action_created'
     );`,
    [
      params.actionId,
      params.workspaceId,
      params.actorUserId,
      params.toStatus,
      params.message,
      JSON.stringify(params.metadataJson || {}),
    ]
  );
}

export async function getActiveActionWorkspaceMembership(params: {
  workspaceId: string;
  userId: string;
}): Promise<WorkspaceActionMembershipRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<WorkspaceActionMembershipRow>(
    `SELECT
       wm.workspace_id,
       wm.user_id,
       wm.role AS workspace_role,
       COALESCE(wm.status, 'active') AS membership_status,
       u.role AS user_platform_role
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
       AND wm.user_id = $2
       AND COALESCE(wm.status, 'active') = 'active'
     LIMIT 1;`,
    [params.workspaceId, params.userId]
  );

  return result.rows[0] ?? null;
}

export async function listWorkspaceActionsForUser(params: {
  workspaceId: string;
  userId: string;
  filters?: WorkspaceActionListFilters;
}): Promise<WorkspaceActionSummaryRow[]> {
  if (!isDatabaseConfigured) return [];

  const filters = params.filters || {};
  const limit = clampLimit(filters.limit);
  const offset = normalizeOffset(filters.offset);
  const filterSql = buildActionFilterSql(filters, 3);
  const limitParam = 3 + filterSql.params.length;
  const offsetParam = limitParam + 1;

  const result = await query<WorkspaceActionSummaryRow>(
    `SELECT ${ACTION_SUMMARY_SELECT}
     FROM actions a
     WHERE a.workspace_id = $1
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = a.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
       ${filterSql.sql}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${limitParam}
     OFFSET $${offsetParam};`,
    [params.workspaceId, params.userId, ...filterSql.params, limit, offset]
  );

  return result.rows;
}


export async function countWorkspaceActionsForUser(params: {
  workspaceId: string;
  userId: string;
  filters?: WorkspaceActionListFilters;
}): Promise<number> {
  if (!isDatabaseConfigured) return 0;

  const filters = params.filters || {};
  const filterSql = buildActionFilterSql(filters, 3);

  const result = await query<{ total_count: string }>(
    `SELECT COUNT(*)::TEXT AS total_count
     FROM actions a
     WHERE a.workspace_id = $1
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = a.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
       ${filterSql.sql};`,
    [params.workspaceId, params.userId, ...filterSql.params]
  );

  return Number(result.rows[0]?.total_count || 0);
}

export async function getWorkspaceActionForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
}): Promise<WorkspaceActionDetailRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<WorkspaceActionDetailRow>(
    `SELECT
       ${ACTION_SUMMARY_SELECT},
       a.payload_json
     FROM actions a
     WHERE a.workspace_id = $1
       AND a.id = $2
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = a.workspace_id
           AND wm.user_id = $3
           AND COALESCE(wm.status, 'active') = 'active'
       )
     LIMIT 1;`,
    [params.workspaceId, params.actionId, params.userId]
  );

  return result.rows[0] ?? null;
}

export async function listWorkspaceActionEventsForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
  limit?: number;
}): Promise<WorkspaceActionEventRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 50, 200);

  const result = await query<WorkspaceActionEventRow>(
    `SELECT
       ae.id,
       ae.action_id,
       ae.workspace_id,
       ae.actor_user_id,
       ae.event_type,
       ae.from_status,
       ae.to_status,
       ae.message,
       ae.metadata_json,
       ae.created_at
     FROM action_events ae
     INNER JOIN actions a ON a.id = ae.action_id AND a.workspace_id = ae.workspace_id
     WHERE ae.workspace_id = $1
       AND ae.action_id = $2
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = ae.workspace_id
           AND wm.user_id = $3
           AND COALESCE(wm.status, 'active') = 'active'
       )
     ORDER BY ae.created_at ASC, ae.id ASC
     LIMIT $4;`,
    [params.workspaceId, params.actionId, params.userId, limit]
  );

  return result.rows;
}

export async function listWorkspaceActionResultsForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
  limit?: number;
}): Promise<WorkspaceActionResultRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 25, 100);

  const result = await query<WorkspaceActionResultRow>(
    `SELECT
       ar.id,
       ar.action_id,
       ar.workspace_id,
       ar.executor_name,
       ar.external_id,
       ar.external_url,
       ar.result_status,
       ar.result_summary,
       ar.error_message,
       ar.rollback_supported,
       ar.rollback_payload,
       ar.metadata_json,
       ar.created_at,
       ar.updated_at
     FROM action_results ar
     INNER JOIN actions a ON a.id = ar.action_id AND a.workspace_id = ar.workspace_id
     WHERE ar.workspace_id = $1
       AND ar.action_id = $2
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = ar.workspace_id
           AND wm.user_id = $3
           AND COALESCE(wm.status, 'active') = 'active'
       )
     ORDER BY ar.created_at DESC, ar.id DESC
     LIMIT $4;`,
    [params.workspaceId, params.actionId, params.userId, limit]
  );

  return result.rows;
}


export async function approveWorkspaceActionForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
  approvableStatuses: ActionStatus[];
}): Promise<ApproveWorkspaceActionRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ApproveWorkspaceActionRow>(
    `WITH target AS (
       SELECT a.*
       FROM actions a
       WHERE a.workspace_id = $1
         AND a.id = $2
         AND EXISTS (
           SELECT 1
           FROM workspace_members wm
           WHERE wm.workspace_id = a.workspace_id
             AND wm.user_id = $3
             AND COALESCE(wm.status, 'active') = 'active'
         )
       FOR UPDATE
     ), updated AS (
       UPDATE actions a
       SET
         status = 'approved',
         approved_at = COALESCE(a.approved_at, NOW()),
         updated_at = NOW()
       FROM target
       WHERE a.id = target.id
         AND target.status = ANY($4::text[])
       RETURNING
         a.id,
         a.workspace_id,
         a.created_by_user_id,
         a.action_type,
         a.title,
         a.description,
         a.status,
         a.risk_level,
         a.approval_required,
         a.policy_decision,
         a.idempotency_key,
         a.action_hash,
         a.created_at,
         a.updated_at,
         a.approved_at,
         a.executed_at,
         target.status AS previous_status
     )
     SELECT * FROM updated;`,
    [params.workspaceId, params.actionId, params.userId, params.approvableStatuses]
  );

  return result.rows[0] ?? null;
}


export async function rejectWorkspaceActionForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
  rejectableStatuses: ActionStatus[];
}): Promise<RejectWorkspaceActionRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<RejectWorkspaceActionRow>(
    `WITH target AS (
       SELECT a.*
       FROM actions a
       WHERE a.workspace_id = $1
         AND a.id = $2
         AND EXISTS (
           SELECT 1
           FROM workspace_members wm
           WHERE wm.workspace_id = a.workspace_id
             AND wm.user_id = $3
             AND COALESCE(wm.status, 'active') = 'active'
         )
       FOR UPDATE
     ), updated AS (
       UPDATE actions a
       SET
         status = 'rejected',
         updated_at = NOW()
       FROM target
       WHERE a.id = target.id
         AND target.status = ANY($4::text[])
       RETURNING
         a.id,
         a.workspace_id,
         a.created_by_user_id,
         a.action_type,
         a.title,
         a.description,
         a.status,
         a.risk_level,
         a.approval_required,
         a.policy_decision,
         a.idempotency_key,
         a.action_hash,
         a.created_at,
         a.updated_at,
         a.approved_at,
         a.executed_at,
         target.status AS previous_status
     )
     SELECT * FROM updated;`,
    [params.workspaceId, params.actionId, params.userId, params.rejectableStatuses]
  );

  return result.rows[0] ?? null;
}

export async function cancelWorkspaceActionForUser(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
  cancellableStatuses: ActionStatus[];
}): Promise<CancelWorkspaceActionRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<CancelWorkspaceActionRow>(
    `WITH target AS (
       SELECT a.*
       FROM actions a
       WHERE a.workspace_id = $1
         AND a.id = $2
         AND EXISTS (
           SELECT 1
           FROM workspace_members wm
           WHERE wm.workspace_id = a.workspace_id
             AND wm.user_id = $3
             AND COALESCE(wm.status, 'active') = 'active'
         )
       FOR UPDATE
     ), updated AS (
       UPDATE actions a
       SET
         status = 'cancelled',
         updated_at = NOW()
       FROM target
       WHERE a.id = target.id
         AND target.status = ANY($4::text[])
       RETURNING
         a.id,
         a.workspace_id,
         a.created_by_user_id,
         a.action_type,
         a.title,
         a.description,
         a.status,
         a.risk_level,
         a.approval_required,
         a.policy_decision,
         a.idempotency_key,
         a.action_hash,
         a.created_at,
         a.updated_at,
         a.approved_at,
         a.executed_at,
         target.status AS previous_status
     )
     SELECT * FROM updated;`,
    [params.workspaceId, params.actionId, params.userId, params.cancellableStatuses]
  );

  return result.rows[0] ?? null;
}

export async function insertActionLifecycleEvent(params: {
  actionId: string;
  workspaceId: string;
  actorUserId: string | null;
  eventType: string;
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus | null;
  message: string;
  metadataJson?: Record<string, unknown>;
  preventDuplicateEventType?: boolean;
}): Promise<boolean> {
  if (!isDatabaseConfigured) return false;

  const duplicateGuardSql = params.preventDuplicateEventType
    ? `AND NOT EXISTS (
         SELECT 1
         FROM action_events
         WHERE action_id = $1
           AND event_type = $4
       )`
    : '';

  const result = await query(
    `INSERT INTO action_events (
       action_id,
       workspace_id,
       actor_user_id,
       event_type,
       from_status,
       to_status,
       message,
       metadata_json
     )
     SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb
     WHERE EXISTS (
       SELECT 1
       FROM actions a
       WHERE a.id = $1
         AND a.workspace_id = $2
     )
     ${duplicateGuardSql};`,
    [
      params.actionId,
      params.workspaceId,
      params.actorUserId,
      params.eventType,
      params.fromStatus,
      params.toStatus,
      params.message,
      JSON.stringify(params.metadataJson || {}),
    ]
  );

  return (result.rowCount || 0) > 0;
}

export async function listInternalAdminActionMonitorRows(params: {
  status?: ActionStatus;
  actionType?: ActionType;
  riskLevel?: ActionRiskLevel;
  limit?: number;
  offset?: number;
}): Promise<InternalAdminActionMonitorRow[]> {
  if (!isDatabaseConfigured) return [];

  const limit = clampLimit(params.limit, 50, 200);
  const offset = normalizeOffset(params.offset);
  const filters: WorkspaceActionListFilters = {
    status: params.status,
    actionType: params.actionType,
    riskLevel: params.riskLevel,
  };
  const filterSql = buildActionFilterSql(filters, 1);
  const limitParam = 1 + filterSql.params.length;
  const offsetParam = limitParam + 1;

  const result = await query<InternalAdminActionMonitorRow>(
    `SELECT
       a.id,
       a.workspace_id,
       w.name AS workspace_name,
       a.action_type,
       a.title,
       a.status,
       a.risk_level,
       a.approval_required,
       a.policy_decision,
       a.created_at,
       a.updated_at,
       latest_result.result_status AS latest_result_status
     FROM actions a
     LEFT JOIN workspaces w ON w.id = a.workspace_id
     LEFT JOIN LATERAL (
       SELECT ar.result_status
       FROM action_results ar
       WHERE ar.action_id = a.id
         AND ar.workspace_id = a.workspace_id
       ORDER BY ar.created_at DESC
       LIMIT 1
     ) latest_result ON TRUE
     WHERE 1 = 1
       ${filterSql.sql}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${limitParam}
     OFFSET $${offsetParam};`,
    [...filterSql.params, limit, offset]
  );

  return result.rows;
}
