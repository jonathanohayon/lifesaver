import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADS_ACTION_SNAPSHOTS_MIGRATION,
  ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE,
  ADS_BEFORE_AFTER_SNAPSHOT_PACKAGE,
  assertAdsBeforeAfterSnapshotSafe,
  buildAdsBeforeAfterSnapshotExampleInput,
  buildAdsBeforeAfterSnapshotReport,
  buildAdsBeforeAfterSnapshotSafety,
  buildAdsBeforeAfterSnapshotStatus,
  buildAdsSnapshotRequiredBeforeExecutionFields,
  evaluateAdsBeforeAfterSnapshot,
} from './ads-before-after-snapshot.model.js';
import { buildAdsManualApprovalExampleInput } from './ads-manual-approval-executor.model.js';

test('Phase 14.7 constants identify before/after snapshot package and health mode', () => {
  assert.equal(ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE, 'v2-phase-14-7-before-after-snapshot');
  assert.equal(ADS_BEFORE_AFTER_SNAPSHOT_PACKAGE, 'lifesaver-v0.7.0-phase-14-7-before-after-snapshot.zip');
  assert.equal(ADS_ACTION_SNAPSHOTS_MIGRATION, 'database/migrations/023_create_ads_action_snapshots.sql');
});

test('required fields match roadmap before execution snapshot requirements', () => {
  assert.deepEqual(buildAdsSnapshotRequiredBeforeExecutionFields(), [
    'current_budget',
    'campaign_status',
    'adset_status',
    'timestamp',
    'platform_data_summary',
  ]);
});

test('safety states no provider clients, no external API calls, and no mutations', () => {
  const safety = buildAdsBeforeAfterSnapshotSafety();
  assert.equal(safety.auditSnapshotOnly, true);
  assert.equal(safety.noMetaAdsApiClientAdded, true);
  assert.equal(safety.noGoogleAdsApiClientAdded, true);
  assert.equal(safety.noExternalAdApiCalled, true);
  assert.equal(safety.noCampaignPaused, true);
  assert.equal(safety.noAdsetPaused, true);
  assert.equal(safety.noBudgetChanged, true);
  assert.equal(safety.noAdsAutoRunEnabled, true);
});

test('valid manually approved ads action creates before and after snapshot preview', () => {
  const result = evaluateAdsBeforeAfterSnapshot(buildAdsBeforeAfterSnapshotExampleInput());
  assert.equal(result.decision, 'snapshot_ready_for_audit_storage');
  assert.equal(result.readyForFutureExecutorAuditStorage, true);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
  assert.equal(result.allowedToMutateAdsThisPhase, false);
  assert.equal(result.manualApprovalRequired, true);
  assert.equal(result.autoRunAllowed, false);
  assert.equal(result.checks.manualApprovalGatePassed, true);
  assert.equal(result.checks.currentBudgetValid, true);
  assert.equal(result.beforeSnapshot?.budget, 100);
  assert.equal(result.beforeSnapshot?.campaign_status, 'active');
  assert.equal(result.beforeSnapshot?.adset_status, 'active');
  assert.equal(result.afterSnapshotPreview?.budget, 110);
  assert.equal(result.recommendedStorage.table, 'ads_action_snapshots');
  assert.doesNotThrow(() => assertAdsBeforeAfterSnapshotSafe(result));
});

test('missing action blocks because manual approval gate cannot run', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({ ...input, action: undefined });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
  assert.equal(result.checks.manualApprovalGatePassed, false);
});

test('proposed action blocks snapshot storage through manual approval gate', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    action: { ...input.action!, status: 'proposed' },
  });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
  assert.equal(result.manualApprovalEvaluation?.decision, 'blocked_invalid_status');
});

test('auto approved action blocks snapshot storage for first ads executor release', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    action: {
      ...input.action!,
      status: 'auto_approved',
      approval: { ...input.action!.approval, approval_method: 'policy_auto' },
    },
  });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
  assert.equal(result.manualApprovalEvaluation?.decision, 'blocked_auto_approval_not_allowed');
});

test('missing before snapshot is blocked', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({ ...input, before_snapshot: undefined });
  assert.equal(result.decision, 'blocked_missing_before_snapshot');
  assert.equal(result.checks.beforeSnapshotPresent, false);
});

test('invalid current budget is blocked', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    before_snapshot: { ...input.before_snapshot!, current_budget: -10 },
  });
  assert.equal(result.decision, 'blocked_invalid_budget');
  assert.equal(result.checks.currentBudgetValid, false);
});

test('missing campaign status is blocked', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    before_snapshot: { ...input.before_snapshot!, campaign_status: '' },
  });
  assert.equal(result.decision, 'blocked_invalid_status');
  assert.equal(result.checks.campaignStatusPresent, false);
});

test('missing platform data summary is blocked', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    before_snapshot: { ...input.before_snapshot!, platform_data_summary: {} },
  });
  assert.equal(result.decision, 'blocked_missing_platform_summary');
  assert.equal(result.checks.platformSummaryPresent, false);
});

test('invalid timestamp is blocked by before snapshot validation', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    before_snapshot: { ...input.before_snapshot!, timestamp: 'not-a-date' },
  });
  assert.equal(result.decision, 'blocked_missing_platform_summary');
  assert.equal(result.checks.timestampValid, false);
});

test('force and persist_now are ignored by preview endpoint', () => {
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({ ...input, force: true, persist_now: true });
  assert.equal(result.decision, 'snapshot_ready_for_audit_storage');
  assert.match(result.warnings.join(' '), /force=true/);
  assert.match(result.warnings.join(' '), /persist_now=true/);
  assert.equal(result.checks.noDatabaseWriteFromPreview, true);
});

test('pause in the underlying action blocks snapshot readiness', () => {
  const action = buildAdsManualApprovalExampleInput();
  const input = buildAdsBeforeAfterSnapshotExampleInput();
  const result = evaluateAdsBeforeAfterSnapshot({
    ...input,
    action: { ...action, pause: { ...action.pause, ads_pause_active: true } },
  });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
  assert.equal(result.manualApprovalEvaluation?.decision, 'blocked_ads_pause_active');
});

test('report includes storage table, migration file, all action types, and next phase', () => {
  const report = buildAdsBeforeAfterSnapshotReport();
  assert.equal(report.healthMode, ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE);
  assert.equal(report.storageTable, 'ads_action_snapshots');
  assert.equal(report.migrationFile, 'database/migrations/023_create_ads_action_snapshots.sql');
  for (const actionType of ['pause_campaign', 'pause_adset', 'adjust_budget', 'restore_budget', 'reenable_campaign']) {
    assert.ok(report.supportedActionTypes.includes(actionType as never));
  }
  assert.equal(report.nextStep, 'Phase 14.8 — Rollback/Re-Enable');
  assert.doesNotThrow(() => assertAdsBeforeAfterSnapshotSafe(report.exampleEvaluation));
});

test('status endpoint model reports no provider API and no ad mutation', () => {
  const status = buildAdsBeforeAfterSnapshotStatus();
  assert.equal(status.healthMode, ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE);
  assert.equal(status.providerApiClientAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.equal(status.campaignPaused, false);
  assert.equal(status.adsetPaused, false);
  assert.equal(status.budgetChanged, false);
  assert.equal(status.adsAutoRunEnabled, false);
});

test('safe assertion rejects token/provider payload fragments', () => {
  assert.throws(() => assertAdsBeforeAfterSnapshotSafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertAdsBeforeAfterSnapshotSafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
