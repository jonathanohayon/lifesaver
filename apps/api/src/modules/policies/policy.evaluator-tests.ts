import { evaluateActionPolicy, enforceActionPolicyEvaluation } from './policy.evaluator.js';
import { getCategoryPauseState } from '../autonomy/autonomy.service.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';
import type { GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import type { ActionPolicyDecision } from '../actions/actions.types.js';
import type { PolicyEvaluationRuleRow } from './policy.repository.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

const workspaceId = '00000000-0000-0000-0000-000000000001';

function makePauseState(overrides: Partial<GlobalPauseBackendState> = {}): GlobalPauseBackendState {
  const emergencySafeMode = getEmergencySafeModeState();
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
      reason: 'Offline Phase 6.10 policy evaluator test pause state.',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'content not paused' },
      support: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'support not paused' },
      ads: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ads not paused' },
      research: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'research not paused' },
      dev: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'dev not paused' },
    },
    emergencySafeMode,
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'Offline test state. This never enables executors or external writes.',
    },
  };

  return { ...base, ...overrides };
}

function makePolicy(params: Partial<PolicyEvaluationRuleRow> & Pick<PolicyEvaluationRuleRow, 'id' | 'decision'>): PolicyEvaluationRuleRow {
  return {
    id: params.id,
    workspace_id: workspaceId,
    name: params.name || `Test policy ${params.id}`,
    action_type: params.action_type || 'content_publish',
    conditions_json: params.conditions_json || {},
    decision: params.decision,
    caps_json: params.caps_json || {},
    priority: params.priority ?? 100,
    enabled: params.enabled ?? true,
    created_by: null,
    updated_by: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

async function main() {
  const notPaused = makePauseState();
  const contentCategory = getCategoryPauseState({ pauseState: notPaused, actionType: 'content_publish' });
  const safeCapUsage = {
    workspaceId,
    source: 'provided' as const,
    windowStartedAt: { day: '2026-01-01T00:00:00.000Z', hour: '2026-01-01T12:00:00.000Z' },
    postsToday: 1,
    supportAutoRepliesToday: 1,
    adSpendChangeToday: 25,
    modelCostTodayUsd: 1,
    actionsThisHour: 1,
  };
  const exhaustedCapUsage = { ...safeCapUsage, postsToday: 3, actionsThisHour: 10 };
  const globalPaused = makePauseState({
    pauseAllAutonomy: true,
    enforcement: {
      autoApprovalAllowed: false,
      executorExecutionAllowed: false,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'Global pause active in offline test.',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks content' },
      support: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks support' },
      ads: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks ads' },
      research: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks research' },
      dev: { paused: false, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'global pause blocks dev' },
    },
  });
  const globalPausedCategory = getCategoryPauseState({ pauseState: globalPaused, actionType: 'content_publish' });

  const noPolicy = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'auto_approve',
    policyRows: [],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_no_policy',
  });

  const matchedAuto = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_auto_approve_empty_conditions', decision: 'auto_approve' })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_auto',
  });

  const matchedBlock = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_block_empty_conditions', decision: 'block' })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_block',
  });

  const matchedRiskCondition = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    riskLevel: 'low',
    requestedDecision: 'auto_approve',
    policyRows: [makePolicy({ id: 'policy_risk_below_auto', decision: 'auto_approve', conditions_json: { risk_below: 'medium' } })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_risk_condition',
  });

  const pausedAuto = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_auto_paused', decision: 'auto_approve' })],
    knownPauseState: globalPaused,
    knownCategoryPauseState: globalPausedCategory,
    source: 'phase_6_8_test_paused',
  });

  const capsPresent = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_caps_present', decision: 'ask', caps_json: { max_posts_per_day: 3 } })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    capUsage: safeCapUsage,
    source: 'phase_6_8_test_caps_present',
  });


  const capsExceeded = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_caps_exceeded', decision: 'auto_approve', caps_json: { max_posts_per_day: 3 } })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    capUsage: exhaustedCapUsage,
    source: 'phase_6_8_test_caps_exceeded',
  });

  const capsUsageUnavailable = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [makePolicy({ id: 'policy_caps_usage_unavailable', decision: 'auto_approve', caps_json: { max_posts_per_day: 3 } })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_caps_usage_unavailable',
  });


  const conflictBlockWins = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [
      makePolicy({ id: 'policy_auto_high_priority', decision: 'auto_approve', priority: 1 }),
      makePolicy({ id: 'policy_block_low_priority', decision: 'block', priority: 999 }),
    ],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_block_wins',
  });

  const conflictCapExceededWins = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [
      makePolicy({ id: 'policy_ask_high_priority', decision: 'ask', priority: 1 }),
      makePolicy({ id: 'policy_auto_cap_exceeded_low_priority', decision: 'auto_approve', priority: 999, caps_json: { max_posts_per_day: 3 } }),
    ],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    capUsage: exhaustedCapUsage,
    source: 'phase_6_8_test_cap_exceeded_wins',
  });

  const conflictAskWins = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    requestedDecision: 'ask',
    policyRows: [
      makePolicy({ id: 'policy_auto_for_conflict', decision: 'auto_approve', priority: 1 }),
      makePolicy({ id: 'policy_ask_for_conflict', decision: 'ask', priority: 999 }),
    ],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_ask_wins',
  });

  const scopedPolicyMatch = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    riskLevel: 'low',
    payloadJson: {
      data: {
        platform: 'instagram',
        channel: 'instagram',
        category: 'product_drop',
        confidence_score: 0.96,
        change_amount: 12,
      },
    },
    requestedDecision: 'ask',
    policyRows: [makePolicy({
      id: 'policy_scope_instagram_product_drop',
      decision: 'auto_approve',
      conditions_json: {
        scope: {
          platform: 'instagram',
          channel: 'instagram',
          category: 'product_drop',
          risk_below: 'medium',
          amount_below: 25,
          confidence_above: 0.9,
        },
      },
    })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_scope_match',
  });

  const scopedPolicyMismatch = await evaluateActionPolicy({
    workspaceId,
    actionType: 'content_publish',
    riskLevel: 'low',
    payloadJson: {
      data: {
        platform: 'tiktok',
        channel: 'tiktok',
        category: 'product_drop',
        confidence_score: 0.96,
        change_amount: 12,
      },
    },
    requestedDecision: 'ask',
    policyRows: [makePolicy({
      id: 'policy_scope_instagram_only',
      decision: 'auto_approve',
      conditions_json: { scope: { platform: 'instagram' } },
    })],
    knownPauseState: notPaused,
    knownCategoryPauseState: contentCategory,
    source: 'phase_6_8_test_scope_mismatch',
  });

  const normalized = { approvalRequired: false, policyDecision: 'auto_approve' as ActionPolicyDecision };
  const enforcedNoPolicy = enforceActionPolicyEvaluation({ normalized, policyEvaluation: noPolicy });
  const enforcedMatchedAuto = enforceActionPolicyEvaluation({ normalized, policyEvaluation: matchedAuto });

  const assertions: Assertion[] = [
    {
      name: 'no_policy_defaults_to_ask_even_if_requested_auto_approve',
      pass: noPolicy.decision === 'ask' && noPolicy.matched_policy_id === null && noPolicy.defaultAskApplied === true,
      details: { decision: noPolicy.decision, matched_policy_id: noPolicy.matched_policy_id, defaultAskApplied: noPolicy.defaultAskApplied },
    },
    {
      name: 'matched_empty_conditions_policy_can_return_auto_approve_without_execution',
      pass: matchedAuto.decision === 'auto_approve' && matchedAuto.matched_policy_id === 'policy_auto_approve_empty_conditions' && matchedAuto.executorExecutionAllowed === false,
      details: { decision: matchedAuto.decision, matched_policy_id: matchedAuto.matched_policy_id, executorExecutionAllowed: matchedAuto.executorExecutionAllowed },
    },
    {
      name: 'matched_block_policy_returns_block',
      pass: matchedBlock.decision === 'block' && matchedBlock.matched_policy_id === 'policy_block_empty_conditions',
      details: { decision: matchedBlock.decision, matched_policy_id: matchedBlock.matched_policy_id },
    },
    {
      name: 'condition_operator_risk_below_matches',
      pass: matchedRiskCondition.decision === 'auto_approve' && matchedRiskCondition.matchState === 'matched_condition_operators',
      details: { decision: matchedRiskCondition.decision, matchState: matchedRiskCondition.matchState, conditionSummary: matchedRiskCondition.conditionSummary },
    },

    {
      name: 'scope_matching_policy_can_return_auto_approve_without_execution',
      pass: scopedPolicyMatch.decision === 'auto_approve' && scopedPolicyMatch.matched_policy_id === 'policy_scope_instagram_product_drop' && scopedPolicyMatch.matchState === 'matched_action_scope' && scopedPolicyMatch.scopeSummary?.matched === true && scopedPolicyMatch.executorExecutionAllowed === false,
      details: { decision: scopedPolicyMatch.decision, matched_policy_id: scopedPolicyMatch.matched_policy_id, matchState: scopedPolicyMatch.matchState, scopeSummary: scopedPolicyMatch.scopeSummary, executorExecutionAllowed: scopedPolicyMatch.executorExecutionAllowed },
    },
    {
      name: 'scope_mismatch_defaults_to_ask',
      pass: scopedPolicyMismatch.decision === 'ask' && scopedPolicyMismatch.matched_policy_id === null && scopedPolicyMismatch.matchState === 'not_matched_action_scope' && scopedPolicyMismatch.defaultAskApplied === true,
      details: { decision: scopedPolicyMismatch.decision, matched_policy_id: scopedPolicyMismatch.matched_policy_id, matchState: scopedPolicyMismatch.matchState, scopeSummary: scopedPolicyMismatch.scopeSummary, defaultAskApplied: scopedPolicyMismatch.defaultAskApplied },
    },
    {
      name: 'pause_overrides_auto_approve_to_ask_or_block',
      pass: pausedAuto.decision !== 'auto_approve' && pausedAuto.autoApprovalAllowed === false && pausedAuto.pause.paused === true,
      details: { decision: pausedAuto.decision, autoApprovalAllowed: pausedAuto.autoApprovalAllowed, pause: pausedAuto.pause },
    },
    {
      name: 'cap_status_reports_caps_ok_when_under_limits',
      pass: capsPresent.cap_status === 'caps_ok' && capsPresent.capSummary?.allowed === true,
      details: { cap_status: capsPresent.cap_status, capSummary: capsPresent.capSummary },
    },
    {
      name: 'cap_exceeded_blocks_auto_approval',
      pass: capsExceeded.decision === 'block' && capsExceeded.cap_status === 'cap_exceeded' && capsExceeded.autoApprovalAllowed === false,
      details: { decision: capsExceeded.decision, cap_status: capsExceeded.cap_status, capSummary: capsExceeded.capSummary },
    },
    {
      name: 'cap_usage_unavailable_downgrades_auto_approval_to_ask',
      pass: capsUsageUnavailable.decision === 'ask' && capsUsageUnavailable.cap_status === 'cap_usage_unavailable' && capsUsageUnavailable.autoApprovalAllowed === false,
      details: { decision: capsUsageUnavailable.decision, cap_status: capsUsageUnavailable.cap_status, capSummary: capsUsageUnavailable.capSummary },
    },

    {
      name: 'conflict_block_rule_wins_over_auto_even_with_lower_priority',
      pass: conflictBlockWins.decision === 'block' && conflictBlockWins.matched_policy_id === 'policy_block_low_priority' && conflictBlockWins.conflictSummary?.reasonCode === 'block_rule_wins',
      details: { decision: conflictBlockWins.decision, matched_policy_id: conflictBlockWins.matched_policy_id, conflictSummary: conflictBlockWins.conflictSummary },
    },
    {
      name: 'conflict_hard_cap_exceeded_wins_over_ask',
      pass: conflictCapExceededWins.decision === 'block' && conflictCapExceededWins.matched_policy_id === 'policy_auto_cap_exceeded_low_priority' && conflictCapExceededWins.cap_status === 'cap_exceeded' && conflictCapExceededWins.conflictSummary?.reasonCode === 'hard_cap_exceeded_wins',
      details: { decision: conflictCapExceededWins.decision, matched_policy_id: conflictCapExceededWins.matched_policy_id, cap_status: conflictCapExceededWins.cap_status, conflictSummary: conflictCapExceededWins.conflictSummary },
    },
    {
      name: 'conflict_ask_rule_wins_over_auto',
      pass: conflictAskWins.decision === 'ask' && conflictAskWins.matched_policy_id === 'policy_ask_for_conflict' && conflictAskWins.conflictSummary?.reasonCode === 'ask_rule_wins',
      details: { decision: conflictAskWins.decision, matched_policy_id: conflictAskWins.matched_policy_id, conflictSummary: conflictAskWins.conflictSummary },
    },
    {
      name: 'enforcement_no_policy_requires_approval',
      pass: enforcedNoPolicy.approvalRequired === true && enforcedNoPolicy.policyDecision === 'ask',
      details: enforcedNoPolicy,
    },
    {
      name: 'enforcement_matched_auto_can_continue_but_not_execute',
      pass: enforcedMatchedAuto.policyDecision === 'auto_approve' && matchedAuto.executorExecutionAllowed === false,
      details: { policyDecision: enforcedMatchedAuto.policyDecision, executorExecutionAllowed: matchedAuto.executorExecutionAllowed },
    },
    {
      name: 'safety_contract_no_external_writes_or_executors',
      pass: [noPolicy, matchedAuto, matchedBlock, scopedPolicyMatch, scopedPolicyMismatch, pausedAuto].every((result) => result.safety.externalWritesAttempted === false && result.safety.executorRan === false && result.safety.autoRunTriggered === false && result.executorExecutionAllowed === false),
      details: { checkedResults: 6 },
    },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 6.10 Policy Tests',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    sampleResults: {
      noPolicy,
      matchedAuto,
      matchedBlock,
      matchedRiskCondition,
      conflictBlockWins,
      conflictCapExceededWins,
      conflictAskWins,
      scopedPolicyMatch,
      scopedPolicyMismatch,
      pausedAuto,
      capsPresent,
      capsExceeded,
      capsUsageUnavailable,
    },
    safety: {
      evaluatorConflictResolutionOnly: true,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.10 validates evaluateActionPolicy(action) with persisted decision-record compatibility, most-restrictive-wins conflict resolution, action scope matching, condition operators, and global cap validation. It returns ask/auto_approve/block, reason, matched_policy_id, cap_status, and conflictSummary. It does not run executors or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
