import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { AutonomyMembershipRow, AutonomySettingsRow } from './autonomy.types.js';
import type { AutonomyPauseScope } from './autonomy.validation.js';

export async function getAutonomySettingsByWorkspaceId(workspaceId: string): Promise<AutonomySettingsRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<AutonomySettingsRow>(
    `SELECT
       workspace_id,
       pause_all_autonomy,
       pause_content_actions,
       pause_support_actions,
       pause_ads_actions,
       pause_research_actions,
       pause_dev_actions,
       updated_by,
       updated_at
     FROM autonomy_settings
     WHERE workspace_id = $1
     LIMIT 1;`,
    [workspaceId]
  );

  return result.rows[0] ?? null;
}

export async function ensureAutonomySettingsForWorkspace(workspaceId: string): Promise<AutonomySettingsRow> {
  if (!isDatabaseConfigured) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const result = await query<AutonomySettingsRow>(
    `INSERT INTO autonomy_settings (
       workspace_id,
       pause_all_autonomy,
       pause_content_actions,
       pause_support_actions,
       pause_ads_actions,
       pause_research_actions,
       pause_dev_actions,
       updated_by,
       updated_at
     )
     VALUES ($1, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, NULL, NOW())
     ON CONFLICT (workspace_id) DO UPDATE
       SET workspace_id = EXCLUDED.workspace_id
     RETURNING
       workspace_id,
       pause_all_autonomy,
       pause_content_actions,
       pause_support_actions,
       pause_ads_actions,
       pause_research_actions,
       pause_dev_actions,
       updated_by,
       updated_at;`,
    [workspaceId]
  );

  return result.rows[0];
}

export async function getActiveAutonomyWorkspaceMembership(params: {
  workspaceId: string;
  userId: string;
}): Promise<AutonomyMembershipRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<AutonomyMembershipRow>(
    `SELECT
       wm.workspace_id,
       wm.user_id,
       wm.role AS workspace_role,
       COALESCE(wm.status, 'active') AS membership_status,
       u.role AS user_platform_role
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
       AND wm.user_id = $2
       AND COALESCE(wm.status, 'active') = 'active'
     LIMIT 1;`,
    [params.workspaceId, params.userId]
  );

  return result.rows[0] ?? null;
}

function scopeUpdateClause(scope: AutonomyPauseScope, paused: boolean): string {
  switch (scope) {
    case 'all':
      return 'pause_all_autonomy = $2';
    case 'content':
      return 'pause_content_actions = $2';
    case 'support':
      return 'pause_support_actions = $2';
    case 'ads':
      return 'pause_ads_actions = $2';
    case 'research':
      return 'pause_research_actions = $2';
    case 'dev':
      return 'pause_dev_actions = $2';
    default:
      return paused ? 'pause_all_autonomy = TRUE' : 'pause_all_autonomy = FALSE';
  }
}

export async function updateAutonomyPauseScope(params: {
  workspaceId: string;
  userId: string;
  scope: AutonomyPauseScope;
  paused: boolean;
}): Promise<AutonomySettingsRow> {
  if (!isDatabaseConfigured) {
    throw new Error('DATABASE_URL is not configured.');
  }

  await ensureAutonomySettingsForWorkspace(params.workspaceId);
  const clause = scopeUpdateClause(params.scope, params.paused);

  const result = await query<AutonomySettingsRow>(
    `UPDATE autonomy_settings
     SET ${clause},
         updated_by = $3,
         updated_at = NOW()
     WHERE workspace_id = $1
     RETURNING
       workspace_id,
       pause_all_autonomy,
       pause_content_actions,
       pause_support_actions,
       pause_ads_actions,
       pause_research_actions,
       pause_dev_actions,
       updated_by,
       updated_at;`,
    [params.workspaceId, params.paused, params.userId]
  );

  return result.rows[0];
}


export async function recordAutonomyPauseAuditEvent(params: {
  workspaceId: string;
  eventType: 'autonomy_pause_enabled' | 'autonomy_pause_disabled';
  scope: AutonomyPauseScope;
  actorUserId: string;
  reason: string | null;
  before: Record<string, boolean>;
  after: Record<string, boolean>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;

  const operation = params.eventType === 'autonomy_pause_enabled' ? 'pause' : 'resume';
  const message = operation === 'pause'
    ? `Autonomy pause enabled for scope: ${params.scope}.`
    : `Autonomy pause disabled for scope: ${params.scope}.`;

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb);`,
    [
      params.workspaceId,
      params.eventType,
      'info',
      message,
      JSON.stringify({
        phase: 'v0.6.0 Phase 5.9 Emergency Safe Mode',
        operation,
        scope: params.scope,
        categoryAffected: params.scope,
        actorUserId: params.actorUserId,
        reason: params.reason,
        before: params.before,
        after: params.after,
        safety: {
          autoApprovalTriggered: false,
          executorTriggered: false,
          externalWriteTriggered: false,
          resumeDoesNotExecuteWaitingActions: true,
        },
      }),
    ]
  );
}
