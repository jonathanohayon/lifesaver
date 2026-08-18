import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { DraftRow } from './drafts.types.js';

export async function insertDraft(params: {
  workspaceId: string;
  userId: string | null;
  draftType: string;
  prompt: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<DraftRow> {
  const result = await query<DraftRow>(
    `INSERT INTO drafts (workspace_id, user_id, draft_type, prompt, content, status, metadata)
     VALUES ($1, $2, $3, $4, $5, 'draft', $6::jsonb)
     RETURNING id, workspace_id, user_id, draft_type, prompt, content, status, metadata, created_at, updated_at;`,
    [
      params.workspaceId,
      params.userId,
      params.draftType,
      params.prompt,
      params.content,
      JSON.stringify(params.metadata || {}),
    ]
  );
  return result.rows[0];
}

export async function listDrafts(workspaceId: string, limit = 20): Promise<DraftRow[]> {
  if (!isDatabaseConfigured) return [];
  const result = await query<DraftRow>(
    `SELECT id, workspace_id, user_id, draft_type, prompt, content, status, metadata, created_at, updated_at
     FROM drafts
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, limit]
  );
  return result.rows;
}

export async function updateDraftStatus(params: {
  workspaceId: string;
  draftId: string;
  status: 'draft' | 'approved' | 'rejected';
}): Promise<DraftRow | null> {
  const result = await query<DraftRow>(
    `UPDATE drafts
     SET status = $3, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id, workspace_id, user_id, draft_type, prompt, content, status, metadata, created_at, updated_at;`,
    [params.draftId, params.workspaceId, params.status]
  );
  return result.rows[0] ?? null;
}

export async function countDraftsToday(workspaceId: string): Promise<number> {
  if (!isDatabaseConfigured) return 0;
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM drafts
     WHERE workspace_id = $1 AND created_at >= date_trunc('day', NOW());`,
    [workspaceId]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function recordDraftEvent(params: {
  workspaceId: string;
  eventType: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;
  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [params.workspaceId, params.eventType, params.severity || 'info', params.message, JSON.stringify(params.metadata || {})]
  );
}
