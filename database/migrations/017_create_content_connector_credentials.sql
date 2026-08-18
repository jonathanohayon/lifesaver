-- LIFE.SAVER v0.7.0 Phase 9.3
-- Content connector credential model.
-- Purpose: store future content-platform OAuth credentials securely, starting with LinkedIn.
-- Safety: additive migration only. No existing tables/columns are dropped or renamed.
-- Secret rule: raw access/refresh tokens must never be stored outside encrypted_* columns.

CREATE TABLE IF NOT EXISTS content_connector_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  connection_kind TEXT NOT NULL DEFAULT 'member',
  provider_account_id_hash TEXT,
  provider_account_hint TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_fingerprint TEXT,
  granted_scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'disconnected',
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  disconnected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, provider, connection_kind),
  CONSTRAINT content_connector_credentials_provider_check
    CHECK (provider IN ('linkedin')),
  CONSTRAINT content_connector_credentials_connection_kind_check
    CHECK (connection_kind IN ('member', 'organization')),
  CONSTRAINT content_connector_credentials_status_check
    CHECK (status IN ('connected', 'expired', 'disconnected', 'revoked', 'token_decrypt_failed', 'connection_error'))
);

CREATE INDEX IF NOT EXISTS idx_content_connector_credentials_workspace
  ON content_connector_credentials(workspace_id);

CREATE INDEX IF NOT EXISTS idx_content_connector_credentials_provider
  ON content_connector_credentials(provider);

CREATE INDEX IF NOT EXISTS idx_content_connector_credentials_status
  ON content_connector_credentials(status);

CREATE INDEX IF NOT EXISTS idx_content_connector_credentials_expiry
  ON content_connector_credentials(access_token_expires_at);

COMMENT ON TABLE content_connector_credentials IS
  'Encrypted OAuth credential records for future content publishing connectors. Phase 9.3 starts with LinkedIn credential storage only.';

COMMENT ON COLUMN content_connector_credentials.encrypted_access_token IS
  'AES-GCM encrypted OAuth access token. Never return this value to browser clients.';

COMMENT ON COLUMN content_connector_credentials.encrypted_refresh_token IS
  'AES-GCM encrypted OAuth refresh token when a refresh token is available. Never return this value to browser clients.';

COMMENT ON COLUMN content_connector_credentials.token_fingerprint IS
  'One-way SHA-256 fingerprint for server-side audit/debug only. Do not use as a browser-visible token hint.';

COMMENT ON COLUMN content_connector_credentials.provider_account_hint IS
  'Safe display hint such as LinkedIn member name/URN suffix. This is the only account hint intended for browser display.';
