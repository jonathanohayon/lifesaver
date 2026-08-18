import { isDatabaseConfigured, query } from '../../db/pool.js';

export type OnboardingWorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan_key: string;
  onboarding_status: string;
  onboarding_completed_at: Date | null;
  triple_whale_status: string | null;
  triple_whale_has_key: boolean;
  metrics_count: string;
  daily_brief_count: string;
  weekly_summary_count: string;
};

export async function getWorkspaceOnboardingRow(workspaceId: string): Promise<OnboardingWorkspaceRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<OnboardingWorkspaceRow>(
    `SELECT
       w.id,
       w.name,
       w.slug,
       w.status,
       w.plan_key,
       w.onboarding_status,
       w.onboarding_completed_at,
       ca.status AS triple_whale_status,
       CASE WHEN ca.encrypted_api_key IS NOT NULL AND ca.status <> 'disconnected' THEN true ELSE false END AS triple_whale_has_key,
       (SELECT COUNT(*)::text FROM metrics_snapshots ms WHERE ms.workspace_id = w.id AND ms.provider = 'triple_whale') AS metrics_count,
       (SELECT COUNT(*)::text FROM briefs b WHERE b.workspace_id = w.id AND b.type = 'daily') AS daily_brief_count,
       (SELECT COUNT(*)::text FROM briefs b WHERE b.workspace_id = w.id AND b.type = 'weekly') AS weekly_summary_count
     FROM workspaces w
     LEFT JOIN connected_accounts ca ON ca.workspace_id = w.id AND ca.provider = 'triple_whale'
     WHERE w.id = $1
     LIMIT 1;`,
    [workspaceId]
  );

  return result.rows[0] ?? null;
}

export async function updateWorkspaceOnboardingStatus(params: {
  workspaceId: string;
  onboardingStatus: string;
  completedAt?: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;
  await query(
    `UPDATE workspaces
     SET onboarding_status = $2,
         onboarding_completed_at = COALESCE($3, onboarding_completed_at),
         onboarding_metadata = onboarding_metadata || $4::jsonb,
         updated_at = NOW()
     WHERE id = $1;`,
    [params.workspaceId, params.onboardingStatus, params.completedAt || null, JSON.stringify(params.metadata || {})]
  );
}

export async function recordOnboardingEvent(params: {
  workspaceId: string;
  userId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured) return;
  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, $2, 'info', $3, $4::jsonb);`,
    [params.workspaceId, params.eventType, params.message, JSON.stringify({ userId: params.userId, version: '0.5.2', ...(params.metadata || {}) })]
  );
}
