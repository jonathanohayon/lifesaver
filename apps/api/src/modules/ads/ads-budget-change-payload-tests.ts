import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE,
  ADS_BUDGET_CHANGE_PAYLOAD_PACKAGE,
  ADS_BUDGET_CHANGE_PAYLOAD_PHASE,
  ADS_BUDGET_CHANGE_REQUIRED_FIELDS,
  assertAdsBudgetChangePayloadSafe,
  buildAdsBudgetChangeExamplePayload,
  buildAdsBudgetChangeFieldSpecs,
  buildAdsBudgetChangePayloadSchemaReport,
  buildAdsBudgetChangePayloadStatus,
  buildAdsBudgetChangeSafetyGates,
  computeAdsBudgetDelta,
  computeAdsBudgetPercentageChange,
  recommendAdsBudgetRiskLevel,
  validateAdsBudgetChangePayload,
} from './ads-budget-change-payload.model.js';
import type { AdsBudgetChangePayloadInput } from './ads-budget-change-payload.types.js';

const EXPECTED_REQUIRED_FIELDS: Array<keyof AdsBudgetChangePayloadInput> = [
  'platform',
  'account_id',
  'campaign_id',
  'adset_id',
  'current_budget',
  'proposed_budget',
  'delta',
  'percentage_change',
  'reason',
  'risk_level',
];

test('Phase 14.4 constants are correct', () => {
  assert.equal(ADS_BUDGET_CHANGE_PAYLOAD_PHASE, 'phase_14_4_budget_change_payload');
  assert.equal(ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE, 'v2-phase-14-4-budget-change-payload');
  assert.equal(ADS_BUDGET_CHANGE_PAYLOAD_PACKAGE, 'lifesaver-v0.7.0-phase-14-4-budget-change-payload.zip');
});

test('budget-change payload includes exactly the roadmap required fields', () => {
  assert.deepEqual([...ADS_BUDGET_CHANGE_REQUIRED_FIELDS].sort(), [...EXPECTED_REQUIRED_FIELDS].sort());
  const specFields = buildAdsBudgetChangeFieldSpecs().map((item) => item.field);
  assert.deepEqual([...specFields].sort(), [...EXPECTED_REQUIRED_FIELDS].sort());
});

test('budget math helpers compute delta and percentage change', () => {
  assert.equal(computeAdsBudgetDelta(100, 125), 25);
  assert.equal(computeAdsBudgetPercentageChange(100, 125), 25);
  assert.equal(computeAdsBudgetPercentageChange(0, 125), null);
});

test('risk recommendation treats budget increases as critical and decreases as at least high', () => {
  assert.equal(recommendAdsBudgetRiskLevel(100, 110), 'critical');
  assert.equal(recommendAdsBudgetRiskLevel(100, 95), 'high');
  assert.equal(recommendAdsBudgetRiskLevel(100, 70), 'critical');
});

test('example payload validates and remains manual-approval-only', () => {
  const example = buildAdsBudgetChangeExamplePayload();
  const result = validateAdsBudgetChangePayload(example);
  assert.equal(result.valid, true);
  assert.equal(result.normalizedPayload?.manual_approval_required, true);
  assert.equal(result.normalizedPayload?.hard_caps_required_before_execution, true);
  assert.equal(result.normalizedPayload?.external_ad_api_called, false);
  assert.equal(result.computed.expected_delta, 10);
  assert.equal(result.computed.expected_percentage_change, 10);
});

test('validator rejects missing required fields', () => {
  const result = validateAdsBudgetChangePayload({ platform: 'meta_marketing_api' });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(' '), /Missing required field: account_id/);
  assert.match(result.issues.join(' '), /Missing required field: proposed_budget/);
});

test('validator rejects mismatched delta and percentage change', () => {
  const payload = {
    ...buildAdsBudgetChangeExamplePayload(),
    delta: 999,
    percentage_change: 999,
  };
  const result = validateAdsBudgetChangePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(' '), /delta must match/);
  assert.match(result.issues.join(' '), /percentage_change must match/);
});

test('validator rejects unsupported platforms and low risk classification', () => {
  const payload = {
    ...buildAdsBudgetChangeExamplePayload(),
    platform: 'triple_whale',
    risk_level: 'medium',
  };
  const result = validateAdsBudgetChangePayload(payload);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(' '), /platform must be/);
  assert.match(result.issues.join(' '), /risk_level is too low/);
});

test('schema report is schema-only and adds no ads execution behavior', () => {
  const report = buildAdsBudgetChangePayloadSchemaReport();
  assert.equal(report.deliverable, 'ads_payload_schema');
  assert.equal(report.schemaOnly, true);
  assert.equal(report.actionType, 'adjust_budget');
  assert.equal(report.safety.noAdsExecutorAdded, true);
  assert.equal(report.safety.noMetaAdsApiClientAdded, true);
  assert.equal(report.safety.noGoogleAdsApiClientAdded, true);
  assert.equal(report.safety.noAdOAuthRouteAdded, true);
  assert.equal(report.safety.noAdTokenStorageAdded, true);
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

test('safety gates require manual approval, pause, caps, snapshots, idempotency, logs, and rollback planning', () => {
  const gates = buildAdsBudgetChangeSafetyGates().join(' ').toLowerCase();
  assert.match(gates, /manual approval/);
  assert.match(gates, /master pause/);
  assert.match(gates, /ads category pause/);
  assert.match(gates, /emergency safe mode/);
  assert.match(gates, /hard caps/);
  assert.match(gates, /before\/after snapshot/);
  assert.match(gates, /idempotency/);
  assert.match(gates, /result logs/);
  assert.match(gates, /rollback/);
});

test('status is concise and safe', () => {
  const status = buildAdsBudgetChangePayloadStatus();
  assert.equal(status.healthMode, ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE);
  assert.equal(status.deliverable, 'ads_payload_schema');
  assert.deepEqual([...status.requiredFields].sort(), [...EXPECTED_REQUIRED_FIELDS].sort());
  assert.equal(status.budgetChanged, false);
  assert.equal(status.adsExecutorAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.doesNotThrow(() => assertAdsBudgetChangePayloadSafe(status));
});

test('full schema output has no secret-like output', () => {
  const report = buildAdsBudgetChangePayloadSchemaReport();
  assert.doesNotThrow(() => assertAdsBudgetChangePayloadSafe(report));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsBudgetChangePayloadSchemaReport() as any;
  report.accidental = 'client_secret: abc123';
  assert.throws(() => assertAdsBudgetChangePayloadSafe(report), /forbidden fragment/);
});
