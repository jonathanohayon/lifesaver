export const POLICY_DEFAULT_ASK_PHASE = 'v0.6.0 Phase 6.2 Default Ask Policy' as const;

export const DEFAULT_ASK_POLICY_RULES = [
  'If no enabled rule matches, the effective decision must be ask.',
  'A caller or tool cannot produce auto_approve merely by requesting auto_approve.',
  'auto_approve is only allowed to continue to later safety checks when an explicit enabled policy rule matches.',
  'Default ask never queues or executes an action.',
  'Default ask never writes to external platforms.',
  'Manual review remains allowed when default ask is applied.',
] as const;

export type DefaultAskDecision = 'ask' | 'auto_approve' | 'block';
export type DefaultAskRuleMatchState = 'matched' | 'no_match';

export type DefaultAskPolicyContract = {
  version: '0.6.0';
  phase: typeof POLICY_DEFAULT_ASK_PHASE;
  behavior: 'default_ask_when_no_rule_matches';
  noRuleDecision: 'ask';
  autoApproveRequiresMatchedPolicy: true;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof DEFAULT_ASK_POLICY_RULES;
};

export const DEFAULT_ASK_POLICY_CONTRACT: DefaultAskPolicyContract = {
  version: '0.6.0',
  phase: POLICY_DEFAULT_ASK_PHASE,
  behavior: 'default_ask_when_no_rule_matches',
  noRuleDecision: 'ask',
  autoApproveRequiresMatchedPolicy: true,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: DEFAULT_ASK_POLICY_RULES,
};
