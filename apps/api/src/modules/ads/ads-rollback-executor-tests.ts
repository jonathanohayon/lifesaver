import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADS_ROLLBACK_EXECUTOR_HEALTH_MODE,
  ADS_ROLLBACK_EXECUTOR_PACKAGE,
  ADS_ROLLBACK_TYPES,
  assertAdsRollbackExecutorSafe,
  buildAdsRollbackExampleInput,
  buildAdsRollbackExecutorReport,
  buildAdsRollbackExecutorSafety,
  buildAdsRollbackExecutorStatus,
  evaluateAdsRollbackExecutor,
} from './ads-rollback-executor.model.js';
import { buildAdsManualApprovalExampleInput } from './ads-manual-approval-executor.model.js';

test('Phase 14.8 constants identify rollback/re-enable package and health mode', () => {
  assert.equal(ADS_ROLLBACK_EXECUTOR_HEALTH_MODE, 'v2-phase-14-8-rollback-reenable');
  assert.equal(ADS_ROLLBACK_EXECUTOR_PACKAGE, 'lifesaver-v0.7.0-phase-14-8-rollback-reenable.zip');
  assert.deepEqual(ADS_ROLLBACK_TYPES, ['restore_previous_budget', 'reenable_paused_adset', 'reenable_campaign']);
});

test('safety states no provider clients, no external API calls, and no ad mutations', () => {
  const safety = buildAdsRollbackExecutorSafety();
  assert.equal(safety.rollbackExecutorShellOnly, true);
  assert.equal(safety.manualApprovalRequired, true);
  assert.equal(safety.noMetaAdsApiClientAdded, true);
  assert.equal(safety.noGoogleAdsApiClientAdded, true);
  assert.equal(safety.noExternalAdApiCalled, true);
  assert.equal(safety.noBudgetRestored, true);
  assert.equal(safety.noCampaignReenabled, true);
  assert.equal(safety.noAdsetReenabled, true);
  assert.equal(safety.noAdsAutoRunEnabled, true);
});

test('valid manual rollback request builds restore budget plan', () => {
  const result = evaluateAdsRollbackExecutor(buildAdsRollbackExampleInput());
  assert.equal(result.decision, 'rollback_ready_for_executor_shell');
  assert.equal(result.readyForFutureProviderRollbackExecutor, true);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
  assert.equal(result.allowedToMutateAdsThisPhase, false);
  assert.equal(result.manualApprovalRequired, true);
  assert.equal(result.autoRunAllowed, false);
  assert.equal(result.checks.manualApprovalGatePassed, true);
  assert.equal(result.checks.budgetRestoreValid, true);
  assert.equal(result.rollbackPlan?.rollback_type, 'restore_previous_budget');
  assert.equal(result.rollbackPlan?.planned_provider_operation, 'restore_budget');
  assert.equal(result.rollbackPlan?.planned_safe_restore_value.previous_budget, 100);
  assert.doesNotThrow(() => assertAdsRollbackExecutorSafe(result));
});

test('missing action blocks because manual approval gate cannot run', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({ ...input, action: undefined });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
});

test('proposed action blocks through manual approval gate', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({ ...input, action: { ...input.action!, status: 'proposed' } });
  assert.equal(result.decision, 'blocked_manual_approval_gate_failed');
  assert.equal(result.manualApprovalEvaluation?.decision, 'blocked_invalid_status');
});

test('auto approved action blocks rollback for first ads executor release', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({
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

test('invalid rollback type is blocked', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    rollback_request: { ...input.rollback_request!, rollback_type: 'delete_campaign' },
  });
  assert.equal(result.decision, 'blocked_invalid_rollback_type');
});

test('missing source snapshot is blocked', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({ ...input, before_snapshot: undefined });
  assert.equal(result.decision, 'blocked_missing_source_snapshot');
  assert.equal(result.checks.sourceSnapshotPresent, false);
});

test('missing current state is blocked', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({ ...input, current_state: undefined });
  assert.equal(result.decision, 'blocked_missing_current_state');
  assert.equal(result.checks.currentStatePresent, false);
});

