import { isDatabaseConfigured, query } from '../../db/pool.js';

export type WorkspaceMembershipRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan_key: string;
  onboarding_status: string | null;
  onboarding_completed_at: Date | null;
  member_role: string;
  member_status: string;
  owner_user_id: string | null;
  created_at: Date;
};

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceMembershipRow[]> {
  if (!isDatabaseConfigured) return [];
  const result = await query<WorkspaceMembershipRow>(
    `SELECT
       w.id,
       w.name,
       w.slug,
       w.status,
       w.plan_key,
       w.onboarding_status,
       w.onboarding_completed_at,
       wm.role AS member_role,
       COALESCE(wm.status, 'active') AS member_status,
       w.owner_user_id,
       w.created_at
     FROM workspace_members wm
     INNER JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1 AND COALESCE(wm.status, 'active') = 'active'
     ORDER BY
       CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END ASC,
       w.created_at ASC;`,
    [userId]
  );
  return result.rows;
}
