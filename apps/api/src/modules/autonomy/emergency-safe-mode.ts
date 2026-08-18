import { env } from '../../config/env.js';

export const EMERGENCY_SAFE_MODE_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export type EmergencySafeModeState = {
  version: '0.6.0';
  phase: typeof EMERGENCY_SAFE_MODE_PHASE;
  active: boolean;
  source: 'environment';
  envKey: 'EMERGENCY_SAFE_MODE';
  reason: string | null;
  adminWarningVisible: boolean;
  executionBlocked: boolean;
  autoApprovalAllowed: false;
  executorExecutionAllowed: false;
  proposedActionCreationAllowed: boolean;
  manualReviewAllowed: true;
  checkedAt: string;
  safety: {
    externalWritesAttempted: false;
    executorRan: false;
    resumeDoesNotExecuteWaitingActions: true;
    note: string;
  };
};

function cleanReason(value: string | null | undefined): string | null {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 500) : null;
}

export function getEmergencySafeModeState(): EmergencySafeModeState {
  const active = Boolean(env.EMERGENCY_SAFE_MODE);
  return {
    version: '0.6.0',
    phase: EMERGENCY_SAFE_MODE_PHASE,
    active,
    source: 'environment',
    envKey: 'EMERGENCY_SAFE_MODE',
    reason: active ? cleanReason(env.EMERGENCY_SAFE_MODE_REASON) : null,
    adminWarningVisible: active,
    executionBlocked: active,
    autoApprovalAllowed: false,
    executorExecutionAllowed: false,
    proposedActionCreationAllowed: true,
    manualReviewAllowed: true,
    checkedAt: new Date().toISOString(),
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      resumeDoesNotExecuteWaitingActions: true,
      note: active
        ? 'Emergency safe mode is active. Future executors must be blocked immediately, policy must not auto-approve, and admin must show a visible warning.'
        : 'Emergency safe mode is not active. Normal pause, policy, approval, cap, audit, idempotency, and executor guards still apply before any future execution.',
    },
  };
}

export function isEmergencySafeModeActive(): boolean {
  return getEmergencySafeModeState().active;
}
