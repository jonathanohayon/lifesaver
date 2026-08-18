export const AUTONOMY_PAUSE_QA_PHASE = 'v0.6.0 Phase 5.10 Pause QA' as const;

export const AUTONOMY_PAUSE_QA_CASES = [
  'Global pause blocks content.',
  'Global pause blocks support.',
  'Global pause blocks ads.',
  'Category pause blocks only that category.',
  'Audit logs record pause/resume changes.',
] as const;

export type PauseQaScenario = {
  name: string;
  globalPaused: boolean;
  categoryPaused: boolean;
  expectedBlocked: boolean;
};

export const AUTONOMY_PAUSE_QA_SAFETY = {
  runsExecutors: false,
  publishesContent: false,
  sendsSupportReplies: false,
  changesAdSpend: false,
  writesToExternalPlatforms: false,
  verifiesInternalPauseLogicOnly: true,
} as const;
