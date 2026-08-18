import { isDatabaseConfigured, query } from '../../db/pool.js';
import type {
  ContentConnectorCredentialRow,
  ContentConnectorKind,
  ContentConnectorProvider,
} from './content-connector-credentials.types.js';

export async function getContentConnectorCredential(params: {
  workspaceId: string;
  provider: ContentConnectorProvider;
  connectionKind?: ContentConnectorKind;
}): Promise<ContentConnectorCredentialRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ContentConnectorCredentialRow>(
    `SELECT
       id,
       workspace_id,
       provider,
       connection_kind,
       provider_account_id_hash,
       provider_account_hint,
       encrypted_access_token,
       encrypted_refresh_token,
       token_fingerprint,
       granted_scopes_json,
       access_token_expires_at,
       refresh_token_expires_at,
       status,
       connected_by_user_id,
       disconnected_by_user_id,
       last_connected_at,
       disconnected_at,
       last_error,
       metadata,
       created_at,
       updated_at
     FROM content_connector_credentials
     WHERE workspace_id = $1
       AND provider = $2
       AND connection_kind = $3
     LIMIT 1;`,
    [params.workspaceId, params.provider, params.connectionKind || 'member']
  );

  return result.rows[0] ?? null;
}

export async function upsertLinkedInCredential(params: {
  workspaceId: string;
  userId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenFingerprint: string;
  grantedScopes: string[];
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  providerAccountIdHash: string | null;
  providerAccountHint: string | null;
  metadata: Record<string, unknown>;
}): Promise<ContentConnectorCredentialRow> {
  const result = await query<ContentConnectorCredentialRow>(
    `INSERT INTO content_connector_credentials (
       workspace_id,
       provider,
       connection_kind,
       provider_account_id_hash,
       provider_account_hint,
       encrypted_access_token,
       encrypted_refresh_token,
       token_fingerprint,
       granted_scopes_json,
       access_token_expires_at,
       refresh_token_expires_at,
       status,
       connected_by_user_id,
       disconnected_by_user_id,
       last_connected_at,
       disconnected_at,
       last_error,
       metadata
     ) VALUES (
       $1,
       'linkedin',
       'member',
       $2,
       $3,
       $4,
       $5,
       $6,
       $7::jsonb,
       $8,
       $9,
       'connected',
       $10,
       NULL,
       NOW(),
       NULL,
       NULL,
       $11::jsonb
     )
     ON CONFLICT (workspace_id, provider, connection_kind)
     DO UPDATE SET
       provider_account_id_hash = EXCLUDED.provider_account_id_hash,
       provider_account_hint = EXCLUDED.provider_account_hint,
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
       token_fingerprint = EXCLUDED.token_fingerprint,
       granted_scopes_json = EXCLUDED.granted_scopes_json,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       status = 'connected',
       connected_by_user_id = EXCLUDED.connected_by_user_id,
       disconnected_by_user_id = NULL,
       last_connected_at = NOW(),
       disconnected_at = NULL,
       last_error = NULL,
       metadata = content_connector_credentials.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING
       id,
       workspace_id,
       provider,
       connection_kind,
       provider_account_id_hash,
       provider_account_hint,
       encrypted_access_token,
       encrypted_refresh_token,
       token_fingerprint,
       granted_scopes_json,
       access_token_expires_at,
       refresh_token_expires_at,
       status,
       connected_by_user_id,
       disconnected_by_user_id,
       last_connected_at,
       disconnected_at,
       last_error,
       metadata,
       created_at,
       updated_at;`,
    [
      params.workspaceId,
      params.providerAccountIdHash,
      params.providerAccountHint,
      params.encryptedAccessToken,
      params.encryptedRefreshToken,
      params.tokenFingerprint,
      JSON.stringify(params.grantedScopes),
      params.accessTokenExpiresAt,
      params.refreshTokenExpiresAt,
      params.userId,
      JSON.stringify(params.metadata),
    ]
  );

  return result.rows[0];
}

export async function disconnectLinkedInCredential(params: {
  workspaceId: string;
  userId: string;
}): Promise<ContentConnectorCredentialRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<ContentConnectorCredentialRow>(
    `UPDATE content_connector_credentials
     SET encrypted_access_token = NULL,
         encrypted_refresh_token = NULL,
         token_fingerprint = NULL,
         status = 'disconnected',
         disconnected_by_user_id = $2,
         disconnected_at = NOW(),
         last_error = NULL,
         metadata = metadata || $3::jsonb,
         updated_at = NOW()
     WHERE workspace_id = $1
       AND provider = 'linkedin'
       AND connection_kind = 'member'
     RETURNING
       id,
       workspace_id,
       provider,
       connection_kind,
       provider_account_id_hash,
       provider_account_hint,
       encrypted_access_token,
       encrypted_refresh_token,
       token_fingerprint,
       granted_scopes_json,
       access_token_expires_at,
       refresh_token_expires_at,
       status,
       connected_by_user_id,
       disconnected_by_user_id,
       last_connected_at,
       disconnected_at,
       last_error,
       metadata,
       created_at,
       updated_at;`,
    [
      params.workspaceId,
      params.userId,
      JSON.stringify({
        disconnectedAt: new Date().toISOString(),
        source: 'content_connector_manual_disconnect',
        phase: 'v0.7.0_phase_9_3',
      }),
    ]
  );

  return result.rows[0] ?? null;
}

export async function recordContentConnectorEvent(params: {
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
