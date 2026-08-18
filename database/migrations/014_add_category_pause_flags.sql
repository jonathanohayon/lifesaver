-- LIFE.SAVER v0.6.0
-- Phase 5.3 — Category Pause States
-- Non-destructive V2 foundation for category-level autonomy controls.
-- Safety: this migration only adds storage for research/dev pause flags and supporting indexes/comments.
-- It does not add pause/resume APIs, policy auto-approval, executors, queueing, posting, sending,
-- ad changes, campaign pause, refunds, rollback execution, or external writes.

ALTER TABLE autonomy_settings
  ADD COLUMN IF NOT EXISTS pause_research_actions BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pause_dev_actions BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_autonomy_settings_research_dev_pause
  ON autonomy_settings(workspace_id)
  WHERE pause_research_actions = TRUE
     OR pause_dev_actions = TRUE;

CREATE INDEX IF NOT EXISTS idx_autonomy_settings_any_category_pause_v053
  ON autonomy_settings(workspace_id)
  WHERE pause_content_actions = TRUE
     OR pause_support_actions = TRUE
     OR pause_ads_actions = TRUE
     OR pause_research_actions = TRUE
     OR pause_dev_actions = TRUE;

COMMENT ON COLUMN autonomy_settings.pause_research_actions IS
  'When true, future research-task autonomy must be blocked for this workspace. Safe proposed research actions may still be created for manual review.';

COMMENT ON COLUMN autonomy_settings.pause_dev_actions IS
  'When true, future dev-task autonomy must be blocked for this workspace. Safe proposed dev actions may still be created for manual review.';

COMMENT ON TABLE autonomy_settings IS
  'V2 Master Pause foundation. Stores workspace-level and category-level autonomy pause controls only; this table does not execute, queue, auto-approve, publish, send, or change external systems.';
