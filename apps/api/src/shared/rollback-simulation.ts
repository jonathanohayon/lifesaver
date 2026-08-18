export const ROLLBACK_SIMULATION_PHASE = 'v0.6.0 Phase 8.9 Rollback Simulation' as const;

export const rollbackSimulationContract = {
  version: '0.6.0',
  phase: ROLLBACK_SIMULATION_PHASE,
  deliverable: 'Rolled_back action state tested',
  statusPath: ['proposed', 'approved', 'executing', 'executed', 'rollback_requested', 'executing', 'rolled_back'],
  resultLogStatus: 'rollback_success',
  sandboxOnly: true,
  realRollbackEnabled: false,
  externalWritesEnabled: false,
  autoRunEnabled: false,
  supportedSandboxActionTypes: ['content_publish', 'support_reply_send', 'ad_budget_adjust', 'ad_pause'],
} as const;
