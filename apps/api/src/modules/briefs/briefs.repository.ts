import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { BriefRow, BriefType } from './briefs.types.js';

export async function getLatestBrief(type: BriefType, workspaceId?: string): Promise<BriefRow | null> {
  if (!isDatabaseConfigured) return null;

  const params: unknown[] = [type];
  let workspaceWhere = '';

  if (workspaceId) {
    params.push(workspaceId);
    workspaceWhere = 'AND workspace_id = $2';
  }

  const result = await query<BriefRow>(
    `SELECT id, workspace_id, type, source_snapshot_id, content, metadata, created_at
     FROM briefs
     WHERE type = $1 ${workspaceWhere}
     ORDER BY created_at DESC
     LIMIT 1;`,
    params
  );

  return result.rows[0] ?? null;
}

export async function insertBrief(params: {
  workspaceId: string;
  type: BriefType;
  sourceSnapshotId: string | null;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<BriefRow> {
  const result = await query<BriefRow>(
    `INSERT INTO briefs (workspace_id, type, source_snapshot_id, content, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, workspace_id, type, source_snapshot_id, content, metadata, created_at;`,
    [
      params.workspaceId,
      params.type,
      params.sourceSnapshotId,
      params.content,
      JSON.stringify(params.metadata || {}),
    ]
  );

  return result.rows[0];
}

export async function recordBriefEvent(params: {
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
    [
      params.workspaceId,
      params.eventType,
      params.severity || 'info',
      params.message,
      JSON.stringify(params.metadata || {}),
    ]
  );
}
