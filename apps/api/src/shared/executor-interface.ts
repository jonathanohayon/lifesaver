export const EXECUTOR_INTERFACE_SHARED_CONTRACT = {
  version: '0.6.0',
  phase: 'V2 Phase 8.1 Executor Interface',
  requiredMethods: ['validate', 'execute', 'rollback', 'summarizeResult'],
  sandboxExecutorImplemented: false,
  realExecutorImplemented: false,
  externalWritesEnabled: false,
  note: 'Shared contract marker for the Phase 8.1 TypeScript executor interface. No executor implementation is registered in this phase.',
} as const;
