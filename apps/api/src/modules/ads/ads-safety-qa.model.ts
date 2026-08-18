import { buildAdsBudgetChangeExamplePayload } from './ads-budget-change-payload.model.js';
import { buildAdsHardCapsExample, evaluateAdsHardCaps } from './ads-hard-caps.model.js';
import { buildAdsManualApprovalExampleInput, evaluateAdsManualApprovalExecutorGate } from './ads-manual-approval-executor.model.js';
import { buildAdsRollbackExampleInput, evaluateAdsRollbackExecutor } from './ads-rollback-executor.model.js';
import { buildAdsBeforeAfterSnapshotExampleInput, evaluateAdsBeforeAfterSnapshot } from './ads-before-after-snapshot.model.js';
import type {
  AdsSafetyQaCheck,
  AdsSafetyQaDuplicateExecutionInput,
  AdsSafetyQaEvaluation,
  AdsSafetyQaInput,
  AdsSafetyQaReport,
  AdsSafetyQaRiskSignOffInput,
  AdsSafetyQaSafety,
  AdsSafetyQaStatus,
} from './ads-safety-qa.types.js';

export const ADS_SAFETY_QA_PHASE = 'phase_14_10_ads_safety_qa' as const;
export const ADS_SAFETY_QA_HEALTH_MODE = 'v2-phase-14-10-ads-safety-qa' as const;
export const ADS_SAFETY_QA_PACKAGE = 'lifesaver-v0.7.0-phase-14-10-ads-safety-qa.zip' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'client_secret=',
  'client_secret:',
  'refresh_token=',
  'refresh_token:',
  'authorization: bearer',
  'bearer ',
  'raw_token',
  'access_token',
  'private_key',
  'ya29.',
  'eaab',
  'provider_raw_response',
  'raw_provider_payload',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

function check(key: AdsSafetyQaCheck['key'], passed: boolean, reason: string): AdsSafetyQaCheck {
  return { key, passed, reason };
}

export function buildAdsSafetyQaSafety(): AdsSafetyQaSafety {
  return {
    qaReportOnly: true,
    sandboxOrTestAccountFirst: true,
    noLiveProviderSendFromQa: true,
    noMetaAdsApiClientAdded: true,
    noGoogleAdsApiClientAdded: true,
    noAdOAuthRouteAdded: true,
    noAdTokenStorageAdded: true,
    noWriteScopeRequested: true,
    noCampaignPaused: true,
    noAdsetPaused: true,
    noBudgetChanged: true,
    noBudgetRestored: true,
    noCampaignReenabled: true,
    noAdsAutoRunEnabled: true,
    noExternalAdApiCalled: true,
    noRawTokensReturned: true,
    noRawProviderPayloadReturned: true,
    noDatabaseMigrationRequired: true,
  };
}

export function buildAdsSafetyQaRoadmapTests(): string[] {
  return [
    'Sandbox/test account first.',
    'Manual approval required for every first-release ads action.',
    'Hard cap exceeded must block budget mutation.',
    'Master pause, ads pause, or emergency safe mode must block execution.',
    'Rollback/re-enable plan must be supported before live mutation.',
    'Duplicate execution must be blocked through idempotency/action attempt evidence.',
  ];
}

export function buildAdsSafetyQaRequiredEvidence(): string[] {
  return [
    'Sandbox/test account confirmation before any controlled provider test.',
    'Manual approval actor, approved_at timestamp, and approval event for the ads action.',
    'Hard-cap exceeded fixture proving blocked behavior.',
    'Pause-active fixture proving master/ads/emergency pause blocks behavior.',
    'Before/after snapshot fixture with safe summarized platform data.',
    'Rollback/re-enable planning fixture with manual rollback request evidence.',
    'Duplicate execution fixture with idempotency key and existing execution attempt.',
    'Result logging readiness before claiming any future action execution.',
    'Risk sign-off acknowledging this QA package does not approve live provider execution.',
  ];
}

function buildHardCapExceededCase() {
  return {
    caps: buildAdsHardCapsExample(),
    usage: {
      daily_budget_change_used: 95,
      changes_today: 3,
    },
    budgetPayload: {
      ...buildAdsBudgetChangeExamplePayload(),
      current_budget: 100,
      proposed_budget: 180,
      delta: 80,
      percentage_change: 80,
      reason: 'QA fixture intentionally exceeds hard caps and daily change count.',
      risk_level: 'critical',
    },
  };
}

