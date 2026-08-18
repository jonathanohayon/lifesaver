import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADS_SAFETY_QA_HEALTH_MODE,
  ADS_SAFETY_QA_PACKAGE,
  assertAdsSafetyQaSafe,
  buildAdsSafetyQaExampleInput,
  buildAdsSafetyQaReport,
  buildAdsSafetyQaRoadmapTests,
  buildAdsSafetyQaSafety,
  buildAdsSafetyQaStatus,
  evaluateAdsSafetyQa,
} from './ads-safety-qa.model.js';

test('Phase 14.10 constants identify package and health mode', () => {
  assert.equal(ADS_SAFETY_QA_HEALTH_MODE, 'v2-phase-14-10-ads-safety-qa');
  assert.equal(ADS_SAFETY_QA_PACKAGE, 'lifesaver-v0.7.0-phase-14-10-ads-safety-qa.zip');
});

test('roadmap tests cover sandbox, manual approval, caps, pause, rollback, and duplicates', () => {
  const roadmapTests = buildAdsSafetyQaRoadmapTests().join(' ');
  assert.match(roadmapTests, /Sandbox\/test account first/);
  assert.match(roadmapTests, /Manual approval/);
  assert.match(roadmapTests, /Hard cap/);
  assert.match(roadmapTests, /pause/);
  assert.match(roadmapTests, /Rollback/);
  assert.match(roadmapTests, /Duplicate execution/);
});

test('safety report states no provider clients, no external API call, and no ad mutation', () => {
  const safety = buildAdsSafetyQaSafety();
  assert.equal(safety.qaReportOnly, true);
  assert.equal(safety.sandboxOrTestAccountFirst, true);
  assert.equal(safety.noMetaAdsApiClientAdded, true);
  assert.equal(safety.noGoogleAdsApiClientAdded, true);
  assert.equal(safety.noExternalAdApiCalled, true);
  assert.equal(safety.noBudgetChanged, true);
  assert.equal(safety.noCampaignPaused, true);
  assert.equal(safety.noAdsetPaused, true);
  assert.equal(safety.noBudgetRestored, true);
  assert.equal(safety.noCampaignReenabled, true);
  assert.equal(safety.noAdsAutoRunEnabled, true);
});

test('example QA passes for executor shell and risk sign-off only', () => {
  const result = evaluateAdsSafetyQa(buildAdsSafetyQaExampleInput());
  assert.equal(result.decision, 'ads_safety_qa_passed');
  assert.equal(result.qaPassed, true);
  assert.equal(result.riskSignOffReady, true);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
  assert.equal(result.allowedToMutateAdsThisPhase, false);
  assert.equal(result.manualApprovalEvaluation?.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.hardCapExceededEvaluation?.decision, 'blocked_by_hard_cap');
  assert.ok(['blocked_master_pause_active', 'blocked_ads_pause_active', 'blocked_emergency_safe_mode'].includes(result.pauseActiveEvaluation?.decision || ''));
  assert.equal(result.rollbackEvaluation?.decision, 'rollback_ready_for_executor_shell');
  assert.equal(result.beforeAfterSnapshotEvaluation?.decision, 'snapshot_ready_for_audit_storage');
  assert.equal(result.duplicateExecution.duplicateBlocked, true);
  assert.doesNotThrow(() => assertAdsSafetyQaSafe(result));
});

test('missing sandbox/test account confirmation fails QA', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({ ...input, sandbox_or_test_account_first: false });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.equal(result.qaPassed, false);
  assert.ok(result.issues.some((issue) => issue.includes('sandbox/test account')));
});

test('manual approval failure fails QA', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    manual_approval_case: { ...input.manual_approval_case, status: 'auto_approved' },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.equal(result.manualApprovalEvaluation?.decision, 'blocked_auto_approval_not_allowed');
});

test('hard-cap fixture must block, otherwise QA fails', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    hard_cap_exceeded_case: {
      ...input.hard_cap_exceeded_case,
      usage: { daily_budget_change_used: 0, changes_today: 0 },
      budgetPayload: { ...input.hard_cap_exceeded_case.budgetPayload, proposed_budget: 105, delta: 5, percentage_change: 5 },
    },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.notEqual(result.hardCapExceededEvaluation?.decision, 'blocked_by_hard_cap');
});

test('pause-active fixture must block, otherwise QA fails', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    pause_active_case: { ...input.pause_active_case, pause: { master_pause_active: false, ads_pause_active: false, emergency_safe_mode_active: false } },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.notEqual(result.pauseActiveEvaluation?.decision, 'blocked_pause_or_emergency_mode');
});

test('rollback unsupported fails QA', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    rollback_case: {
      ...input.rollback_case,
      rollback_request: { ...input.rollback_case.rollback_request!, rollback_type: 'delete_campaign' },
    },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.equal(result.rollbackEvaluation?.decision, 'blocked_invalid_rollback_type');
});

test('duplicate execution guard must prove duplicate block', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    duplicate_execution_case: { ...input.duplicate_execution_case, existing_execution_ids: [] },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.equal(result.duplicateExecution.duplicateBlocked, false);
});

test('missing risk sign-off fails QA', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({
    ...input,
    risk_signoff: { ...input.risk_signoff, acknowledges_no_live_provider_call_from_qa: false },
  });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.equal(result.riskSignOffReady, false);
});

test('force=true fails clean QA and is not a bypass', () => {
  const input = buildAdsSafetyQaExampleInput();
  const result = evaluateAdsSafetyQa({ ...input, force: true });
  assert.equal(result.decision, 'ads_safety_qa_failed');
  assert.match(result.warnings.join(' '), /force=true/);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
});

test('report includes QA evidence, risk sign-off, and Phase 15 next step', () => {
  const report = buildAdsSafetyQaReport();
  assert.equal(report.healthMode, ADS_SAFETY_QA_HEALTH_MODE);
  assert.equal(report.exampleEvaluation.decision, 'ads_safety_qa_passed');
  assert.equal(report.riskSignOff.liveProviderExecutionApproved, false);
  assert.equal(report.nextStep, 'Phase 15.1 — Request Classifier');
  assert.doesNotThrow(() => assertAdsSafetyQaSafe(report));
});

test('status endpoint model confirms no live provider execution', () => {
  const status = buildAdsSafetyQaStatus();
  assert.equal(status.healthMode, ADS_SAFETY_QA_HEALTH_MODE);
  assert.equal(status.liveProviderExecutionApproved, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.equal(status.budgetChanged, false);
  assert.equal(status.rollbackSupported, true);
  assert.equal(status.duplicateExecutionBlockedByPolicy, true);
});

test('safe assertion rejects token/provider payload fragments', () => {
  assert.throws(() => assertAdsSafetyQaSafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertAdsSafetyQaSafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
