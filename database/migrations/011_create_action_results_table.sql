-- LIFE.SAVER v0.6.0
-- Phase 2.6 — Action Results Table Migration
-- Non-destructive V2 foundation for future executor result storage.
-- Safety: this migration creates result/audit storage only. It does not add executors,
-- approval APIs, external write connectors, auto-run behaviour, posting, sending,
-- refunds, ad changes, or any real-world business action.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  executor_name TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,
  result_status TEXT NOT NULL DEFAULT 'pending',
  result_summary TEXT,
  error_message TEXT,
  rollback_supported BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT action_results_executor_name_not_blank_check CHECK (
    char_length(trim(executor_name)) > 0
  ),

  CONSTRAINT action_results_result_status_check CHECK (
    result_status IN (
      'pending',
      'success',
      'failed',
      'blocked',
      'skipped',
      'rollback_success',
      'rollback_failed'
    )
  ),

  CONSTRAINT action_results_external_url_format_check CHECK (
    external_url IS NULL OR external_url ~* '^https?://'
  ),

  CONSTRAINT action_results_result_summary_not_blank_check CHECK (
    result_summary IS NULL OR char_length(trim(result_summary)) > 0
  ),

  CONSTRAINT action_results_error_message_not_blank_check CHECK (
    error_message IS NULL OR char_length(trim(error_message)) > 0
  ),

  CONSTRAINT action_results_error_status_check CHECK (
    error_message IS NULL OR result_status IN ('failed', 'blocked', 'skipped', 'rollback_failed')
  ),

  CONSTRAINT action_results_rollback_payload_object_check CHECK (
    jsonb_typeof(rollback_payload) = 'object'
  ),

  CONSTRAINT action_results_metadata_json_object_check CHECK (
    jsonb_typeof(metadata_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_action_results_action_created
  ON action_results(action_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_results_workspace_created
  ON action_results(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_results_workspace_status_created
  ON action_results(workspace_id, result_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_results_executor_created
  ON action_results(executor_name, created_at DESC);

COMMENT ON TABLE action_results IS
  'V2 executor result records. Stores future executor outcomes and rollback details. This table does not execute actions.';

COMMENT ON COLUMN action_results.action_id IS
  'The action whose future executor result is being recorded. References actions.id from Phase 2.3.';

COMMENT ON COLUMN action_results.workspace_id IS
  'Workspace scope for safe workspace-isolated result queries. Service logic must keep this aligned with actions.workspace_id.';

COMMENT ON COLUMN action_results.executor_name IS
  'Name of the future executor or sandbox executor that produced this result. Example: sandbox_content_executor.';

COMMENT ON COLUMN action_results.external_id IS
  'External platform object ID when a future real executor creates or updates something. Null for sandbox, blocked, or failed results when not applicable.';

COMMENT ON COLUMN action_results.external_url IS
  'External platform URL/permalink when safe to show. Must not include signed URLs, private tokens, or secret query parameters.';

COMMENT ON COLUMN action_results.result_status IS
  'Executor outcome status. Pending/success/failed/blocked/skipped/rollback_success/rollback_failed.';

COMMENT ON COLUMN action_results.rollback_payload IS
  'Safe rollback instructions/details only. Must not store raw OAuth tokens, API keys, passwords, raw .env values, or unnecessary sensitive customer data.';

COMMENT ON COLUMN action_results.metadata_json IS
  'Safe structured result metadata only. Must not store raw API keys, OAuth tokens, passwords, raw .env values, or unnecessary sensitive customer data.';