test('missing source links and manual rollback request are blocked', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    rollback_request: {
      ...input.rollback_request!,
      source_action_id: '',
      source_action_result_id: '',
      source_snapshot_id: '',
      manual_rollback_requested: false,
    },
  });
  assert.equal(result.decision, 'blocked_missing_source_snapshot');
  assert.equal(result.checks.beforeAfterSnapshotLinked, false);
  assert.equal(result.checks.manualRollbackRequested, false);
});

test('invalid budget restore is blocked when values are equal', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    current_state: { ...input.current_state!, current_budget: 100 },
  });
  assert.equal(result.decision, 'blocked_invalid_budget_restore');
  assert.equal(result.checks.budgetRestoreValid, false);
});

test('paused adset re-enable plan requires previous active and current paused', () => {
  const input = buildAdsRollbackExampleInput();
  const action = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    action: { ...action, action_type: 'pause_adset' },
    rollback_request: { ...input.rollback_request!, rollback_type: 'reenable_paused_adset' },
    before_snapshot: { ...input.before_snapshot!, adset_status: 'active' },
    current_state: { ...input.current_state!, adset_status: 'paused' },
  });
  assert.equal(result.decision, 'rollback_ready_for_executor_shell');
  assert.equal(result.checks.adsetReenableValid, true);
  assert.equal(result.rollbackPlan?.planned_provider_operation, 'enable_adset_or_ad_group');
});

test('campaign re-enable plan requires previous active and current paused', () => {
  const input = buildAdsRollbackExampleInput();
  const action = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    action: { ...action, action_type: 'pause_campaign' },
    rollback_request: { ...input.rollback_request!, rollback_type: 'reenable_campaign' },
    before_snapshot: { ...input.before_snapshot!, campaign_status: 'enabled' },
    current_state: { ...input.current_state!, campaign_status: 'paused' },
  });
  assert.equal(result.decision, 'rollback_ready_for_executor_shell');
  assert.equal(result.checks.campaignReenableValid, true);
  assert.equal(result.rollbackPlan?.planned_provider_operation, 'enable_campaign');
});

test('bulk or multi-entity rollback is blocked', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({
    ...input,
    current_state: { ...input.current_state!, campaign_id: 'cmp_one,cmp_two' },
  });
  assert.equal(result.decision, 'blocked_bulk_or_multi_entity_request');
  assert.equal(result.checks.singleEntityOnly, false);
});

test('force is ignored by preview endpoint', () => {
  const input = buildAdsRollbackExampleInput();
  const result = evaluateAdsRollbackExecutor({ ...input, force: true });
  assert.equal(result.decision, 'rollback_ready_for_executor_shell');
  assert.match(result.warnings.join(' '), /force=true/);
});

test('report includes supported rollback types, examples, and next phase', () => {
  const report = buildAdsRollbackExecutorReport();
  assert.equal(report.healthMode, ADS_ROLLBACK_EXECUTOR_HEALTH_MODE);
  assert.deepEqual(report.supportedRollbackTypes, ADS_ROLLBACK_TYPES);
  assert.ok(report.rollbackExamples.some((item) => item.includes('Restore a previous')));
  assert.equal(report.nextStep, 'Phase 14.9 — Auto-Run Below Threshold Later');
  assert.doesNotThrow(() => assertAdsRollbackExecutorSafe(report.exampleEvaluation));
});

test('status endpoint model reports no provider API and no ad mutation', () => {
  const status = buildAdsRollbackExecutorStatus();
  assert.equal(status.healthMode, ADS_ROLLBACK_EXECUTOR_HEALTH_MODE);
  assert.equal(status.providerApiClientAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.equal(status.budgetRestored, false);
  assert.equal(status.campaignReenabled, false);
  assert.equal(status.adsetReenabled, false);
  assert.equal(status.adsAutoRunEnabled, false);
});

test('safe assertion rejects token/provider payload fragments', () => {
  assert.throws(() => assertAdsRollbackExecutorSafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertAdsRollbackExecutorSafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
