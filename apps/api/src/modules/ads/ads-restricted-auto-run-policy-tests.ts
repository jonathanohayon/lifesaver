import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAdsBudgetChangeExamplePayload } from './ads-budget-change-payload.model.js';
import { buildAdsHardCapsExample, buildAdsHardCapsExampleUsage } from './ads-hard-caps.model.js';
import {
  ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE,
  ADS_RESTRICTED_AUTO_RUN_PACKAGE,
  ADS_RESTRICTED_AUTO_RUN_PHASE,
  assertAdsRestrictedAutoRunPolicySafe,
  buildAdsRestrictedAutoRunExampleContext,
  buildAdsRestrictedAutoRunExampleInput,
  buildAdsRestrictedAutoRunExamplePolicy,
  buildAdsRestrictedAutoRunPolicyReport,
  buildAdsRestrictedAutoRunPolicyStatus,
  buildAdsRestrictedAutoRunRequirements,
  evaluateAdsRestrictedAutoRunPolicy,
} from './ads-restricted-auto-run-policy.model.js';

test('Phase 14.9 constants are correct', () => {
  assert.equal(ADS_RESTRICTED_AUTO_RUN_PHASE, 'phase_14_9_auto_run_below_threshold_later');
  assert.equal(ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE, 'v2-phase-14-9-restricted-ads-auto-run-policy');
  assert.equal(ADS_RESTRICTED_AUTO_RUN_PACKAGE, 'lifesaver-v0.7.0-phase-14-9-restricted-ads-auto-run-policy.zip');
});

test('requirements describe explicit policy, thresholds, caps, pauses, snapshots, logs, and no live enablement', () => {
  const text = buildAdsRestrictedAutoRunRequirements().join(' ').toLowerCase();
  assert.match(text, /explicitly allow/);
  assert.match(text, /daily amount threshold/);
  assert.match(text, /percentage threshold/);
  assert.match(text, /hard caps/);
  assert.match(text, /before snapshot/);
  assert.match(text, /result logging/);
  assert.match(text, /rollback planning/);
  assert.match(text, /master pause/);
  assert.match(text, /does not enable live ads auto-run/);
});

test('eligible tiny budget change is only eligible for future restricted auto-run, not live auto-run now', () => {
  const result = evaluateAdsRestrictedAutoRunPolicy(buildAdsRestrictedAutoRunExampleInput());
  assert.equal(result.decision, 'eligible_for_future_restricted_auto_run');
  assert.equal(result.eligibleForFutureRestrictedAutoRun, true);
  assert.equal(result.autoRunEnabledNow, false);
  assert.equal(result.manualApprovalStillRequiredThisPhase, true);
  assert.equal(result.safety.noAdsAutoRunEnabled, true);
  assert.equal(result.safety.noExternalAdApiCalled, true);
  assert.doesNotThrow(() => assertAdsRestrictedAutoRunPolicySafe(result));
});

test('missing explicit policy falls back to manual review', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    policy: { ...input.policy, explicit_policy_allows_auto_run: false },
  });
  assert.equal(result.decision, 'manual_review_required');
  assert.equal(result.eligibleForFutureRestrictedAutoRun, false);
  assert.ok(result.checks.find((item) => item.key === 'explicit_policy_allows_auto_run' && !item.passed));
});

test('single delta above restricted threshold requires manual review', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    budgetPayload: {
      ...input.budgetPayload,
      proposed_budget: 112,
      delta: 12,
      percentage_change: 12,
    },
  });
  assert.equal(result.decision, 'manual_review_required');
  assert.ok(result.checks.find((item) => item.key === 'single_delta_under_policy_threshold' && !item.passed));
});

test('percentage above restricted threshold requires manual review', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    budgetPayload: {
      ...input.budgetPayload,
      current_budget: 100,
      proposed_budget: 106,
      delta: 6,
      percentage_change: 6,
    },
  });
  assert.equal(result.decision, 'manual_review_required');
  assert.ok(result.checks.find((item) => item.key === 'percentage_under_policy_threshold' && !item.passed));
});

