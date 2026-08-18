export const SANDBOX_CONTENT_EXECUTOR_SHARED_PHASE = 'v0.6.0 Phase 8.3 Sandbox Content Executor' as const;

export const SANDBOX_CONTENT_EXECUTOR_SHARED_CONTRACT = {
  version: '0.6.0',
  phase: SANDBOX_CONTENT_EXECUTOR_SHARED_PHASE,
  executorName: 'sandboxContentExecutor',
  actionType: 'content_publish',
  returns: ['fake_external_post_id', 'fake_permalink', 'sandbox_success'],
  sandboxOnly: true,
  realExternalWriteEnabled: false,
  externalWritesEnabled: false,
  autoRunEnabled: false,
  wiredToActionFlow: false,
  note: 'Shared contract marker for Phase 8.3. The sandbox content executor returns fake post data only and must not touch external social platforms.',
} as const;
