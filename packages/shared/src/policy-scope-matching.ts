export const POLICY_SCOPE_MATCHING_PHASE = 'v0.6.0 Phase 6.6 Global Caps Foundation' as const;

export const POLICY_SCOPE_FIELDS = [
  'action_type',
  'platform',
  'channel',
  'workspace',
  'risk_level',
  'amount',
  'category',
  'confidence_score',
] as const;

export type PolicyScopeField = typeof POLICY_SCOPE_FIELDS[number];

export const POLICY_SCOPE_MATCHING_SAFETY_RULES = [
  'Scope matching only decides whether a policy rule is eligible for an action.',
  'Scope matching can match action type, platform, channel, workspace, risk level, amount, category, and confidence score.',
  'Unsupported or missing scope values fail closed by not matching the policy.',
  'A scope match does not execute, queue, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
  'Default ask remains active when no scoped policy matches.',
  'Pause and emergency safe mode still override auto_approve.',
] as const;

export type PolicyScopeMatchingContract = {
  version: '0.6.0';
  phase: typeof POLICY_SCOPE_MATCHING_PHASE;
  fields: typeof POLICY_SCOPE_FIELDS;
  matchOnly: true;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_SCOPE_MATCHING_SAFETY_RULES;
};

export const POLICY_SCOPE_MATCHING_CONTRACT: PolicyScopeMatchingContract = {
  version: '0.6.0',
  phase: POLICY_SCOPE_MATCHING_PHASE,
  fields: POLICY_SCOPE_FIELDS,
  matchOnly: true,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_SCOPE_MATCHING_SAFETY_RULES,
};
