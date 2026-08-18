import type { ActionType } from '../actions/actions.types.js';
import { EXECUTOR_PAUSE_ENFORCEMENT_PHASE } from './executor.types.js';

export const EXECUTOR_REGISTRY_PHASE = 'v0.6.0 Phase 8.5 Sandbox Ads Executor' as const;

export type ExecutorHandlerKey =
  | 'sandboxContentExecutor'
  | 'sandboxSupportExecutor'
  | 'sandboxAdsBudgetExecutor'
  | 'sandboxAdsPauseExecutor'
  | 'sandboxResearchExecutor'
  | 'sandboxDevExecutor'
  | 'sandboxNotificationExecutor'
  | 'sandboxRollbackExecutor';

export type ExecutorRegistryStatus =
  | 'registered_sandbox_mapping_only'
  | 'not_registered'
  | 'real_executor_disabled';

export type ExecutorRegistryEntry = {
  actionType: ActionType;
  handlerKey: ExecutorHandlerKey;
  executorName: ExecutorHandlerKey;
  mode: 'sandbox';
  status: Extract<ExecutorRegistryStatus, 'registered_sandbox_mapping_only'>;
  registryMappingDefined: true;
  handlerImplementationIncluded: boolean;
  executionEnabled: false;
  sandboxExecutorEnabled: boolean;
  realExternalWriteEnabled: false;
  externalWritesEnabled: false;
  pauseGuardRequired: true;
  approvalRequiredBeforeExecution: true;
  note: string;
};

export type RegisteredExecutorSummary = {
  actionType: ActionType;
  executorName: string | null;
  handlerKey: ExecutorHandlerKey | null;
  realExternalWriteEnabled: false;
  sandboxExecutorEnabled: boolean;
  executionEnabled: false;
  pauseGuardRequired: true;
  status: ExecutorRegistryStatus;
};

export const EXECUTOR_HANDLER_MAP: Readonly<Record<ActionType, ExecutorHandlerKey>> = {
  content_publish: 'sandboxContentExecutor',
  support_reply_send: 'sandboxSupportExecutor',
  ad_budget_adjust: 'sandboxAdsBudgetExecutor',
  ad_pause: 'sandboxAdsPauseExecutor',
  research_task: 'sandboxResearchExecutor',
  dev_task: 'sandboxDevExecutor',
  notification_send: 'sandboxNotificationExecutor',
  rollback_action: 'sandboxRollbackExecutor',
} as const;

const ACTION_TYPES = Object.keys(EXECUTOR_HANDLER_MAP) as ActionType[];

function hasSandboxImplementation(actionType: ActionType): boolean {
  return actionType === 'content_publish' || actionType === 'support_reply_send' || actionType === 'ad_budget_adjust' || actionType === 'ad_pause';
}

export function getRegisteredExecutorEntry(actionType: ActionType): ExecutorRegistryEntry {
  const handlerKey = EXECUTOR_HANDLER_MAP[actionType];
  return {
    actionType,
    handlerKey,
    executorName: handlerKey,
    mode: 'sandbox',
    status: 'registered_sandbox_mapping_only',
    registryMappingDefined: true,
    handlerImplementationIncluded: hasSandboxImplementation(actionType),
    executionEnabled: false,
    sandboxExecutorEnabled: hasSandboxImplementation(actionType),
    realExternalWriteEnabled: false,
    externalWritesEnabled: false,
    pauseGuardRequired: true,
    approvalRequiredBeforeExecution: true,
    note: hasSandboxImplementation(actionType)
      ? 'Phase 8.5 includes sandbox implementations for content_publish, support_reply_send, ad_budget_adjust, and ad_pause. They return fake sandbox results and are not wired to auto-run or external platforms.'
      : 'Phase 8.5 keeps this action type as a registry mapping only. No executable handler implementation or external write exists for this action type yet.',
  };
}