function buildPauseActiveCase() {
  const input = buildAdsManualApprovalExampleInput();
  return {
    ...input,
    pause: {
      master_pause_active: true,
      ads_pause_active: false,
      emergency_safe_mode_active: false,
    },
  };
}

export function buildAdsSafetyQaExampleInput(): AdsSafetyQaInput {
  return {
    sandbox_or_test_account_first: true,
    manual_approval_case: buildAdsManualApprovalExampleInput(),
    hard_cap_exceeded_case: buildHardCapExceededCase(),
    pause_active_case: buildPauseActiveCase(),
    rollback_case: buildAdsRollbackExampleInput(),
    before_after_snapshot_case: buildAdsBeforeAfterSnapshotExampleInput(),
    duplicate_execution_case: {
      action_id: '00000000-0000-4000-8000-000000000146',
      idempotency_key: 'ads-adjust-budget-safe-example-2026-07-09',
      action_hash: 'sha256:safe-fixture-adjust-budget',
      existing_execution_ids: ['exec_safe_existing_001'],
      current_execution_attempt_id: 'exec_safe_existing_001',
    },
    result_logging_ready: true,
    risk_signoff: {
      signed_by_user_id: '00000000-0000-4000-8000-000000000001',
      signed_at: '2026-07-09T12:30:00.000Z',
      notes: 'Phase 14.10 QA sign-off for executor shell and safety gates only. No live Meta/Google Ads mutation approved by this report.',
      acknowledges_manual_approval_required: true,
      acknowledges_sandbox_or_test_account_first: true,
      acknowledges_no_live_provider_call_from_qa: true,
      acknowledges_hard_caps_pause_rollback_duplicate_gates: true,
    },
    force: false,
  };
}

function evaluateDuplicateExecution(input: unknown): { passed: boolean; reason: string; normalized: AdsSafetyQaEvaluation['duplicateExecution']; issue: string | null } {
  if (!isPlainObject(input)) {
    return {
      passed: false,
      reason: 'duplicate_execution_case must be an object.',
      normalized: { duplicateBlocked: false, action_id: null, idempotency_key: null, current_execution_attempt_id: null, existing_execution_count: 0 },
      issue: 'duplicate_execution_case must be an object.',
    };
  }
  const typed = input as unknown as AdsSafetyQaDuplicateExecutionInput;
  const actionId = isNonEmptyString(typed.action_id) ? typed.action_id.trim() : null;
  const idempotencyKey = isNonEmptyString(typed.idempotency_key) ? typed.idempotency_key.trim() : null;
  const actionHash = isNonEmptyString(typed.action_hash) ? typed.action_hash.trim() : null;
  const currentAttemptId = isNonEmptyString(typed.current_execution_attempt_id) ? typed.current_execution_attempt_id.trim() : null;
  const existing = Array.isArray(typed.existing_execution_ids) ? typed.existing_execution_ids.filter(isNonEmptyString).map((item) => item.trim()) : [];
  const duplicateBlocked = Boolean(actionId && idempotencyKey && actionHash && currentAttemptId && existing.includes(currentAttemptId));
  return {
    passed: duplicateBlocked,
    reason: duplicateBlocked
      ? 'Existing execution attempt matched the current attempt/idempotency evidence, so duplicate execution is blocked.'
      : 'Duplicate execution evidence is incomplete or no matching existing execution attempt was supplied.',
    normalized: {
      duplicateBlocked,
      action_id: actionId,
      idempotency_key: idempotencyKey,
      current_execution_attempt_id: currentAttemptId,
      existing_execution_count: existing.length,
    },
    issue: duplicateBlocked ? null : 'duplicate execution guard did not prove an existing execution attempt would be blocked.',
  };
}

function evaluateRiskSignoff(input: unknown): { passed: boolean; reason: string; issue: string | null } {
  if (!isPlainObject(input)) return { passed: false, reason: 'risk_signoff must be an object.', issue: 'risk_signoff must be an object.' };
  const signoff = input as unknown as AdsSafetyQaRiskSignOffInput;
  const passed = isNonEmptyString(signoff.signed_by_user_id)
    && isValidTimestamp(signoff.signed_at)
    && signoff.acknowledges_manual_approval_required === true
    && signoff.acknowledges_sandbox_or_test_account_first === true
    && signoff.acknowledges_no_live_provider_call_from_qa === true
    && signoff.acknowledges_hard_caps_pause_rollback_duplicate_gates === true;
  return {
    passed,
    reason: passed
      ? 'Risk sign-off acknowledges manual approval, sandbox/test-account-first, no live provider call from QA, and all required gates.'
      : 'Risk sign-off is missing signer, timestamp, or required acknowledgements.',
    issue: passed ? null : 'risk sign-off evidence is incomplete.',
  };
}

