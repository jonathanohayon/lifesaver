import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildAdsBudgetChangeExamplePayload } from './ads-budget-change-payload.model.js';
import {
  ADS_HARD_CAPS_HEALTH_MODE,
  ADS_HARD_CAPS_MIGRATION,
  ADS_HARD_CAPS_PACKAGE,
  ADS_HARD_CAPS_PHASE,
  ADS_HARD_CAP_KEYS,
  assertAdsHardCapsSafe,
  buildAdsHardCapsExample,
  buildAdsHardCapsExampleUsage,
  buildAdsHardCapsFieldSpecs,
  buildAdsHardCapsSafetyGates,
  buildAdsHardCapsStatus,
  buildAdsHardCapsStorageReport,
  evaluateAdsHardCaps,
} from './ads-hard-caps.model.js';

const EXPECTED_CAP_KEYS = [
  'max_daily_budget_change',
  'max_percentage_change',
  'max_changes_per_day',
  'always_ask_above_threshold',
  'emergency_never_exceed_limit',
];

test('Phase 14.5 constants are correct', () => {
  assert.equal(ADS_HARD_CAPS_PHASE, 'phase_14_5_hard_caps_table');
  assert.equal(ADS_HARD_CAPS_HEALTH_MODE, 'v2-phase-14-5-hard-caps-table');
  assert.equal(ADS_HARD_CAPS_PACKAGE, 'lifesaver-v0.7.0-phase-14-5-hard-caps-table.zip');
  assert.equal(ADS_HARD_CAPS_MIGRATION, '022_create_ads_hard_caps.sql');
});

test('hard cap keys match roadmap requirements', () => {
  assert.deepEqual([...ADS_HARD_CAP_KEYS].sort(), [...EXPECTED_CAP_KEYS].sort());
  const specFields = buildAdsHardCapsFieldSpecs().map((item) => item.field);
  for (const key of EXPECTED_CAP_KEYS) {
    assert.ok(specFields.includes(key as never), `${key} missing from field specs`);
  }
});

test('migration creates additive ads_hard_caps storage with required columns and safety comments', () => {
  const migrationPath = join(process.cwd(), '..', '..', 'database', 'migrations', ADS_HARD_CAPS_MIGRATION);
  const sql = readFileSync(migrationPath, 'utf8');
  const requiredSnippets = [
    'CREATE TABLE IF NOT EXISTS ads_hard_caps',
    'workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE',
    'platform TEXT NOT NULL DEFAULT',
    'account_id TEXT',
    'currency TEXT NOT NULL DEFAULT',
    'max_daily_budget_change NUMERIC(12,2) NOT NULL DEFAULT 0',
    'max_percentage_change NUMERIC(6,2) NOT NULL DEFAULT 0',
    'max_changes_per_day INTEGER NOT NULL DEFAULT 0',
    'always_ask_above_threshold NUMERIC(12,2) NOT NULL DEFAULT 0',
    'emergency_never_exceed_limit NUMERIC(12,2) NOT NULL DEFAULT 0',
    'enabled BOOLEAN NOT NULL DEFAULT TRUE',
    'idx_ads_hard_caps_workspace_platform_enabled',
    'does not execute, pause campaigns, change budgets, restore budgets, call ad APIs, or enable ads auto-run',
  ];
  for (const snippet of requiredSnippets) {
    assert.ok(sql.includes(snippet), `Missing migration snippet: ${snippet}`);
  }

  const forbiddenSnippets = ['DROP TABLE', 'DROP COLUMN', 'TRUNCATE', 'DELETE FROM', 'ALTER TABLE actions DROP', 'ALTER TABLE policies DROP'];
  for (const snippet of forbiddenSnippets) {
    assert.equal(sql.toUpperCase().includes(snippet.toUpperCase()), false, `Forbidden destructive SQL found: ${snippet}`);
  }
});

