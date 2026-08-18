-- LIFE.SAVER v0.7.0
-- Phase 14.7 — Before/After Snapshot
-- Purpose: additive storage for ads before/after audit snapshots before any real ads mutation can be attempted.
-- Safety: this migration creates audit storage only. It does not add an ads executor provider client,
-- OAuth route, token storage, write scope request, campaign pause, ad set pause, budget mutation,
-- budget restore, campaign re-enable, ads auto-run, or external ad API call.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ads_action_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  action_result_id UUID REFERENCES action_results(id) ON DELETE SET NULL,
  snapshot_kind TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  campaign_id TEXT,
  adset_id TEXT,
  current_budget NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  campaign_status TEXT NOT NULL,
  adset_status TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL,
  platform_data_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ads_action_snapshots_kind_check CHECK (
    snapshot_kind IN ('before_execution', 'after_execution', 'rollback_before', 'rollback_after')
  ),

  CONSTRAINT ads_action_snapshots_platform_check CHECK (
    platform IN ('meta_marketing_api', 'google_ads_api')
  ),

  CONSTRAINT ads_action_snapshots_currency_check CHECK (
    currency ~ '^[A-Z]{3}$'
  ),

  CONSTRAINT ads_action_snapshots_budget_non_negative_check CHECK (
    current_budget IS NULL OR current_budget >= 0
  ),

  CONSTRAINT ads_action_snapshots_summary_object_check CHECK (
    jsonb_typeof(platform_data_summary_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_ads_action_snapshots_workspace_action
  ON ads_action_snapshots(workspace_id, action_id, snapshot_kind, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_action_snapshots_action_result
  ON ads_action_snapshots(action_result_id, snapshot_at DESC)
  WHERE action_result_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ads_action_snapshots_platform_account
  ON ads_action_snapshots(workspace_id, platform, account_id, snapshot_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_action_snapshots_one_before_per_action
  ON ads_action_snapshots(action_id)
  WHERE snapshot_kind = 'before_execution';

COMMENT ON TABLE ads_action_snapshots IS
  'Phase 14.7 ads before/after audit snapshot storage. Future ads executors must store current budget, campaign status, adset status, timestamp, and safe platform summary before mutation. This table does not execute, pause campaigns, change budgets, restore budgets, call ad APIs, or enable ads auto-run.';

COMMENT ON COLUMN ads_action_snapshots.workspace_id IS
  'Workspace that owns this snapshot. Queries must remain workspace-scoped.';

COMMENT ON COLUMN ads_action_snapshots.action_id IS
  'Approved ads action associated with this snapshot.';

COMMENT ON COLUMN ads_action_snapshots.action_result_id IS
  'Optional action_results row associated with the future execution result.';

COMMENT ON COLUMN ads_action_snapshots.snapshot_kind IS
  'before_execution or after_execution for future provider mutation audit; rollback kinds are reserved for Phase 14.8 planning.';

COMMENT ON COLUMN ads_action_snapshots.platform_data_summary_json IS
  'Safe summarized provider state only. Must never contain raw OAuth tokens, raw provider payloads, request headers, raw HTTP responses, or secrets.';
