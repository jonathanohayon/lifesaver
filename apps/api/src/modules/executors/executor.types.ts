import type { ActionType } from '../actions/actions.types.js';
import type { AutonomyActionCategory, CategoryPauseBackendState, GlobalPauseBackendState } from '../autonomy/autonomy.types.js';

export const EXECUTOR_PAUSE_ENFORCEMENT_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export type ExecutorExecutionIntent = {
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  executorName: string;
  requestedByUserId?: string | null;
};

export type ExecutorPauseDecision = {
  version: '0.6.0';
  phase: typeof EXECUTOR_PAUSE_ENFORCEMENT_PHASE;
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  executorName: string;
  category: AutonomyActionCategory;
  blocked: boolean;
  blockReason: 'none' | 'global_pause' | 'category_pause' | 'database_not_configured' | 'emergency_safe_mode';
  pauseAllAutonomy: boolean;
  categoryPaused: boolean;
  executorExecutionAllowed: boolean;
  autoApprovalAllowed: boolean;
  checkedImmediatelyBeforeExecution: true;
  checkedAt: string;
  message: string;
  emergencySafeModeActive: boolean;
  pauseState: {
    global: Pick<GlobalPauseBackendState, 'pauseAllAutonomy' | 'pauseContentActions' | 'pauseSupportActions' | 'pauseAdsActions' | 'pauseResearchActions' | 'pauseDevActions'>;
    category: CategoryPauseBackendState;
  } | null;
  safety: {
    externalWritesAttempted: false;
    executorRan: boolean;
    note: string;
  };
};

export type ExecutorFunction<TInput, TResult> = (input: TInput) => Promise<TResult>;
