export const EXECUTION_RESULT_LOGS_SHARED_PHASE = 'v0.6.0 Phase 8.7 Execution Result Logs' as const;

export type SharedActionResultLogStatus = 'pending' | 'success' | 'failed' | 'blocked' | 'skipped' | 'rollback_success' | 'rollback_failed';

export type SharedSandboxExecutionResultLogPreview = {
  action_id: string;
  workspace_id: string;
  executor_name: string;
  external_id: string | null;
  external_url: string | null;
  result_status: SharedActionResultLogStatus;
  result_summary: string | null;
  error_message: string | null;
  rollback_supported: boolean;
  rollback_payload_included_in_browser: false;
  metadata_preview_available: true;
};

export const EXECUTION_RESULT_LOGS_SAFETY_BOUNDARY = {
  phase: EXECUTION_RESULT_LOGS_SHARED_PHASE,
  targetTable: 'action_results',
  sandboxOnly: true,
  externalWritesEnabled: false,
  browserReceivesRollbackPayload: false,
  note: 'Phase 8.7 makes sandbox executor result logs visible while keeping rollback payloads and raw executor metadata protected server-side.',
} as const;
