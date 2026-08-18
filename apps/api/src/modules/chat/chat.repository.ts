import { isDatabaseConfigured, query } from '../../db/pool.js';

export type WorkspaceUserContext = {
  workspaceId: string;
  userId: string | null;
};

export async function getDefaultWorkspaceContext(): Promise<WorkspaceUserContext | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<{ workspace_id: string; user_id: string | null }>(`
    SELECT w.id AS workspace_id, w.owner_user_id AS user_id
    FROM workspaces w
    WHERE w.status = 'active'
    ORDER BY w.created_at ASC
    LIMIT 1;
  `);

  const row = result.rows[0];
  if (!row) return null;
  return { workspaceId: row.workspace_id, userId: row.user_id };
}

export async function insertChatMessage(params: {
  workspaceId: string;
  userId?: string | null;
  role: 'user' | 'assistant';
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO chat_history (workspace_id, user_id, role, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [params.workspaceId, params.userId || null, params.role, params.message, JSON.stringify(params.metadata || {})]
  );
}

export async function countClaudeChatCallsToday(workspaceId: string): Promise<number> {
  if (!isDatabaseConfigured) return 0;

  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM usage_logs
     WHERE workspace_id = $1
       AND event_type = 'claude_chat_completed'
       AND created_at >= date_trunc('day', now());`,
    [workspaceId]
  );

  return Number(result.rows[0]?.count || 0);
}

export async function insertUsageLog(params: {
  workspaceId: string;
  userId?: string | null;
  eventType: string;
  provider?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO usage_logs (
       workspace_id, user_id, event_type, provider, model, tokens_in, tokens_out, estimated_cost_usd, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb);`,
    [
      params.workspaceId,
      params.userId || null,
      params.eventType,
      params.provider || null,
      params.model || null,
      params.tokensIn || 0,
      params.tokensOut || 0,
      params.estimatedCostUsd || 0,
      JSON.stringify(params.metadata || {}),
    ]
  );
}

export async function insertSystemEvent(params: {
  workspaceId?: string | null;
  eventType: string;
  severity?: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [params.workspaceId || null, params.eventType, params.severity || 'info', params.message, JSON.stringify(params.metadata || {})]
  );
}
