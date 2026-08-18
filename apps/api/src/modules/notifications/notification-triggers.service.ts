import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import { buildNotificationTriggerEvaluation } from './notification-triggers.model.js';
import { getNotificationTriggerPreferencesSnapshot, listNotificationTriggerCandidateRows } from './notification-triggers.repository.js';
import type { NotificationTriggerEvaluation, NotificationTriggerInput } from './notification-triggers.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for notification trigger evaluation.');
  }
}

async function requireWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
}

export async function evaluateNotificationTriggersForWorkspace(params: {
  workspaceId: string;
  userId: string;
  limit?: unknown;
}): Promise<NotificationTriggerEvaluation> {
  assertDatabaseReady();
  await requireWorkspaceMembership(params.workspaceId, params.userId);
  const limit = clampLimit(params.limit, 50, 100);
  const [preferences, rows] = await Promise.all([
    getNotificationTriggerPreferencesSnapshot(params.workspaceId),
    listNotificationTriggerCandidateRows({ workspaceId: params.workspaceId, userId: params.userId, limit }),
  ]);
  const candidates: NotificationTriggerInput[] = rows.map((row) => ({
    actionId: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    actionType: row.action_type,
    status: row.status,
    riskLevel: row.risk_level,
    approvalRequired: row.approval_required,
    policyDecision: row.policy_decision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEventType: row.last_event_type,
    lastEventMessage: row.last_event_message,
    lastEventAt: row.last_event_at,
    reminderCount: row.reminder_count,
    lastReminderAt: row.last_reminder_at,
  }));
  return buildNotificationTriggerEvaluation({ workspaceId: params.workspaceId, candidates, preferences });
}
