export type MigrationSafetyRule = {
  key: string;
  label: string;
  required: boolean;
  reason: string;
};

export const SAFE_MIGRATION_PHASE = {
  version: '0.6.0',
  phase: '2.9',
  name: 'Safe Migration Strategy',
  databaseChange: 'none',
  nextMigrationNumber: '013',
} as const;

export const ALLOWED_ADDITIVE_MIGRATION_PATTERNS = [
  'CREATE TABLE IF NOT EXISTS',
  'ADD COLUMN IF NOT EXISTS',
  'CREATE INDEX IF NOT EXISTS',
  'CREATE UNIQUE INDEX IF NOT EXISTS where safe',
  'nullable columns first',
  'workspace_id on customer/business data tables',
] as const;

export const FORBIDDEN_DESTRUCTIVE_MIGRATION_PATTERNS = [
  'DROP TABLE',
  'DROP COLUMN',
  'RENAME TABLE',
  'RENAME COLUMN',
  'DELETE production data',
  'TRUNCATE production tables',
  'ALTER COLUMN TYPE on production data without approval',
  'casual APP_ENCRYPTION_KEY rotation',
] as const;

export const MIGRATION_PRECHECK_RULES: MigrationSafetyRule[] = [
  {
    key: 'additive_only',
    label: 'Migration is additive only by default',
    required: true,
    reason: 'Protects V1 advisor mode and existing customer/workspace data.',
  },
  {
    key: 'no_v1_drop',
    label: 'No V1 tables are dropped or broken',
    required: true,
    reason: 'V2 is built on V1, not a rewrite.',
  },
  {
    key: 'workspace_scoped',
    label: 'Customer/business tables include workspace_id',
    required: true,
    reason: 'Protects tenant/workspace isolation for V2 and future SaaS use.',
  },
  {
    key: 'backup_before_production',
    label: 'Production backup exists before migration',
    required: true,
    reason: 'Allows recovery if a production migration has unexpected impact.',
  },
  {
    key: 'no_secret_mutation',
    label: 'No secrets are inserted, logged, or rotated casually',
    required: true,
    reason: 'Protects Claude, Triple Whale, database, auth, encryption, and worker secrets.',
  },
];
