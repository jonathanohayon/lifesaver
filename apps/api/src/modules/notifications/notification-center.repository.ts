import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { NotificationCenterPendingActionRow, NotificationCenterRecentEventRow } from './notification-center.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function listPendingApprovalNotificationRows(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<NotificationCenterPendingActionRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 10, 25);
  const result = await query<NotificationCenterPendingActionRow>(
    `SELECT
       a.id,
       a.workspace_id,
       a.action_type,
       a.title,
       a.description,
       a.status,
       a.risk_level,
       a.approval_required,
       a.policy_decision,
       a.created_at,
       a.updated_at
     FROM actions a
     WHERE a.workspace_id = $1
       AND a.status IN ('proposed', 'approval_required')
       AND a.approval_required = TRUE
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = a.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
     ORDER BY
       CASE a.risk_level
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       a.created_at ASC,
       a.id ASC
     LIMIT $3;`,
    [params.workspaceId, params.userId, limit]
  );
  return result.rows;
}

export async function listRecentNotificationEventRows(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<NotificationCenterRecentEventRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 15, 50);
  const result = await query<NotificationCenterRecentEventRow>(
    `SELECT
       ae.id,
       ae.action_id,
       ae.workspace_id,
       a.action_type,
       a.title AS action_title,
       a.status AS action_status,
       a.risk_level,
       ae.event_type,
       ae.from_status,
       ae.to_status,
       ae.message,
       ae.actor_user_id,
       COALESCE(ae.metadata_json, '{}'::jsonb) AS metadata_json,
       ae.created_at
     FROM action_events ae
     INNER JOIN actions a ON a.id = ae.action_id AND a.workspace_id = ae.workspace_id
     WHERE ae.workspace_id = $1
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = ae.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
     ORDER BY ae.created_at DESC, ae.id DESC
     LIMIT $3;`,
    [params.workspaceId, params.userId, limit]
  );
  return result.rows;
}
