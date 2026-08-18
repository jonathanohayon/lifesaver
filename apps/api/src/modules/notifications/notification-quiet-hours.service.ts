import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import { buildQuietHoursPreview } from './notification-quiet-hours.model.js';
import { getNotificationTriggerPreferencesSnapshot, listNotificationTriggerCandidateRows } from './notification-triggers.repository.js';
import type { QuietHoursEnforcementInput, QuietHoursPreviewResponse } from './notification-quiet-hours.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for quiet-hours enforcement preview.');
  }
}

async function requireWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
}

function priorityFromRow(row: { status: string; risk_level: string; last_event_type: string | null; reminder_count: number }): 'normal' | 'elevated' | 'urgent' {
  const status = row.status.toLowerCase();
  const risk = row.risk_level.toLowerCase();
  if (status === 'failed' || row.last_event_type === 'execution_failed' || row.last_event_type === 'rollback_failed' || risk === 'critical' || row.reminder_count >= 2) return 'urgent';
  if (risk === 'high' || row.reminder_count >= 1) return 'elevated';
  return 'normal';
}

function triggerTypeFromRow(row: { status: string; risk_level: string; approval_required: boolean; last_event_type: string | null }): QuietHoursEnforcementInput['triggerType'] {
  const status = row.status.toLowerCase();
  if (status === 'failed' || row.last_event_type === 'execution_failed' || row.last_event_type === 'rollback_failed') return 'action_failed';
  if (row.approval_required && ['proposed', 'approval_required'].includes(status) && row.risk_level.toLowerCase() === 'critical') return 'high_risk_action_waiting';
  if (row.approval_required && ['proposed', 'approval_required'].includes(status)) return 'action_proposed';
  return 'manual_preview';
}

export async function previewQuietHoursEnforcementForWorkspace(params: {
  workspaceId: string;
  userId: string;
  limit?: unknown;
}): Promise<QuietHoursPreviewResponse> {
  assertDatabaseReady();
  await requireWorkspaceMembership(params.workspaceId, params.userId);
  const limit = clampLimit(params.limit, 50, 100);
  const [preferences, rows] = await Promise.all([
    getNotificationTriggerPreferencesSnapshot(params.workspaceId),
    listNotificationTriggerCandidateRows({ workspaceId: params.workspaceId, userId: params.userId, limit }),
  ]);
  const candidates: QuietHoursEnforcementInput[] = rows.map((row) => ({
    actionId: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    actionType: row.action_type,
    riskLevel: row.risk_level,
    priority: priorityFromRow(row),
    triggerType: triggerTypeFromRow(row),
    channels: {
      inAppCandidate: preferences.inAppEnabled,
      emailCandidate: preferences.emailEnabled,
      slackCandidate: false,
    },
  }));
  return buildQuietHoursPreview({ workspaceId: params.workspaceId, candidates, preferences });
}
