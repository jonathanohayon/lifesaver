export const AUTONOMY_GLOBAL_PAUSE_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export interface GlobalPauseStateReference {
  workspaceId: string;
  pauseAllAutonomy: boolean;
  enforcement: {
    autoApprovalAllowed: boolean;
    executorExecutionAllowed: boolean;
    proposedActionCreationAllowed: boolean;
    manualReviewAllowed: boolean;
  };
}

export const GLOBAL_PAUSE_RULES = {
  phase: AUTONOMY_GLOBAL_PAUSE_PHASE,
  whenPauseAllAutonomyIsTrue: {
    noAutoApproval: true,
    noExecutorExecution: true,
    existingProposedActionsRemainReviewable: true,
    safeNewProposedActionsMayStillBeCreated: true,
  },
  allowedInPhase53: [
    'read pause_all_autonomy from autonomy_settings',
    'create a default autonomy_settings row for a workspace when missing',
    'force proposed actions to policy_decision=ask when global or relevant category pause is active',
    'force proposed actions to approval_required=true when global or relevant category pause is active',
    'include pause state in internal createProposedAction audit metadata',
    'document future policy/executor enforcement rules'
  ],
  forbiddenInPhase53: [
    'pause/resume API endpoints',
    'pause switch UI',
    'policy auto-approval',
    'executor registry',
    'sandbox executor',
    'real executor',
    'queueing actions for execution',
    'content publishing',
    'support sending',
    'ad budget changes',
    'campaign pause',
    'external platform writes'
  ]
} as const;

export function canAutoApproveWithGlobalPause(pauseAllAutonomy: boolean): false | 'not_blocked_by_global_pause' {
  return pauseAllAutonomy ? false : 'not_blocked_by_global_pause';
}

export function canExecuteWithGlobalPause(pauseAllAutonomy: boolean): false | 'not_blocked_by_global_pause' {
  return pauseAllAutonomy ? false : 'not_blocked_by_global_pause';
}
