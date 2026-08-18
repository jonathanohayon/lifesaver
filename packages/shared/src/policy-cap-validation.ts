export const POLICY_CAP_VALIDATION_PHASE = 'v0.6.0 Phase 6.6 Global Caps Foundation' as const;

export const POLICY_GLOBAL_CAPS = [
  'max_posts_per_day',
  'max_support_auto_replies_per_day',
  'max_ad_spend_change_per_day',
  'max_model_cost_per_day',
  'max_actions_per_hour',
] as const;

export type PolicyGlobalCap = typeof POLICY_GLOBAL_CAPS[number];

export const POLICY_CAP_STATUSES = [
  'not_applicable_no_policy_match',
  'no_caps_defined',
  'caps_ok',
  'cap_exceeded',
  'cap_usage_unavailable',
  'blocked_by_pause_or_emergency',
  'database_unavailable',
] as const;

export type PolicyCapStatus = typeof POLICY_CAP_STATUSES[number];

export const POLICY_CAP_VALIDATION_SAFETY_RULES = [
  'Global caps are checked before auto-approval may continue.',
  'Supported caps include max posts/day, support auto-replies/day, ad spend change/day, model cost/day, and actions/hour.',
  'If cap usage cannot be verified, auto-approval must not continue.',
  'If a hard cap would be exceeded, the policy decision must block the action.',
  'Cap validation does not queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
  'Pause and emergency safe mode still override policy and cap decisions.',
] as const;

export type PolicyCapValidationContract = {
  version: '0.6.0';
  phase: typeof POLICY_CAP_VALIDATION_PHASE;
  caps: typeof POLICY_GLOBAL_CAPS;
  statuses: typeof POLICY_CAP_STATUSES;
  validationOnly: true;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_CAP_VALIDATION_SAFETY_RULES;
};

export const POLICY_CAP_VALIDATION_CONTRACT: PolicyCapValidationContract = {
  version: '0.6.0',
  phase: POLICY_CAP_VALIDATION_PHASE,
  caps: POLICY_GLOBAL_CAPS,
  statuses: POLICY_CAP_STATUSES,
  validationOnly: true,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_CAP_VALIDATION_SAFETY_RULES,
};
