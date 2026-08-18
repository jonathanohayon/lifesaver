export const POLICY_CONDITION_OPERATOR_PHASE = 'v0.6.0 Phase 6.6 Global Caps Foundation' as const;

export const POLICY_CONDITION_OPERATORS = [
  'equals',
  'contains',
  'less_than',
  'greater_than',
  'channel_is',
  'risk_below',
  'confidence_above',
  'amount_below',
] as const;

export type PolicyConditionOperator = typeof POLICY_CONDITION_OPERATORS[number];

export const POLICY_CONDITION_OPERATOR_SAFETY_RULES = [
  'Condition operators decide whether a scoped policy rule matches an action after Phase 6.5 scope matching.',
  'Condition operators cannot approve, queue, execute, publish, send, spend, refund, edit products, or write externally.',
  'Unsupported or invalid conditions fail closed by not matching the policy.',
  'If no policy condition matches, the existing default-ask behaviour remains in control.',
  'Pause and emergency safe mode still override auto-approval.',
] as const;

export type PolicyConditionOperatorContract = {
  version: '0.6.0';
  phase: typeof POLICY_CONDITION_OPERATOR_PHASE;
  operators: typeof POLICY_CONDITION_OPERATORS;
  matchOnly: true;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_CONDITION_OPERATOR_SAFETY_RULES;
};

export const POLICY_CONDITION_OPERATOR_CONTRACT: PolicyConditionOperatorContract = {
  version: '0.6.0',
  phase: POLICY_CONDITION_OPERATOR_PHASE,
  operators: POLICY_CONDITION_OPERATORS,
  matchOnly: true,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_CONDITION_OPERATOR_SAFETY_RULES,
};
