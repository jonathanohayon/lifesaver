export const POLICY_EVALUATOR_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const POLICY_EVALUATOR_DECISIONS = ['ask', 'auto_approve', 'block'] as const;
export type PolicyEvaluatorDecision = typeof POLICY_EVALUATOR_DECISIONS[number];

export const POLICY_EVALUATOR_CAP_STATUSES = [
  'not_applicable_no_policy_match',
  'no_caps_defined',
  'caps_ok',
  'cap_exceeded',
  'cap_usage_unavailable',
  'blocked_by_pause_or_emergency',
  'database_unavailable',
] as const;
export type PolicyEvaluatorCapStatus = typeof POLICY_EVALUATOR_CAP_STATUSES[number];

export const POLICY_EVALUATOR_SAFETY_RULES = [
  'evaluateActionPolicy(action) returns ask, auto_approve, or block only.',
  'The evaluator must include reason, matched_policy_id, and cap_status.',
  'No enabled matching policy means ask/manual review.',
  'Phase 6.10 keeps action scope matching for action type, platform, channel, workspace, risk level, amount, category, and confidence score.',
  'Condition operators from Phase 6.4 still apply after scope matching. Caps are validated through the Phase 6.6 global caps foundation, then Phase 6.7 resolves conflicts using most-restrictive-wins priority.',
  'Conflict priority remains: master pause, block rule, hard cap exceeded, ask rule, auto-approve rule.',
  'Phase 6.10 supports dry-run previews for admin simulation, QA, and future policy UI preview. The evaluator cannot queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
] as const;

export type PolicyEvaluatorContract = {
  version: '0.6.0';
  phase: typeof POLICY_EVALUATOR_PHASE;
  functionName: 'evaluateActionPolicy';
  returns: {
    decision: PolicyEvaluatorDecision;
    reason: string;
    matched_policy_id: string | null;
    cap_status: PolicyEvaluatorCapStatus;
  };
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_EVALUATOR_SAFETY_RULES;
};

export const POLICY_EVALUATOR_CONTRACT: PolicyEvaluatorContract = {
  version: '0.6.0',
  phase: POLICY_EVALUATOR_PHASE,
  functionName: 'evaluateActionPolicy',
  returns: {
    decision: 'ask',
    reason: 'Example contract shape only.',
    matched_policy_id: null,
    cap_status: 'not_applicable_no_policy_match',
  },
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_EVALUATOR_SAFETY_RULES,
};
