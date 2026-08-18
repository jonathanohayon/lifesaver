import type { ActionPolicyDecision, ActionRiskLevel, ActionStatus, ActionType } from '../actions/actions.types.js';
import type { ExecutorActionContext, ExecutorExecuteResult, ExecutorRollbackResult, LifeSaverExecutor } from './executor.interface.js';
import type { SandboxExecutionResultLogRecord } from './executor.result-logs.js';
import { buildSandboxExecutionResultLogRecord } from './executor.result-logs.js';
import {
  getSandboxExecutorForActionType,
  runApproveToExecuteSandboxLifecycle,
  type SandboxLifecycleInput,
  type SandboxLifecycleResult,
} from './executor.sandbox-lifecycle.js';

export const ROLLBACK_SIMULATION_PHASE = 'v0.6.0 Phase 8.9 Rollback Simulation' as const;

export type SandboxRollbackSimulationEventType =
  | 'rollback_requested'
  | 'rollback_started'
  | 'rollback_finished'
  | 'rollback_failed'
  | 'rollback_skipped';

export type SandboxRollbackSimulationEvent = {
  eventType: SandboxRollbackSimulationEventType;
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type SandboxRollbackSimulationInput = SandboxLifecycleInput & {
  rollbackRequestedByUserId: string;
  rollbackNote?: string | null;
};

export type SandboxRollbackSimulationResult = {
  version: '0.6.0';
  phase: typeof ROLLBACK_SIMULATION_PHASE;
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  execution: SandboxLifecycleResult;
  rollback: {
    requested: boolean;
    attempted: boolean;
    supported: boolean;
    succeeded: boolean;
    failed: boolean;
    skipped: boolean;
    finalStatus: ActionStatus;
    statusPath: ActionStatus[];
    events: SandboxRollbackSimulationEvent[];
    result: ExecutorRollbackResult | null;
    resultSummary: string;
    resultLogRecordPreview: SandboxExecutionResultLogRecord;
  };
  safety: {
    sandboxOnly: true;
    externalWritesAttempted: false;
    externalWritesSucceeded: false;
    realRollbackEnabled: false;
    autoRunEnabled: false;
    note: string;
  };
};

function now(): string {
  return new Date().toISOString();
}

function makeEvent(input: {
  eventType: SandboxRollbackSimulationEventType;
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  message: string;
  metadata?: Record<string, unknown>;
}): SandboxRollbackSimulationEvent {
  return {
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    message: input.message,
    createdAt: now(),
    metadata: input.metadata || {},
  };
}

function makeContext(input: SandboxRollbackSimulationInput): ExecutorActionContext<Record<string, unknown>> {
  return {
    version: '0.6.0',
    phase: 'v0.6.0 Phase 8.1 Executor Interface',
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    actionType: input.actionType,
    riskLevel: input.riskLevel,
    requestedByUserId: input.createdByUserId || null,
    approvedByUserId: input.approvedByUserId,
    idempotencyKey: input.idempotencyKey || null,
    policyDecision: input.policyDecision || 'not_evaluated',
    payload: input.payloadJson,
    metadata: {
      ...(input.metadata || {}),
      rollback_phase: ROLLBACK_SIMULATION_PHASE,
      rollback_requested_by_user_id: input.rollbackRequestedByUserId,
      sandbox_only: true,
    },
  };
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getFakeExternalId(execution: SandboxLifecycleResult): string | null {
  return execution.executor.resultStoragePreview?.external_id || null;
}

function getFakeExternalUrl(execution: SandboxLifecycleResult): string | null {
  return execution.executor.resultStoragePreview?.external_url || null;
}

export function buildSandboxRollbackResultLogRecord(
  execution: SandboxLifecycleResult,
  rollbackResult: ExecutorRollbackResult | null,
): SandboxExecutionResultLogRecord {
  const executionRecord = buildSandboxExecutionResultLogRecord(execution);
  const success = rollbackResult?.ok === true && rollbackResult.status === 'rolled_back';
  const skipped = rollbackResult === null;

  return {
    action_id: execution.actionId,
    workspace_id: execution.workspaceId,
    executor_name: rollbackResult?.executorName || executionRecord.executor_name,
    external_id: getFakeExternalId(execution),
    external_url: getFakeExternalUrl(execution),
    result_status: success ? 'rollback_success' : 'rollback_failed',
    result_summary: rollbackResult?.resultSummary || 'Sandbox rollback simulation was skipped because the action was not eligible for rollback.',
    error_message: success ? null : (rollbackResult?.resultSummary || 'Sandbox rollback simulation did not complete.'),
    rollback_supported: false,
    rollback_payload: {},
    metadata_json: {
      phase: ROLLBACK_SIMULATION_PHASE,
      source_execution_phase: execution.phase,
      action_type: execution.actionType,
      execution_status_path: execution.lifecycle.statusPath,
      rollback_status: rollbackResult?.status || 'rollback_not_supported',
      rollback_skipped: skipped,
      sandbox_only: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      real_rollback_enabled: false,
      auto_run_enabled: false,
      execution_record_metadata: safeObject(executionRecord.metadata_json),
    },
  };
}

export async function runSandboxRollbackSimulation(input: SandboxRollbackSimulationInput): Promise<SandboxRollbackSimulationResult> {
  const execution = await runApproveToExecuteSandboxLifecycle(input);
  const events: SandboxRollbackSimulationEvent[] = [];
  const basePath = execution.lifecycle.statusPath;
  const executor = getSandboxExecutorForActionType(input.actionType) as LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>> | null;

  const notEligibleSummary = !execution.lifecycle.executed
    ? `Sandbox rollback skipped because the action final status is ${execution.lifecycle.finalStatus}, not executed.`
    : !execution.executor.executionResult
      ? 'Sandbox rollback skipped because there is no sandbox execution result to roll back.'
      : !execution.executor.executionResult.rollbackSupported
        ? 'Sandbox rollback skipped because this sandbox executor result does not support rollback.'
        : !executor
          ? `Sandbox rollback skipped because no sandbox executor is available for ${input.actionType}.`
          : null;

  if (notEligibleSummary) {
    events.push(makeEvent({
      eventType: 'rollback_skipped',
      fromStatus: execution.lifecycle.finalStatus,
      toStatus: execution.lifecycle.finalStatus,
      message: notEligibleSummary,
      metadata: {
        executor_name: execution.executor.name,
        rollback_supported: execution.executor.executionResult?.rollbackSupported || false,
        sandbox_only: true,
        external_writes_attempted: false,
      },
    }));

    const record = buildSandboxRollbackResultLogRecord(execution, null);
    return {
      version: '0.6.0',
      phase: ROLLBACK_SIMULATION_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      actionType: input.actionType,
      execution,
      rollback: {
        requested: false,
        attempted: false,
        supported: false,
        succeeded: false,
        failed: false,
        skipped: true,
        finalStatus: execution.lifecycle.finalStatus,
        statusPath: basePath,
        events,
        result: null,
        resultSummary: notEligibleSummary,
        resultLogRecordPreview: record,
      },
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        realRollbackEnabled: false,
        autoRunEnabled: false,
        note: 'Rollback simulation skipped safely. No external write or real rollback was attempted.',
      },
    };
  }

  events.push(makeEvent({
    eventType: 'rollback_requested',
    fromStatus: execution.lifecycle.finalStatus,
    toStatus: 'rollback_requested',
    message: input.rollbackNote || 'Sandbox rollback requested for QA after sandbox execution.',
    metadata: {
      rollback_requested_by_user_id: input.rollbackRequestedByUserId,
      sandbox_only: true,
      external_writes_attempted: false,
    },
  }));

  events.push(makeEvent({
    eventType: 'rollback_started',
    fromStatus: 'rollback_requested',
    toStatus: 'executing',
    message: `Sandbox rollback started with ${executor!.name}.`,
    metadata: {
      executor_name: executor!.name,
      sandbox_only: true,
      external_writes_attempted: false,
    },
  }));

  const rollbackResult = await executor!.rollback(makeContext(input), execution.executor.executionResult as ExecutorExecuteResult<Record<string, unknown>>);
  const finalStatus: ActionStatus = rollbackResult.ok && rollbackResult.status === 'rolled_back' ? 'rolled_back' : 'failed';

  events.push(makeEvent({
    eventType: finalStatus === 'rolled_back' ? 'rollback_finished' : 'rollback_failed',
    fromStatus: 'executing',
    toStatus: finalStatus,
    message: rollbackResult.resultSummary,
    metadata: {
      executor_name: executor!.name,
      rollback_status: rollbackResult.status,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      sandbox_only: true,
    },
  }));

  const record = buildSandboxRollbackResultLogRecord(execution, rollbackResult);

  return {
    version: '0.6.0',
    phase: ROLLBACK_SIMULATION_PHASE,
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    actionType: input.actionType,
    execution,
    rollback: {
      requested: true,
      attempted: true,
      supported: true,
      succeeded: finalStatus === 'rolled_back',
      failed: finalStatus !== 'rolled_back',
      skipped: false,
      finalStatus,
      statusPath: [...basePath, 'rollback_requested', 'executing', finalStatus],
      events,
      result: rollbackResult,
      resultSummary: rollbackResult.resultSummary,
      resultLogRecordPreview: record,
    },
    safety: {
      sandboxOnly: true,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      realRollbackEnabled: false,
      autoRunEnabled: false,
      note: 'Phase 8.9 simulates rollback after sandbox execution. The action can reach rolled_back state in QA without touching any external platform.',
    },
  };
}

export function buildRollbackSimulationSafetySummary(): {
  version: '0.6.0';
  phase: typeof ROLLBACK_SIMULATION_PHASE;
  rolledBackActionStateTested: true;
  supportedSandboxActionTypes: ActionType[];
  statusPath: ['proposed', 'approved', 'executing', 'executed', 'rollback_requested', 'executing', 'rolled_back'];
  resultLogStatus: 'rollback_success';
  sandboxOnly: true;
  realRollbackEnabled: false;
  externalWritesEnabled: false;
  autoRunEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: ROLLBACK_SIMULATION_PHASE,
    rolledBackActionStateTested: true,
    supportedSandboxActionTypes: ['content_publish', 'support_reply_send', 'ad_budget_adjust', 'ad_pause'],
    statusPath: ['proposed', 'approved', 'executing', 'executed', 'rollback_requested', 'executing', 'rolled_back'],
    resultLogStatus: 'rollback_success',
    sandboxOnly: true,
    realRollbackEnabled: false,
    externalWritesEnabled: false,
    autoRunEnabled: false,
    note: 'Phase 8.9 tests rolled_back action state after sandbox execution. Rollback is simulated only and never calls external social, support, or ads platforms.',
  };
}
