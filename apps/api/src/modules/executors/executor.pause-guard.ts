import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getCategoryPauseState, getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';
import type { ExecutorExecutionIntent, ExecutorFunction, ExecutorPauseDecision } from './executor.types.js';
import { EXECUTOR_PAUSE_ENFORCEMENT_PHASE } from './executor.types.js';

function checkedAt(): string {
  return new Date().toISOString();
}

function buildEmergencySafeModeDecision(intent: ExecutorExecutionIntent): ExecutorPauseDecision {
  const emergency = getEmergencySafeModeState();
  return {
    version: '0.6.0',
    phase: EXECUTOR_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: intent.workspaceId,
    actionId: intent.actionId,
    actionType: intent.actionType,
    executorName: intent.executorName,
    category: 'system',
    blocked: true,
    blockReason: 'emergency_safe_mode',
    pauseAllAutonomy: true,
    categoryPaused: true,
    executorExecutionAllowed: false,
    autoApprovalAllowed: false,
    checkedImmediatelyBeforeExecution: true,
    checkedAt: checkedAt(),
    message: emergency.reason || 'Emergency safe mode is active. Executor execution is blocked before any external write can run.',
    emergencySafeModeActive: true,
    pauseState: null,
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Environment-level emergency safe mode overrides approvals, policies, queues, and category pause settings. Future executors must fail closed.',
    },
  };
}

function buildDatabaseUnavailableDecision(intent: ExecutorExecutionIntent): ExecutorPauseDecision {
  return {
    version: '0.6.0',
    phase: EXECUTOR_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: intent.workspaceId,
    actionId: intent.actionId,
    actionType: intent.actionType,
    executorName: intent.executorName,
    category: 'system',
    blocked: true,
    blockReason: 'database_not_configured',
    pauseAllAutonomy: true,
    categoryPaused: true,
    executorExecutionAllowed: false,
    autoApprovalAllowed: false,
    checkedImmediatelyBeforeExecution: true,
    checkedAt: checkedAt(),
    message: 'Executor execution is blocked because the database is not configured, so pause state cannot be verified safely.',
    emergencySafeModeActive: getEmergencySafeModeState().active,
    pauseState: null,
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Fail-closed behavior: future executors must not run if pause state cannot be read.',
    },
  };
}

export async function evaluateExecutorPauseState(intent: ExecutorExecutionIntent): Promise<ExecutorPauseDecision> {
  if (getEmergencySafeModeState().active) return buildEmergencySafeModeDecision(intent);
  if (!isDatabaseConfigured) return buildDatabaseUnavailableDecision(intent);

  const pauseState = await getGlobalPauseStateForWorkspace(intent.workspaceId);
  const categoryPauseState = getCategoryPauseState({ pauseState, actionType: intent.actionType });
  const blocked = pauseState.pauseAllAutonomy || categoryPauseState.categoryPaused || !categoryPauseState.executorExecutionAllowed;
  const blockReason: ExecutorPauseDecision['blockReason'] = pauseState.pauseAllAutonomy
    ? 'global_pause'
    : categoryPauseState.categoryPaused
      ? 'category_pause'
      : 'none';

  return {
    version: '0.6.0',
    phase: EXECUTOR_PAUSE_ENFORCEMENT_PHASE,
    workspaceId: intent.workspaceId,
    actionId: intent.actionId,
    actionType: intent.actionType,
    executorName: intent.executorName,
    category: categoryPauseState.category,
    blocked,
    blockReason,
    pauseAllAutonomy: pauseState.pauseAllAutonomy,
    categoryPaused: categoryPauseState.categoryPaused,
    executorExecutionAllowed: categoryPauseState.executorExecutionAllowed,
    autoApprovalAllowed: categoryPauseState.autoApprovalAllowed,
    checkedImmediatelyBeforeExecution: true,
    checkedAt: checkedAt(),
    message: blocked
      ? 'Executor execution is blocked by active autonomy pause state. The action remains reviewable internally, but no external write may run.'
      : 'Executor pause guard passed. Future executors must still apply approval, status, policy, caps, audit log, idempotency, and connector-scope checks before any external write.',
    emergencySafeModeActive: false,
    pauseState: {
      global: {
        pauseAllAutonomy: pauseState.pauseAllAutonomy,
        pauseContentActions: pauseState.pauseContentActions,
        pauseSupportActions: pauseState.pauseSupportActions,
        pauseAdsActions: pauseState.pauseAdsActions,
        pauseResearchActions: pauseState.pauseResearchActions,
        pauseDevActions: pauseState.pauseDevActions,
      },
      category: categoryPauseState,
    },
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      note: blocked
        ? 'Pause enforcement is fail-closed. This guard must run immediately before future executor execution.'
        : 'This decision is permission to continue safety checks only, not permission to execute by itself.',
    },
  };
}

export async function assertExecutorNotPaused(intent: ExecutorExecutionIntent): Promise<ExecutorPauseDecision> {
  const decision = await evaluateExecutorPauseState(intent);
  if (!decision.blocked) return decision;

  throw new AppError(
    423,
    'AUTONOMY_EXECUTION_PAUSED',
    decision.message,
    {
      actionId: decision.actionId,
      actionType: decision.actionType,
      executorName: decision.executorName,
      workspaceId: decision.workspaceId,
      category: decision.category,
      blockReason: decision.blockReason,
      emergencySafeModeActive: decision.emergencySafeModeActive,
      pauseAllAutonomy: decision.pauseAllAutonomy,
      categoryPaused: decision.categoryPaused,
      checkedImmediatelyBeforeExecution: true,
      externalWritesAttempted: false,
      executorRan: false,
    },
  );
}

export async function runWithExecutorPauseGuard<TInput extends ExecutorExecutionIntent, TResult>(
  input: TInput,
  executor: ExecutorFunction<TInput, TResult>,
): Promise<{ pauseDecision: ExecutorPauseDecision; result: TResult }> {
  const pauseDecision = await assertExecutorNotPaused(input);
  const result = await executor(input);
  return {
    pauseDecision: {
      ...pauseDecision,
      safety: {
        ...pauseDecision.safety,
        executorRan: true,
        externalWritesAttempted: false,
        note: 'The wrapped executor function ran only after pause state was checked. In Phase 5.6 there are still no real executors registered in LIFE.SAVER.',
      },
    },
    result,
  };
}
