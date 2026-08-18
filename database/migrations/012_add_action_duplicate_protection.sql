-- LIFE.SAVER v0.6.0
-- Phase 2.7 — Idempotency + Duplicate Protection
-- Non-destructive V2 foundation for preventing duplicate action creation and duplicate execution.
-- Safety: this migration adds duplicate-protection metadata only. It does not add approval APIs,
-- executors, external write connectors, auto-run behaviour, posting, sending, refunds, ad changes,
-- or any real-world business action.

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS action_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'actions_idempotency_key_not_blank_check'
  ) THEN
    ALTER TABLE actions
      ADD CONSTRAINT actions_idempotency_key_not_blank_check
      CHECK (idempotency_key IS NULL OR char_length(trim(idempotency_key)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'actions_action_hash_not_blank_check'
  ) THEN
    ALTER TABLE actions
      ADD CONSTRAINT actions_action_hash_not_blank_check
      CHECK (action_hash IS NULL OR char_length(trim(action_hash)) > 0);
  END IF;
END $$;

-- One idempotency key may create only one action inside a workspace.
-- This protects retries/timeouts from creating duplicate proposed actions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_workspace_idempotency_key_unique
  ON actions(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- One active action intent/hash may exist only once inside a workspace.
-- Service logic must build action_hash from action_type + normalized payload + target/schedule fields.
-- Rejected/cancelled/failed actions are excluded so a founder can intentionally create a corrected replacement later.
CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_workspace_action_hash_active_unique
  ON actions(workspace_id, action_hash)
  WHERE action_hash IS NOT NULL
    AND status IN (
      'proposed',
      'approval_required',
      'auto_approved',
      'approved',
      'queued',
      'executing',
      'executed',
      'rollback_requested',
      'rolled_back'
    );

CREATE INDEX IF NOT EXISTS idx_actions_workspace_action_hash_lookup
  ON actions(workspace_id, action_hash, created_at DESC)
  WHERE action_hash IS NOT NULL;

COMMENT ON COLUMN actions.idempotency_key IS
  'Caller-provided or service-generated key that makes action creation/retry safe inside one workspace. Never store secrets here.';

COMMENT ON COLUMN actions.action_hash IS
  'Stable hash of action_type + normalized safe payload + target/schedule fields. Used to detect duplicate active action intent before execution.';

COMMENT ON INDEX idx_actions_workspace_idempotency_key_unique IS
  'Prevents duplicate action rows when a client, worker, or AI tool retries the same request.';

COMMENT ON INDEX idx_actions_workspace_action_hash_active_unique IS
  'Prevents duplicate active action intent in a workspace. This is a safety rail for future executors and double-submit scenarios.';
