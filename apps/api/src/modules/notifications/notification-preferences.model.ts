import { z } from 'zod';
import type { NotificationPreferencePatch, NotificationPreferenceRow, SafeNotificationPreferences } from './notification-preferences.types.js';

export const NOTIFICATION_PREFERENCES_PHASE = 'phase_10_1_notification_preferences_model' as const;
export const NOTIFICATION_PREFERENCES_VERSION = '0.7.0' as const;

const hhmmRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const notificationPreferencePatchSchema = z.object({
  channels: z.object({
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
    slack: z.boolean().optional(),
  }).optional(),
  quietHours: z.object({
    enabled: z.boolean().optional(),
    start: z.string().regex(hhmmRegex, 'quietHours.start must use HH:mm 24-hour format.').optional(),
    end: z.string().regex(hhmmRegex, 'quietHours.end must use HH:mm 24-hour format.').optional(),
    timezone: z.string().trim().min(3).max(80).optional(),
  }).optional(),
  escalation: z.object({
    approvalEscalationMinutes: z.number().int().min(5).max(1440).optional(),
    repeatEscalationMinutes: z.number().int().min(5).max(1440).optional(),
    maxEscalations: z.number().int().min(0).max(10).optional(),
  }).optional(),
}).strict();

export type ParsedNotificationPreferencePatch = z.infer<typeof notificationPreferencePatchSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES_ROW: Omit<NotificationPreferenceRow, 'workspace_id' | 'updated_by' | 'created_at' | 'updated_at'> = {
  in_app_enabled: true,
  email_enabled: false,
  slack_enabled: false,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  quiet_hours_timezone: 'America/New_York',
  approval_escalation_minutes: 60,
  repeat_escalation_minutes: 120,
  max_escalations: 3,
  metadata: {},
};

export function parseHhmmToMinutes(value: string): number {
  if (!hhmmRegex.test(value)) {
    throw new Error(`Invalid HH:mm time: ${value}`);
  }
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

export function quietHoursCrossesMidnight(start: string, end: string): boolean {
  return parseHhmmToMinutes(start) > parseHhmmToMinutes(end);
}

export function assertSlackIsPlannedOnly(input: NotificationPreferencePatch): void {
  if (input.channels?.slack === true) {
    throw new Error('Slack notifications are planned for a later phase and cannot be enabled in Phase 10.1.');
  }
}

export function mergeNotificationPreferencePatch(
  current: NotificationPreferenceRow | null,
  workspaceId: string,
  input: NotificationPreferencePatch
): NotificationPreferenceRow {
  const parsed = notificationPreferencePatchSchema.parse(input);
  assertSlackIsPlannedOnly(parsed);

  const now = new Date();
  const base: NotificationPreferenceRow = current || {
    workspace_id: workspaceId,
    ...DEFAULT_NOTIFICATION_PREFERENCES_ROW,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };

  return {
    ...base,
    in_app_enabled: parsed.channels?.inApp ?? base.in_app_enabled,
    email_enabled: parsed.channels?.email ?? base.email_enabled,
    slack_enabled: false,
    quiet_hours_enabled: parsed.quietHours?.enabled ?? base.quiet_hours_enabled,
    quiet_hours_start: parsed.quietHours?.start ?? base.quiet_hours_start,
    quiet_hours_end: parsed.quietHours?.end ?? base.quiet_hours_end,
    quiet_hours_timezone: parsed.quietHours?.timezone?.trim() ?? base.quiet_hours_timezone,
    approval_escalation_minutes: parsed.escalation?.approvalEscalationMinutes ?? base.approval_escalation_minutes,
    repeat_escalation_minutes: parsed.escalation?.repeatEscalationMinutes ?? base.repeat_escalation_minutes,
    max_escalations: parsed.escalation?.maxEscalations ?? base.max_escalations,
    metadata: {
      ...(base.metadata || {}),
      phase: NOTIFICATION_PREFERENCES_PHASE,
      modelOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      createsInAppRowsInThisPhase: false,
      externalServicesCalled: false,
      updatedByPatch: true,
    },
    updated_at: now,
  };
}

export function defaultNotificationPreferences(workspaceId: string): SafeNotificationPreferences {
  const now = new Date();
  return toSafeNotificationPreferences({
    workspace_id: workspaceId,
    ...DEFAULT_NOTIFICATION_PREFERENCES_ROW,
    updated_by: null,
    created_at: now,
    updated_at: now,
  });
}

export function toSafeNotificationPreferences(row: NotificationPreferenceRow): SafeNotificationPreferences {
  return {
    version: NOTIFICATION_PREFERENCES_VERSION,
    phase: NOTIFICATION_PREFERENCES_PHASE,
    workspaceId: row.workspace_id,
    channels: {
      inApp: {
        enabled: Boolean(row.in_app_enabled),
        status: 'stored_preference_only',
      },
      email: {
        enabled: Boolean(row.email_enabled),
        status: 'stored_preference_only',
        deliveryImplemented: false,
      },
      slack: {
        enabled: false,
        status: 'planned_later',
        deliveryImplemented: false,
      },
    },
    quietHours: {
      enabled: Boolean(row.quiet_hours_enabled),
      start: row.quiet_hours_start,
      end: row.quiet_hours_end,
      timezone: row.quiet_hours_timezone,
      crossesMidnight: quietHoursCrossesMidnight(row.quiet_hours_start, row.quiet_hours_end),
    },
    escalation: {
      approvalEscalationMinutes: row.approval_escalation_minutes,
      repeatEscalationMinutes: row.repeat_escalation_minutes,
      maxEscalations: row.max_escalations,
      schedulingImplemented: false,
    },
    triggers: {
      actionNeedsApproval: true,
      actionFailed: true,
      rollbackNeedsReview: true,
    },
    safety: {
      modelOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      createsInAppRowsInThisPhase: false,
      externalServicesCalled: false,
      browserReceivesSecrets: false,
      autoRunEnabled: false,
    },
    updatedBy: row.updated_by,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    metadata: {
      ...(row.metadata || {}),
      phase: NOTIFICATION_PREFERENCES_PHASE,
      slackLater: true,
      realExternalNotificationsAdded: false,
    },
  };
}

export function assertSafeNotificationPreferencesResponse(response: SafeNotificationPreferences): void {
  const serialized = JSON.stringify(response).toLowerCase();
  const forbiddenFragments = ['access_token', 'refresh_token', 'authorization', 'smtp_password', 'slack_webhook_secret'];
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) {
      throw new Error(`Safe notification preference response contains forbidden fragment: ${fragment}`);
    }
  }
}
