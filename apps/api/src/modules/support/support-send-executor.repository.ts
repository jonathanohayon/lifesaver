import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';

export type SupportSendActionTransitionRow = Pick<
  WorkspaceActionDetailRow,
  'id' | 'workspace_id' | 'created_by_user_id' | 'action_type' | 'title' | 'description' | 'status' | 'risk_level' | 'approval_required' | 'policy_decision' | 'policy_decision_snapshot_json' | 'policy_evaluated_at' | 'idempotency_key' | 'action_hash' | 'payload_json' | 'created_at' | 'updated_at' | 'approved_at' | 'executed_at'
> & {
  previous_status: ActionStatus;
};

export type SupportSendApprovedEventRow = {
  id: string;
  actor_user_id: string | null;
  created_at: Date;
};

export async function findLatestSupportReplyApprovalEvent(params: {
  actionId: string;
  workspaceId: string;
}): Promise<SupportSendApprovedEventRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<SupportSendApprovedEventRow>(
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

export async function transitionSupportReplyActionStatus(params: {
  actionId: string;
  workspaceId: string;
  fromStatuses: ActionStatus[];
  toStatus: Extract<ActionStatus, 'executing' | 'executed' | 'failed'>;
}): Promise<SupportSendActionTransitionRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<SupportSendActionTransitionRow>(
    `WITH target AS (
       SELECT a.*
       FROM actions a
       WHERE a.id = $1
         AND a.workspace_id = $2
         AND a.action_type = 'support_reply_send'
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

export async function insertSupportSendActionResult(params: {
  actionId: string;
  workspaceId: string;
  executorName: string;
  externalId: string | null;
  externalUrl: string | null;
  resultStatus: 'success' | 'failed' | 'blocked';
  resultSummary: string;
  errorMessage?: string | null;
  metadataJson?: Record<string, unknown>;
}): Promise<boolean> {
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
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, '{}'::jsonb, $9::jsonb);`,
    [
      params.actionId,
      params.workspaceId,
      params.executorName,
      params.externalId,
      params.externalUrl,
      params.resultStatus,
      params.resultSummary,
      params.errorMessage || null,
      JSON.stringify(params.metadataJson || {}),
    ]
  );

  return (result.rowCount || 0) > 0;
}
