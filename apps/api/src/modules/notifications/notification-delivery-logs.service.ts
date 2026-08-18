import { ZodError } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import {
  buildNotificationDeliveryLog,
  buildNotificationDeliveryLogsResponse,
  deliveryLogFromRow,
  sanitizeDeliveryLogMetadata,
} from './notification-delivery-logs.model.js';
import { actionBelongsToWorkspace, insertNotificationDeliveryLogRow, listNotificationDeliveryLogRows } from './notification-delivery-logs.repository.js';
import type { NotificationDeliveryLogInput, NotificationDeliveryLogsResponse, SafeNotificationDeliveryLog } from './notification-delivery-logs.types.js';

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for notification delivery logs.');
  }
}

function toSafeValidationError(error: unknown): AppError {
  if (error instanceof ZodError) {
    return new AppError(400, 'INVALID_NOTIFICATION_DELIVERY_LOG', 'Notification delivery log input is invalid.', {
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return error instanceof AppError ? error : new AppError(400, 'INVALID_NOTIFICATION_DELIVERY_LOG', 'Notification delivery log input is invalid.');
}

async function requireWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
}

export async function recordNotificationDeliveryLog(input: NotificationDeliveryLogInput): Promise<SafeNotificationDeliveryLog> {
  assertDatabaseReady();
  let safeLog: SafeNotificationDeliveryLog;
  try {
    safeLog = buildNotificationDeliveryLog(input);
  } catch (error) {
    throw toSafeValidationError(error);
  }
  if (input.actionId) {
    const belongs = await actionBelongsToWorkspace({ workspaceId: input.workspaceId, actionId: input.actionId });
    if (!belongs) throw new AppError(404, 'ACTION_NOT_FOUND', 'Action was not found in this workspace.');
  }
  const row = await insertNotificationDeliveryLogRow({
    workspaceId: input.workspaceId,
    actionId: input.actionId || null,
    userId: input.userId || null,
    notificationKey: safeLog.notificationKey,
    channel: safeLog.channel,
    eventType: safeLog.eventType,
    recipientHint: safeLog.recipientHint,
    deliveryProvider: safeLog.deliveryProvider,
    message: safeLog.message,
    errorMessage: safeLog.errorMessage,
    metadataJson: safeLog.metadata,
  });
  return deliveryLogFromRow(row);
}

export async function listNotificationDeliveryLogs(params: {
  workspaceId: string;
  userId: string;
  limit?: unknown;
  eventType?: unknown;
  channel?: unknown;
}): Promise<NotificationDeliveryLogsResponse> {
  assertDatabaseReady();
  await requireWorkspaceMembership(params.workspaceId, params.userId);
  const rows = await listNotificationDeliveryLogRows(params);
  return buildNotificationDeliveryLogsResponse({
    workspaceId: params.workspaceId,
    logs: rows.map(deliveryLogFromRow),
  });
}

export async function recordNotificationOpened(params: {
  workspaceId: string;
  userId: string;
  actionId?: unknown;
  notificationKey?: unknown;
  channel?: unknown;
}): Promise<SafeNotificationDeliveryLog> {
  assertDatabaseReady();
  await requireWorkspaceMembership(params.workspaceId, params.userId);
  const actionId = typeof params.actionId === 'string' && params.actionId.trim() ? params.actionId.trim() : null;
  const notificationKey = typeof params.notificationKey === 'string' && params.notificationKey.trim() ? params.notificationKey.trim() : null;
  const channel = params.channel === 'email' || params.channel === 'slack' || params.channel === 'in_app' ? params.channel : 'in_app';
  return recordNotificationDeliveryLog({
    workspaceId: params.workspaceId,
    userId: params.userId,
    actionId,
    notificationKey,
    channel,
    eventType: 'notification_opened',
    deliveryProvider: 'lifesaver_internal',
    message: 'Notification review link was opened by an authenticated workspace member.',
    metadata: sanitizeDeliveryLogMetadata({
      source: 'approval_deep_link',
      phase: 'phase_10_8_delivery_logs',
      sendsEmailInThisPhase: false,
      externalServicesCalled: false,
    }),
  });
}
