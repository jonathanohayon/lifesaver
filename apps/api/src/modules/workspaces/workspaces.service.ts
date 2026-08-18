import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { listWorkspacesForUser } from './workspaces.repository.js';

function serialize(row: Awaited<ReturnType<typeof listWorkspacesForUser>>[number]) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    planKey: row.plan_key,
    role: row.member_role,
    memberStatus: row.member_status,
    onboardingStatus: row.onboarding_status,
    onboardingCompletedAt: row.onboarding_completed_at ? row.onboarding_completed_at.toISOString() : null,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getWorkspaceListForUser(userId: string, currentWorkspaceId: string) {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for workspace management.');
  }

  const rows = await listWorkspacesForUser(userId);
  const workspaces = rows.map(serialize);
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0] || null;

  return {
    current,
    workspaces,
    count: workspaces.length,
    message: 'Workspace list is scoped to the authenticated user. v0.5.3 does not allow frontend-chosen workspace access without membership.',
  };
}
