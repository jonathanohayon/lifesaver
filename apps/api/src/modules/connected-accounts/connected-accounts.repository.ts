import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { ConnectedAccountStatus } from './connected-accounts.types.js';

export type ConnectedAccountRow = {
  id: string;
  workspace_id: string;
  provider: string;
  encrypted_api_key: string | null;
  key_hint: string | null;
  status: string;
  last_connected_at: Date | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export async function getConnectedAccount(workspaceId: string, provider: 'triple_whale'): Promise<ConnectedAccountRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ConnectedAccountRow>(
    `SELECT id, workspace_id, provider, encrypted_api_key, key_hint, status, last_connected_at, last_error, metadata, created_at, updated_at
     FROM connected_accounts
     WHERE workspace_id = $1 AND provider = $2
     LIMIT 1;`,
    [workspaceId, provider]
  );

  return result.rows[0] ?? null;
}

export async function upsertTripleWhaleApiKey(params: {
  workspaceId: string;
  encryptedApiKey: string;
  keyHint: string;
  metadata: Record<string, unknown>;
}): Promise<ConnectedAccountRow> {
  const result = await query<ConnectedAccountRow>(
    `INSERT INTO connected_accounts (
       workspace_id,
       provider,
       encrypted_api_key,
       key_hint,
       status,
       last_connected_at,
       last_error,
       metadata
     ) VALUES ($1, 'triple_whale', $2, $3, 'connected_unverified', NOW(), NULL, $4::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET
       encrypted_api_key = EXCLUDED.encrypted_api_key,
       key_hint = EXCLUDED.key_hint,
       status = 'connected_unverified',
       last_connected_at = NOW(),
       last_error = NULL,
       metadata = connected_accounts.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, workspace_id, provider, encrypted_api_key, key_hint, status, last_connected_at, last_error, metadata, created_at, updated_at;`,
    [params.workspaceId, params.encryptedApiKey, params.keyHint, JSON.stringify(params.metadata)]
  );

  return result.rows[0];
}

export async function disconnectTripleWhale(workspaceId: string): Promise<ConnectedAccountRow | null> {
  const result = await query<ConnectedAccountRow>(
    `UPDATE connected_accounts
     SET encrypted_api_key = NULL,
         key_hint = NULL,
         status = 'disconnected',
         last_error = NULL,
         metadata = metadata || $2::jsonb,
         updated_at = NOW()
     WHERE workspace_id = $1 AND provider = 'triple_whale'
     RETURNING id, workspace_id, provider, encrypted_api_key, key_hint, status, last_connected_at, last_error, metadata, created_at, updated_at;`,
    [workspaceId, JSON.stringify({ disconnectedAt: new Date().toISOString(), source: 'customer_workspace_settings_disconnect' })]
  );

  return result.rows[0] ?? null;
}

export async function recordConnectedAccountEvent(params: {
  workspaceId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, 'info', $3, $4::jsonb);`,
    [params.workspaceId, params.eventType, params.message, JSON.stringify(params.metadata || {})]
  );
}

export function toConnectedAccountStatus(row: ConnectedAccountRow | null): ConnectedAccountStatus {
  if (!row) {
    return {
      provider: 'triple_whale',
      status: 'not_created',
      connected: false,
      keyHint: null,
      lastConnectedAt: null,
      lastError: null,
      updatedAt: null,
      metadata: {},
    };
  }

  return {
    provider: 'triple_whale',
    status: row.status,
    connected: Boolean(row.encrypted_api_key && row.status !== 'disconnected'),
    keyHint: row.key_hint,
    lastConnectedAt: row.last_connected_at ? row.last_connected_at.toISOString() : null,
    lastError: row.last_error,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    metadata: row.metadata || {},
  };
}
