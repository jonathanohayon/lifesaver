export const ACTION_RESULTS_TABLE_VERSION = 'action-results/v0.6.0' as const;

export const V2_ACTION_RESULT_STATUSES = [
  'pending',
  'success',
  'failed',
  'blocked',
  'skipped',
  'rollback_success',
  'rollback_failed',
] as const;

export type V2ActionResultStatus = typeof V2_ACTION_RESULT_STATUSES[number];

export interface V2ActionResultRecordShape {
  id: string;
  action_id: string;
  workspace_id: string;
  executor_name: string;
  external_id: string | null;
  external_url: string | null;
  result_status: V2ActionResultStatus;
  result_summary: string | null;
  error_message: string | null;
  rollback_supported: boolean;
  rollback_payload: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const SAFE_SANDBOX_EXECUTOR_NAMES = [
  'sandbox_content_executor',
  'sandbox_support_executor',
  'sandbox_ads_executor',
] as const;

export type SafeSandboxExecutorName = typeof SAFE_SANDBOX_EXECUTOR_NAMES[number];

export const FORBIDDEN_ACTION_RESULT_KEY_PATTERNS = [
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'cookie',
  'authorization',
  'database_url',
  'DATABASE_URL',
  'CLAUDE_API_KEY',
  'TRIPLE_WHALE_API_KEY',
  'APP_ENCRYPTION_KEY',
  'WORKER_SHARED_SECRET',
] as const;
