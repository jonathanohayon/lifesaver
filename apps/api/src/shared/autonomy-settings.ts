export const AUTONOMY_SETTINGS_PHASE = 'v0.6.0 Phase 5.1 Autonomy Settings Table' as const;

export const AUTONOMY_PAUSE_FLAGS = [
  'pause_all_autonomy',
  'pause_content_actions',
  'pause_support_actions',
  'pause_ads_actions',
  'pause_research_actions',
  'pause_dev_actions'
] as const;

export type AutonomyPauseFlag = typeof AUTONOMY_PAUSE_FLAGS[number];

export interface AutonomySettingsRecord {
  workspace_id: string;
  pause_all_autonomy: boolean;
  pause_content_actions: boolean;
  pause_support_actions: boolean;
  pause_ads_actions: boolean;
  pause_research_actions: boolean;
  pause_dev_actions: boolean;
  updated_by: string | null;
  updated_at: string;
}

export const AUTONOMY_SETTINGS_DEFAULTS = {
  pause_all_autonomy: false,
  pause_content_actions: false,
  pause_support_actions: false,
  pause_ads_actions: false,
  pause_research_actions: false,
  pause_dev_actions: false
} as const;

export const AUTONOMY_SETTINGS_SAFETY_BOUNDARY = {
  phase: AUTONOMY_SETTINGS_PHASE,
  createsStorageOnly: true,
  allowed: [
    'workspace-scoped autonomy pause storage',
    'master pause flag foundation',
    'content/support/ads/research/dev category pause flag foundation',
    'updated_by and updated_at audit fields',
    'non-destructive additive migration'
  ],
  forbidden: [
    'pause/resume API endpoints',
    'policy auto-approval',
    'executor registry',
    'sandbox executor',
    'real executor',
    'queueing actions for execution',
    'content publishing',
    'support sending',
    'ad budget changes',
    'campaign pause',
    'rollback execution',
    'external platform writes'
  ]
} as const;

export function isAnyAutonomyPaused(settings: Pick<AutonomySettingsRecord, AutonomyPauseFlag>): boolean {
  return AUTONOMY_PAUSE_FLAGS.some((flag) => settings[flag] === true);
}
