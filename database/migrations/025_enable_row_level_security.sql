-- LIFE.SAVER v0.8.5
-- Row Level Security foundation for the 22 application tables.
--
-- Purpose: no table in this database has RLS today. Zero ENABLE ROW LEVEL SECURITY,
-- zero CREATE POLICY. Anyone holding the Postgres connection string has read AND write
-- access to every row of users, connected_accounts, content_connector_credentials and
-- support_tickets. This migration installs the workspace isolation layer.
--
-- Safety: this migration is deliberately NON-BREAKING on its own.
--   * ENABLE ROW LEVEL SECURITY does NOT apply to the table owner, and never applies to a
--     superuser or to a role with BYPASSRLS. If the application connects with the role that
--     owns these tables (the usual case on Supabase/Render single-role setups), applying this
--     file changes nothing at runtime: the policies exist but the owner still sees everything.
--   * The protective half is FORCE ROW LEVEL SECURITY, which is deliberately NOT in this file.
--     It lives in database/migrations/manual/force_row_level_security.sql, outside the
--     migration runner's glob, because forcing RLS on a live database with an application that
--     does not yet set app.workspace_id returns zero rows for every query, instantly.
--
-- Cutover order is documented in database/migrations/manual/force_row_level_security.sql.
--
-- Tenant context: the application must set two session GUCs per request/transaction:
--     SET LOCAL app.workspace_id = '<uuid>';
--     SET LOCAL app.user_id      = '<uuid>';
-- Unset context means "no rows". Fail closed, never fail open.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Tenant context helpers
-- ---------------------------------------------------------------------------------------------
-- current_setting(..., true) returns NULL when the GUC was never set and '' when it was set to
-- an empty string. Both must resolve to NULL, never to an error and never to a wildcard.
-- SECURITY INVOKER (the default) is required here: a SECURITY DEFINER helper would run as the
-- owner and could be used to sidestep the very policies it feeds.

CREATE OR REPLACE FUNCTION app_current_workspace_id() RETURNS UUID
  LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID
  LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

COMMENT ON FUNCTION app_current_workspace_id() IS
  'Current workspace from the app.workspace_id session GUC. Returns NULL when unset, which makes every workspace-scoped policy deny.';

COMMENT ON FUNCTION app_current_user_id() IS
  'Current authenticated user from the app.user_id session GUC. Returns NULL when unset, which makes every user-scoped policy deny.';

-- ---------------------------------------------------------------------------------------------
-- Identity tables without a workspace_id column
-- ---------------------------------------------------------------------------------------------
-- Rule applied: these two tables are the graph that defines tenancy, so they cannot be scoped by
-- a workspace_id they do not have. They are scoped by membership instead:
--   workspaces        -> the current workspace, plus every workspace the current user belongs to
--                        (needed for a workspace switcher).
--   workspace_members -> rows of the current workspace, plus the current user's own memberships.
--   users             -> the current user, plus users who share the current workspace.
-- Writes are strictly narrower than reads on purpose: a request may read its colleagues but may
-- only write its own user row and may only write memberships inside the current workspace.

ALTER TABLE IF EXISTS workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspaces_membership_isolation ON workspaces;
CREATE POLICY workspaces_membership_isolation ON workspaces
  FOR ALL
  USING (
    id = app_current_workspace_id()
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = workspaces.id
        AND m.user_id = app_current_user_id()
    )
  )
  WITH CHECK (id = app_current_workspace_id());

COMMENT ON POLICY workspaces_membership_isolation ON workspaces IS
  'Read: the current workspace or any workspace the current user is a member of. Write: the current workspace only. Workspace creation therefore requires a privileged path (see manual/force_row_level_security.sql).';

ALTER TABLE IF EXISTS workspace_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_members_isolation ON workspace_members;
CREATE POLICY workspace_members_isolation ON workspace_members
  FOR ALL
  USING (
    workspace_id = app_current_workspace_id()
    OR user_id = app_current_user_id()
  )
  WITH CHECK (workspace_id = app_current_workspace_id());

COMMENT ON POLICY workspace_members_isolation ON workspace_members IS
  'Read: memberships of the current workspace plus the current user own memberships, so a workspace switcher keeps working. Write: current workspace only.';

ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self_and_workspace_isolation ON users;
CREATE POLICY users_self_and_workspace_isolation ON users
  FOR ALL
  USING (
    id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.user_id = users.id
        AND m.workspace_id = app_current_workspace_id()
    )
  )
  WITH CHECK (id = app_current_user_id());

COMMENT ON POLICY users_self_and_workspace_isolation ON users IS
  'Read: self, plus users sharing the current workspace. Write: self only. Login and signup run BEFORE app.user_id exists and are therefore not covered by this policy: they must go through a privileged auth path.';

-- ---------------------------------------------------------------------------------------------
-- Workspace-scoped tables with a NOT NULL workspace_id
-- ---------------------------------------------------------------------------------------------
-- Rule applied: strict equality on workspace_id, on both read and write. Unset context denies.

