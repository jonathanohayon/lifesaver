-- LIFE.SAVER v0.6.0
-- Phase 6.8 — Policy Decision Records
-- Additive migration for persisted policy decision snapshots on actions.
-- Safety: this migration stores audit/explanation data only. It does not add executors,
-- queues, external write connectors, auto-run behaviour, posting, sending, refunds, or ad changes.

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS policy_decision_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS policy_evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_actions_workspace_policy_evaluated
  ON actions(workspace_id, policy_evaluated_at DESC)
  WHERE policy_evaluated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actions_workspace_policy_decision
  ON actions(workspace_id, policy_decision, created_at DESC);

COMMENT ON COLUMN actions.policy_decision_snapshot_json IS
  'Phase 6.8 persisted policy decision snapshot. Stores safe evaluator explanation data such as decision, reason, matched policy, cap status, conflict summary, pause summary, and evaluation timestamp. Must not store raw secrets or unnecessary sensitive customer data.';

COMMENT ON COLUMN actions.policy_evaluated_at IS
  'Timestamp when the latest policy decision snapshot was recorded for this action.';
