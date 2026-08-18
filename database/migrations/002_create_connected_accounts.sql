-- Connected provider accounts such as Triple Whale.
-- Raw API keys are never stored here; only encrypted_api_key is allowed.

CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_api_key TEXT,
  key_hint TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_workspace ON connected_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider ON connected_accounts(provider);
