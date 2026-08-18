import type { ActionPolicyDecision, ActionRiskLevel, ActionType } from '../actions/actions.types.js';
import type { AutonomyActionCategory, CategoryPauseBackendState, GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import type { PolicyCapCheckResult, PolicyCapUsageSnapshot } from './policy.cap-validation.js';

export const POLICY_PAUSE_ENFORCEMENT_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export type PolicyPauseBlockReason =
  | 'none'
  | 'global_pause'
  | 'category_pause'
  | 'database_not_configured'
  | 'pause_state_unavailable'
  | 'emergency_safe_mode';

export type PolicyPauseEnforcementMode = 'ask_when_paused' | 'block_when_paused';

export type PolicyPauseEvaluationInput = {
  workspaceId: string;
  actionType: ActionType;
  requestedDecision?: ActionPolicyDecision | null;
  enforcementMode?: PolicyPauseEnforcementMode;
  source?: string | null;
};

export type KnownPolicyPauseInput = PolicyPauseEvaluationInput & {
  pauseState: GlobalPauseBackendState;
  categoryPauseState: CategoryPauseBackendState;
};

export type PolicyPauseDecision = {
  version: '0.6.0';
  phase: typeof POLICY_PAUSE_ENFORCEMENT_PHASE;
  workspaceId: string;
  actionType: ActionType;
  category: AutonomyActionCategory;
  requestedDecision: ActionPolicyDecision;
  effectiveDecision: ActionPolicyDecision;
  paused: boolean;
  blocked: boolean;
  blockReason: PolicyPauseBlockReason;
  emergencySafeModeActive: boolean;
  pauseAllAutonomy: boolean;
  categoryPaused: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: boolean;
  manualReviewAllowed: boolean;
  proposedActionCreationAllowed: boolean;
  policyCheckedPauseState: true;
  checkedAt: string;
  message: string;
  pauseState: {
    global: Pick<GlobalPauseBackendState, 'pauseAllAutonomy' | 'pauseContentActions' | 'pauseSupportActions' | 'pauseAdsActions' | 'pauseResearchActions' | 'pauseDevActions'>;
    category: CategoryPauseBackendState;
  } | null;
  safety: {
    autoApproved: false;
    externalWritesAttempted: false;
    executorRan: false;
    note: string;
  };
};

export const POLICY_EVALUATOR_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export type PolicyConditionMatchState =
  | 'matched_empty_conditions'
  | 'matched_always_true'
  | 'matched_condition_operators'
  | 'not_matched_condition_operators'
  | 'unsupported_condition_operators'
  | 'matched_action_scope'
  | 'not_matched_action_scope'
  | 'unsupported_action_scope'
  | 'no_enabled_policy'
  | 'policy_lookup_unavailable';

export type PolicyCapStatus =
  | 'not_applicable_no_policy_match'
  | 'no_caps_defined'
  | 'caps_ok'
  | 'cap_exceeded'
  | 'cap_usage_unavailable'
  | 'blocked_by_pause_or_emergency'
  | 'database_unavailable';

export type EvaluateActionPolicyInput = {
  workspaceId: string;
  actionId?: string | null;
  actionType: ActionType;
  riskLevel?: ActionRiskLevel | null;
  payloadJson?: Record<string, unknown>;
  requestedDecision?: ActionPolicyDecision | null;
  source?: string | null;
  policyRows?: Array<{
    id: string;
    workspace_id: string;
    name: string;
    action_type: ActionType;
    conditions_json: Record<string, unknown>;
    decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
    caps_json: Record<string, unknown>;
    priority: number;
    enabled: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: Date;
    updated_at: Date;
  }>;
  capUsage?: PolicyCapUsageSnapshot | null;
  knownPauseState?: GlobalPauseBackendState;
  knownCategoryPauseState?: CategoryPauseBackendState;
};

export type EvaluateActionPolicyResult = {
  version: '0.6.0';
  phase: typeof POLICY_EVALUATOR_PHASE;
  workspaceId: string;
  actionId: string | null;
  actionType: ActionType;
  riskLevel: ActionRiskLevel | null;
  decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
  reason: string;
  matched_policy_id: string | null;
  matchedPolicyId: string | null;
  cap_status: PolicyCapStatus;
  capStatus: PolicyCapStatus;
  capSummary?: {
    allowed: boolean;
    checkedCount: number;
    exceededCount: number;
    capsDefined: boolean;
    usageSource: PolicyCapUsageSnapshot['source'];
    reason: string;
    checks: PolicyCapCheckResult[];
    usage: PolicyCapUsageSnapshot | null;
  };
  checkedPolicyCount: number;
  matchState: PolicyConditionMatchState;
  defaultAskApplied: boolean;
  approvalRequired: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: false;
  policyCheckedPauseState: boolean;
  pause: {
    paused: boolean;
    blockReason: PolicyPauseBlockReason | 'pause_state_unavailable';
    emergencySafeModeActive: boolean;
    pauseAllAutonomy: boolean;
    categoryPaused: boolean;
  };
  scopeSummary?: {
    supported: boolean;
    matched: boolean;
    emptyScope: boolean;
    checkedCount: number;
    actionScope: {
      platform: string | null;
      channel: string | null;
      riskLevel: ActionRiskLevel | null;
      amount: number | null;
      category: string | null;
      confidenceScore: number | null;
    };
    checked: Array<{
      field: string;
      matched: boolean;
      supported: boolean;
      reason: string;
    }>;
  };
  conditionSummary?: {
    supported: boolean;
    matchMode: string;
    checkedCount: number;
    checked: Array<{
      operator: string;
      matched: boolean;
      supported: boolean;
      field?: string | null;
      reason: string;
    }>;
  };

  conflictSummary?: {
    reasonCode: string;
    priorityOrder: [
      'master_pause',
      'block_rule',
      'hard_cap_exceeded',
      'ask_rule',
      'auto_approve_rule'
    ];
    matchedCandidateCount: number;
    winningCandidate: {
      policyId: string;
      policyName: string;
      decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
      capStatus: PolicyCapStatus;
      priority: number;
    } | null;
    candidates: Array<{
      policyId: string;
      policyName: string;
      decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
      capStatus: PolicyCapStatus;
      priority: number;
    }>;
  };
  evaluatedAt: string;
  safety: {
    externalWritesAttempted: false;
    executorRan: false;
    autoRunTriggered: false;
    note: string;
  };
};
