import type { ActionPolicyDecision, ActionType } from '../actions/actions.types.js';

export const POLICY_DEFAULT_ASK_PHASE = 'v0.6.0 Phase 6.2 Default Ask Policy' as const;

export type DefaultAskRuleMatchState = 'matched' | 'no_match';

export type DefaultAskPolicyInput = {
  workspaceId: string;
  actionType: ActionType;
  requestedDecision?: ActionPolicyDecision | null;
  matchedPolicyId?: string | null;
  matchedPolicyDecision?: ActionPolicyDecision | null;
  source?: string | null;
};

export type DefaultAskPolicyDecision = {
  version: '0.6.0';
  phase: typeof POLICY_DEFAULT_ASK_PHASE;
  workspaceId: string;
  actionType: ActionType;
  requestedDecision: ActionPolicyDecision;
  ruleMatchState: DefaultAskRuleMatchState;
  matchedPolicyId: string | null;
  matchedPolicyDecision: ActionPolicyDecision | null;
  effectiveDecision: ActionPolicyDecision;
  defaultAskApplied: boolean;
  approvalRequired: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: false;
  manualReviewRequired: boolean;
  evaluatedAt: string;
  message: string;
  safety: {
    defaultToAsk: true;
    autoApprovedWithoutMatchedPolicy: false;
    externalWritesAttempted: false;
    executorRan: false;
    note: string;
  };
};

const VALID_ACTION_POLICY_DECISIONS = new Set<ActionPolicyDecision>([
  'not_evaluated',
  'ask',
  'auto_approve',
  'block',
]);

function normalizeDecision(value: unknown): ActionPolicyDecision {
  return VALID_ACTION_POLICY_DECISIONS.has(value as ActionPolicyDecision)
    ? value as ActionPolicyDecision
    : 'not_evaluated';
}

function normalizeMatchedPolicyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean.slice(0, 120) : null;
}

export function evaluateDefaultAskPolicy(input: DefaultAskPolicyInput): DefaultAskPolicyDecision {
  const requestedDecision = normalizeDecision(input.requestedDecision);
  const matchedPolicyId = normalizeMatchedPolicyId(input.matchedPolicyId);
  const matchedPolicyDecision = matchedPolicyId ? normalizeDecision(input.matchedPolicyDecision) : null;
  const ruleMatchState: DefaultAskRuleMatchState = matchedPolicyId && matchedPolicyDecision ? 'matched' : 'no_match';

  const effectiveDecision: ActionPolicyDecision = ruleMatchState === 'matched' && matchedPolicyDecision
    ? (matchedPolicyDecision === 'not_evaluated' ? 'ask' : matchedPolicyDecision)
    : 'ask';

  const defaultAskApplied = ruleMatchState === 'no_match' || matchedPolicyDecision === 'not_evaluated';
  const autoApprovalAllowed = ruleMatchState === 'matched' && effectiveDecision === 'auto_approve';
  const manualReviewRequired = effectiveDecision !== 'auto_approve';

  return {
    version: '0.6.0',
    phase: POLICY_DEFAULT_ASK_PHASE,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    requestedDecision,
    ruleMatchState,
    matchedPolicyId,
    matchedPolicyDecision,
    effectiveDecision,
    defaultAskApplied,
    approvalRequired: manualReviewRequired,
    autoApprovalAllowed,
    executorExecutionAllowed: false,
    manualReviewRequired,
    evaluatedAt: new Date().toISOString(),
    message: defaultAskApplied
      ? 'No enabled policy rule matched this action, so LIFE.SAVER defaulted to ask/manual review. Auto-approval is not allowed without an explicit matched policy rule.'
      : 'An explicit policy rule matched this action. This decision still cannot execute anything by itself; pause, caps, audit, idempotency, permissions, and executor guards must pass later.',
    safety: {
      defaultToAsk: true,
      autoApprovedWithoutMatchedPolicy: false,
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Phase 6.2 defines default ask behavior only. It does not create auto-run rules, execute actions, publish content, send replies, change ad spend, or write externally.',
    },
  };
}

export function enforceDefaultAskDecision<T extends { approvalRequired: boolean; policyDecision: ActionPolicyDecision }>(params: {
  normalized: T;
  defaultAskDecision: DefaultAskPolicyDecision;
}): T {
  return {
    ...params.normalized,
    approvalRequired: params.defaultAskDecision.effectiveDecision === 'auto_approve'
      ? params.normalized.approvalRequired
      : true,
    policyDecision: params.defaultAskDecision.effectiveDecision,
  };
}
