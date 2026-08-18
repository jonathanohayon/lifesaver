-- LIFE.SAVER v0.6.0
-- Phase 6.1 — Policy Table Schema
-- Non-destructive V2 foundation for the policy/rules decision engine.
-- Safety: this migration creates policy storage only. It does not add a policy evaluator,
-- auto-approval execution, executors, queueing, posting, sending, ad changes, campaign pause,
-- refunds, rollback execution, or external writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision TEXT NOT NULL DEFAULT 'ask',
  caps_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT policies_name_not_blank_check CHECK (char_length(trim(name)) > 0),

  CONSTRAINT policies_action_type_check CHECK (
    action_type IN (
      'content_publish',
      'support_reply_send',
      'ad_budget_adjust',
      'ad_pause',
      'research_task',
      'dev_task',
      'notification_send',
      'rollback_action'
    )
  ),

  CONSTRAINT policies_decision_check CHECK (
    decision IN ('ask', 'auto_approve', 'block')
  ),

  CONSTRAINT policies_priority_check CHECK (
    priority >= 0 AND priority <= 10000
  ),

  CONSTRAINT policies_conditions_json_object_check CHECK (
    jsonb_typeof(conditions_json) = 'object'
  ),

  CONSTRAINT policies_caps_json_object_check CHECK (
    jsonb_typeof(caps_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_policies_workspace_enabled_priority
  ON policies(workspace_id, enabled, priority ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policies_workspace_action_enabled_priority
  ON policies(workspace_id, action_type, enabled, priority ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policies_workspace_decision_enabled
  ON policies(workspace_id, decision, enabled, priority ASC);

CREATE INDEX IF NOT EXISTS idx_policies_created_by
  ON policies(created_by, created_at DESC)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policies_updated_by
  ON policies(updated_by, updated_at DESC)
  WHERE updated_by IS NOT NULL;

COMMENT ON TABLE policies IS
  'V2 policy/rules foundation. Stores ask/auto_approve/block policy definitions only; this table does not evaluate, auto-approve, queue, execute, publish, send, change ads, or write to external systems.';

COMMENT ON COLUMN policies.workspace_id IS
  'Workspace that owns this policy. Normal customers must only access policies scoped to their own workspace.';

COMMENT ON COLUMN policies.name IS
  'Human-readable rule name shown in future policy/rules UI. Must not contain secrets.';

COMMENT ON COLUMN policies.action_type IS
  'Action type this policy applies to. Must match the V2 action taxonomy.';

COMMENT ON COLUMN policies.conditions_json IS
  'JSON object describing policy conditions. Must not store API keys, OAuth tokens, passwords, raw customer secrets, or raw .env values.';

COMMENT ON COLUMN policies.decision IS
  'Policy decision: ask, auto_approve, or block. Future policy evaluation must still check master pause, emergency safe mode, caps, roles, audit logs, and executor pause guard before any execution.';

COMMENT ON COLUMN policies.caps_json IS
  'JSON object describing policy caps such as max posts/day, max replies/day, max budget change, or model-cost limits. Stored only; cap enforcement comes later.';

COMMENT ON COLUMN policies.priority IS
  'Lower number means higher priority for future policy evaluation. Conflict resolution is defined in later phases.';

COMMENT ON COLUMN policies.enabled IS
  'When false, the policy should be ignored by future policy evaluation.';

COMMENT ON COLUMN policies.created_by IS
  'User who created the policy when known.';

COMMENT ON COLUMN policies.updated_by IS
  'User who last updated the policy when known.';
