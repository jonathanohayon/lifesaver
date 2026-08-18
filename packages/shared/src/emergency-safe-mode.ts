export const EMERGENCY_SAFE_MODE_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export const EMERGENCY_SAFE_MODE_ENV_KEY = 'EMERGENCY_SAFE_MODE' as const;

export const emergencySafeModeRules = [
  'When EMERGENCY_SAFE_MODE=true, every future executor path must be blocked immediately before execution.',
  'Policy evaluation must never return auto_approve while emergency safe mode is active.',
  'Admin must show a visible warning when emergency safe mode is active.',
  'Emergency safe mode does not execute, queue, publish, send, spend, pause campaigns, refund, edit products, or rollback anything by itself.',
  'Disabling emergency safe mode must not execute waiting approved actions automatically.',
] as const;

export type EmergencySafeModeSnapshot = {
  active: boolean;
  reason: string | null;
  adminWarningVisible: boolean;
  executionBlocked: boolean;
  autoApprovalAllowed: false;
  executorExecutionAllowed: false;
};
