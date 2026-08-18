import { isDatabaseConfigured, pool, query } from '../../db/pool.js';

export type MembershipRow = {
  membership_id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  membership_status: string;
  user_email: string;
  user_full_name: string | null;
  user_status: string;
  joined_at: Date;
};

export type UserLiteRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
};

export async function getActiveMembership(workspaceId: string, userId: string): Promise<MembershipRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<MembershipRow>(
    `SELECT
       wm.id AS membership_id,
       wm.workspace_id,
       wm.user_id,
       wm.role,
       COALESCE(wm.status, 'active') AS membership_status,
       u.email AS user_email,
       u.full_name AS user_full_name,
       u.status AS user_status,
       wm.created_at AS joined_at
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
       AND wm.user_id = $2
       AND COALESCE(wm.status, 'active') = 'active'
     LIMIT 1;`,
    [workspaceId, userId]
  );

  return result.rows[0] ?? null;
}

export async function listWorkspaceTeamMembers(workspaceId: string): Promise<MembershipRow[]> {
  if (!isDatabaseConfigured) return [];

  const result = await query<MembershipRow>(
    `SELECT
       wm.id AS membership_id,
       wm.workspace_id,
       wm.user_id,
       wm.role,
       COALESCE(wm.status, 'active') AS membership_status,
       u.email AS user_email,
       u.full_name AS user_full_name,
       u.status AS user_status,
       wm.created_at AS joined_at
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
       AND COALESCE(wm.status, 'active') <> 'removed'
     ORDER BY
       CASE wm.role
         WHEN 'owner' THEN 0
         WHEN 'admin' THEN 1
         WHEN 'member' THEN 2
         WHEN 'viewer' THEN 3
         ELSE 4
       END ASC,
       wm.created_at ASC;`,
    [workspaceId]
  );

  return result.rows;
}

export async function findUserLiteByEmail(email: string): Promise<UserLiteRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<UserLiteRow>(
    `SELECT id, email, full_name, status
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1;`,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function createInvitedUser(email: string, fullName: string | null): Promise<UserLiteRow> {
  const result = await query<UserLiteRow>(
    `INSERT INTO users (email, full_name, password_hash, role, status)
     VALUES (LOWER($1), $2, NULL, 'customer', 'invited')
     RETURNING id, email, full_name, status;`,
    [email, fullName]
  );

  return result.rows[0];
}

export async function addWorkspaceMember(params: {
  workspaceId: string;
  userId: string;
  role: string;
}): Promise<MembershipRow> {
  const result = await query<MembershipRow>(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, status = 'active'
     RETURNING
       id AS membership_id,
       workspace_id,
       user_id,
       role,
       COALESCE(status, 'active') AS membership_status,
       (SELECT email FROM users WHERE id = workspace_members.user_id) AS user_email,
       (SELECT full_name FROM users WHERE id = workspace_members.user_id) AS user_full_name,
       (SELECT status FROM users WHERE id = workspace_members.user_id) AS user_status,
       created_at AS joined_at;`,
    [params.workspaceId, params.userId, params.role]
  );

  return result.rows[0];
}

export async function getMembershipById(workspaceId: string, membershipId: string): Promise<MembershipRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<MembershipRow>(
    `SELECT
       wm.id AS membership_id,
       wm.workspace_id,
       wm.user_id,
       wm.role,
       COALESCE(wm.status, 'active') AS membership_status,
       u.email AS user_email,
       u.full_name AS user_full_name,
       u.status AS user_status,
       wm.created_at AS joined_at
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
       AND wm.id = $2
     LIMIT 1;`,
    [workspaceId, membershipId]
  );

  return result.rows[0] ?? null;
}

export async function updateMembershipRole(workspaceId: string, membershipId: string, role: string): Promise<MembershipRow | null> {
  const result = await query<MembershipRow>(
    `UPDATE workspace_members
     SET role = $3, status = 'active'
     WHERE workspace_id = $1 AND id = $2
     RETURNING
       id AS membership_id,
       workspace_id,
       user_id,
       role,
       COALESCE(status, 'active') AS membership_status,
       (SELECT email FROM users WHERE id = workspace_members.user_id) AS user_email,
       (SELECT full_name FROM users WHERE id = workspace_members.user_id) AS user_full_name,
       (SELECT status FROM users WHERE id = workspace_members.user_id) AS user_status,
       created_at AS joined_at;`,
    [workspaceId, membershipId, role]
  );

  return result.rows[0] ?? null;
}

export async function markMembershipRemoved(workspaceId: string, membershipId: string): Promise<MembershipRow | null> {
  const result = await query<MembershipRow>(
    `UPDATE workspace_members
     SET status = 'removed'
     WHERE workspace_id = $1 AND id = $2
     RETURNING
       id AS membership_id,
       workspace_id,
       user_id,
       role,
       COALESCE(status, 'active') AS membership_status,
       (SELECT email FROM users WHERE id = workspace_members.user_id) AS user_email,
       (SELECT full_name FROM users WHERE id = workspace_members.user_id) AS user_full_name,
       (SELECT status FROM users WHERE id = workspace_members.user_id) AS user_status,
       created_at AS joined_at;`,
    [workspaceId, membershipId]
  );

  return result.rows[0] ?? null;
}

export async function countActiveOwners(workspaceId: string): Promise<number> {
  if (!isDatabaseConfigured) return 0;
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM workspace_members
     WHERE workspace_id = $1
       AND role = 'owner'
       AND COALESCE(status, 'active') = 'active';`,
    [workspaceId]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function recordTeamEvent(params: {
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
    [params.workspaceId, params.eventType, params.message, JSON.stringify({ userId: params.userId, version: '0.5.3', ...(params.metadata || {}) })]
  );
}

export async function withTeamTransaction<T>(runner: () => Promise<T>): Promise<T> {
  // Current v0.5.3 team operations use single statements. Kept for future invite/email workflows.
  if (!pool) return runner();
  return runner();
}
