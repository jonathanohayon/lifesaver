import { isDatabaseConfigured } from '../../db/pool.js';
import type { ActionPolicyDecision, ActionRiskLevel, ActionType } from '../actions/actions.types.js';
import type { CategoryPauseBackendState, GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import { getCategoryPauseState, getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import { applyPolicyPauseDecisionWithKnownState } from './policy.pause-enforcement.js';
import { evaluateDefaultAskPolicy } from './policy.default-ask.js';
import { getPolicyCapUsageSnapshot, listEnabledPolicyRulesForAction, type PolicyEvaluationRuleRow } from './policy.repository.js';
import { POLICY_EVALUATOR_PHASE, type EvaluateActionPolicyInput, type EvaluateActionPolicyResult, type PolicyCapStatus, type PolicyConditionMatchState } from './policy.types.js';
import { evaluatePolicyConditions } from './policy.condition-operators.js';
import { evaluatePolicyScopeMatch } from './policy.scope-matching.js';
import { unavailablePolicyCapUsage, validatePolicyCaps, type PolicyCapValidationResult, type PolicyCapUsageSnapshot } from './policy.cap-validation.js';
import { resolvePolicyConflicts, type PolicyConflictCandidate, type PolicyConflictResolutionResult } from './policy.conflict-resolution.js';

const POLICY_DECISIONS = new Set<ActionPolicyDecision>(['ask', 'auto_approve', 'block']);

function evaluatedAt(): string {
  return new Date().toISOString();
}

function normalizeDecision(value: unknown): Exclude<ActionPolicyDecision, 'not_evaluated'> {
  return POLICY_DECISIONS.has(value as ActionPolicyDecision)
    ? value as Exclude<ActionPolicyDecision, 'not_evaluated'>
    : 'ask';
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function objectIsEmpty(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

type PolicyConditionMatchResult = {
  matched: boolean;
  state: PolicyConditionMatchState;
  reason: string;
  scopeSummary: EvaluateActionPolicyResult['scopeSummary'];
  conditionSummary: EvaluateActionPolicyResult['conditionSummary'];
};

function matchPolicyConditions(params: {
  policy: PolicyEvaluationRuleRow;
  action: EvaluateActionPolicyInput;
}): PolicyConditionMatchResult {
  const scope = evaluatePolicyScopeMatch({
    action: params.action,
    conditionsJson: params.policy.conditions_json,
  });

  const scopeSummary: EvaluateActionPolicyResult['scopeSummary'] = {
    supported: scope.supported,
    matched: scope.matched,
    emptyScope: scope.emptyScope,
    checkedCount: scope.checkedCount,
    actionScope: {
      platform: scope.actionScope.platform,
      channel: scope.actionScope.channel,
      riskLevel: scope.actionScope.riskLevel,
      amount: scope.actionScope.amount,
      category: scope.actionScope.category,
      confidenceScore: scope.actionScope.confidenceScore,
    },
    checked: scope.checked.map((item) => ({
      field: item.field,
      matched: item.matched,
      supported: item.supported,
      reason: item.reason,
    })),
  };

  if (!scope.supported) {
    return {
      matched: false,
      state: 'unsupported_action_scope',
      reason: `${scope.reason} Default ask applies if no later policy matches.`,
      scopeSummary,
      conditionSummary: undefined,
    };
  }

  if (!scope.matched) {
    return {
      matched: false,
      state: 'not_matched_action_scope',
      reason: `${scope.reason} Default ask applies if no later policy matches.`,
      scopeSummary,
      conditionSummary: undefined,
    };
  }

  const evaluation = evaluatePolicyConditions({
    action: params.action,
    conditionsJson: params.policy.conditions_json,
  });

  let state: PolicyConditionMatchState = 'not_matched_condition_operators';
  if (evaluation.emptyConditions) state = 'matched_empty_conditions';
  else if (evaluation.matchMode === 'always' && evaluation.matched) state = 'matched_always_true';
  else if (!evaluation.supported) state = 'unsupported_condition_operators';
  else if (evaluation.matched) state = 'matched_condition_operators';

  return {
    matched: evaluation.matched && evaluation.supported,
    state: (state === 'matched_empty_conditions' || (evaluation.matchMode === 'empty' && evaluation.checked.length === 0)) && !scope.emptyScope ? 'matched_action_scope' : state,
    reason: scope.emptyScope ? evaluation.reason : `${scope.reason} ${evaluation.reason}`,
    scopeSummary,
    conditionSummary: {
      supported: evaluation.supported,
      matchMode: evaluation.matchMode,
      checkedCount: evaluation.checked.length,
      checked: evaluation.checked.map((item) => ({
        operator: item.operator,
        matched: item.matched,
        supported: item.supported,
        field: item.field ?? null,
        reason: item.reason,
      })),
    },
  };
}

type MatchedPolicyCandidate = {
  policy: PolicyEvaluationRuleRow;
  decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
  state: PolicyConditionMatchState;
  reason: string;
  scopeSummary?: EvaluateActionPolicyResult['scopeSummary'];
  conditionSummary?: EvaluateActionPolicyResult['conditionSummary'];
  capValidation: PolicyCapValidationResult;
  conflictCandidate: PolicyConflictCandidate;
};

type PolicyMatchCollection = {
  candidates: MatchedPolicyCandidate[];
  fallbackState: PolicyConditionMatchState;
  fallbackReason: string;
  checkedPolicyCount: number;
  fallbackScopeSummary?: EvaluateActionPolicyResult['scopeSummary'];
  fallbackConditionSummary?: EvaluateActionPolicyResult['conditionSummary'];
};

function collectPolicyMatches(params: {
  policies: PolicyEvaluationRuleRow[];
  action: EvaluateActionPolicyInput;
  capUsage: PolicyCapUsageSnapshot | null;
}): PolicyMatchCollection {
  let firstUnsupported: PolicyConditionMatchResult | null = null;
  let firstNotMatched: PolicyConditionMatchResult | null = null;
  const candidates: MatchedPolicyCandidate[] = [];

  for (const [order, policy] of params.policies.entries()) {
    const match = matchPolicyConditions({ policy, action: params.action });
    if (!match.matched) {
      if ((match.state === 'unsupported_condition_operators' || match.state === 'unsupported_action_scope') && !firstUnsupported) firstUnsupported = match;
      if (!firstNotMatched) firstNotMatched = match;
      continue;
    }

    const decision = normalizeDecision(policy.decision);
    const capsJson = asJsonObject(policy.caps_json);
    const capValidation = validatePolicyCaps({
      action: params.action,
      capsJson,
      usage: !objectIsEmpty(capsJson)
        ? (params.capUsage || unavailablePolicyCapUsage(params.action.workspaceId))
        : params.capUsage,
      requestedDecision: decision,
    });

    const conflictCandidate: PolicyConflictCandidate = {
      policyId: policy.id,
      policyName: policy.name,
      decision,
      priority: Number.isFinite(policy.priority) ? policy.priority : 100,
      order,
      capStatus: capValidation.status as PolicyCapStatus,
      capAllowed: capValidation.allowed,
      reason: `${match.reason} Policy decision: ${decision}. Cap status: ${capValidation.status}.`,
    };

    candidates.push({
      policy,
      decision,
      state: match.state,
      reason: match.reason,
      scopeSummary: match.scopeSummary,
      conditionSummary: match.conditionSummary,
      capValidation,
      conflictCandidate,
    });
  }

  const fallback: PolicyConditionMatchResult | null = firstUnsupported || firstNotMatched || null;
  const fallbackState: PolicyConditionMatchState = params.policies.length === 0
    ? 'no_enabled_policy'
    : (fallback ? fallback.state : 'not_matched_condition_operators');
  const fallbackReason = params.policies.length === 0
    ? 'No enabled policy rule exists for this workspace/action type, so default ask applies.'
    : `${fallback ? fallback.reason : 'Enabled policies exist, but none matched.'} Default ask applies.`;

  return {
    candidates,
    fallbackState,
    fallbackReason,
    checkedPolicyCount: params.policies.length,
    fallbackScopeSummary: fallback ? fallback.scopeSummary : undefined,
    fallbackConditionSummary: fallback ? fallback.conditionSummary : undefined,
  };
}

function buildUnavailableResult(input: EvaluateActionPolicyInput, reason: string): EvaluateActionPolicyResult {
  return {
    version: '0.6.0',
    phase: POLICY_EVALUATOR_PHASE,
    workspaceId: input.workspaceId,
    actionId: input.actionId || null,
    actionType: input.actionType,
    riskLevel: input.riskLevel || null,
    decision: 'block',
    reason,
    matched_policy_id: null,
    matchedPolicyId: null,
    cap_status: 'database_unavailable',
    capStatus: 'database_unavailable',
    checkedPolicyCount: 0,
    matchState: 'policy_lookup_unavailable',
    defaultAskApplied: false,
    approvalRequired: true,
    autoApprovalAllowed: false,
    executorExecutionAllowed: false,
    policyCheckedPauseState: false,
    pause: {
      paused: true,
      blockReason: 'pause_state_unavailable',
      emergencySafeModeActive: false,
      pauseAllAutonomy: true,
      categoryPaused: true,
    },
    conflictSummary: {
      reasonCode: 'no_matched_policy_default_ask',
      priorityOrder: ['master_pause', 'block_rule', 'hard_cap_exceeded', 'ask_rule', 'auto_approve_rule'],
      matchedCandidateCount: 0,
      winningCandidate: null,
      candidates: [],
    },
    evaluatedAt: evaluatedAt(),
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      note: 'Phase 6.10 validates policy decisions, conflicts, action scope, condition operators, and global caps only. Database/pause unavailability fails closed and cannot execute anything.',
    },
  };
}

async function loadCapUsageForEvaluation(input: EvaluateActionPolicyInput): Promise<Awaited<ReturnType<typeof getPolicyCapUsageSnapshot>> | NonNullable<EvaluateActionPolicyInput['capUsage']> | null> {
  if (input.capUsage) return input.capUsage;
  if (!isDatabaseConfigured) return null;
  return getPolicyCapUsageSnapshot({ workspaceId: input.workspaceId });
}

function summarizeCapValidation(capValidation: PolicyCapValidationResult | null): EvaluateActionPolicyResult['capSummary'] | undefined {
  if (!capValidation) return undefined;
  return {
    allowed: capValidation.allowed,
    checkedCount: capValidation.checkedCount,
    exceededCount: capValidation.exceededCount,
    capsDefined: capValidation.capsDefined,
    usageSource: capValidation.usageSource,
    reason: capValidation.reason,
    checks: capValidation.checks,
    usage: capValidation.usage,
  };
}

function capReasonSuffix(capValidation: PolicyCapValidationResult | null): string {
  if (!capValidation || capValidation.status === 'no_caps_defined' || capValidation.status === 'not_applicable_no_policy_match') return '';
  return ` Cap validation: ${capValidation.reason}`;
}

function conflictSummaryForResult(conflict: PolicyConflictResolutionResult): EvaluateActionPolicyResult['conflictSummary'] {
  return {
    reasonCode: conflict.reasonCode,
    priorityOrder: conflict.priorityOrder,
    matchedCandidateCount: conflict.matchedCandidateCount,
    winningCandidate: conflict.winningCandidate ? {
      policyId: conflict.winningCandidate.policyId,
      policyName: conflict.winningCandidate.policyName,
      decision: conflict.winningCandidate.decision,
      capStatus: conflict.winningCandidate.capStatus,
      priority: conflict.winningCandidate.priority,
    } : null,
    candidates: conflict.candidates.map((candidate) => ({
      policyId: candidate.policyId,
      policyName: candidate.policyName,
      decision: candidate.decision,
      capStatus: candidate.capStatus,
      priority: candidate.priority,
    })),
  };
}

export async function evaluateActionPolicy(input: EvaluateActionPolicyInput): Promise<EvaluateActionPolicyResult> {
  if (!input.workspaceId) return buildUnavailableResult(input, 'workspaceId is required for policy evaluation. LIFE.SAVER failed closed with block.');
  if (!input.actionType) return buildUnavailableResult(input, 'actionType is required for policy evaluation. LIFE.SAVER failed closed with block.');

  if (!isDatabaseConfigured && !input.policyRows) {
    return buildUnavailableResult(input, 'DATABASE_URL is not configured, so enabled policy rules and pause state cannot be verified. LIFE.SAVER failed closed with block.');
  }

  try {
    const [policies, pauseState] = await Promise.all([
      input.policyRows
        ? Promise.resolve(input.policyRows.map((row) => ({
            ...row,
            conditions_json: asJsonObject(row.conditions_json),
            caps_json: asJsonObject(row.caps_json),
          })))
        : listEnabledPolicyRulesForAction({ workspaceId: input.workspaceId, actionType: input.actionType }),
      input.knownPauseState
        ? Promise.resolve(input.knownPauseState)
        : getGlobalPauseStateForWorkspace(input.workspaceId),
    ]);

    const categoryPauseState = input.knownCategoryPauseState || getCategoryPauseState({
      pauseState: pauseState as GlobalPauseBackendState,
      actionType: input.actionType,
    });

    const hasAnyCaps = policies.some((policy) => !objectIsEmpty(asJsonObject(policy.caps_json)));
    const capUsage = hasAnyCaps ? await loadCapUsageForEvaluation(input) : (input.capUsage || null);
    const matchCollection = collectPolicyMatches({ policies, action: input, capUsage });
    const conflict = resolvePolicyConflicts({ candidates: matchCollection.candidates.map((candidate) => candidate.conflictCandidate) });
    const winningMatch = conflict.matchedPolicyId
      ? matchCollection.candidates.find((candidate) => candidate.policy.id === conflict.matchedPolicyId) || null
      : null;

    const defaultAsk = evaluateDefaultAskPolicy({
      workspaceId: input.workspaceId,
      actionType: input.actionType,
      requestedDecision: input.requestedDecision || 'ask',
      matchedPolicyId: conflict.matchedPolicyId,
      matchedPolicyDecision: conflict.decision,
      source: input.source || 'policy_evaluator',
    });

    const pauseDecision = applyPolicyPauseDecisionWithKnownState({
      workspaceId: input.workspaceId,
      actionType: input.actionType,
      requestedDecision: normalizeDecision(defaultAsk.effectiveDecision),
      source: input.source || 'policy_evaluator',
      pauseState: pauseState as GlobalPauseBackendState,
      categoryPauseState: categoryPauseState as CategoryPauseBackendState,
      enforcementMode: 'ask_when_paused',
    });

    const finalDecision = normalizeDecision(pauseDecision.effectiveDecision);
    const capStatus: PolicyCapStatus = pauseDecision.blockReason === 'emergency_safe_mode' || pauseDecision.blockReason === 'global_pause' || pauseDecision.blockReason === 'category_pause'
      ? 'blocked_by_pause_or_emergency'
      : conflict.capStatus;

    return {
      version: '0.6.0',
      phase: POLICY_EVALUATOR_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId || null,
      actionType: input.actionType,
      riskLevel: input.riskLevel || null,
      decision: finalDecision,
      reason: pauseDecision.blockReason !== 'none'
        ? `${pauseDecision.message} Conflict priority order: master pause, block rule, hard cap exceeded, ask rule, auto-approve rule.`
        : winningMatch
          ? `${winningMatch.reason} ${conflict.reason}${capReasonSuffix(winningMatch.capValidation)}`
          : conflict.reason || matchCollection.fallbackReason,
      matched_policy_id: winningMatch?.policy.id || conflict.matchedPolicyId || null,
      matchedPolicyId: winningMatch?.policy.id || conflict.matchedPolicyId || null,
      cap_status: capStatus,
      capStatus,
      capSummary: summarizeCapValidation(winningMatch?.capValidation || null),
      checkedPolicyCount: matchCollection.checkedPolicyCount,
      matchState: winningMatch?.state || matchCollection.fallbackState,
      scopeSummary: winningMatch?.scopeSummary || matchCollection.fallbackScopeSummary,
      conditionSummary: winningMatch?.conditionSummary || matchCollection.fallbackConditionSummary,
      conflictSummary: conflictSummaryForResult(conflict),
      defaultAskApplied: defaultAsk.defaultAskApplied || matchCollection.candidates.length === 0,
      approvalRequired: finalDecision !== 'auto_approve',
      autoApprovalAllowed: finalDecision === 'auto_approve' && pauseDecision.autoApprovalAllowed === true,
      executorExecutionAllowed: false,
      policyCheckedPauseState: true,
      pause: {
        paused: pauseDecision.paused,
        blockReason: pauseDecision.blockReason,
        emergencySafeModeActive: pauseDecision.emergencySafeModeActive,
        pauseAllAutonomy: pauseDecision.pauseAllAutonomy,
        categoryPaused: pauseDecision.categoryPaused,
      },
      evaluatedAt: evaluatedAt(),
      safety: {
        externalWritesAttempted: false,
        executorRan: false,
        autoRunTriggered: false,
        note: 'Phase 6.10 returns and tests ask/auto_approve/block policy decisions after most-restrictive conflict resolution, action-scope, condition-operator, and global cap validation only. It does not queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write to external platforms.',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildUnavailableResult(input, `Policy evaluation failed safely: ${message}`);
  }
}

export function enforceActionPolicyEvaluation<T extends { approvalRequired: boolean; policyDecision: ActionPolicyDecision }>(params: {
  normalized: T;
  policyEvaluation: EvaluateActionPolicyResult;
}): T {
  return {
    ...params.normalized,
    approvalRequired: params.policyEvaluation.decision === 'auto_approve'
      ? params.normalized.approvalRequired
      : true,
    policyDecision: params.policyEvaluation.decision,
  };
}
