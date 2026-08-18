-- LIFE.SAVER v0.6.0
-- Phase 2.5 — Action Events Table Migration
-- Non-destructive V2 foundation for action lifecycle audit events.
-- Safety: this migration creates audit storage only. It does not add executors,
-- approval APIs, external write connectors, auto-run behaviour, posting, sending,
-- refunds, ad changes, or any real-world business action.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS action_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT action_events_event_type_check CHECK (
    event_type IN (
      'action_created',
      'policy_evaluated',
      'approved',
      'rejected',
      'cancelled',
      'queued',
      'execution_started',
      'execution_finished',
      'execution_failed',
      'rollback_requested',
      'rollback_started',
      'rollback_finished',
      'rollback_failed'
    )
  ),

  CONSTRAINT action_events_from_status_check CHECK (
    from_status IS NULL OR from_status IN (
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

  CONSTRAINT action_events_to_status_check CHECK (
    to_status IS NULL OR to_status IN (
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

  CONSTRAINT action_events_message_not_blank_check CHECK (
    message IS NULL OR char_length(trim(message)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_action_events_action_created
  ON action_events(action_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_action_events_workspace_created
  ON action_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_workspace_type_created
  ON action_events(workspace_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_actor_created
  ON action_events(actor_user_id, created_at DESC);

COMMENT ON TABLE action_events IS
  'V2 action lifecycle audit events. Logs proposed, policy, approval, execution, failure, and rollback events. This table does not execute actions.';

COMMENT ON COLUMN action_events.action_id IS
  'The action whose lifecycle changed. References actions.id from Phase 2.3.';

COMMENT ON COLUMN action_events.workspace_id IS
  'Duplicated workspace scope for fast, safe workspace-isolated audit queries. Must match the action workspace in service logic.';

COMMENT ON COLUMN action_events.actor_user_id IS
  'User responsible for the event when known. Null is allowed for system/worker/future policy events.';

COMMENT ON COLUMN action_events.metadata_json IS
  'Safe structured event metadata only. Must not store raw API keys, OAuth tokens, passwords, raw .env values, or unnecessary sensitive customer data.';
