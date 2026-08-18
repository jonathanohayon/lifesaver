export const SANDBOX_SUPPORT_EXECUTOR_SHARED_PHASE = 'v0.6.0 Phase 8.4 Sandbox Support Executor' as const;

export const SANDBOX_SUPPORT_EXECUTOR_SHARED_CONTRACT = {
  version: '0.6.0',
  phase: SANDBOX_SUPPORT_EXECUTOR_SHARED_PHASE,
  executorName: 'sandboxSupportExecutor',
  actionType: 'support_reply_send',
  returns: ['fake_external_reply_id', 'fake_thread_permalink', 'sandbox_success'],
  sandboxOnly: true,
  realExternalWriteEnabled: false,
  externalWritesEnabled: false,
  autoRunEnabled: false,
  wiredToActionFlow: false,
  emailHelpdeskApiCalled: false,
  note: 'Shared contract marker for Phase 8.4. The sandbox support executor returns fake support reply data only and must not touch Gmail, Zendesk, Gorgias, Help Scout, or any helpdesk/email provider.',
} as const;
