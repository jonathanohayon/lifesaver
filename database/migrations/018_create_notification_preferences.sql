-- LIFE.SAVER v0.7.0 Phase 10.1
-- Notification preferences model.
-- Purpose: store workspace-level notification preferences for action approval alerts.
-- Safety: additive migration only. No notifications are sent by this migration.
-- Phase 10.1 supports in-app and email preferences, with Slack reserved for a later phase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notification_preferences (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  quiet_hours_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  approval_escalation_minutes INTEGER NOT NULL DEFAULT 60,
  repeat_escalation_minutes INTEGER NOT NULL DEFAULT 120,
  max_escalations INTEGER NOT NULL DEFAULT 3,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_preferences_quiet_start_check
    CHECK (quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT notification_preferences_quiet_end_check
    CHECK (quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT notification_preferences_timezone_not_empty_check
    CHECK (LENGTH(TRIM(quiet_hours_timezone)) BETWEEN 3 AND 80),
  CONSTRAINT notification_preferences_approval_escalation_range_check
    CHECK (approval_escalation_minutes BETWEEN 5 AND 1440),
  CONSTRAINT notification_preferences_repeat_escalation_range_check
    CHECK (repeat_escalation_minutes BETWEEN 5 AND 1440),
  CONSTRAINT notification_preferences_max_escalations_range_check
    CHECK (max_escalations BETWEEN 0 AND 10),
  CONSTRAINT notification_preferences_slack_reserved_check
    CHECK (slack_enabled = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_by
  ON notification_preferences(updated_by, updated_at DESC)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_email_enabled
  ON notification_preferences(workspace_id)
  WHERE email_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_quiet_hours
  ON notification_preferences(workspace_id)
  WHERE quiet_hours_enabled = TRUE;

COMMENT ON TABLE notification_preferences IS
  'Workspace-level notification preferences for approval-required actions. Phase 10.1 stores settings only and does not send email, Slack, or in-app notifications.';

COMMENT ON COLUMN notification_preferences.in_app_enabled IS
  'Whether future in-app approval notifications should be created. Phase 10.1 stores the preference only.';

COMMENT ON COLUMN notification_preferences.email_enabled IS
  'Whether future email approval notifications should be sent after email delivery is implemented. Phase 10.1 stores the preference only.';

COMMENT ON COLUMN notification_preferences.slack_enabled IS
  'Reserved for a later Slack integration phase. Phase 10.1 enforces false.';

COMMENT ON COLUMN notification_preferences.approval_escalation_minutes IS
  'How long a future approval notification may wait before escalation logic is considered. Phase 10.1 does not schedule or send escalations.';
