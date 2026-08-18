-- LIFE.SAVER v0.6.0
-- Phase 2.3 — Actions Table Migration
-- Non-destructive V2 foundation for proposed/approved/executed action records.
-- Safety: this migration creates storage only. It does not add executors, queues,
-- external write connectors, auto-run behaviour, posting, sending, refunds, or ad changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed',
  risk_level TEXT NOT NULL DEFAULT 'low',
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  policy_decision TEXT NOT NULL DEFAULT 'not_evaluated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  CONSTRAINT actions_action_type_check CHECK (
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

  CONSTRAINT actions_status_check CHECK (
    status IN (
      'proposed',
      'approval_required',
      'auto_approved',
      'approved',
      'rejected',
      'cancelled',
      'queued',
      'executing',
      'executed',
      'failed',
      'rollback_requested',
      'rolled_back'
    )
  ),

  CONSTRAINT actions_risk_level_check CHECK (
    risk_level IN ('low', 'medium', 'high', 'critical')
  ),

  CONSTRAINT actions_policy_decision_check CHECK (
    policy_decision IN ('not_evaluated', 'ask', 'auto_approve', 'block')
  ),

  CONSTRAINT actions_title_not_blank_check CHECK (char_length(trim(title)) > 0),

  CONSTRAINT actions_approved_at_status_check CHECK (
    approved_at IS NULL OR status IN (
      'auto_approved',
      'approved',
      'queued',
      'executing',
      'executed',
      'failed',
      'rollback_requested',
      'rolled_back'
    )
  ),

  CONSTRAINT actions_executed_at_status_check CHECK (
    executed_at IS NULL OR status IN (
      'executed',
      'rollback_requested',
      'rolled_back'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_actions_workspace_created
  ON actions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_actions_workspace_status_created
  ON actions(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_actions_workspace_type_status
  ON actions(workspace_id, action_type, status);

CREATE INDEX IF NOT EXISTS idx_actions_created_by_user_created
  ON actions(created_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_actions_approval_queue
  ON actions(workspace_id, created_at DESC)
  WHERE status IN ('proposed', 'approval_required', 'auto_approved', 'approved');

COMMENT ON TABLE actions IS
  'V2 action records. Stores proposed/approved/executed action intent only; no executor or external write is enabled by this table.';

COMMENT ON COLUMN actions.payload_json IS
  'Structured action payload. Must not store raw secrets, full API keys, auth tokens, or unnecessary sensitive customer data.';

COMMENT ON COLUMN actions.policy_decision IS
  'Policy decision snapshot: not_evaluated, ask, auto_approve, or block. Full policy records arrive in later policy phases.';
