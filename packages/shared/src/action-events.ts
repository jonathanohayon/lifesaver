export const ACTION_EVENTS_TABLE_VERSION = 'action-events/v0.6.0' as const;

export const V2_ACTION_EVENT_TYPES = [
  'action_created',
  'policy_evaluated',
  'approved',
  'rejected',
  'cancelled',
  'queued',
  'execution_started',
  'execution_finished',
  'execution_failed',
  'rollback_requested',
  'rollback_started',
  'rollback_finished',
  'rollback_failed',
] as const;

export type V2ActionEventType = typeof V2_ACTION_EVENT_TYPES[number];

export const V2_ACTION_STATUSES_FOR_EVENTS = [
  'proposed',
  'approval_required',
  'auto_approved',
  'approved',
  'rejected',
  'cancelled',
  'queued',
  'executing',
  'executed',
  'failed',
  'rollback_requested',
  'rolled_back',
] as const;

export type V2ActionEventStatus = typeof V2_ACTION_STATUSES_FOR_EVENTS[number];

export interface V2ActionEventRecordShape {
  id: string;
  action_id: string;
  workspace_id: string;
  actor_user_id: string | null;
  event_type: V2ActionEventType;
  from_status: V2ActionEventStatus | null;
  to_status: V2ActionEventStatus | null;
  message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export const FORBIDDEN_ACTION_EVENT_METADATA_KEY_PATTERNS = [
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
