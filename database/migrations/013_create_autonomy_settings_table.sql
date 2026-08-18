-- LIFE.SAVER v0.6.0
-- Phase 5.1 — Autonomy Settings Table
-- Non-destructive V2 foundation for the Master Pause Switch.
-- Safety: this migration creates autonomy-control storage only. It does not add
-- pause/resume APIs, policy auto-approval, executors, queueing, posting, sending,
-- ad changes, campaign pause, refunds, rollback execution, or external writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS autonomy_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  pause_all_autonomy BOOLEAN NOT NULL DEFAULT FALSE,
  pause_content_actions BOOLEAN NOT NULL DEFAULT FALSE,
  pause_support_actions BOOLEAN NOT NULL DEFAULT FALSE,
  pause_ads_actions BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT autonomy_settings_not_null_workspace_check CHECK (workspace_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_autonomy_settings_updated_by
  ON autonomy_settings(updated_by, updated_at DESC)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_autonomy_settings_any_pause
  ON autonomy_settings(workspace_id)
  WHERE pause_all_autonomy = TRUE
     OR pause_content_actions = TRUE
     OR pause_support_actions = TRUE
     OR pause_ads_actions = TRUE;

COMMENT ON TABLE autonomy_settings IS
  'V2 Master Pause foundation. Stores workspace-level autonomy pause controls only; this table does not execute, queue, auto-approve, publish, send, or change external systems.';

COMMENT ON COLUMN autonomy_settings.workspace_id IS
  'One autonomy settings row per workspace. Workspace scoping is required before any future policy/executor work.';

COMMENT ON COLUMN autonomy_settings.pause_all_autonomy IS
  'When true, future policy/executor layers must block all autonomous execution for this workspace. Phase 5.1 stores the flag only.';

COMMENT ON COLUMN autonomy_settings.pause_content_actions IS
  'When true, future content autonomy must be blocked for this workspace. Manual review of proposed actions may still remain available.';

COMMENT ON COLUMN autonomy_settings.pause_support_actions IS
  'When true, future support-send autonomy must be blocked for this workspace. Manual review of proposed actions may still remain available.';

COMMENT ON COLUMN autonomy_settings.pause_ads_actions IS
  'When true, future ad-control autonomy must be blocked for this workspace. Manual review of proposed actions may still remain available.';

COMMENT ON COLUMN autonomy_settings.updated_by IS
  'User who last changed autonomy pause settings when known. Null is allowed for migrations/system initialization.';

COMMENT ON COLUMN autonomy_settings.updated_at IS
  'Timestamp for the most recent autonomy settings update. Future APIs should update this value on every pause/resume change.';
