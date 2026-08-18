-- LIFE.SAVER v0.7.0 Phase 10.8
-- Notification delivery logs.
-- Purpose: store audit records for notification_created, notification_sent,
-- notification_failed, and notification_opened events.
-- Safety: additive migration only. It does not send email, call Slack, approve
-- actions, execute actions, publish content, or call any external service.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notification_key TEXT,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  recipient_hint TEXT,
  delivery_provider TEXT NOT NULL DEFAULT 'lifesaver_internal',
  message TEXT,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_delivery_logs_channel_check CHECK (
    channel IN ('in_app', 'email', 'slack')
  ),

  CONSTRAINT notification_delivery_logs_event_type_check CHECK (
    event_type IN (
      'notification_created',
      'notification_sent',
      'notification_failed',
      'notification_opened'
    )
  ),

  CONSTRAINT notification_delivery_logs_notification_key_not_blank_check CHECK (
    notification_key IS NULL OR char_length(trim(notification_key)) > 0
  ),

  CONSTRAINT notification_delivery_logs_delivery_provider_not_blank_check CHECK (
    char_length(trim(delivery_provider)) > 0
  ),

  CONSTRAINT notification_delivery_logs_message_not_blank_check CHECK (
    message IS NULL OR char_length(trim(message)) > 0
  ),

  CONSTRAINT notification_delivery_logs_error_status_check CHECK (
    error_message IS NULL OR event_type = 'notification_failed'
  ),

  CONSTRAINT notification_delivery_logs_metadata_object_check CHECK (
    jsonb_typeof(metadata_json) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_workspace_created
  ON notification_delivery_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_workspace_event_created
  ON notification_delivery_logs(workspace_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_workspace_channel_created
  ON notification_delivery_logs(workspace_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_action_created
  ON notification_delivery_logs(action_id, created_at DESC)
  WHERE action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_user_created
  ON notification_delivery_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_notification_key_created
  ON notification_delivery_logs(workspace_id, notification_key, created_at DESC)
  WHERE notification_key IS NOT NULL;

COMMENT ON TABLE notification_delivery_logs IS
  'Audit records for notification lifecycle events. Phase 10.8 logs notification_created/sent/failed/opened and does not deliver notifications or call external providers.';

COMMENT ON COLUMN notification_delivery_logs.notification_key IS
  'Optional safe grouping key for future notification rows/messages. Must never contain tokens, signed URLs, raw provider IDs with secrets, or private payloads.';

COMMENT ON COLUMN notification_delivery_logs.recipient_hint IS
  'Safe recipient hint only, such as masked email/domain. Never store full credentials, tokens, or secrets.';

COMMENT ON COLUMN notification_delivery_logs.metadata_json IS
  'Safe structured metadata only. Must not store raw OAuth tokens, API keys, passwords, raw action payload_json, rollback payloads, provider Authorization headers, or private provider responses.';
