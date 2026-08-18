import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(process.cwd(), '..', '..', 'database', 'migrations', '015_create_policies_table.sql');
const sql = readFileSync(migrationPath, 'utf8');

const requiredSnippets = [
  'CREATE TABLE IF NOT EXISTS policies',
  'workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE',
  'name TEXT NOT NULL',
  'action_type TEXT NOT NULL',
  'conditions_json JSONB NOT NULL DEFAULT',
  'decision TEXT NOT NULL DEFAULT',
  'caps_json JSONB NOT NULL DEFAULT',
  'priority INTEGER NOT NULL DEFAULT',
  'enabled BOOLEAN NOT NULL DEFAULT TRUE',
  'created_by UUID REFERENCES users(id) ON DELETE SET NULL',
  'updated_by UUID REFERENCES users(id) ON DELETE SET NULL',
  "decision IN ('ask', 'auto_approve', 'block')",
  'jsonb_typeof(conditions_json) =',
  'jsonb_typeof(caps_json) =',
  'idx_policies_workspace_action_enabled_priority',
  'does not evaluate, auto-approve, queue, execute, publish, send, change ads, or write to external systems',
];

const assertions = requiredSnippets.map((snippet) => ({
  name: snippet.length > 64 ? `${snippet.slice(0, 61)}...` : snippet,
  pass: sql.includes(snippet),
}));

const forbiddenSnippets = [
  'DROP TABLE',
  'DROP COLUMN',
  'TRUNCATE',
  'DELETE FROM actions',
  'DELETE FROM policies',
  'ALTER TABLE actions DROP',
  'ALTER TABLE workspaces DROP',
];

const forbiddenAssertions = forbiddenSnippets.map((snippet) => ({
  name: `forbidden_${snippet.replace(/\s+/g, '_').toLowerCase()}`,
  pass: !sql.toUpperCase().includes(snippet.toUpperCase()),
}));

const allAssertions = [...assertions, ...forbiddenAssertions];
const failed = allAssertions.filter((item) => !item.pass);

const payload = {
  version: '0.6.0',
  phase: 'V2 Phase 6.1 Policy Table Schema',
  success: failed.length === 0,
  passed: allAssertions.length - failed.length,
  failed: failed.length,
  assertions: allAssertions,
  migration: '015_create_policies_table.sql',
  safety: {
    storageOnly: true,
    evaluatorAdded: false,
    autoApprovalEnabled: false,
    executorEnabled: false,
    externalWritesEnabled: false,
    destructiveStatementsDetected: forbiddenAssertions.some((item) => !item.pass),
  },
  note: 'This test validates the policy table migration shape only. It does not run db:migrate, evaluate policies, auto-approve, execute, publish, send, or change any external platform.',
};

console.log(JSON.stringify(payload, null, 2));
if (failed.length > 0) process.exit(1);
