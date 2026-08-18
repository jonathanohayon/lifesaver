export const POLICY_DRY_RUN_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const POLICY_DRY_RUN_USE_CASES = [
  'admin_simulation',
  'qa',
  'policy_ui_preview',
] as const;

export const POLICY_DRY_RUN_DELIVERABLE = {
  version: '0.6.0',
  phase: POLICY_DRY_RUN_PHASE,
  purpose: 'Test LIFE.SAVER V2 policy decisions without creating actions, persisting policy snapshots, queueing executors, or touching external platforms.',
  function: 'dryRunActionPolicy(input)',
  useCases: POLICY_DRY_RUN_USE_CASES,
  returns: [
    'dryRunId',
    'evaluation decision: ask / auto_approve / block',
    'reason',
    'matched_policy_id',
    'cap_status',
    'snapshotPreview for audit display only',
    'outcomePreview showing what would happen',
    'safety flags proving no writes/executors ran',
  ],
  safety: [
    'No action row is created.',
    'No policy decision snapshot is persisted.',
    'No approval state changes.',
    'No queueing.',
    'No executor runs.',
    'No external write connector is called.',
  ],
  nextPhase: 'Phase 6.10 — Policy Tests',
} as const;
