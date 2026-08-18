import { evaluateActionPolicy } from './policy.evaluator.js';
import { buildPolicyDecisionSnapshot, summarizePolicyDecisionSnapshot } from './policy.decision-records.js';
import { getCategoryPauseState } from '../autonomy/autonomy.service.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';
import type { GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import type { PolicyEvaluationRuleRow } from './policy.repository.js';
import type { PolicyCapUsageSnapshot } from './policy.cap-validation.js';
import type { ActionPolicyDecision, ActionRiskLevel, ActionType } from '../actions/actions.types.js';

type TestResult = {
  name: string;
  status: 'pass' | 'fail';
  message: string;
  details?: Record<string, unknown>;
};

const workspaceId = '00000000-0000-0000-0000-000000000610';
const results: TestResult[] = [];

function record(name: string, status: TestResult['status'], message: string, details?: Record<string, unknown>) {
  results.push({ name, status, message, details });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makePauseState(overrides: Partial<GlobalPauseBackendState> = {}): GlobalPauseBackendState {
  const base: GlobalPauseBackendState = {
    workspaceId,
    pauseAllAutonomy: false,
    pauseContentActions: false,
    pauseSupportActions: false,
    pauseAdsActions: false,
    pauseResearchActions: false,
    pauseDevActions: false,
    updatedBy: null,
    updatedAt: null,
    enforcement: {
      autoApprovalAllowed: true,
      executorExecutionAllowed: true,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'Phase 6.10 policy test state: autonomy is not paused.',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'content not paused' },
      support: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'support not paused' },
      ads: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ads not paused' },
      research: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'research not paused' },
      dev: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'dev not paused' },
    },
    emergencySafeMode: getEmergencySafeModeState(),
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'Offline test pause state. It never enables executors or external writes.',
    },
  };

  return { ...base, ...overrides };
}

function makePausedState(): GlobalPauseBackendState {
  return makePauseState({
    pauseAllAutonomy: true,
    enforcement: {
      autoApprovalAllowed: false,
      executorExecutionAllowed: false,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'Phase 6.10 test: master pause is active.',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks content auto-approval' },
      support: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks support auto-approval' },
      ads: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks ads auto-approval' },
      research: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks research auto-approval' },
      dev: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks dev auto-approval' },
    },
  });
}

function makePolicy(params: {
  id: string;
  decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
  actionType?: ActionType;
  riskLevel?: ActionRiskLevel;
  conditionsJson?: Record<string, unknown>;
  capsJson?: Record<string, unknown>;
  priority?: number;
}): PolicyEvaluationRuleRow {
  return {
    id: params.id,
    workspace_id: workspaceId,
    name: `Phase 6.10 ${params.id}`,
    action_type: params.actionType || 'content_publish',
    conditions_json: params.conditionsJson || {},
    decision: params.decision,
    caps_json: params.capsJson || {},
    priority: params.priority ?? 100,
    enabled: true,
    created_by: null,
    updated_by: null,
    created_at: new Date('2026-07-05T00:00:00.000Z'),
    updated_at: new Date('2026-07-05T00:00:00.000Z'),
  };
}

function capUsage(overrides: Partial<PolicyCapUsageSnapshot> = {}): PolicyCapUsageSnapshot {
  return {
    workspaceId,
    source: 'provided',
    windowStartedAt: {
      day: '2026-07-05T00:00:00.000Z',
      hour: '2026-07-05T12:00:00.000Z',
    },
    postsToday: 0,
    supportAutoRepliesToday: 0,
    adSpendChangeToday: 0,
    modelCostTodayUsd: 0,
    actionsThisHour: 0,
    ...overrides,
  };
}

