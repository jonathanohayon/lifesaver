import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADS_ACTION_TYPES_HEALTH_MODE,
  ADS_ACTION_TYPES_PACKAGE,
  ADS_ACTION_TYPES_PHASE,
  ADS_ACTION_TYPE_REGISTRY,
  assertAdsActionTypesSafe,
  buildAdsActionCategories,
  buildAdsActionSharedSafetyGates,
  buildAdsActionTaxonomyReport,
  buildAdsActionTypeDefinitions,
  buildAdsActionTypesStatus,
} from './ads-action-types.model.js';
import type { AdsActionType } from './ads-action-types.types.js';

const EXPECTED_ACTION_TYPES: AdsActionType[] = [
  'pause_campaign',
  'pause_adset',
  'adjust_budget',
  'restore_budget',
  'reenable_campaign',
];

test('Phase 14.3 constants are correct', () => {
  assert.equal(ADS_ACTION_TYPES_PHASE, 'phase_14_3_ads_action_types');
  assert.equal(ADS_ACTION_TYPES_HEALTH_MODE, 'v2-phase-14-3-ads-action-types');
  assert.equal(ADS_ACTION_TYPES_PACKAGE, 'lifesaver-v0.7.0-phase-14-3-ads-action-types.zip');
});

test('ads action type registry includes exactly the roadmap initial action types', () => {
  assert.deepEqual([...ADS_ACTION_TYPE_REGISTRY].sort(), [...EXPECTED_ACTION_TYPES].sort());
});

test('taxonomy definitions exist for every registered action type', () => {
  const definitions = buildAdsActionTypeDefinitions();
  assert.equal(definitions.length, EXPECTED_ACTION_TYPES.length);
  assert.deepEqual(definitions.map((item) => item.actionType).sort(), [...EXPECTED_ACTION_TYPES].sort());
});

test('taxonomy keeps all actions manual-approval-only for first release', () => {
  const definitions = buildAdsActionTypeDefinitions();
  assert.equal(definitions.every((item) => item.approvalMode === 'manual_approval_required_first_release'), true);
  assert.equal(definitions.every((item) => item.requiredSafetyGates.some((gate) => gate.toLowerCase().includes('manual approval'))), true);
});

test('budget mutation and restore actions are risk classified', () => {
  const definitions = buildAdsActionTypeDefinitions();
  const adjustBudget = definitions.find((item) => item.actionType === 'adjust_budget');
  const restoreBudget = definitions.find((item) => item.actionType === 'restore_budget');
  assert.equal(adjustBudget?.initialRiskLevel, 'critical');
  assert.equal(restoreBudget?.initialRiskLevel, 'high');
  assert.equal(adjustBudget?.plannedPayloadFields.includes('proposed_budget'), true);
  assert.equal(restoreBudget?.plannedPayloadFields.includes('previous_budget'), true);
});

test('categories cover status, budget, and restore control', () => {
  assert.deepEqual(buildAdsActionCategories().sort(), ['budget_control', 'restore_control', 'status_control'].sort());
});

test('shared gates require pause, caps, snapshots, idempotency, result logs, and rollback planning', () => {
  const gates = buildAdsActionSharedSafetyGates().join(' ').toLowerCase();
  assert.match(gates, /master pause/);
  assert.match(gates, /ads category pause/);
  assert.match(gates, /emergency safe mode/);
  assert.match(gates, /hard caps/);
  assert.match(gates, /before\/after snapshots/);
  assert.match(gates, /idempotency/);
  assert.match(gates, /result logs/);
  assert.match(gates, /rollback/);
});

test('report is taxonomy-only and adds no external ads behavior', () => {
  const report = buildAdsActionTaxonomyReport();
  assert.equal(report.deliverable, 'ads_action_taxonomy');
  assert.equal(report.taxonomyOnly, true);
  assert.equal(report.safety.noExecutorAdded, true);
  assert.equal(report.safety.noAdApiClientAdded, true);
  assert.equal(report.safety.noOAuthRouteAdded, true);
  assert.equal(report.safety.noTokenStorageAdded, true);
  assert.equal(report.safety.noWriteScopeRequested, true);
  assert.equal(report.safety.noCampaignPaused, true);
  assert.equal(report.safety.noAdsetPaused, true);
  assert.equal(report.safety.noBudgetChanged, true);
  assert.equal(report.safety.noBudgetRestored, true);
  assert.equal(report.safety.noCampaignReenabled, true);
  assert.equal(report.safety.noAdsAutoRunEnabled, true);
  assert.equal(report.safety.noExternalAdApiCalled, true);
  assert.equal(report.safety.noDatabaseMigrationRequired, true);
});

test('status is concise and safe', () => {
  const status = buildAdsActionTypesStatus();
  assert.equal(status.healthMode, ADS_ACTION_TYPES_HEALTH_MODE);
  assert.equal(status.deliverable, 'ads_action_taxonomy');
  assert.deepEqual([...status.actionTypes].sort(), [...EXPECTED_ACTION_TYPES].sort());
  assert.equal(status.executorAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.doesNotThrow(() => assertAdsActionTypesSafe(status));
});

test('full taxonomy output has no secret-like output', () => {
  const report = buildAdsActionTaxonomyReport();
  assert.doesNotThrow(() => assertAdsActionTypesSafe(report));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsActionTaxonomyReport() as any;
  report.accidental = 'refresh_token: abc123';
  assert.throws(() => assertAdsActionTypesSafe(report), /forbidden fragment/);
});
