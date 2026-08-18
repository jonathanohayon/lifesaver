import { query } from '../../db/pool.js';
import type { NotificationPreferenceRow } from './notification-preferences.types.js';

export async function getNotificationPreferencesRow(workspaceId: string): Promise<NotificationPreferenceRow | null> {
  const result = await query<NotificationPreferenceRow>(
    `SELECT
       workspace_id,
       in_app_enabled,
       email_enabled,
       slack_enabled,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       quiet_hours_timezone,
       approval_escalation_minutes,
       repeat_escalation_minutes,
       max_escalations,
       updated_by,
       metadata,
       created_at,
       updated_at
     FROM notification_preferences
     WHERE workspace_id = $1
     LIMIT 1;`,
    [workspaceId]
  );

  return result.rows[0] ?? null;
}

export async function upsertNotificationPreferencesRow(params: {
  workspaceId: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  approvalEscalationMinutes: number;
  repeatEscalationMinutes: number;
  maxEscalations: number;
  metadata: Record<string, unknown>;
}): Promise<NotificationPreferenceRow> {
  const result = await query<NotificationPreferenceRow>(
    `INSERT INTO notification_preferences (
       workspace_id,
       in_app_enabled,
       email_enabled,
       slack_enabled,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       quiet_hours_timezone,
       approval_escalation_minutes,
       repeat_escalation_minutes,
       max_escalations,
       updated_by,
       metadata
     ) VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     ON CONFLICT (workspace_id)
     DO UPDATE SET
       in_app_enabled = EXCLUDED.in_app_enabled,
       email_enabled = EXCLUDED.email_enabled,
       slack_enabled = FALSE,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       quiet_hours_timezone = EXCLUDED.quiet_hours_timezone,
       approval_escalation_minutes = EXCLUDED.approval_escalation_minutes,
       repeat_escalation_minutes = EXCLUDED.repeat_escalation_minutes,
       max_escalations = EXCLUDED.max_escalations,
       updated_by = EXCLUDED.updated_by,
       metadata = notification_preferences.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING
       workspace_id,
       in_app_enabled,
       email_enabled,
       slack_enabled,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       quiet_hours_timezone,
       approval_escalation_minutes,
       repeat_escalation_minutes,
       max_escalations,
       updated_by,
       metadata,
       created_at,
       updated_at;`,
    [
      params.workspaceId,
      params.inAppEnabled,
      params.emailEnabled,
      params.quietHoursEnabled,
      params.quietHoursStart,
      params.quietHoursEnd,
      params.quietHoursTimezone,
      params.approvalEscalationMinutes,
      params.repeatEscalationMinutes,
      params.maxEscalations,
      params.userId,
      JSON.stringify(params.metadata),
    ]
  );

  return result.rows[0];
}

export async function recordNotificationPreferencesEvent(params: {
  workspaceId: string;
  userId: string;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, 'info', $3, $4::jsonb);`,
    [params.workspaceId, params.eventType, params.message, JSON.stringify({ userId: params.userId, ...params.metadata })]
  );
}
