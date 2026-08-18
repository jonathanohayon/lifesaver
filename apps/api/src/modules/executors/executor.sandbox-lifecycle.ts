import type { ActionPolicyDecision, ActionRiskLevel, ActionStatus, ActionType } from '../actions/actions.types.js';
import type { ExecutorActionContext, ExecutorExecuteResult, LifeSaverExecutor } from './executor.interface.js';
import { buildForcedSandboxFailureExecuteResult, detectSandboxShouldFail, FAILURE_SIMULATION_PHASE } from './executor.failure-simulation.js';
import { sandboxAdsBudgetExecutor, sandboxAdsPauseExecutor } from './sandbox-ads.executor.js';
import { sandboxContentExecutor } from './sandbox-content.executor.js';
import { sandboxSupportExecutor } from './sandbox-support.executor.js';

export const SANDBOX_LIFECYCLE_PHASE = 'v0.6.0 Phase 8.8 Failure Simulation' as const;

export type SandboxLifecycleEventType =
  | 'approved'
  | 'execution_started'
  | 'execution_finished'
  | 'execution_failed'
  | 'execution_blocked';

export type SandboxLifecycleEvent = {
  eventType: SandboxLifecycleEventType;
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type SandboxLifecycleInput = {
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  currentStatus: ActionStatus;
  riskLevel: ActionRiskLevel;
  payloadJson: Record<string, unknown>;
  approvedByUserId: string;
  approvalNote?: string | null;
  createdByUserId?: string | null;
  idempotencyKey?: string | null;
  policyDecision?: ActionPolicyDecision;
  metadata?: Record<string, unknown>;
};

export type SandboxLifecycleResultStoragePreview = {
  executor_name: string;
  result_status: 'success' | 'failed' | 'blocked' | 'skipped';
  external_id: string | null;
  external_url: string | null;
  result_summary: string;
  rollback_supported: boolean;
  rollback_payload: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
};

export type SandboxLifecycleResult = {
  version: '0.6.0';
  phase: typeof SANDBOX_LIFECYCLE_PHASE;
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  lifecycle: {
    requestedTransition: 'proposed_to_approved_to_executed';
    fromStatus: ActionStatus;
    finalStatus: ActionStatus;
    approved: boolean;
    executed: boolean;
    failed: boolean;
    blocked: boolean;
    statusPath: ActionStatus[];
    events: SandboxLifecycleEvent[];
  };
  executor: {
    found: boolean;
    name: string | null;
    mode: 'sandbox' | null;
    validationOk: boolean;
    validationReason: string;
    validationWarnings: string[];
    validationErrors: string[];
    executionResult: ExecutorExecuteResult<Record<string, unknown>> | null;
    resultStoragePreview: SandboxLifecycleResultStoragePreview | null;
  };
  safety: {
    sandboxOnly: true;
    externalWritesAttempted: false;
    externalWritesSucceeded: false;
    autoRunEnabled: false;
    realExecutorEnabled: false;
    note: string;
  };
};

const SANDBOX_EXECUTORS: Partial<Record<ActionType, LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>>>> = {
  content_publish: sandboxContentExecutor as LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>>,
  support_reply_send: sandboxSupportExecutor as LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>>,
  ad_budget_adjust: sandboxAdsBudgetExecutor as LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>>,
  ad_pause: sandboxAdsPauseExecutor as LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>>,
};

function now(): string {
  return new Date().toISOString();
}

function makeEvent(input: {
  eventType: SandboxLifecycleEventType;
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  message: string;
  metadata?: Record<string, unknown>;
}): SandboxLifecycleEvent {
  return {
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    message: input.message,
    createdAt: now(),
    metadata: input.metadata || {},
  };
}

function extractExternalId(result: Record<string, unknown>): string | null {
  const candidates = [
    result.fake_external_post_id,
    result.fake_external_reply_id,
    result.fake_external_action_id,
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match : null;
}

function extractExternalUrl(result: Record<string, unknown>): string | null {
  const candidates = [
    result.fake_permalink,
    result.fake_thread_permalink,
    result.fake_audit_permalink,
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match : null;
}

function buildStoragePreview(executionResult: ExecutorExecuteResult<Record<string, unknown>>): SandboxLifecycleResultStoragePreview {
  return {
    executor_name: executionResult.executorName,
    result_status: executionResult.ok ? 'success' : 'failed',
    external_id: extractExternalId(executionResult.result),
    external_url: extractExternalUrl(executionResult.result),
    result_summary: executionResult.resultSummary,
    rollback_supported: executionResult.rollbackSupported,
    rollback_payload: executionResult.rollbackPayload || {},
    metadata_json: {
      phase: SANDBOX_LIFECYCLE_PHASE,
      mode: executionResult.mode,
      sandbox_only: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      result: executionResult.result,
    },
  };
}

export function getSandboxExecutorForActionType(actionType: ActionType): LifeSaverExecutor<Record<string, unknown>, Record<string, unknown>> | null {
  return SANDBOX_EXECUTORS[actionType] || null;
}

export function listApproveToExecuteSandboxActionTypes(): ActionType[] {
  return Object.keys(SANDBOX_EXECUTORS) as ActionType[];
}

export async function runApproveToExecuteSandboxLifecycle(input: SandboxLifecycleInput): Promise<SandboxLifecycleResult> {
  const executor = getSandboxExecutorForActionType(input.actionType);
  const events: SandboxLifecycleEvent[] = [];
  const initialStatus = input.currentStatus;

  if (!executor) {
    events.push(makeEvent({
      eventType: 'execution_blocked',
      fromStatus: initialStatus,
      toStatus: initialStatus,
      message: `No sandbox executor is implemented for ${input.actionType}.`,
      metadata: { action_type: input.actionType, external_writes_attempted: false },
    }));

    return {
      version: '0.6.0',
      phase: SANDBOX_LIFECYCLE_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      actionType: input.actionType,
      lifecycle: {
        requestedTransition: 'proposed_to_approved_to_executed',
        fromStatus: initialStatus,
        finalStatus: initialStatus,
        approved: false,
        executed: false,
        failed: false,
        blocked: true,
        statusPath: [initialStatus],
        events,
      },
      executor: {
        found: false,
        name: null,
        mode: null,
        validationOk: false,
        validationReason: 'No sandbox executor is available for this action type.',
        validationWarnings: [],
        validationErrors: [`No sandbox executor is implemented for ${input.actionType}.`],
        executionResult: null,
        resultStoragePreview: null,
      },
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        autoRunEnabled: false,
        realExecutorEnabled: false,
        note: 'Unsupported action types remain blocked in the sandbox lifecycle. No external write was attempted.',
      },
    };
  }

  if (!['proposed', 'approval_required', 'auto_approved'].includes(input.currentStatus)) {
    events.push(makeEvent({
      eventType: 'execution_blocked',
      fromStatus: initialStatus,
      toStatus: initialStatus,
      message: `Sandbox lifecycle cannot approve from status ${input.currentStatus}.`,
      metadata: { allowed_statuses: ['proposed', 'approval_required', 'auto_approved'] },
    }));

    return {
      version: '0.6.0',
      phase: SANDBOX_LIFECYCLE_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      actionType: input.actionType,
      lifecycle: {
        requestedTransition: 'proposed_to_approved_to_executed',
        fromStatus: initialStatus,
        finalStatus: initialStatus,
        approved: false,
        executed: false,
        failed: false,
        blocked: true,
        statusPath: [initialStatus],
        events,
      },
      executor: {
        found: true,
        name: executor.name,
        mode: 'sandbox',
        validationOk: false,
        validationReason: 'Action status is not approvable for sandbox lifecycle.',
        validationWarnings: [],
        validationErrors: [`Status ${input.currentStatus} is not approvable.`],
        executionResult: null,
        resultStoragePreview: null,
      },
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        autoRunEnabled: false,
        realExecutorEnabled: false,
        note: 'Invalid lifecycle status blocked before executor validation. No external write was attempted.',
      },
    };
  }

  events.push(makeEvent({
    eventType: 'approved',
    fromStatus: initialStatus,
    toStatus: 'approved',
    message: input.approvalNote || 'Action approved for sandbox lifecycle execution.',
    metadata: { approved_by_user_id: input.approvedByUserId, sandbox_only: true },
  }));

  const context: ExecutorActionContext<Record<string, unknown>> = {
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
      lifecycle_phase: SANDBOX_LIFECYCLE_PHASE,
      sandbox_only: true,
    },
  };

  const validation = await executor.validate(context);
  if (!validation.ok) {
    events.push(makeEvent({
      eventType: 'execution_started',
      fromStatus: 'approved',
      toStatus: 'executing',
      message: 'Sandbox executor validation started before simulated execution.',
      metadata: { executor_name: executor.name },
    }));
    events.push(makeEvent({
      eventType: 'execution_failed',
      fromStatus: 'executing',
      toStatus: 'failed',
      message: validation.errors.join(' ') || 'Sandbox executor validation failed.',
      metadata: { executor_name: executor.name, validation_errors: validation.errors },
    }));

    return {
      version: '0.6.0',
      phase: SANDBOX_LIFECYCLE_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      actionType: input.actionType,
      lifecycle: {
        requestedTransition: 'proposed_to_approved_to_executed',
        fromStatus: initialStatus,
        finalStatus: 'failed',
        approved: true,
        executed: false,
        failed: true,
        blocked: false,
        statusPath: [initialStatus, 'approved', 'executing', 'failed'],
        events,
      },
      executor: {
        found: true,
        name: executor.name,
        mode: 'sandbox',
        validationOk: false,
        validationReason: validation.reason,
        validationWarnings: validation.warnings,
        validationErrors: validation.errors,
        executionResult: null,
        resultStoragePreview: {
          executor_name: executor.name,
          result_status: 'failed',
          external_id: null,
          external_url: null,
          result_summary: validation.errors.join(' ') || 'Sandbox executor validation failed.',
          rollback_supported: false,
          rollback_payload: {},
          metadata_json: {
            phase: SANDBOX_LIFECYCLE_PHASE,
            validation,
            sandbox_only: true,
            external_writes_attempted: false,
          },
        },
      },
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        autoRunEnabled: false,
        realExecutorEnabled: false,
        note: 'Sandbox lifecycle failed during validation. No external write was attempted.',
      },
    };
  }

  events.push(makeEvent({
    eventType: 'execution_started',
    fromStatus: 'approved',
    toStatus: 'executing',
    message: `Sandbox executor ${executor.name} started.`,
    metadata: { executor_name: executor.name, sandbox_only: true },
  }));

  const forcedFailure = detectSandboxShouldFail(context.payload, context.metadata || {});
  if (forcedFailure.sandboxShouldFail) {
    const executionResult = buildForcedSandboxFailureExecuteResult(context, executor.name, forcedFailure);
    const resultStoragePreview = buildStoragePreview(executionResult);

    events.push(makeEvent({
      eventType: 'execution_failed',
      fromStatus: 'executing',
      toStatus: 'failed',
      message: executionResult.resultSummary,
      metadata: {
        executor_name: executor.name,
        result_status: resultStoragePreview.result_status,
        sandbox_should_fail: true,
        failure_simulation_phase: FAILURE_SIMULATION_PHASE,
        external_writes_attempted: false,
        external_writes_succeeded: false,
        result_storage_preview: resultStoragePreview,
      },
    }));

    return {
      version: '0.6.0',
      phase: SANDBOX_LIFECYCLE_PHASE,
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      actionType: input.actionType,
      lifecycle: {
        requestedTransition: 'proposed_to_approved_to_executed',
        fromStatus: initialStatus,
        finalStatus: 'failed',
        approved: true,
        executed: false,
        failed: true,
        blocked: false,
        statusPath: [initialStatus, 'approved', 'executing', 'failed'],
        events,
      },
      executor: {
        found: true,
        name: executor.name,
        mode: 'sandbox',
        validationOk: true,
        validationReason: validation.reason,
        validationWarnings: validation.warnings,
        validationErrors: validation.errors,
        executionResult,
        resultStoragePreview,
      },
      safety: {
        sandboxOnly: true,
        externalWritesAttempted: false,
        externalWritesSucceeded: false,
        autoRunEnabled: false,
        realExecutorEnabled: false,
        note: 'Phase 8.8 forced a fake sandbox failure for QA using sandbox_should_fail=true. No external write was attempted.',
      },
    };
  }

  const executionResult = await executor.execute(context);
  const resultStoragePreview = buildStoragePreview(executionResult);
  const finalStatus: ActionStatus = executionResult.ok ? 'executed' : 'failed';

  events.push(makeEvent({
    eventType: executionResult.ok ? 'execution_finished' : 'execution_failed',
    fromStatus: 'executing',
    toStatus: finalStatus,
    message: executionResult.resultSummary,
    metadata: {
      executor_name: executor.name,
      result_status: resultStoragePreview.result_status,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      result_storage_preview: resultStoragePreview,
    },
  }));

  return {
    version: '0.6.0',
    phase: SANDBOX_LIFECYCLE_PHASE,
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    actionType: input.actionType,
    lifecycle: {
      requestedTransition: 'proposed_to_approved_to_executed',
      fromStatus: initialStatus,
      finalStatus,
      approved: true,
      executed: executionResult.ok,
      failed: !executionResult.ok,
      blocked: false,
      statusPath: [initialStatus, 'approved', 'executing', finalStatus],
      events,
    },
    executor: {
      found: true,
      name: executor.name,
      mode: 'sandbox',
      validationOk: true,
      validationReason: validation.reason,
      validationWarnings: validation.warnings,
      validationErrors: validation.errors,
      executionResult,
      resultStoragePreview,
    },
    safety: {
      sandboxOnly: true,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      autoRunEnabled: false,
      realExecutorEnabled: false,
      note: 'Phase 8.8 preserves the complete approve-to-execute sandbox lifecycle and adds forced fake failure QA with sandbox_should_fail=true. All IDs/URLs are fake sandbox values and no external write is attempted.',
    },
  };
}

export function buildApproveToExecuteSandboxSafetySummary(): {
  version: '0.6.0';
  phase: typeof SANDBOX_LIFECYCLE_PHASE;
  lifecycleDefined: true;
  supportedSandboxActionTypes: ActionType[];
  statusPath: ['proposed', 'approved', 'executing', 'executed'];
  usesSandboxExecutors: true;
  writesToExternalPlatforms: false;
  realExecutorsEnabled: false;
  autoRunEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: SANDBOX_LIFECYCLE_PHASE,
    lifecycleDefined: true,
    supportedSandboxActionTypes: listApproveToExecuteSandboxActionTypes(),
    statusPath: ['proposed', 'approved', 'executing', 'executed'],
    usesSandboxExecutors: true,
    writesToExternalPlatforms: false,
    realExecutorsEnabled: false,
    autoRunEnabled: false,
    note: 'Phase 8.8 defines and tests the full sandbox lifecycle plus forced fake failure QA. It approves, executes or fails in sandbox, and records result previews using fake sandbox executor outputs only.',
  };
}