export function evaluateAdsSafetyQa(input: unknown): AdsSafetyQaEvaluation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const safety = buildAdsSafetyQaSafety();

  if (!isPlainObject(input)) {
    return {
      version: '0.7.0',
      phase: ADS_SAFETY_QA_PHASE,
      healthMode: ADS_SAFETY_QA_HEALTH_MODE,
      deliverable: 'ads_executor_qa_and_risk_signoff',
      decision: 'invalid_qa_input',
      qaPassed: false,
      riskSignOffReady: false,
      allowedToCallProviderApiThisPhase: false,
      allowedToMutateAdsThisPhase: false,
      issues: ['QA input must be an object.'],
      warnings,
      checks: [check('no_live_provider_api_called', true, 'Invalid preview input still cannot call a provider API.')],
      manualApprovalEvaluation: null,
      hardCapExceededEvaluation: null,
      pauseActiveEvaluation: null,
      rollbackEvaluation: null,
      beforeAfterSnapshotEvaluation: null,
      duplicateExecution: { duplicateBlocked: false, action_id: null, idempotency_key: null, current_execution_attempt_id: null, existing_execution_count: 0 },
      requiredEvidence: buildAdsSafetyQaRequiredEvidence(),
      safety,
    };
  }

  const typed = input as unknown as AdsSafetyQaInput;
  if (typed.force === true) warnings.push('force=true was supplied and ignored; force cannot bypass ads QA, approval, caps, pause, rollback, duplicate, or result-log gates.');

  const manualApprovalEvaluation = evaluateAdsManualApprovalExecutorGate(typed.manual_approval_case);
  const hardCapExceededEvaluation = evaluateAdsHardCaps(typed.hard_cap_exceeded_case);
  const pauseActiveEvaluation = evaluateAdsManualApprovalExecutorGate(typed.pause_active_case);
  const rollbackEvaluation = evaluateAdsRollbackExecutor(typed.rollback_case);
  const beforeAfterSnapshotEvaluation = evaluateAdsBeforeAfterSnapshot(typed.before_after_snapshot_case);
  const duplicate = evaluateDuplicateExecution(typed.duplicate_execution_case);
  const riskSignoff = evaluateRiskSignoff(typed.risk_signoff);

  const checks: AdsSafetyQaCheck[] = [
    check('sandbox_test_account_first', typed.sandbox_or_test_account_first === true, typed.sandbox_or_test_account_first === true ? 'Sandbox/test account first is confirmed.' : 'Sandbox/test account first is not confirmed.'),
    check('manual_approval_required', manualApprovalEvaluation.decision === 'ready_for_manual_executor_shell' && manualApprovalEvaluation.manualApprovalRequired === true, 'Manual approval gate must be ready and manualApprovalRequired must remain true.'),
    check('hard_cap_exceeded_blocks', hardCapExceededEvaluation.decision === 'blocked_by_hard_cap' && hardCapExceededEvaluation.allowed === false, 'The hard-cap exceeded fixture must block budget mutation.'),
    check('pause_active_blocks', ['blocked_master_pause_active', 'blocked_ads_pause_active', 'blocked_emergency_safe_mode'].includes(pauseActiveEvaluation.decision), 'The pause-active fixture must block execution.'),
    check('rollback_supported', rollbackEvaluation.decision === 'rollback_ready_for_executor_shell' && rollbackEvaluation.rollbackPlan !== null, 'Rollback/re-enable plan must be ready for the executor shell.'),
    check('before_after_snapshot_ready', beforeAfterSnapshotEvaluation.decision === 'snapshot_ready_for_audit_storage', 'Before/after snapshot must be ready for future audit storage.'),
    check('no_duplicate_execution', duplicate.passed, duplicate.reason),
    check('result_logs_required', typed.result_logging_ready === true, typed.result_logging_ready === true ? 'Result logging readiness is confirmed before any future execution can be claimed.' : 'Result logging readiness is not confirmed.'),
    check('risk_signoff_present', riskSignoff.passed, riskSignoff.reason),
    check('no_live_provider_api_called', true, 'Phase 14.10 QA is report/evaluator only and does not call Meta or Google Ads APIs.'),
    check('no_force_bypass', typed.force !== true, typed.force === true ? 'force=true was ignored, but QA is not considered clean with force requested.' : 'No force bypass requested.'),
  ];

  if (manualApprovalEvaluation.decision !== 'ready_for_manual_executor_shell') issues.push('manual approval QA case did not pass.');
  if (hardCapExceededEvaluation.decision !== 'blocked_by_hard_cap') issues.push('hard-cap exceeded QA case did not block as expected.');
  if (!['blocked_master_pause_active', 'blocked_ads_pause_active', 'blocked_emergency_safe_mode'].includes(pauseActiveEvaluation.decision)) issues.push('pause-active QA case did not block as expected.');
  if (rollbackEvaluation.decision !== 'rollback_ready_for_executor_shell') issues.push('rollback QA case did not produce a safe rollback plan.');
  if (beforeAfterSnapshotEvaluation.decision !== 'snapshot_ready_for_audit_storage') issues.push('before/after snapshot QA case did not pass.');
  if (duplicate.issue) issues.push(duplicate.issue);
  if (riskSignoff.issue) issues.push(riskSignoff.issue);
  if (typed.sandbox_or_test_account_first !== true) issues.push('sandbox/test account first is required.');
  if (typed.result_logging_ready !== true) issues.push('result logging readiness is required.');
  if (typed.force === true) issues.push('force=true is not allowed for a clean ads safety QA sign-off.');

  const qaPassed = checks.every((item) => item.passed) && issues.length === 0;
  const decision: AdsSafetyQaEvaluation['decision'] = qaPassed ? 'ads_safety_qa_passed' : (issues.length > 0 ? 'ads_safety_qa_failed' : 'ads_safety_qa_requires_review');

  return {
    version: '0.7.0',
    phase: ADS_SAFETY_QA_PHASE,
    healthMode: ADS_SAFETY_QA_HEALTH_MODE,
    deliverable: 'ads_executor_qa_and_risk_signoff',
    decision,
    qaPassed,
    riskSignOffReady: riskSignoff.passed,
    allowedToCallProviderApiThisPhase: false,
    allowedToMutateAdsThisPhase: false,
    issues,
    warnings,
    checks,
    manualApprovalEvaluation,
    hardCapExceededEvaluation,
    pauseActiveEvaluation,
    rollbackEvaluation,
    beforeAfterSnapshotEvaluation,
    duplicateExecution: duplicate.normalized,
    requiredEvidence: buildAdsSafetyQaRequiredEvidence(),
    safety,
  };
}

