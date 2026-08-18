import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { MetricsSnapshotRow, NormalizedMetrics } from './metrics.types.js';

export async function getLatestMetricsSnapshot(workspaceId?: string): Promise<MetricsSnapshotRow | null> {
  if (!isDatabaseConfigured) return null;

  const params: unknown[] = [];
  let where = '';

  if (workspaceId) {
    params.push(workspaceId);
    where = 'WHERE workspace_id = $1';
  }

  const result = await query<MetricsSnapshotRow>(
    `SELECT id, workspace_id, provider, date_range, raw_payload, normalized_metrics, source_started_at, source_ended_at, created_at
     FROM metrics_snapshots
     ${where}
     ORDER BY
       CASE
         WHEN normalized_metrics->>'coreMetricsProductionReady' = 'true' THEN 0
         WHEN normalized_metrics->>'sourceStatus' LIKE 'live_summary%' THEN 1
         WHEN normalized_metrics->>'sourceStatus' LIKE 'attribution_probe%' THEN 3
         ELSE 2
       END ASC,
       created_at DESC
     LIMIT 1;`,
    params
  );

  return result.rows[0] ?? null;
}

export async function insertMetricsSnapshot(params: {
  workspaceId: string;
  provider: string;
  dateRange: string;
  rawPayload: Record<string, unknown>;
  normalizedMetrics: NormalizedMetrics;
  sourceStartedAt?: Date | null;
  sourceEndedAt?: Date | null;
}): Promise<MetricsSnapshotRow> {
  const result = await query<MetricsSnapshotRow>(
    `INSERT INTO metrics_snapshots (
       workspace_id,
       provider,
       date_range,
       raw_payload,
       normalized_metrics,
       source_started_at,
       source_ended_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
     RETURNING id, workspace_id, provider, date_range, raw_payload, normalized_metrics, source_started_at, source_ended_at, created_at;`,
    [
      params.workspaceId,
      params.provider,
      params.dateRange,
      JSON.stringify(params.rawPayload),
      JSON.stringify(params.normalizedMetrics),
      params.sourceStartedAt || null,
      params.sourceEndedAt || null,
    ]
  );

  return result.rows[0];
}
