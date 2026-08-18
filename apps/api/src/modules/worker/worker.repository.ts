import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';

export type WorkerTarget = {
  workspaceId: string;
  userId: string;
  workspaceName: string | null;
  userEmail: string | null;
};

export async function resolveWorkerTarget(): Promise<WorkerTarget> {
  if (env.WORKER_WORKSPACE_ID && env.WORKER_USER_ID) {
    return {
      workspaceId: env.WORKER_WORKSPACE_ID,
      userId: env.WORKER_USER_ID,
      workspaceName: null,
      userEmail: null,
    };
  }

  const result = await query<WorkerTarget>(
    `SELECT
       w.id AS "workspaceId",
       u.id AS "userId",
       w.name AS "workspaceName",
       u.email AS "userEmail"
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     JOIN users u ON u.id = wm.user_id
     WHERE w.status = 'active'
       AND u.status = 'active'
     ORDER BY
       CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END,
       wm.created_at ASC
     LIMIT 1;`
  );

  if (!result.rows[0]) {
    throw new Error('No active workspace/user membership found for worker automation. Run db:seed or set WORKER_WORKSPACE_ID and WORKER_USER_ID.');
  }

  return result.rows[0];
}

export async function recordWorkerEvent(params: {
  workspaceId: string | null;
  eventType: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [
      params.workspaceId,
      params.eventType,
      params.severity || 'info',
      params.message,
      JSON.stringify(params.metadata || {}),
    ]
  );
}
