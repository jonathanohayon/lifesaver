import type { ActionPolicyDecision } from '../actions/actions.types.js';
import type { PolicyCapStatus } from './policy.types.js';

export const POLICY_CONFLICT_RESOLUTION_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export type PolicyConflictDecision = Exclude<ActionPolicyDecision, 'not_evaluated'>;

export type PolicyConflictResolutionReasonCode =
  | 'no_matched_policy_default_ask'
  | 'master_pause_or_emergency_override'
  | 'block_rule_wins'
  | 'hard_cap_exceeded_wins'
  | 'ask_rule_wins'
  | 'cap_usage_unavailable_asks'
  | 'auto_approve_rule_wins';

export type PolicyConflictCandidate = {
  policyId: string;
  policyName: string;
  decision: PolicyConflictDecision;
  priority: number;
  order: number;
  capStatus: PolicyCapStatus;
  capAllowed: boolean | null;
  reason: string;
};

export type PolicyConflictResolutionResult = {
  version: '0.6.0';
  phase: typeof POLICY_CONFLICT_RESOLUTION_PHASE;
  decision: PolicyConflictDecision;
  reasonCode: PolicyConflictResolutionReasonCode;
  reason: string;
  matchedPolicyId: string | null;
  matched_policy_id: string | null;
  capStatus: PolicyCapStatus;
  cap_status: PolicyCapStatus;
  matchedCandidateCount: number;
  winningCandidate: PolicyConflictCandidate | null;
  candidates: PolicyConflictCandidate[];
  priorityOrder: [
    'master_pause',
    'block_rule',
    'hard_cap_exceeded',
    'ask_rule',
    'auto_approve_rule'
  ];
  safety: {
    mostRestrictiveWins: true;
    defaultAskWhenNoMatch: true;
    executorRan: false;
    externalWritesAttempted: false;
    autoRunTriggered: false;
    note: string;
  };
};

const priorityOrder: PolicyConflictResolutionResult['priorityOrder'] = [
  'master_pause',
  'block_rule',
  'hard_cap_exceeded',
  'ask_rule',
  'auto_approve_rule',
];

function sortCandidates(candidates: PolicyConflictCandidate[]): PolicyConflictCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.order - b.order;
  });
}

function buildResult(params: {
  decision: PolicyConflictDecision;
  reasonCode: PolicyConflictResolutionReasonCode;
  reason: string;
  candidate: PolicyConflictCandidate | null;
  candidates: PolicyConflictCandidate[];
  capStatus?: PolicyCapStatus;
}): PolicyConflictResolutionResult {
  return {
    version: '0.6.0',
    phase: POLICY_CONFLICT_RESOLUTION_PHASE,
    decision: params.decision,
    reasonCode: params.reasonCode,
    reason: params.reason,
    matchedPolicyId: params.candidate?.policyId || null,
    matched_policy_id: params.candidate?.policyId || null,
    capStatus: params.capStatus || params.candidate?.capStatus || 'not_applicable_no_policy_match',
    cap_status: params.capStatus || params.candidate?.capStatus || 'not_applicable_no_policy_match',
    matchedCandidateCount: params.candidates.length,
    winningCandidate: params.candidate,
    candidates: params.candidates,
    priorityOrder,
    safety: {
      mostRestrictiveWins: true,
      defaultAskWhenNoMatch: true,
      executorRan: false,
      externalWritesAttempted: false,
      autoRunTriggered: false,
      note: 'Phase 6.7 resolves policy conflicts only. It never queues, executes, publishes, sends, spends, pauses campaigns, refunds, edits products, rolls back, or writes externally.',
    },
  };
}

export function resolvePolicyConflicts(params: {
  candidates: PolicyConflictCandidate[];
  pauseBlocked?: boolean;
  pauseReason?: string | null;
}): PolicyConflictResolutionResult {
  const candidates = sortCandidates(params.candidates);

  if (params.pauseBlocked) {
    return buildResult({
      decision: 'ask',
      reasonCode: 'master_pause_or_emergency_override',
      reason: params.pauseReason || 'Master pause, category pause, or emergency safe mode overrides every policy decision. Auto-approval is not allowed while paused.',
      candidate: null,
      candidates,
      capStatus: 'blocked_by_pause_or_emergency',
    });
  }

  if (candidates.length === 0) {
    return buildResult({
      decision: 'ask',
      reasonCode: 'no_matched_policy_default_ask',
      reason: 'No enabled policy rule matched this action, so default ask/manual review applies.',
      candidate: null,
      candidates,
      capStatus: 'not_applicable_no_policy_match',
    });
  }

  const blockRule = candidates.find((candidate) => candidate.decision === 'block');
  if (blockRule) {
    return buildResult({
      decision: 'block',
      reasonCode: 'block_rule_wins',
      reason: `Most restrictive rule wins: block policy "${blockRule.policyName}" matched before any ask or auto-approve rule may continue.`,
      candidate: blockRule,
      candidates,
    });
  }

  const capExceeded = candidates.find((candidate) => candidate.capStatus === 'cap_exceeded');
  if (capExceeded) {
    return buildResult({
      decision: 'block',
      reasonCode: 'hard_cap_exceeded_wins',
      reason: `Most restrictive rule wins: hard cap exceeded for policy "${capExceeded.policyName}". The action is blocked before ask or auto-approve rules may continue.`,
      candidate: capExceeded,
      candidates,
      capStatus: 'cap_exceeded',
    });
  }

  const askRule = candidates.find((candidate) => candidate.decision === 'ask');
  if (askRule) {
    return buildResult({
      decision: 'ask',
      reasonCode: 'ask_rule_wins',
      reason: `Most restrictive rule wins: ask policy "${askRule.policyName}" matched, so founder approval is required before any future execution path may continue.`,
      candidate: askRule,
      candidates,
    });
  }

  const unavailableCaps = candidates.find((candidate) => candidate.capStatus === 'cap_usage_unavailable');
  if (unavailableCaps) {
    return buildResult({
      decision: 'ask',
      reasonCode: 'cap_usage_unavailable_asks',
      reason: `Caps are defined for policy "${unavailableCaps.policyName}", but current usage could not be verified. LIFE.SAVER downgrades auto-approval to ask/manual review.`,
      candidate: unavailableCaps,
      candidates,
      capStatus: 'cap_usage_unavailable',
    });
  }

  const autoApproveRule = candidates.find((candidate) => candidate.decision === 'auto_approve');
  if (autoApproveRule) {
    return buildResult({
      decision: 'auto_approve',
      reasonCode: 'auto_approve_rule_wins',
      reason: `Auto-approve policy "${autoApproveRule.policyName}" matched and no block rule, hard-cap failure, ask rule, pause state, or cap-usage failure was more restrictive.`,
      candidate: autoApproveRule,
      candidates,
    });
  }

  return buildResult({
    decision: 'ask',
    reasonCode: 'no_matched_policy_default_ask',
    reason: 'Matched policy candidates were present, but none produced a supported decision. Default ask/manual review applies.',
    candidate: null,
    candidates,
    capStatus: 'not_applicable_no_policy_match',
  });
}

export function policyConflictResolutionLibraryStatus() {
  return {
    version: '0.6.0',
    phase: POLICY_CONFLICT_RESOLUTION_PHASE,
    priorityOrder,
    mostRestrictiveWins: true,
    executorEnabled: false,
    externalWritesEnabled: false,
  };
}
