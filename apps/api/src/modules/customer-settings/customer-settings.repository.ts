import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { CustomerWorkspaceProfile } from './customer-settings.types.js';

export type CustomerWorkspaceProfileRow = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string | null;
  workspace_role: string;
  owner_email: string | null;
  plan_key: string;
  status: string;
  onboarding_status: string | null;
  onboarding_completed_at: Date | null;
  onboarding_metadata: Record<string, any> | null;
};

function toProfile(row: CustomerWorkspaceProfileRow): CustomerWorkspaceProfile {
  const metadata = row.onboarding_metadata || {};
  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug,
    workspaceRole: row.workspace_role,
    ownerEmail: row.owner_email,
    storeDomain: typeof metadata.storeDomain === 'string' ? metadata.storeDomain : null,
    timezone: typeof metadata.timezone === 'string' ? metadata.timezone : null,
    currency: typeof metadata.currency === 'string' ? metadata.currency : null,
    planKey: row.plan_key,
    status: row.status,
    onboardingStatus: row.onboarding_status,
    onboardingCompletedAt: row.onboarding_completed_at ? row.onboarding_completed_at.toISOString() : null,
  };
}

export async function getCustomerWorkspaceProfile(workspaceId: string, userId: string): Promise<CustomerWorkspaceProfile | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<CustomerWorkspaceProfileRow>(
    `SELECT
       w.id AS workspace_id,
       w.name AS workspace_name,
       w.slug AS workspace_slug,
       wm.role AS workspace_role,
       owner.email AS owner_email,
       w.plan_key,
       w.status,
       w.onboarding_status,
       w.onboarding_completed_at,
       w.onboarding_metadata
     FROM workspaces w
     INNER JOIN workspace_members wm ON wm.workspace_id = w.id
     LEFT JOIN users owner ON owner.id = w.owner_user_id
     WHERE w.id = $1
       AND wm.user_id = $2
       AND COALESCE(wm.status, 'active') = 'active'
     LIMIT 1;`,
    [workspaceId, userId]
  );

  const row = result.rows[0];
  return row ? toProfile(row) : null;
}

export async function updateCustomerWorkspaceProfile(params: {
  workspaceId: string;
  userId: string;
  workspaceName: string;
  storeDomain: string | null;
  timezone: string | null;
  currency: string | null;
}): Promise<CustomerWorkspaceProfile | null> {
  if (!isDatabaseConfigured) return null;

  await query(
    `UPDATE workspaces
     SET name = $2,
         onboarding_metadata = onboarding_metadata || $3::jsonb,
         updated_at = NOW()
     WHERE id = $1;`,
    [
      params.workspaceId,
      params.workspaceName,
      JSON.stringify({
        storeDomain: params.storeDomain,
        timezone: params.timezone,
        currency: params.currency,
        customerSettingsUpdatedAt: new Date().toISOString(),
        customerSettingsVersion: '0.5.3',
      }),
    ]
  );

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, 'customer_workspace_settings_updated', 'info', $2, $3::jsonb);`,
    [
      params.workspaceId,
      'Customer workspace profile settings were updated by a workspace user.',
      JSON.stringify({ userId: params.userId, version: '0.5.3', fields: ['workspaceName', 'storeDomain', 'timezone', 'currency'] }),
    ]
  );

  return getCustomerWorkspaceProfile(params.workspaceId, params.userId);
}
