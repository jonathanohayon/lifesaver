export const POLICY_CONFLICT_RESOLUTION_PHASE = 'v0.6.0 Phase 6.7 Policy Conflict Resolution' as const;

export const POLICY_CONFLICT_PRIORITY_ORDER = [
  'master_pause',
  'block_rule',
  'hard_cap_exceeded',
  'ask_rule',
  'auto_approve_rule',
] as const;

export type PolicyConflictPriority = typeof POLICY_CONFLICT_PRIORITY_ORDER[number];

export const POLICY_CONFLICT_RESOLUTION_SAFETY_RULES = [
  'Most restrictive rule wins when multiple policy rules match the same action.',
  'Master pause, category pause, and emergency safe mode override every policy decision.',
  'A block rule wins over hard caps, ask rules, and auto-approve rules.',
  'A hard cap exceeded blocks before ask or auto-approve may continue.',
  'An ask rule requires founder review before auto-approval may continue.',
  'Auto-approve is only possible when no more restrictive matched rule, cap failure, or pause state applies.',
  'Conflict resolution does not queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
] as const;

export type PolicyConflictResolutionContract = {
  version: '0.6.0';
  phase: typeof POLICY_CONFLICT_RESOLUTION_PHASE;
  priorityOrder: typeof POLICY_CONFLICT_PRIORITY_ORDER;
  mostRestrictiveWins: true;
  executorEnabled: false;
  externalWritesEnabled: false;
  safetyRules: typeof POLICY_CONFLICT_RESOLUTION_SAFETY_RULES;
};

export const POLICY_CONFLICT_RESOLUTION_CONTRACT: PolicyConflictResolutionContract = {
  version: '0.6.0',
  phase: POLICY_CONFLICT_RESOLUTION_PHASE,
  priorityOrder: POLICY_CONFLICT_PRIORITY_ORDER,
  mostRestrictiveWins: true,
  executorEnabled: false,
  externalWritesEnabled: false,
  safetyRules: POLICY_CONFLICT_RESOLUTION_SAFETY_RULES,
};