ALTER TABLE IF EXISTS connected_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connected_accounts_workspace_isolation ON connected_accounts;
CREATE POLICY connected_accounts_workspace_isolation ON connected_accounts
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS metrics_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metrics_snapshots_workspace_isolation ON metrics_snapshots;
CREATE POLICY metrics_snapshots_workspace_isolation ON metrics_snapshots
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_history_workspace_isolation ON chat_history;
CREATE POLICY chat_history_workspace_isolation ON chat_history
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS briefs_workspace_isolation ON briefs;
CREATE POLICY briefs_workspace_isolation ON briefs
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drafts_workspace_isolation ON drafts;
CREATE POLICY drafts_workspace_isolation ON drafts
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actions_workspace_isolation ON actions;
CREATE POLICY actions_workspace_isolation ON actions
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS action_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_events_workspace_isolation ON action_events;
CREATE POLICY action_events_workspace_isolation ON action_events
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS action_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_results_workspace_isolation ON action_results;
CREATE POLICY action_results_workspace_isolation ON action_results
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS autonomy_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS autonomy_settings_workspace_isolation ON autonomy_settings;
CREATE POLICY autonomy_settings_workspace_isolation ON autonomy_settings
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policies_workspace_isolation ON policies;
CREATE POLICY policies_workspace_isolation ON policies
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS content_connector_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_connector_credentials_workspace_isolation ON content_connector_credentials;
CREATE POLICY content_connector_credentials_workspace_isolation ON content_connector_credentials
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_workspace_isolation ON notification_preferences;
CREATE POLICY notification_preferences_workspace_isolation ON notification_preferences
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS notification_delivery_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_delivery_logs_workspace_isolation ON notification_delivery_logs;
CREATE POLICY notification_delivery_logs_workspace_isolation ON notification_delivery_logs
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_tickets_workspace_isolation ON support_tickets;
CREATE POLICY support_tickets_workspace_isolation ON support_tickets
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS ads_hard_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ads_hard_caps_workspace_isolation ON ads_hard_caps;
CREATE POLICY ads_hard_caps_workspace_isolation ON ads_hard_caps
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS ads_action_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ads_action_snapshots_workspace_isolation ON ads_action_snapshots;
CREATE POLICY ads_action_snapshots_workspace_isolation ON ads_action_snapshots
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

ALTER TABLE IF EXISTS memory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_items_workspace_isolation ON memory_items;
CREATE POLICY memory_items_workspace_isolation ON memory_items
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());

-- ---------------------------------------------------------------------------------------------
-- Telemetry tables with a NULLABLE workspace_id
-- ---------------------------------------------------------------------------------------------
-- Rule applied: usage_logs and system_events declare
--   workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL
-- so they legitimately hold platform-level rows with workspace_id IS NULL, and they also keep
-- orphan rows after a workspace is deleted. The read rule is strict equality, which means a NULL
-- workspace_id row is invisible to every tenant session. The write rule is intentionally wider:
-- workspace_id IS NULL is accepted so the application can keep appending platform-level
-- telemetry without a workspace context. Read narrow, write append-only.
-- Consequence to accept knowingly: platform-level telemetry becomes readable only through a
-- privileged (owner / BYPASSRLS) role. Admin dashboards that read system_events across
-- workspaces must use that path.

ALTER TABLE IF EXISTS usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_logs_workspace_isolation ON usage_logs;
CREATE POLICY usage_logs_workspace_isolation ON usage_logs
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id IS NULL OR workspace_id = app_current_workspace_id());

COMMENT ON POLICY usage_logs_workspace_isolation ON usage_logs IS
  'Read: current workspace only; platform-level rows (workspace_id IS NULL) are never tenant-readable. Write: current workspace or platform-level, so cost telemetry is never lost.';

ALTER TABLE IF EXISTS system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_events_workspace_isolation ON system_events;
CREATE POLICY system_events_workspace_isolation ON system_events
  FOR ALL
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id IS NULL OR workspace_id = app_current_workspace_id());

COMMENT ON POLICY system_events_workspace_isolation ON system_events IS
  'Read: current workspace only; platform-level rows (workspace_id IS NULL) are never tenant-readable. Write: current workspace or platform-level, so audit events are never lost.';

-- ---------------------------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------------------------
-- schema_migrations is intentionally excluded: it is infrastructure owned by the migration
-- runner (apps/api/src/db/migrate.ts), not tenant data, and locking it out would break deploys.
--
-- CREATE POLICY has no IF NOT EXISTS form in PostgreSQL. DROP POLICY IF EXISTS + CREATE POLICY
-- is the idempotent equivalent used throughout this file, and it also lets a later migration
-- refine a policy by re-running an updated definition.
--
-- RLS is orthogonal to GRANT. A non-owner application role still needs
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <role>;
-- All primary keys here are UUID defaults, so no sequence grants are required.
