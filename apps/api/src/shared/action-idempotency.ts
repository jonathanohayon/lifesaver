export const ACTION_DUPLICATE_PROTECTION_VERSION = 'action-duplicate-protection/v0.6.0' as const;

export const ACTION_HASH_ACTIVE_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
  'approved',
  'queued',
  'executing',
  'executed',
  'rollback_requested',
  'rolled_back',
] as const;

export type ActionHashActiveStatus = typeof ACTION_HASH_ACTIVE_STATUSES[number];

export const ACTION_HASH_REPLACEABLE_STATUSES = [
  'rejected',
  'cancelled',
  'failed',
] as const;

export type ActionHashReplaceableStatus = typeof ACTION_HASH_REPLACEABLE_STATUSES[number];

export interface ActionDuplicateProtectionFields {
  idempotency_key?: string | null;
  action_hash?: string | null;
}

export interface ActionHashInputShape {
  workspace_id: string;
  action_type: string;
  target_platform?: string | null;
  target_external_id?: string | null;
  scheduled_time?: string | null;
  normalized_payload: Record<string, unknown>;
}

export const FORBIDDEN_IDEMPOTENCY_OR_HASH_INPUT_KEY_PATTERNS = [
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

export const FUTURE_CREATE_PROPOSED_ACTION_DUPLICATE_CHECK_ORDER = [
  'validate_workspace_and_permission',
  'validate_action_type',
  'validate_payload_schema',
  'generate_or_receive_idempotency_key',
  'build_action_hash_from_safe_normalized_data',
  'check_existing_action_by_idempotency_key',
  'check_existing_active_action_by_action_hash',
  'insert_action',
  'insert_action_created_event',
  'do_not_execute',
] as const;

export const FUTURE_APPROVE_DOUBLE_CLICK_ALLOWED_FROM_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
] as const;

export const ACTION_DUPLICATE_PROTECTION_ERROR_CODES = [
  'DUPLICATE_IDEMPOTENCY_KEY',
  'DUPLICATE_ACTION_INTENT',
  'ACTION_ALREADY_APPROVED',
  'ACTION_ALREADY_EXECUTED',
  'EXECUTION_ALREADY_IN_PROGRESS',
] as const;

export type ActionDuplicateProtectionErrorCode = typeof ACTION_DUPLICATE_PROTECTION_ERROR_CODES[number];
