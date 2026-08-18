import { isDatabaseConfigured } from '../../db/pool.js';
import { getCategoryPauseState, getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';
import type { ActionPolicyDecision } from '../actions/actions.types.js';
import type { CategoryPauseBackendState, GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import type { KnownPolicyPauseInput, PolicyPauseDecision, PolicyPauseEvaluationInput } from './policy.types.js';
import { POLICY_PAUSE_ENFORCEMENT_PHASE } from './policy.types.js';

const POLICY_DECISIONS = new Set<ActionPolicyDecision>(['not_evaluated', 'ask', 'auto_approve', 'block']);

function checkedAt(): string {
  return new Date().toISOString();
}

function normalizeRequestedDecision(value: unknown): ActionPolicyDecision {
  return POLICY_DECISIONS.has(value as ActionPolicyDecision) ? value as ActionPolicyDecision : 'ask';
}

function buildUnavailableDecision(input: PolicyPauseEvaluationInput, reason: 'database_not_configured' | 'pause_state_unavailable'): PolicyPauseDecision {
  const requestedDecision = normalizeRequestedDecision(input.requestedDecision);
  return {
    version: '0.6.0',
    phase: POLICY_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    category: 'system',
    requestedDecision,
    effectiveDecision: 'block',
    paused: true,
    blocked: true,
    blockReason: reason,
    emergencySafeModeActive: getEmergencySafeModeState().active,
    pauseAllAutonomy: true,
    categoryPaused: true,
    autoApprovalAllowed: false,
    executorExecutionAllowed: false,
    manualReviewAllowed: true,
    proposedActionCreationAllowed: true,
    policyCheckedPauseState: true,
    checkedAt: checkedAt(),
    message: 'Policy evaluation is blocked because pause state could not be verified safely. LIFE.SAVER must never auto-approve when pause state is unknown.',
    pauseState: null,
    safety: {
      autoApproved: false,
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Fail-closed policy behavior: unknown pause state must never produce auto_approve. Future policy engines should return block or ask, not auto_approve.',
    },
  };
}


function buildEmergencySafeModePolicyDecision(input: PolicyPauseEvaluationInput): PolicyPauseDecision {
  const emergency = getEmergencySafeModeState();
  const requestedDecision = normalizeRequestedDecision(input.requestedDecision);
  return {
    version: '0.6.0',
    phase: POLICY_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    category: 'system',
    requestedDecision,
    effectiveDecision: 'block',
    paused: true,
    blocked: true,
    blockReason: 'emergency_safe_mode',
    emergencySafeModeActive: true,
    pauseAllAutonomy: true,
    categoryPaused: true,
    autoApprovalAllowed: false,
    executorExecutionAllowed: false,
    manualReviewAllowed: true,
    proposedActionCreationAllowed: true,
    policyCheckedPauseState: true,
    checkedAt: checkedAt(),
    message: emergency.reason || 'Emergency safe mode is active. Policy evaluation is blocked and auto-approval is forbidden.',
    pauseState: null,
    safety: {
      autoApproved: false,
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Environment-level emergency safe mode overrides policy rules. It must return block/ask and never auto_approve.',
    },
  };
}

function decideEffectivePolicy(input: {
  requestedDecision: ActionPolicyDecision;
  pauseState: GlobalPauseBackendState;
  categoryPauseState: CategoryPauseBackendState;
  enforcementMode?: 'ask_when_paused' | 'block_when_paused';
}): { effectiveDecision: ActionPolicyDecision; blocked: boolean; blockReason: PolicyPauseDecision['blockReason']; message: string } {
  const emergencyActive = input.pauseState.emergencySafeMode?.active === true;
  const globallyPaused = input.pauseState.pauseAllAutonomy;
  const categoryPaused = input.categoryPauseState.categoryPaused;
  const paused = emergencyActive || globallyPaused || categoryPaused;

  if (emergencyActive) {
    return {
      effectiveDecision: 'block',
      blocked: true,
      blockReason: 'emergency_safe_mode',
      message: 'Emergency safe mode is active and overrides policy rules. Auto-approval is forbidden and execution must remain blocked.',
    };
  }

  if (!paused) {
    return {
      effectiveDecision: input.requestedDecision,
      blocked: false,
      blockReason: 'none',
      message: 'Pause state allows policy evaluation to continue. This is not permission to execute; approvals, caps, audit logs, idempotency, and executor pause checks still apply.',
    };
  }

  const blockReason: PolicyPauseDecision['blockReason'] = globallyPaused ? 'global_pause' : 'category_pause';

  if (input.requestedDecision === 'block' || input.enforcementMode === 'block_when_paused') {
    return {
      effectiveDecision: 'block',
      blocked: true,
      blockReason,
      message: 'Policy evaluation detected active pause state and returned block. Auto-approval is forbidden while paused.',
    };
  }

  return {
    effectiveDecision: 'ask',
    blocked: false,
    blockReason,
    message: 'Policy evaluation detected active pause state and forced ask/manual review. Auto-approval is forbidden while paused.',
  };
}

export function applyPolicyPauseDecisionWithKnownState(input: KnownPolicyPauseInput): PolicyPauseDecision {
  const requestedDecision = normalizeRequestedDecision(input.requestedDecision);
  const decision = decideEffectivePolicy({
    requestedDecision,
    pauseState: input.pauseState,
    categoryPauseState: input.categoryPauseState,
    enforcementMode: input.enforcementMode,
  });
  const paused = input.pauseState.emergencySafeMode?.active === true || input.pauseState.pauseAllAutonomy || input.categoryPauseState.categoryPaused;

  return {
    version: '0.6.0',
    phase: POLICY_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    category: input.categoryPauseState.category,
    requestedDecision,
    effectiveDecision: decision.effectiveDecision,
    paused,
    blocked: decision.blocked,
    blockReason: decision.blockReason,
    emergencySafeModeActive: input.pauseState.emergencySafeMode?.active === true,
    pauseAllAutonomy: input.pauseState.pauseAllAutonomy,
    categoryPaused: input.categoryPauseState.categoryPaused,
    autoApprovalAllowed: paused ? false : input.categoryPauseState.autoApprovalAllowed,
    executorExecutionAllowed: paused ? false : input.categoryPauseState.executorExecutionAllowed,
    manualReviewAllowed: true,
    proposedActionCreationAllowed: true,
    policyCheckedPauseState: true,
    checkedAt: checkedAt(),
    message: decision.message,
    pauseState: {
      global: {
        pauseAllAutonomy: input.pauseState.pauseAllAutonomy,
        pauseContentActions: input.pauseState.pauseContentActions,
        pauseSupportActions: input.pauseState.pauseSupportActions,
        pauseAdsActions: input.pauseState.pauseAdsActions,
        pauseResearchActions: input.pauseState.pauseResearchActions,
        pauseDevActions: input.pauseState.pauseDevActions,
      },
      category: input.categoryPauseState,
    },
    safety: {
      autoApproved: false,
      externalWritesAttempted: false,
      executorRan: false,
      note: paused
        ? 'Active pause state forces policy decision away from auto_approve. Existing proposed actions remain reviewable; safe new proposed actions may still be created for manual review.'
        : 'No pause is active for this action category. Policy result still cannot execute anything by itself.',
    },
  };
}

export async function evaluatePolicyPauseState(input: PolicyPauseEvaluationInput): Promise<PolicyPauseDecision> {
  if (getEmergencySafeModeState().active) return buildEmergencySafeModePolicyDecision(input);
  if (!isDatabaseConfigured) return buildUnavailableDecision(input, 'database_not_configured');

  try {
    const pauseState = await getGlobalPauseStateForWorkspace(input.workspaceId);
    const categoryPauseState = getCategoryPauseState({ pauseState, actionType: input.actionType });
    return applyPolicyPauseDecisionWithKnownState({ ...input, pauseState, categoryPauseState });
  } catch {
    return buildUnavailableDecision(input, 'pause_state_unavailable');
  }
}

export function enforcePolicyPauseDecision<T extends { approvalRequired: boolean; policyDecision: ActionPolicyDecision }>(params: {
  normalized: T;
  policyPauseDecision: PolicyPauseDecision;
}): T {
  if (params.policyPauseDecision.effectiveDecision === params.normalized.policyDecision) return params.normalized;

  return {
    ...params.normalized,
    approvalRequired: params.policyPauseDecision.effectiveDecision === 'auto_approve' ? params.normalized.approvalRequired : true,
    policyDecision: params.policyPauseDecision.effectiveDecision,
  };
}
