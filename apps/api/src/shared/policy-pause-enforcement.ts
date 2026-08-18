export const POLICY_PAUSE_ENFORCEMENT_PHASE = 'v0.6.0 Phase 5.7 Policy Pause Enforcement' as const;

export const POLICY_PAUSE_RULES = [
  'Every future policy evaluation must read global and category pause state before returning auto_approve.',
  'If pause_all_autonomy is active, policy evaluation must return ask or block and must never return auto_approve.',
  'If a category pause is active, policy evaluation for that category must return ask or block and must never return auto_approve.',
  'If pause state cannot be read, policy evaluation must fail closed and return block or ask, not auto_approve.',
  'Existing proposed actions remain reviewable while paused.',
  'Safe new proposed actions may still be created while paused, but they must require founder review.',
] as const;

export const POLICY_PAUSE_DECISION_MATRIX = {
  notPaused: {
    requestedAsk: 'ask',
    requestedBlock: 'block',
    requestedAutoApprove: 'auto_approve_allowed_for_future_policy_only',
  },
  paused: {
    requestedAsk: 'ask',
    requestedBlock: 'block',
    requestedAutoApprove: 'ask_or_block_only_never_auto_approve',
  },
  pauseUnknown: {
    anyRequestedDecision: 'block_fail_closed',
  },
} as const;

export const POLICY_PAUSE_DISABLED_CAPABILITIES = [
  'policy auto-approval while paused',
  'executor execution while paused',
  'external writes',
  'content publishing',
  'support reply sending',
  'ad budget changes',
  'campaign pausing',
  'rollback execution',
  'auto-run rules',
] as const;
