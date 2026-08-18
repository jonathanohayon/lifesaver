import { ZodError } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import {
  assertSafeNotificationPreferencesResponse,
  defaultNotificationPreferences,
  mergeNotificationPreferencePatch,
  toSafeNotificationPreferences,
} from './notification-preferences.model.js';
import { getNotificationPreferencesRow, recordNotificationPreferencesEvent, upsertNotificationPreferencesRow } from './notification-preferences.repository.js';
import type { NotificationPreferencePatch, SafeNotificationPreferences } from './notification-preferences.types.js';

const MANAGE_NOTIFICATION_ROLES = new Set(['owner', 'admin']);

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for notification preference settings.');
  }
}

function toSafeValidationError(error: unknown): AppError {
  if (error instanceof ZodError) {
    return new AppError(400, 'INVALID_NOTIFICATION_PREFERENCES', 'Notification preference settings are invalid.', {
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (error instanceof Error && error.message.includes('Slack notifications are planned')) {
    return new AppError(400, 'SLACK_NOT_AVAILABLE_IN_PHASE_10_1', error.message, {
      slackStatus: 'planned_later',
      deliveryImplemented: false,
    });
  }

  return error instanceof AppError ? error : new AppError(400, 'INVALID_NOTIFICATION_PREFERENCES', 'Notification preference settings are invalid.');
}

async function requireWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
  return membership;
}

async function assertCanManageNotificationPreferences(workspaceId: string, userId: string): Promise<string> {
  const membership = await requireWorkspaceMembership(workspaceId, userId);
  const role = String(membership.role || '').toLowerCase();
  if (!MANAGE_NOTIFICATION_ROLES.has(role)) {
    throw new AppError(403, 'INSUFFICIENT_WORKSPACE_PERMISSION', 'Only workspace owners/admins can update notification preferences.');
  }
  return role;
}

export async function getNotificationPreferences(workspaceId: string, userId: string): Promise<SafeNotificationPreferences> {
  assertDatabaseReady();
  await requireWorkspaceMembership(workspaceId, userId);
  const row = await getNotificationPreferencesRow(workspaceId);
  const response = row ? toSafeNotificationPreferences(row) : defaultNotificationPreferences(workspaceId);
  assertSafeNotificationPreferencesResponse(response);
  return response;
}

export async function updateNotificationPreferences(
  workspaceId: string,
  userId: string,
  input: NotificationPreferencePatch
): Promise<SafeNotificationPreferences> {
  assertDatabaseReady();
  const role = await assertCanManageNotificationPreferences(workspaceId, userId);
  const current = await getNotificationPreferencesRow(workspaceId);

  let merged;
  try {
    merged = mergeNotificationPreferencePatch(current, workspaceId, input);
  } catch (error) {
    throw toSafeValidationError(error);
  }

  const row = await upsertNotificationPreferencesRow({
    workspaceId,
    userId,
    inAppEnabled: merged.in_app_enabled,
    emailEnabled: merged.email_enabled,
    quietHoursEnabled: merged.quiet_hours_enabled,
    quietHoursStart: merged.quiet_hours_start,
    quietHoursEnd: merged.quiet_hours_end,
    quietHoursTimezone: merged.quiet_hours_timezone,
    approvalEscalationMinutes: merged.approval_escalation_minutes,
    repeatEscalationMinutes: merged.repeat_escalation_minutes,
    maxEscalations: merged.max_escalations,
    metadata: {
      ...(merged.metadata || {}),
      updatedByRole: role,
      phase: 'phase_10_1_notification_preferences_model',
      sendsNotificationsInThisPhase: false,
    },
  });

  await recordNotificationPreferencesEvent({
    workspaceId,
    userId,
    eventType: 'notification_preferences_updated',
    message: 'Notification preferences were updated. Phase 10.1 stores settings only and does not send notifications.',
    metadata: {
      role,
      phase: 'phase_10_1_notification_preferences_model',
      inAppEnabled: row.in_app_enabled,
      emailEnabled: row.email_enabled,
      slackEnabled: false,
      quietHoursEnabled: row.quiet_hours_enabled,
      approvalEscalationMinutes: row.approval_escalation_minutes,
      sendsNotificationsInThisPhase: false,
      externalServicesCalled: false,
    },
  });

  const response = toSafeNotificationPreferences(row);
  assertSafeNotificationPreferencesResponse(response);
  return response;
}
