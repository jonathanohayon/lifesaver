export const AUTONOMY_PAUSE_SWITCH_UI_PHASE = 'v0.6.0 Phase 5.5 Pause Switch UI' as const;

export const AUTONOMY_PAUSE_SWITCH_UI_REQUIREMENTS = [
  'Big master switch visible to owner/admin users.',
  'Warning message explains that pause blocks future auto-approval and execution.',
  'Current pause state is visible.',
  'Last updated by is visible without exposing secrets.',
  'Last updated at is visible.',
  'Resume does not execute waiting actions.',
  'Category controls are visible for content, support, ads, research, and dev.',
] as const;

export const AUTONOMY_PAUSE_SWITCH_SAFETY = {
  uiTriggersExecution: false,
  uiTriggersAutoApproval: false,
  uiWritesExternally: false,
  resumeExecutesWaitingActions: false,
  statusEndpoint: 'GET /api/v1/autonomy/status',
  pauseEndpoint: 'POST /api/v1/autonomy/pause',
  resumeEndpoint: 'POST /api/v1/autonomy/resume',
} as const;
