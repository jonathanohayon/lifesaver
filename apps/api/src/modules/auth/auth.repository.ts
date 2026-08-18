import { isDatabaseConfigured, pool, query } from '../../db/pool.js';

export type AuthUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string | null;
  role: string;
  status: string;
};

export type AuthWorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  plan_key: string;
  member_role: string;
  onboarding_status?: string | null;
  onboarding_completed_at?: Date | null;
};

export async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<AuthUserRow>(
    `SELECT id, email, full_name, password_hash, role, status
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1;`,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function findPrimaryWorkspaceForUser(userId: string): Promise<AuthWorkspaceRow | null> {
  if (!isDatabaseConfigured) return null;

  const result = await query<AuthWorkspaceRow>(
    `SELECT
       w.id,
       w.name,
       w.slug,
       w.status,
       w.plan_key,
       wm.role AS member_role,
       w.onboarding_status,
       w.onboarding_completed_at
     FROM workspace_members wm
     INNER JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1
       AND COALESCE(wm.status, 'active') = 'active'
     ORDER BY
       CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END ASC,
       w.created_at ASC
     LIMIT 1;`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function recordLoginEvent(workspaceId: string, userId: string, email: string): Promise<void> {
  if (!isDatabaseConfigured) return;

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, 'founder_login_success', 'info', $2, $3::jsonb);`,
    [
      workspaceId,
      `Founder/super-admin login succeeded for ${email}.`,
      JSON.stringify({ userId, source: 'auth.login', version: '0.3.0' }),
    ]
  );
}


export type SignupAccountParams = {
  email: string;
  fullName: string;
  passwordHash: string;
  workspaceName: string;
  workspaceSlug: string;
};

export async function emailExists(email: string): Promise<boolean> {
  if (!isDatabaseConfigured) return false;
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)) AS exists;`,
    [email]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function workspaceSlugExists(slug: string): Promise<boolean> {
  if (!isDatabaseConfigured) return false;
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM workspaces WHERE slug = $1) AS exists;`,
    [slug]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function createSignupAccount(params: SignupAccountParams): Promise<{ user: AuthUserRow; workspace: AuthWorkspaceRow }> {
  if (!isDatabaseConfigured || !pool) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query<AuthUserRow>(
      `INSERT INTO users (email, full_name, password_hash, role, status)
       VALUES (LOWER($1), $2, $3, 'customer', 'active')
       RETURNING id, email, full_name, password_hash, role, status;`,
      [params.email, params.fullName, params.passwordHash]
    );

    const user = userResult.rows[0];

    const workspaceResult = await client.query<AuthWorkspaceRow>(
      `INSERT INTO workspaces (name, slug, owner_user_id, status, plan_key, onboarding_status, onboarding_metadata)
       VALUES ($1, $2, $3, 'active', 'trial_founder', 'needs_connection', $4::jsonb)
       RETURNING id, name, slug, status, plan_key, 'owner'::text AS member_role, onboarding_status, onboarding_completed_at;`,
      [
        params.workspaceName,
        params.workspaceSlug,
        user.id,
        JSON.stringify({ source: 'self_service_signup', version: '0.5.3', createdAt: new Date().toISOString() }),
      ]
    );

    const workspace = workspaceResult.rows[0];

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET role = 'owner', status = 'active';`,
      [workspace.id, user.id]
    );

    await client.query(
      `INSERT INTO connected_accounts (workspace_id, provider, encrypted_api_key, key_hint, status, metadata)
       VALUES ($1, 'triple_whale', NULL, NULL, 'disconnected', $2::jsonb)
       ON CONFLICT (workspace_id, provider) DO NOTHING;`,
      [workspace.id, JSON.stringify({ seeded: true, source: 'signup_onboarding', version: '0.5.3' })]
    );

    await client.query(
      `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
       VALUES ($1, 'saas_signup_workspace_created', 'info', $2, $3::jsonb);`,
      [
        workspace.id,
        `New LIFE.SAVER workspace created for ${user.email}.`,
        JSON.stringify({ userId: user.id, workspaceSlug: workspace.slug, version: '0.5.3', safetyMode: 'read_advise_draft_only' }),
      ]
    );

    await client.query('COMMIT');
    return { user, workspace };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