export function buildAdsSafetyQaReport(): AdsSafetyQaReport {
  const exampleInput = buildAdsSafetyQaExampleInput();
  return {
    version: '0.7.0',
    phase: ADS_SAFETY_QA_PHASE,
    healthMode: ADS_SAFETY_QA_HEALTH_MODE,
    deliverable: 'ads_executor_qa_and_risk_signoff',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.10 adds the ads executor QA and risk sign-off report. It verifies sandbox/test-account-first, manual approval, hard-cap blocking, pause blocking, rollback planning, result-log readiness, and duplicate execution protection without adding Meta/Google Ads API clients or performing live ad mutations.',
    roadmapTests: buildAdsSafetyQaRoadmapTests(),
    exampleInput,
    exampleEvaluation: evaluateAdsSafetyQa(exampleInput),
    riskSignOff: {
      status: 'qa_passed_for_executor_shell_only',
      liveProviderExecutionApproved: false,
      notes: [
        'This QA report signs off safety gates for the executor shell only.',
        'It does not approve live Meta or Google Ads execution.',
        'Any future controlled provider test must still use sandbox/test account first and explicit founder/client approval.',
      ],
    },
    safety: buildAdsSafetyQaSafety(),
    nextStep: 'Phase 15.1 — Request Classifier',
  };
}

export function buildAdsSafetyQaStatus(): AdsSafetyQaStatus {
  return {
    phase: 'V2 Phase 14.10 — Ads Safety QA',
    healthMode: ADS_SAFETY_QA_HEALTH_MODE,
    deliverable: 'ads_executor_qa_and_risk_signoff',
    qaReportOnly: true,
    sandboxOrTestAccountFirst: true,
    liveProviderExecutionApproved: false,
    externalAdApiCalled: false,
    budgetChanged: false,
    campaignPaused: false,
    adsetPaused: false,
    rollbackSupported: true,
    duplicateExecutionBlockedByPolicy: true,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 15.1 — Request Classifier',
  };
}

export function assertAdsSafetyQaSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads safety QA output contains forbidden fragment: ${fragment}`);
    }
  }
}
