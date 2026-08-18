export const POLICY_TESTS_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const REQUIRED_POLICY_TEST_SCENARIOS = [
  'ask_by_default',
  'auto_approve_when_rule_matches',
  'block_when_rule_matches',
  'cap_exceeded',
  'pause_active',
  'conflicting_rules',
] as const;

export const POLICY_TESTS_SAFETY_CONTRACT = {
  version: '0.6.0',
  phase: POLICY_TESTS_PHASE,
  databaseWritesPerformed: false,
  executorEnabled: false,
  executorRan: false,
  externalWritesEnabled: false,
  externalWritesAttempted: false,
  autoRunTriggered: false,
  note: 'Phase 6.10 is test coverage only. It verifies policy decisions and never creates actions, queues execution, runs executors, or writes externally.',
} as const;
