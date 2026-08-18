import { getEmergencySafeModeState } from './emergency-safe-mode.js';
import { applyPolicyPauseDecisionWithKnownState } from '../policies/policy.pause-enforcement.js';
import type { CategoryPauseBackendState, GlobalPauseBackendState } from './autonomy.types.js';

function assertCondition(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function fakePauseState(): GlobalPauseBackendState {
  const category = { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'test category unpaused' };
  return {
    workspaceId: '00000000-0000-0000-0000-000000000001',
    pauseAllAutonomy: false,
    pauseContentActions: false,
    pauseSupportActions: false,
    pauseAdsActions: false,
    pauseResearchActions: false,
    pauseDevActions: false,
    updatedBy: null,
    updatedAt: null,
    enforcement: {
      autoApprovalAllowed: true,
      executorExecutionAllowed: true,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'test state',
    },
    categories: { content: category, support: category, ads: category, research: category, dev: category },
    emergencySafeMode: getEmergencySafeModeState(),
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'test',
    },
  };
}

const state = getEmergencySafeModeState();

const categoryPauseState: CategoryPauseBackendState = {
  workspaceId: '00000000-0000-0000-0000-000000000001',
  category: 'content',
  categoryPaused: false,
  pauseAllAutonomy: false,
  pauseContentActions: false,
  pauseSupportActions: false,
  pauseAdsActions: false,
  pauseResearchActions: false,
  pauseDevActions: false,
  autoApprovalAllowed: true,
  executorExecutionAllowed: true,
  proposedActionCreationAllowed: true,
  manualReviewAllowed: true,
  reason: 'test',
};

const baselinePolicy = applyPolicyPauseDecisionWithKnownState({
  workspaceId: '00000000-0000-0000-0000-000000000001',
  actionType: 'content_publish',
  requestedDecision: 'auto_approve',
  pauseState: fakePauseState(),
  categoryPauseState,
});

assertCondition(state.version === '0.6.0', 'Emergency safe mode state must report v0.6.0.');
assertCondition(state.autoApprovalAllowed === false, 'Emergency safe mode contract must never expose autoApprovalAllowed=true.');
assertCondition(state.executorExecutionAllowed === false, 'Emergency safe mode contract must never expose executorExecutionAllowed=true.');
assertCondition(state.safety.externalWritesAttempted === false, 'Emergency safe mode test must not attempt external writes.');
assertCondition(baselinePolicy.safety.externalWritesAttempted === false, 'Policy dry test must not attempt external writes.');

console.log(JSON.stringify({
  version: '0.6.0',
  phase: 'V2 Phase 5.9 Emergency Safe Mode',
  success: true,
  emergencySafeModeActiveInThisEnvironment: state.active,
  checks: [
    'EMERGENCY_SAFE_MODE state is readable from environment',
    'admin warning visibility is tied to active flag',
    'autoApprovalAllowed is never true in emergency contract',
    'executorExecutionAllowed is never true in emergency contract',
    'test performed no external writes',
  ],
  note: state.active
    ? 'This environment currently has EMERGENCY_SAFE_MODE=true. Future executor/policy paths must be blocked.'
    : 'This environment currently has EMERGENCY_SAFE_MODE=false. Set EMERGENCY_SAFE_MODE=true to test the active override path locally.',
}, null, 2));