test('hard cap rejection blocks future restricted auto-run eligibility', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    hardCaps: { ...input.hardCaps, max_daily_budget_change: 1 },
  });
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.equal(result.eligibleForFutureRestrictedAutoRun, false);
  assert.ok(result.checks.find((item) => item.key === 'hard_caps_allow' && !item.passed));
});

test('master pause, ads pause, and emergency safe mode block policy', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  for (const pauseKey of ['master_pause_active', 'ads_pause_active', 'emergency_safe_mode'] as const) {
    const result = evaluateAdsRestrictedAutoRunPolicy({
      ...input,
      context: { ...input.context, [pauseKey]: true },
    });
    assert.equal(result.decision, 'blocked_by_policy', `${pauseKey} should block`);
    assert.equal(result.eligibleForFutureRestrictedAutoRun, false);
  }
});

test('low confidence is manual review', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    context: { ...input.context, confidence_score: 0.4 },
  });
  assert.equal(result.decision, 'manual_review_required');
  assert.ok(result.checks.find((item) => item.key === 'confidence_high_enough' && !item.passed));
});

test('decrease-only policy rejects budget increase from future auto-run lane', () => {
  const input = buildAdsRestrictedAutoRunExampleInput();
  const result = evaluateAdsRestrictedAutoRunPolicy({
    ...input,
    policy: { ...input.policy, allowed_direction: 'decrease_only' },
  });
  assert.equal(result.decision, 'manual_review_required');
  assert.ok(result.checks.find((item) => item.key === 'direction_allowed' && !item.passed));
});

test('invalid budget payload fails closed', () => {
  const result = evaluateAdsRestrictedAutoRunPolicy({
    policy: buildAdsRestrictedAutoRunExamplePolicy(),
    hardCaps: buildAdsHardCapsExample(),
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: { ...buildAdsBudgetChangeExamplePayload(), platform: 'triple_whale' },
    context: buildAdsRestrictedAutoRunExampleContext(),
  });
  assert.equal(result.decision, 'invalid_budget_payload_preview');
  assert.equal(result.eligibleForFutureRestrictedAutoRun, false);
  assert.match(result.issues.join(' '), /budgetPayload/);
});

test('report is safe and adds no execution behavior', () => {
  const report = buildAdsRestrictedAutoRunPolicyReport();
  assert.equal(report.deliverable, 'restricted_ads_auto_run_policy');
  assert.equal(report.policyOnly, true);
  assert.equal(report.safety.noAdsExecutorAdded, true);
  assert.equal(report.safety.noMetaAdsApiClientAdded, true);
  assert.equal(report.safety.noGoogleAdsApiClientAdded, true);
  assert.equal(report.safety.noAdOAuthRouteAdded, true);
  assert.equal(report.safety.noAdTokenStorageAdded, true);
  assert.equal(report.safety.noBudgetChanged, true);
  assert.equal(report.safety.noAdsAutoRunEnabled, true);
  assert.equal(report.safety.noExternalAdApiCalled, true);
  assert.equal(report.safety.noDatabaseMigrationRequired, true);
  assert.doesNotThrow(() => assertAdsRestrictedAutoRunPolicySafe(report));
});

test('status is concise and safe', () => {
  const status = buildAdsRestrictedAutoRunPolicyStatus();
  assert.equal(status.healthMode, ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE);
  assert.equal(status.deliverable, 'restricted_ads_auto_run_policy');
  assert.equal(status.autoRunEnabledNow, false);
  assert.equal(status.manualApprovalStillRequiredThisPhase, true);
  assert.equal(status.adsExecutorAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.equal(status.budgetChanged, false);
  assert.equal(status.noDatabaseMigrationRequired, true);
  assert.doesNotThrow(() => assertAdsRestrictedAutoRunPolicySafe(status));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsRestrictedAutoRunPolicyReport() as any;
  report.accidental = 'Authorization: Bearer secret';
  assert.throws(() => assertAdsRestrictedAutoRunPolicySafe(report), /forbidden fragment/);
});
