import { query } from '../../db/pool.js';
import type { ConnectedAccountRow } from '../connected-accounts/connected-accounts.repository.js';

export async function updateTripleWhaleAfterSync(params: {
  workspaceId: string;
  status: string;
  lastError?: string | null;
  metadata: Record<string, unknown>;
}): Promise<ConnectedAccountRow | null> {
  const result = await query<ConnectedAccountRow>(
    `UPDATE connected_accounts
     SET status = $2,
         last_error = $3,
         metadata = metadata || $4::jsonb,
         updated_at = NOW()
     WHERE workspace_id = $1 AND provider IN ('triple_whale', 'triple_whale_attribution')
     RETURNING id, workspace_id, provider, encrypted_api_key, key_hint, status, last_connected_at, last_error, metadata, created_at, updated_at;`,
    [params.workspaceId, params.status, params.lastError || null, JSON.stringify(params.metadata)]
  );

  return result.rows[0] ?? null;
}

export async function recordTripleWhaleSyncEvent(params: {
  workspaceId: string;
  eventType: string;
  severity?: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [params.workspaceId, params.eventType, params.severity || 'info', params.message, JSON.stringify(params.metadata || {})]
  );
}

export type TripleWhaleSnapshotRow = {
  id: string;
  provider: string;
  date_range: string;
  raw_payload: Record<string, unknown>;
  normalized_metrics: Record<string, unknown>;
  created_at: Date;
};

export async function getLatestTripleWhaleRawSnapshot(workspaceId: string): Promise<TripleWhaleSnapshotRow | null> {
  const result = await query<TripleWhaleSnapshotRow>(
    `SELECT id, provider, date_range, raw_payload, normalized_metrics, created_at
     FROM metrics_snapshots
     WHERE workspace_id = $1 AND provider IN ('triple_whale', 'triple_whale_attribution')
     ORDER BY created_at DESC
     LIMIT 1;`,
    [workspaceId]
  );

  return result.rows[0] ?? null;
}

export async function getTripleWhaleRawSnapshots(workspaceId: string, limit = 15): Promise<TripleWhaleSnapshotRow[]> {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
  const result = await query<TripleWhaleSnapshotRow>(
    `SELECT id, provider, date_range, raw_payload, normalized_metrics, created_at
     FROM metrics_snapshots
     WHERE workspace_id = $1 AND provider IN ('triple_whale', 'triple_whale_attribution')
     ORDER BY created_at DESC
     LIMIT $2;`,
    [workspaceId, safeLimit]
  );

  return result.rows;
}
