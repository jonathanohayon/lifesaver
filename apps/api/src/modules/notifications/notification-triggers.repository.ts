import { isDatabaseConfigured, query } from '../../db/pool.js';
import { DEFAULT_NOTIFICATION_PREFERENCES_ROW } from './notification-preferences.model.js';
import type { NotificationPreferenceRow } from './notification-preferences.types.js';
import type { NotificationTriggerCandidateRow, NotificationTriggerPreferencesSnapshot } from './notification-triggers.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function getNotificationTriggerPreferencesSnapshot(workspaceId: string): Promise<NotificationTriggerPreferencesSnapshot> {
  if (!isDatabaseConfigured) {
    return {
      inAppEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.in_app_enabled,
      emailEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.email_enabled,
      slackEnabled: false,
      quietHoursEnabled: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_enabled,
      quietHoursStart: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_start,
      quietHoursEnd: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_end,
      quietHoursTimezone: DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_timezone,
      approvalEscalationMinutes: DEFAULT_NOTIFICATION_PREFERENCES_ROW.approval_escalation_minutes,
      repeatEscalationMinutes: DEFAULT_NOTIFICATION_PREFERENCES_ROW.repeat_escalation_minutes,
      maxEscalations: DEFAULT_NOTIFICATION_PREFERENCES_ROW.max_escalations,
    };
  }
  const result = await query<NotificationPreferenceRow>(
    `SELECT * FROM notification_preferences WHERE workspace_id = $1 LIMIT 1;`,
    [workspaceId]
  );
  const row = result.rows[0];
  return {
    inAppEnabled: row?.in_app_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.in_app_enabled,
    emailEnabled: row?.email_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.email_enabled,
    slackEnabled: false,
    quietHoursEnabled: row?.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_enabled,
    quietHoursStart: row?.quiet_hours_start ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_start,
    quietHoursEnd: row?.quiet_hours_end ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_end,
    quietHoursTimezone: row?.quiet_hours_timezone ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.quiet_hours_timezone,
    approvalEscalationMinutes: row?.approval_escalation_minutes ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.approval_escalation_minutes,
    repeatEscalationMinutes: row?.repeat_escalation_minutes ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.repeat_escalation_minutes,
    maxEscalations: row?.max_escalations ?? DEFAULT_NOTIFICATION_PREFERENCES_ROW.max_escalations,
  };
}

export async function listNotificationTriggerCandidateRows(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<NotificationTriggerCandidateRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 50, 100);
  const result = await query<NotificationTriggerCandidateRow>(
    `WITH latest_events AS (
       SELECT DISTINCT ON (ae.action_id)
         ae.action_id,
         ae.event_type,
         ae.message,
         ae.created_at
       FROM action_events ae
       WHERE ae.workspace_id = $1
       ORDER BY ae.action_id, ae.created_at DESC, ae.id DESC
     ), reminder_events AS (
       SELECT
         ae.action_id,
         COUNT(*) FILTER (WHERE ae.event_type = 'queued' AND COALESCE(ae.metadata_json->>'notification_trigger_type', '') = 'approval_reminder_needed')::integer AS reminder_count,
         MAX(ae.created_at) FILTER (WHERE ae.event_type = 'queued' AND COALESCE(ae.metadata_json->>'notification_trigger_type', '') = 'approval_reminder_needed') AS last_reminder_at
       FROM action_events ae
       WHERE ae.workspace_id = $1
       GROUP BY ae.action_id
     )
     SELECT
       a.id,
       a.workspace_id,
       a.action_type,
       a.title,
       a.description,
       a.status,
       a.risk_level,
       a.approval_required,
       a.policy_decision,
       a.created_at,
       a.updated_at,
       a.approved_at,
       a.executed_at,
       le.event_type AS last_event_type,
       le.message AS last_event_message,
       le.created_at AS last_event_at,
       COALESCE(re.reminder_count, 0)::integer AS reminder_count,
       re.last_reminder_at
     FROM actions a
     LEFT JOIN latest_events le ON le.action_id = a.id
     LEFT JOIN reminder_events re ON re.action_id = a.id
     WHERE a.workspace_id = $1
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = a.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
       AND (
         (a.approval_required = TRUE AND a.status IN ('proposed', 'approval_required'))
         OR a.status = 'failed'
         OR le.event_type IN ('execution_failed', 'rollback_failed')
       )
     ORDER BY
       CASE a.risk_level
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         ELSE 3
       END,
       a.updated_at DESC,
       a.id ASC
     LIMIT $3;`,
    [params.workspaceId, params.userId, limit]
  );
  return result.rows;
}
