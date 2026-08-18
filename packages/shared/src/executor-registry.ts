export const EXECUTOR_REGISTRY_SHARED_PHASE = 'v0.6.0 Phase 8.5 Sandbox Ads Executor' as const;

export const SHARED_EXECUTOR_HANDLER_MAP = {
  content_publish: 'sandboxContentExecutor',
  support_reply_send: 'sandboxSupportExecutor',
  ad_budget_adjust: 'sandboxAdsBudgetExecutor',
  ad_pause: 'sandboxAdsPauseExecutor',
  research_task: 'sandboxResearchExecutor',
  dev_task: 'sandboxDevExecutor',
  notification_send: 'sandboxNotificationExecutor',
  rollback_action: 'sandboxRollbackExecutor',
} as const;

export type SharedExecutorActionType = keyof typeof SHARED_EXECUTOR_HANDLER_MAP;
export type SharedExecutorHandlerKey = (typeof SHARED_EXECUTOR_HANDLER_MAP)[SharedExecutorActionType];

export function getSharedExecutorHandlerKey(actionType: SharedExecutorActionType): SharedExecutorHandlerKey {
  return SHARED_EXECUTOR_HANDLER_MAP[actionType];
}

export function buildSharedExecutorRegistrySummary(): {
  version: '0.6.0';
  phase: typeof EXECUTOR_REGISTRY_SHARED_PHASE;
  registryMappingsDefined: true;
  sandboxContentHandlerIncluded: true;
  sandboxSupportHandlerIncluded: true;
  sandboxAdsBudgetHandlerIncluded: true;
  sandboxAdsPauseHandlerIncluded: true;
  externalWritesEnabled: false;
  mappedActionTypes: SharedExecutorActionType[];
} {
  return {
    version: '0.6.0',
    phase: EXECUTOR_REGISTRY_SHARED_PHASE,
    registryMappingsDefined: true,
    sandboxContentHandlerIncluded: true,
    sandboxSupportHandlerIncluded: true,
    sandboxAdsBudgetHandlerIncluded: true,
    sandboxAdsPauseHandlerIncluded: true,
    externalWritesEnabled: false,
    mappedActionTypes: Object.keys(SHARED_EXECUTOR_HANDLER_MAP) as SharedExecutorActionType[],
  };
}
