import { isDatabaseConfigured, query, closeDatabasePool } from './pool.js';
import { hashPassword } from '../modules/auth/password.js';

if (!isDatabaseConfigured) {
  console.error('DATABASE_URL is not configured. Create .env first, then run npm.cmd run db:seed again.');
  process.exit(1);
}

async function ensureDefaultFounder() {
  const email = 'founder@lifesaver.local';
  const defaultPassword = 'LifeSaverDev123!';
  const passwordHash = await hashPassword(defaultPassword);

  const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1;', [email]);
  if (existing.rows[0]) {
    await query(
      `UPDATE users
       SET full_name = COALESCE(full_name, 'LIFE.SAVER Founder'),
           password_hash = $2,
           role = 'super_admin',
           status = 'active',
           updated_at = NOW()
       WHERE id = $1;`,
      [existing.rows[0].id, passwordHash]
    );
    return existing.rows[0].id;
  }

  const inserted = await query<{ id: string }>(
    `INSERT INTO users (email, full_name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id;`,
    [email, 'LIFE.SAVER Founder', passwordHash, 'super_admin', 'active']
  );

  return inserted.rows[0].id;
}

async function ensureDefaultWorkspace(ownerUserId: string) {
  const slug = 'lifesaver-dev';

  const existing = await query<{ id: string }>('SELECT id FROM workspaces WHERE slug = $1 LIMIT 1;', [slug]);
  if (existing.rows[0]) {
    await query(
      `UPDATE workspaces
       SET name = 'LIFE.SAVER Dev Workspace',
           owner_user_id = $1,
           status = 'active',
           plan_key = 'v1_founder',
           updated_at = NOW()
       WHERE id = $2;`,
      [ownerUserId, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const inserted = await query<{ id: string }>(
    `INSERT INTO workspaces (name, slug, owner_user_id, status, plan_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id;`,
    ['LIFE.SAVER Dev Workspace', slug, ownerUserId, 'active', 'v1_founder']
  );

  return inserted.rows[0].id;
}

async function ensureWorkspaceMembership(workspaceId: string, userId: string) {
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status)
     VALUES ($1, $2, 'owner', 'active')
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = 'owner', status = 'active';`,
    [workspaceId, userId]
  );
}

async function ensureTripleWhalePlaceholder(workspaceId: string) {
  await query(
    `INSERT INTO connected_accounts (workspace_id, provider, encrypted_api_key, key_hint, status, metadata)
     VALUES ($1, 'triple_whale', NULL, NULL, 'disconnected', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET
       status = connected_accounts.status,
       metadata = connected_accounts.metadata || $2::jsonb,
       updated_at = NOW();`,
    [workspaceId, JSON.stringify({ seeded: true, note: 'Placeholder connection. Real encrypted key will be stored in a later phase.' })]
  );
}

async function recordSeedEvent(workspaceId: string) {
  const exists = await query<{ id: string }>(
    `SELECT id FROM system_events
     WHERE workspace_id = $1 AND event_type = 'default_workspace_seeded'
     LIMIT 1;`,
    [workspaceId]
  );

  if (exists.rows[0]) {
    return;
  }

  await query(
    `INSERT INTO system_events (workspace_id, event_type, severity, message, metadata)
     VALUES ($1, 'default_workspace_seeded', 'info', $2, $3::jsonb);`,
    [
      workspaceId,
      'Default founder user, workspace, membership, and Triple Whale placeholder were created for local development.',
      JSON.stringify({ version: '0.5.2', source: 'db:seed', auth: 'default-dev-password-set' }),
    ]
  );
}

async function run() {
  const founderUserId = await ensureDefaultFounder();
  const workspaceId = await ensureDefaultWorkspace(founderUserId);
  await ensureWorkspaceMembership(workspaceId, founderUserId);
  await ensureTripleWhalePlaceholder(workspaceId);
  await recordSeedEvent(workspaceId);

  console.log(JSON.stringify({
    success: true,
    message: 'Default LIFE.SAVER development workspace is ready.',
    founderUserEmail: 'founder@lifesaver.local',
    founderDevPassword: 'LifeSaverDev123!',
    workspaceSlug: 'lifesaver-dev',
    workspaceId,
  }, null, 2));
}

try {
  await run();
} finally {
  await closeDatabasePool();
}
