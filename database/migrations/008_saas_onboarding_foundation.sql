-- LIFE.SAVER v0.5.0
-- SaaS onboarding foundation. Non-destructive additions only.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'needs_connection',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_status ON workspace_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workspaces_onboarding_status ON workspaces(onboarding_status);
