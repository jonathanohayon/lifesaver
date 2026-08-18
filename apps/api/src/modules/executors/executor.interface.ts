import type { ActionRiskLevel, ActionType } from '../actions/actions.types.js';

export const EXECUTOR_INTERFACE_PHASE = 'v0.6.0 Phase 8.1 Executor Interface' as const;

export type ExecutorMode = 'sandbox' | 'mock' | 'real';
export type ExecutorLifecycleStatus = 'valid' | 'invalid' | 'executed' | 'failed' | 'rolled_back' | 'rollback_not_supported';

export type ExecutorActionContext<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  version: '0.6.0';
  phase: typeof EXECUTOR_INTERFACE_PHASE;
  workspaceId: string;
  actionId: string;
  actionType: ActionType;
  riskLevel: ActionRiskLevel;
  requestedByUserId?: string | null;
  approvedByUserId?: string | null;
  idempotencyKey?: string | null;
  policyDecision?: 'ask' | 'auto_approve' | 'block' | 'not_evaluated';
  payload: TPayload;
  metadata?: Record<string, unknown>;
};

export type ExecutorValidationResult = {
  ok: boolean;
  status: Extract<ExecutorLifecycleStatus, 'valid' | 'invalid'>;
  reason: string;
  warnings: string[];
  errors: string[];
  externalWritesAllowed: false;
  checkedAt: string;
};

export type ExecutorExecuteResult<TResult extends Record<string, unknown> = Record<string, unknown>> = {
  ok: boolean;
  status: Extract<ExecutorLifecycleStatus, 'executed' | 'failed'>;
  executorName: string;
  mode: ExecutorMode;
  result: TResult;
  resultSummary: string;
  externalWritesAttempted: false;
  externalWritesSucceeded: false;
  rollbackSupported: boolean;
  rollbackPayload: Record<string, unknown> | null;
  executedAt: string;
};

export type ExecutorRollbackResult = {
  ok: boolean;
  status: Extract<ExecutorLifecycleStatus, 'rolled_back' | 'rollback_not_supported' | 'failed'>;
  executorName: string;
  mode: ExecutorMode;
  resultSummary: string;
  externalWritesAttempted: false;
  externalWritesSucceeded: false;
  rolledBackAt: string;
};

export type ExecutorResultSummary = {
  title: string;
  status: ExecutorLifecycleStatus;
  message: string;
  safeForFounderDisplay: true;
  externalWritesAttempted: false;
  externalWritesSucceeded: false;
};

export interface LifeSaverExecutor<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  TResult extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name: string;
  readonly actionType: ActionType;
  readonly mode: ExecutorMode;
  readonly realExternalWriteEnabled: false;
  readonly sandboxOnly: true;

  validate(context: ExecutorActionContext<TPayload>): Promise<ExecutorValidationResult>;
  execute(context: ExecutorActionContext<TPayload>): Promise<ExecutorExecuteResult<TResult>>;
  rollback(context: ExecutorActionContext<TPayload>, result: ExecutorExecuteResult<TResult>): Promise<ExecutorRollbackResult>;
  summarizeResult(result: ExecutorExecuteResult<TResult> | ExecutorRollbackResult): ExecutorResultSummary;
}

export function buildExecutorInterfaceSafetySummary(): {
  version: '0.6.0';
  phase: typeof EXECUTOR_INTERFACE_PHASE;
  interfaceDefined: true;
  requiredMethods: ['validate', 'execute', 'rollback', 'summarizeResult'];
  sandboxExecutorImplemented: false;
  realExecutorImplemented: false;
  externalWritesEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    interfaceDefined: true,
    requiredMethods: ['validate', 'execute', 'rollback', 'summarizeResult'],
    sandboxExecutorImplemented: false,
    realExecutorImplemented: false,
    externalWritesEnabled: false,
    note: 'Phase 8.1 defines the TypeScript executor contract only. It does not register a sandbox executor, real executor, external connector, or external write path.',
  };
}
