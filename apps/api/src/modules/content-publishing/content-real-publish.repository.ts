import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';
import { CONTENT_PUBLISH_RESULT_LOGS_EXECUTOR_NAME, CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME, formatSafeContentPublishResultLog, type ContentPublishResultLogRow, type SafeContentPublishResultLog } from './content-publish-result-logs.js';

export type RealPublishActionTransitionRow = Pick<
  WorkspaceActionDetailRow,
  'id' | 'workspace_id' | 'created_by_user_id' | 'action_type' | 'title' | 'description' | 'status' | 'risk_level' | 'approval_required' | 'policy_decision' | 'policy_decision_snapshot_json' | 'policy_evaluated_at' | 'idempotency_key' | 'action_hash' | 'payload_json' | 'created_at' | 'updated_at' | 'approved_at' | 'executed_at'
> & {
  previous_status: ActionStatus;
};

export type RealPublishApprovedEventRow = {
  id: string;
  actor_user_id: string | null;
  created_at: Date;
};

export type RealPublishActionResultInsert = {
  actionId: string;
  workspaceId: string;
  executorName: string;
  externalId: string | null;
  externalUrl: string | null;
  resultStatus: 'success' | 'failed' | 'blocked' | 'skipped' | 'rollback_success' | 'rollback_failed';
  resultSummary: string;
  errorMessage?: string | null;
  rollbackSupported: boolean;
  rollbackPayload?: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
};

export async function findLatestManualApprovalEvent(params: {
  actionId: string;
  workspaceId: string;
}): Promise<RealPublishApprovedEventRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<RealPublishApprovedEventRow>(
    `SELECT id, actor_user_id, created_at
     FROM action_events
     WHERE action_id = $1
       AND workspace_id = $2
       AND event_type = 'approved'
       AND actor_user_id IS NOT NULL
     ORDER BY created_at DESC, id DESC
     LIMIT 1;`,
    [params.actionId, params.workspaceId]
  );

  return result.rows[0] ?? null;
}

export async function transitionContentPublishActionStatus(params: {
  actionId: string;
  workspaceId: string;
  fromStatuses: ActionStatus[];
  toStatus: Extract<ActionStatus, 'executing' | 'executed' | 'failed' | 'rollback_requested' | 'rolled_back'>;
}): Promise<RealPublishActionTransitionRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<RealPublishActionTransitionRow>(
    `WITH target AS (
       SELECT a.*
       FROM actions a
       WHERE a.id = $1
         AND a.workspace_id = $2
         AND a.action_type = 'content_publish'
       FOR UPDATE
     ), updated AS (
       UPDATE actions a
       SET status = $3,
           executed_at = CASE WHEN $3 = 'executed' THEN COALESCE(a.executed_at, NOW()) ELSE a.executed_at END,
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
         a.policy_decision_snapshot_json,
         a.policy_evaluated_at,
         a.idempotency_key,
         a.action_hash,
         a.payload_json,
         a.created_at,
         a.updated_at,
         a.approved_at,
         a.executed_at,
         target.status AS previous_status
     )
     SELECT * FROM updated;`,
    [params.actionId, params.workspaceId, params.toStatus, params.fromStatuses]
  );

  return result.rows[0] ?? null;
}

export async function insertRealPublishActionResult(params: RealPublishActionResultInsert): Promise<boolean> {
  if (!isDatabaseConfigured) return false;

  const result = await query(
    `INSERT INTO action_results (
       action_id,
       workspace_id,
       executor_name,
       external_id,
       external_url,
       result_status,
       result_summary,
       error_message,
       rollback_supported,
       rollback_payload,
       metadata_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb);`,
    [
      params.actionId,
      params.workspaceId,
      params.executorName,
      params.externalId,
      params.externalUrl,
      params.resultStatus,
      params.resultSummary,
      params.errorMessage || null,
      params.rollbackSupported,
      JSON.stringify(params.rollbackPayload || {}),
      JSON.stringify(params.metadataJson || {}),
    ]
  );

  return (result.rowCount || 0) > 0;
}


export async function listSafeContentPublishResultLogs(params: {
  actionId: string;
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<SafeContentPublishResultLog[]> {
  if (!isDatabaseConfigured) return [];
  const limit = Math.min(Math.max(Number(params.limit || 20), 1), 50);

  const result = await query<ContentPublishResultLogRow>(
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
       ar.metadata_json,
       ar.created_at,
       ar.updated_at
     FROM action_results ar
     INNER JOIN actions a ON a.id = ar.action_id AND a.workspace_id = ar.workspace_id
     WHERE ar.workspace_id = $1
       AND ar.action_id = $2
       AND ar.executor_name = ANY($3::text[])
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = ar.workspace_id
           AND wm.user_id = $4
           AND COALESCE(wm.status, 'active') = 'active'
       )
     ORDER BY ar.created_at DESC, ar.id DESC
     LIMIT $5;`,
    [params.workspaceId, params.actionId, [CONTENT_PUBLISH_RESULT_LOGS_EXECUTOR_NAME, CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME], params.userId, limit]
  );

  return result.rows.map(formatSafeContentPublishResultLog);
}


export async function findLatestSuccessfulContentPublishResult(params: {
  actionId: string;
  workspaceId: string;
}): Promise<ContentPublishResultLogRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ContentPublishResultLogRow>(
    `SELECT
       id,
       action_id,
       workspace_id,
       executor_name,
       external_id,
       external_url,
       result_status,
       result_summary,
       error_message,
       metadata_json,
       created_at,
       updated_at
     FROM action_results
     WHERE workspace_id = $1
       AND action_id = $2
       AND executor_name = $3
       AND result_status = 'success'
     ORDER BY created_at DESC, id DESC
     LIMIT 1;`,
    [params.workspaceId, params.actionId, CONTENT_PUBLISH_RESULT_LOGS_EXECUTOR_NAME]
  );

  return result.rows[0] ?? null;
}
