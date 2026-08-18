-- LIFE.SAVER v0.7.0
-- Phase 14.5 — Hard Caps Table
-- Purpose: additive storage for ads hard caps before any real ads executor exists.
-- Safety: this migration creates cap storage only. It does not add an ads executor,
-- OAuth route, token storage, write scope, campaign pause, ad set pause, budget mutation,
-- budget restore, campaign re-enable, ads auto-run, or external ad API calls.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ads_hard_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'global',
  account_id TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  max_daily_budget_change NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_percentage_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_changes_per_day INTEGER NOT NULL DEFAULT 0,
  always_ask_above_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
  emergency_never_exceed_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ads_hard_caps_platform_check CHECK (
    platform IN ('global', 'meta_marketing_api', 'google_ads_api')
  ),

  CONSTRAINT ads_hard_caps_currency_check CHECK (
    currency ~ '^[A-Z]{3}$'
  ),

  CONSTRAINT ads_hard_caps_non_negative_values_check CHECK (
    max_daily_budget_change >= 0
    AND max_percentage_change >= 0
    AND max_percentage_change <= 100
    AND max_changes_per_day >= 0
    AND always_ask_above_threshold >= 0
    AND emergency_never_exceed_limit >= 0
  ),

  CONSTRAINT ads_hard_caps_threshold_within_daily_cap_check CHECK (
    always_ask_above_threshold <= max_daily_budget_change
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_hard_caps_workspace_platform_account_unique
  ON ads_hard_caps(workspace_id, platform, COALESCE(account_id, '__global__'));

CREATE INDEX IF NOT EXISTS idx_ads_hard_caps_workspace_platform_enabled
  ON ads_hard_caps(workspace_id, platform, enabled, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_hard_caps_created_by
  ON ads_hard_caps(created_by, created_at DESC)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ads_hard_caps_updated_by
  ON ads_hard_caps(updated_by, updated_at DESC)
  WHERE updated_by IS NOT NULL;

COMMENT ON TABLE ads_hard_caps IS
  'Phase 14.5 ads hard caps storage. This table stores max daily budget change, max percentage change, max changes/day, always-ask threshold, and emergency never-exceed limit. It does not execute, pause campaigns, change budgets, restore budgets, call ad APIs, or enable ads auto-run.';

COMMENT ON COLUMN ads_hard_caps.workspace_id IS
  'Workspace that owns these ads hard caps. Normal users must only access caps scoped to their own workspace.';

COMMENT ON COLUMN ads_hard_caps.platform IS
  'global, meta_marketing_api, or google_ads_api. Triple Whale remains read-only and is intentionally not a control platform.';

COMMENT ON COLUMN ads_hard_caps.account_id IS
  'Optional safe ad account reference. Must never contain OAuth tokens, refresh tokens, client secrets, or raw provider payloads.';

COMMENT ON COLUMN ads_hard_caps.max_daily_budget_change IS
  'Maximum absolute budget-change amount allowed per day before a future executor must block the action.';

COMMENT ON COLUMN ads_hard_caps.max_percentage_change IS
  'Maximum absolute percentage change allowed for a single budget proposal before a future executor must block the action.';

COMMENT ON COLUMN ads_hard_caps.max_changes_per_day IS
  'Maximum number of ads budget/control changes allowed per day before a future executor must block the action.';

COMMENT ON COLUMN ads_hard_caps.always_ask_above_threshold IS
  'Budget-change amount above which ask/manual approval is always required. This must never be treated as auto-approval permission.';

COMMENT ON COLUMN ads_hard_caps.emergency_never_exceed_limit IS
  'Absolute proposed-budget ceiling that a future executor must never exceed, regardless of lower-priority policy decisions.';