export function resolveExecutorHandlerKey(actionType: ActionType): ExecutorHandlerKey {
  return EXECUTOR_HANDLER_MAP[actionType];
}

export function isExecutorHandlerMapped(actionType: ActionType): boolean {
  return Boolean(EXECUTOR_HANDLER_MAP[actionType]);
}

export function listExecutorRegistryEntries(): ExecutorRegistryEntry[] {
  return ACTION_TYPES.map(getRegisteredExecutorEntry);
}

export function listExecutorRegistrySafetyState(): {
  version: '0.6.0';
  phase: typeof EXECUTOR_REGISTRY_PHASE;
  previousPausePhase: typeof EXECUTOR_PAUSE_ENFORCEMENT_PHASE;
  registryMappingsDefined: true;
  executorsEnabled: false;
  realExternalWritesEnabled: false;
  sandboxExecutorsEnabled: true;
  pauseGuardRequiredForFutureExecutors: true;
  items: RegisteredExecutorSummary[];
  handlerMap: Readonly<Record<ActionType, ExecutorHandlerKey>>;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: EXECUTOR_REGISTRY_PHASE,
    previousPausePhase: EXECUTOR_PAUSE_ENFORCEMENT_PHASE,
    registryMappingsDefined: true,
    executorsEnabled: false,
    realExternalWritesEnabled: false,
    sandboxExecutorsEnabled: true,
    pauseGuardRequiredForFutureExecutors: true,
    handlerMap: EXECUTOR_HANDLER_MAP,
    items: ACTION_TYPES.map((actionType) => {
      const handlerKey = EXECUTOR_HANDLER_MAP[actionType];
      return {
        actionType,
        executorName: handlerKey,
        handlerKey,
        realExternalWriteEnabled: false,
        sandboxExecutorEnabled: hasSandboxImplementation(actionType),
        executionEnabled: false,
        pauseGuardRequired: true,
        status: 'registered_sandbox_mapping_only',
      };
    }),
    note: 'Phase 8.5 keeps the registry safe while marking content_publish, support_reply_send, ad_budget_adjust, and ad_pause as having sandbox-only handler implementations. They can return fake result data in tests, but are not wired to auto-run or external platforms.',
  };
}

export function buildExecutorRegistrySafetySummary(): {
  version: '0.6.0';
  phase: typeof EXECUTOR_REGISTRY_PHASE;
  registryMappingsDefined: true;
  mappedActionTypeCount: number;
  contentPublishMapsTo: 'sandboxContentExecutor';
  supportReplyMapsTo: 'sandboxSupportExecutor';
  adBudgetAdjustMapsTo: 'sandboxAdsBudgetExecutor';
  sandboxContentExecutorImplemented: true;
  sandboxSupportExecutorImplemented: true;
  sandboxAdsBudgetExecutorImplemented: true;
  sandboxAdsPauseExecutorImplemented: true;
  realExecutorImplemented: false;
  executorAutoRunEnabled: false;
  externalWritesEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: EXECUTOR_REGISTRY_PHASE,
    registryMappingsDefined: true,
    mappedActionTypeCount: ACTION_TYPES.length,
    contentPublishMapsTo: 'sandboxContentExecutor',
    supportReplyMapsTo: 'sandboxSupportExecutor',
    adBudgetAdjustMapsTo: 'sandboxAdsBudgetExecutor',
    sandboxContentExecutorImplemented: true,
    sandboxSupportExecutorImplemented: true,
    sandboxAdsBudgetExecutorImplemented: true,
    sandboxAdsPauseExecutorImplemented: true,
    realExecutorImplemented: false,
    executorAutoRunEnabled: false,
    externalWritesEnabled: false,
    note: 'Phase 8.5 adds sandbox ads executor implementations for ad_budget_adjust and ad_pause alongside content/support sandbox executors while keeping auto-run disabled and external writes impossible. Research/dev/notification/rollback registry mappings remain mapping-only.',
  };
}
