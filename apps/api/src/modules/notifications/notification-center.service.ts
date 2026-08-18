import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import { buildNotificationCenterResponse } from './notification-center.model.js';
import { listPendingApprovalNotificationRows, listRecentNotificationEventRows } from './notification-center.repository.js';
import type { NotificationCenterResponse } from './notification-center.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for the in-app notification center.');
  }
}

async function requireWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
}

export async function getNotificationCenter(params: {
  workspaceId: string;
  userId: string;
  pendingLimit?: unknown;
  eventLimit?: unknown;
}): Promise<NotificationCenterResponse> {
  assertDatabaseReady();
  await requireWorkspaceMembership(params.workspaceId, params.userId);
  const pendingLimit = clampLimit(params.pendingLimit, 10, 25);
  const eventLimit = clampLimit(params.eventLimit, 15, 50);
  const [pendingApprovals, recentEvents] = await Promise.all([
    listPendingApprovalNotificationRows({ workspaceId: params.workspaceId, userId: params.userId, limit: pendingLimit }),
    listRecentNotificationEventRows({ workspaceId: params.workspaceId, userId: params.userId, limit: eventLimit }),
  ]);

  return buildNotificationCenterResponse({
    workspaceId: params.workspaceId,
    pendingApprovals,
    recentEvents,
  });
}
