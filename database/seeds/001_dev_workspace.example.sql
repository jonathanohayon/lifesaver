-- Optional development seed.
-- Run manually only after migrations if you want sample workspace/user rows.
-- Do not use real customer emails or secrets in seed files.

INSERT INTO users (email, full_name, role, status)
VALUES ('founder@example.com', 'Demo Founder', 'owner', 'active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO workspaces (name, slug, owner_user_id, status, plan_key)
SELECT 'Demo LIFE.SAVER Workspace', 'demo-lifesaver-workspace', id, 'active', 'v1_founder'
FROM users
WHERE email = 'founder@example.com'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'owner'
FROM workspaces w
JOIN users u ON u.email = 'founder@example.com'
WHERE w.slug = 'demo-lifesaver-workspace'
ON CONFLICT (workspace_id, user_id) DO NOTHING;