test('example caps and budget payload evaluate as allowed manual review', () => {
  const result = evaluateAdsHardCaps({
    caps: buildAdsHardCapsExample(),
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: buildAdsBudgetChangeExamplePayload(),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.manualApprovalRequired, true);
  assert.equal(result.decision, 'allowed_manual_review');
  assert.equal(result.computed.projectedDailyBudgetChange, 30);
  assert.equal(result.computed.projectedChangesToday, 2);
  assert.equal(result.safety.noExternalAdApiCalled, true);
});

test('daily budget cap blocks projected over-limit change', () => {
  const result = evaluateAdsHardCaps({
    caps: buildAdsHardCapsExample(),
    usage: { daily_budget_change_used: 95, changes_today: 1 },
    budgetPayload: buildAdsBudgetChangeExamplePayload(),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.ok(result.checks.find((item) => item.capKey === 'max_daily_budget_change')?.exceeded);
});

test('percentage cap blocks oversized percentage change', () => {
  const payload = {
    ...buildAdsBudgetChangeExamplePayload(),
    current_budget: 100,
    proposed_budget: 130,
    delta: 30,
    percentage_change: 30,
  };
  const result = evaluateAdsHardCaps({
    caps: buildAdsHardCapsExample(),
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: payload,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.ok(result.checks.find((item) => item.capKey === 'max_percentage_change')?.exceeded);
});

test('changes-per-day cap blocks excessive daily change count', () => {
  const result = evaluateAdsHardCaps({
    caps: buildAdsHardCapsExample(),
    usage: { daily_budget_change_used: 0, changes_today: 3 },
    budgetPayload: buildAdsBudgetChangeExamplePayload(),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.ok(result.checks.find((item) => item.capKey === 'max_changes_per_day')?.exceeded);
});

test('always-ask threshold is explanatory and never grants auto-approval', () => {
  const caps = { ...buildAdsHardCapsExample(), always_ask_above_threshold: 5 };
  const result = evaluateAdsHardCaps({
    caps,
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: buildAdsBudgetChangeExamplePayload(),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.decision, 'always_ask_required');
  assert.equal(result.manualApprovalRequired, true);
  assert.equal(result.computed.alwaysAskTriggered, true);
  assert.ok(result.checks.find((item) => item.capKey === 'always_ask_above_threshold')?.alwaysAskTriggered);
});

test('emergency never-exceed limit blocks proposed budget above emergency limit', () => {
  const caps = { ...buildAdsHardCapsExample(), emergency_never_exceed_limit: 105 };
  const result = evaluateAdsHardCaps({
    caps,
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: buildAdsBudgetChangeExamplePayload(),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.equal(result.computed.emergencyLimitExceeded, true);
});

test('invalid budget payload fails closed', () => {
  const result = evaluateAdsHardCaps({
    caps: buildAdsHardCapsExample(),
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: { platform: 'triple_whale' },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'invalid_budget_payload_preview');
  assert.match(result.issues.join(' '), /budgetPayload/);
});

test('storage report is safe and adds no ads execution behavior', () => {
  const report = buildAdsHardCapsStorageReport();
  assert.equal(report.deliverable, 'ads_hard_caps_storage');
  assert.equal(report.storageOnly, true);
  assert.equal(report.tableName, 'ads_hard_caps');
  assert.equal(report.safety.databaseMigrationAdded, true);
  assert.equal(report.safety.noAdsExecutorAdded, true);
  assert.equal(report.safety.noMetaAdsApiClientAdded, true);
  assert.equal(report.safety.noGoogleAdsApiClientAdded, true);
  assert.equal(report.safety.noAdOAuthRouteAdded, true);
  assert.equal(report.safety.noAdTokenStorageAdded, true);
  assert.equal(report.safety.noCampaignPaused, true);
  assert.equal(report.safety.noBudgetChanged, true);
  assert.equal(report.safety.noAdsAutoRunEnabled, true);
  assert.equal(report.safety.noExternalAdApiCalled, true);
  assert.doesNotThrow(() => assertAdsHardCapsSafe(report));
});

test('safety gates include pause, manual approval, emergency, snapshots, idempotency, result logs, and rollback', () => {
  const gates = buildAdsHardCapsSafetyGates().join(' ').toLowerCase();
  assert.match(gates, /manual approval/);
  assert.match(gates, /master pause/);
  assert.match(gates, /ads category pause/);
  assert.match(gates, /emergency safe mode/);
  assert.match(gates, /before\/after snapshots/);
  assert.match(gates, /idempotency/);
  assert.match(gates, /result logs/);
  assert.match(gates, /rollback/);
});

test('status is concise and safe', () => {
  const status = buildAdsHardCapsStatus();
  assert.equal(status.healthMode, ADS_HARD_CAPS_HEALTH_MODE);
  assert.equal(status.deliverable, 'ads_hard_caps_storage');
  assert.equal(status.budgetChanged, false);
  assert.equal(status.adsExecutorAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.deepEqual([...status.capKeys].sort(), [...EXPECTED_CAP_KEYS].sort());
  assert.doesNotThrow(() => assertAdsHardCapsSafe(status));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsHardCapsStorageReport() as any;
  report.accidental = 'refresh_token: secret';
  assert.throws(() => assertAdsHardCapsSafe(report), /forbidden fragment/);
});