async function runTest(name: string, fn: () => Promise<Record<string, unknown> | void>) {
  try {
    const details = await fn();
    record(name, 'pass', 'Passed.', details || undefined);
  } catch (error) {
    record(name, 'fail', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const openPause = makePauseState();
  const openContentCategory = getCategoryPauseState({ pauseState: openPause, actionType: 'content_publish' });

  await runTest('ask_by_default_when_no_rule_matches', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      requestedDecision: 'auto_approve',
      payloadJson: { platform: 'instagram', caption: 'Test post' },
      policyRows: [],
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_default_ask',
    });

    assert(evaluation.decision === 'ask', 'Expected ask when no policy rule matches.');
    assert(evaluation.defaultAskApplied === true, 'Default ask should be applied.');
    assert(evaluation.matched_policy_id === null, 'No policy should be matched.');
    assert(evaluation.cap_status === 'not_applicable_no_policy_match', 'Cap status should show no policy match.');
    assert(evaluation.executorExecutionAllowed === false, 'Executor execution must remain disabled.');
    return {
      decision: evaluation.decision,
      matched_policy_id: evaluation.matched_policy_id,
      cap_status: evaluation.cap_status,
      defaultAskApplied: evaluation.defaultAskApplied,
    };
  });

  await runTest('auto_approve_when_safe_rule_matches', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      riskLevel: 'low',
      requestedDecision: 'ask',
      payloadJson: {
        platform: 'instagram',
        channel: 'instagram',
        category: 'approved_style_content',
        confidence_score: 0.94,
      },
      policyRows: [makePolicy({
        id: 'policy_auto_approved_style_content',
        decision: 'auto_approve',
        conditionsJson: {
          scope: {
            action_type: 'content_publish',
            platform: 'instagram',
            channel: 'instagram',
            category: 'approved_style_content',
            risk_below: 'medium',
            confidence_above: 0.9,
          },
        },
        capsJson: { max_posts_per_day: 3, max_actions_per_hour: 10 },
      })],
      capUsage: capUsage({ postsToday: 1, actionsThisHour: 1 }),
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_auto_approve',
    });

    assert(evaluation.decision === 'auto_approve', 'Expected auto_approve when a safe matching rule passes.');
    assert(evaluation.matched_policy_id === 'policy_auto_approved_style_content', 'Expected the auto-approve policy to match.');
    assert(evaluation.cap_status === 'caps_ok', 'Caps should be OK.');
    assert(evaluation.autoApprovalAllowed === true, 'Auto-approval should be allowed as a decision only.');
    assert(evaluation.executorExecutionAllowed === false, 'Even auto_approve must not execute in Phase 6.10.');
    return {
      decision: evaluation.decision,
      matched_policy_id: evaluation.matched_policy_id,
      cap_status: evaluation.cap_status,
      autoApprovalAllowed: evaluation.autoApprovalAllowed,
      executorExecutionAllowed: evaluation.executorExecutionAllowed,
    };
  });

  await runTest('block_when_block_rule_matches', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      riskLevel: 'high',
      requestedDecision: 'ask',
      payloadJson: { platform: 'instagram', category: 'restricted_claim' },
      policyRows: [makePolicy({
        id: 'policy_block_restricted_claims',
        decision: 'block',
        conditionsJson: { all: [{ field: 'category', operator: 'equals', value: 'restricted_claim' }] },
      })],
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_block',
    });

    assert(evaluation.decision === 'block', 'Expected block when a block rule matches.');
    assert(evaluation.matched_policy_id === 'policy_block_restricted_claims', 'Expected the block policy to match.');
    assert(evaluation.approvalRequired === true, 'Blocked action remains approval-required / non-executable.');
    assert(evaluation.autoApprovalAllowed === false, 'Blocked action must not allow auto-approval.');
    return {
      decision: evaluation.decision,
      matched_policy_id: evaluation.matched_policy_id,
      reason: evaluation.reason,
    };
  });

  await runTest('cap_exceeded_blocks_auto_approval', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      riskLevel: 'low',
      requestedDecision: 'ask',
      payloadJson: { platform: 'instagram', confidence_score: 0.97 },
      policyRows: [makePolicy({
        id: 'policy_auto_but_daily_post_cap_exceeded',
        decision: 'auto_approve',
        capsJson: { max_posts_per_day: 2, max_actions_per_hour: 10 },
      })],
      capUsage: capUsage({ postsToday: 2, actionsThisHour: 1 }),
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_cap_exceeded',
    });

    assert(evaluation.decision === 'block', 'Expected hard cap exceeded to block.');
    assert(evaluation.cap_status === 'cap_exceeded', 'Expected cap_exceeded status.');
    assert(evaluation.conflictSummary?.reasonCode === 'hard_cap_exceeded_wins', 'Conflict summary should explain hard cap priority.');
    assert(evaluation.autoApprovalAllowed === false, 'Cap-exceeded action must not allow auto-approval.');
    return {
      decision: evaluation.decision,
      cap_status: evaluation.cap_status,
      matched_policy_id: evaluation.matched_policy_id,
      conflictReason: evaluation.conflictSummary?.reasonCode,
      capSummary: evaluation.capSummary,
    };
  });

  await runTest('pause_active_overrides_auto_approval', async () => {
    const paused = makePausedState();
    const pausedCategory = getCategoryPauseState({ pauseState: paused, actionType: 'content_publish' });
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      riskLevel: 'low',
      requestedDecision: 'ask',
      payloadJson: { platform: 'instagram' },
      policyRows: [makePolicy({ id: 'policy_auto_while_paused', decision: 'auto_approve' })],
      knownPauseState: paused,
      knownCategoryPauseState: pausedCategory,
      source: 'phase_6_10_policy_tests_pause_active',
    });

    assert(evaluation.decision !== 'auto_approve', 'Pause must prevent auto_approve.');
    assert(evaluation.pause.paused === true, 'Pause summary should show paused.');
    assert(evaluation.cap_status === 'blocked_by_pause_or_emergency', 'Pause should set blocked_by_pause_or_emergency cap status.');
    assert(evaluation.reason.toLowerCase().includes('pause') || evaluation.cap_status === 'blocked_by_pause_or_emergency', 'Pause result should explain pause override.');
    assert(evaluation.executorExecutionAllowed === false, 'Executor execution must remain disabled.');
    return {
      decision: evaluation.decision,
      pause: evaluation.pause,
      cap_status: evaluation.cap_status,
      conflictReason: evaluation.conflictSummary?.reasonCode,
    };
  });

  await runTest('conflicting_rules_most_restrictive_wins', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionType: 'content_publish',
      riskLevel: 'low',
      requestedDecision: 'ask',
      payloadJson: { platform: 'instagram', category: 'approved_style_content' },
      policyRows: [
        makePolicy({ id: 'policy_auto_conflict', decision: 'auto_approve', priority: 1 }),
        makePolicy({ id: 'policy_ask_conflict', decision: 'ask', priority: 50 }),
        makePolicy({ id: 'policy_block_conflict', decision: 'block', priority: 999 }),
      ],
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_conflicts',
    });

    assert(evaluation.decision === 'block', 'Block should win over ask and auto_approve.');
    assert(evaluation.matched_policy_id === 'policy_block_conflict', 'The block rule should be the winning policy.');
    assert(evaluation.conflictSummary?.reasonCode === 'block_rule_wins', 'Conflict summary should show block_rule_wins.');
    assert((evaluation.conflictSummary?.matchedCandidateCount || 0) >= 3, 'All conflicting candidates should be represented.');
    return {
      decision: evaluation.decision,
      matched_policy_id: evaluation.matched_policy_id,
      conflictSummary: evaluation.conflictSummary,
    };
  });

  await runTest('policy_decision_snapshot_can_explain_audit_reason', async () => {
    const evaluation = await evaluateActionPolicy({
      workspaceId,
      actionId: 'phase-6-10-audit-action',
      actionType: 'content_publish',
      requestedDecision: 'ask',
      policyRows: [],
      knownPauseState: openPause,
      knownCategoryPauseState: openContentCategory,
      source: 'phase_6_10_policy_tests_snapshot',
    });
    const snapshot = buildPolicyDecisionSnapshot({
      evaluation,
      actionId: 'phase-6-10-audit-action',
      recordedAt: '2026-07-05T12:00:00.000Z',
    });
    const summary = summarizePolicyDecisionSnapshot(snapshot);

    assert(summary.decision === 'ask', 'Snapshot summary should preserve decision.');
    assert(summary.reason, 'Snapshot summary should preserve reason for later audit.');
    assert(snapshot.safety.externalWritesAttempted === false, 'Snapshot builder must not write externally.');
    return {
      summary,
      safety: snapshot.safety,
    };
  });

  const failed = results.filter((result) => result.status === 'fail');
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 6.10 Policy Tests',
    success: failed.length === 0,
    passed: results.length - failed.length,
    failed: failed.length,
    requiredRoadmapScenarios: [
      'Ask by default',
      'Auto-approve when rule matches',
      'Block when rule matches',
      'Cap exceeded',
      'Pause active',
      'Conflicting rules',
    ],
    results,
    safety: {
      testOnly: true,
      databaseWritesPerformed: false,
      executorEnabled: false,
      executorRan: false,
      externalWritesEnabled: false,
      externalWritesAttempted: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.10 verifies the policy engine scenarios required by the roadmap. It does not create actions, persist snapshots to the database, queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
