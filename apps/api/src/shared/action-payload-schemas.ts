export const ACTION_PAYLOAD_SCHEMA_VERSION = 'action-payload/v0.6.0' as const;

export const ACTION_PAYLOAD_SOURCES = [
  'chat',
  'draft',
  'worker',
  'admin',
  'policy',
  'system',
  'import',
] as const;

export type ActionPayloadSource = typeof ACTION_PAYLOAD_SOURCES[number];

export const V2_ACTION_TYPES = [
  'content_publish',
  'support_reply_send',
  'ad_budget_adjust',
  'ad_pause',
  'research_task',
  'dev_task',
  'notification_send',
  'rollback_action',
] as const;

export type V2ActionType = typeof V2_ACTION_TYPES[number];

export interface BaseActionPayload<TActionType extends V2ActionType, TData extends Record<string, unknown>> {
  schema_version: typeof ACTION_PAYLOAD_SCHEMA_VERSION;
  action_type: TActionType;
  source: ActionPayloadSource;
  intent_summary: string;
  created_reason?: string | null;
  risk_notes?: string[];
  idempotency_hint?: string | null;
  data: TData;
}

export type ContentPublishPayload = BaseActionPayload<'content_publish', {
  platform: string;
  caption: string;
  post_type?: string | null;
  media_url?: string | null;
  media_asset_id?: string | null;
  hashtags?: string[];
  scheduled_time?: string | null;
  account_id_hint?: string | null;
  call_to_action_url?: string | null;
  approval_notes?: string | null;
  brand_voice_profile_id?: string | null;
}>;

export type SupportReplySendPayload = BaseActionPayload<'support_reply_send', {
  ticket_id: string;
  thread_id: string;
  reply_body: string;
  support_provider?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  subject?: string | null;
  category?: string | null;
  confidence_score?: number | null;
  sensitive_flag?: boolean;
  escalation_required?: boolean;
  approval_notes?: string | null;
}>;

export type AdBudgetAdjustPayload = BaseActionPayload<'ad_budget_adjust', {
  platform: string;
  campaign_id: string;
  current_budget: number;
  proposed_budget: number;
  change_amount: number;
  currency: string;
  account_id_hint?: string | null;
  adset_id?: string | null;
  current_budget_period?: 'daily' | 'lifetime' | string;
  proposed_budget_period?: 'daily' | 'lifetime' | string;
  change_percent?: number | null;
  reason?: string | null;
  metric_window?: string | null;
  performance_snapshot?: Record<string, unknown>;
  rollback_budget?: number | null;
  approval_notes?: string | null;
}>;

export type AdPausePayload = BaseActionPayload<'ad_pause', {
  platform: string;
  target_level: 'campaign' | 'adset' | 'ad' | string;
  target_id: string;
  current_status: string;
  proposed_status: 'paused' | string;
  reason: string;
  account_id_hint?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  metric_window?: string | null;
  performance_snapshot?: Record<string, unknown>;
  rollback_status?: string | null;
  approval_notes?: string | null;
}>;

export type ResearchTaskPayload = BaseActionPayload<'research_task', {
  question: string;
  objective: string;
  allowed_sources?: string[];
  blocked_sources?: string[];
  output_format?: string | null;
  due_at?: string | null;
  confidence_required?: number | null;
  deliverable_notes?: string | null;
}>;

export type DevTaskPayload = BaseActionPayload<'dev_task', {
  task_summary: string;
  area: string;
  files_expected?: string[];
  acceptance_criteria?: string[];
  test_commands?: string[];
  deployment_required?: boolean;
  rollback_notes?: string | null;
  risk_notes?: string[];
}>;

export type NotificationSendPayload = BaseActionPayload<'notification_send', {
  channel: string;
  recipient_user_id: string;
  message: string;
  template_key?: string | null;
  subject?: string | null;
  deep_link_action_id?: string | null;
  quiet_hours_policy?: string | null;
  urgency?: 'low' | 'medium' | 'high' | 'critical' | string;
  expires_at?: string | null;
}>;

export type RollbackActionPayload = BaseActionPayload<'rollback_action', {
  original_action_id: string;
  rollback_type: string;
  reason: string;
  rollback_payload?: Record<string, unknown>;
  rollback_supported?: boolean;
  expected_result?: string | null;
  manual_followup_required?: boolean;
}>;

export type V2ActionPayload =
  | ContentPublishPayload
  | SupportReplySendPayload
  | AdBudgetAdjustPayload
  | AdPausePayload
  | ResearchTaskPayload
  | DevTaskPayload
  | NotificationSendPayload
  | RollbackActionPayload;

export const ACTION_PAYLOAD_REQUIRED_DATA_FIELDS: Record<V2ActionType, string[]> = {
  content_publish: ['platform', 'caption'],
  support_reply_send: ['ticket_id', 'thread_id', 'reply_body'],
  ad_budget_adjust: ['platform', 'campaign_id', 'current_budget', 'proposed_budget', 'change_amount', 'currency'],
  ad_pause: ['platform', 'target_level', 'target_id', 'current_status', 'proposed_status', 'reason'],
  research_task: ['question', 'objective'],
  dev_task: ['task_summary', 'area'],
  notification_send: ['channel', 'recipient_user_id', 'message'],
  rollback_action: ['original_action_id', 'rollback_type', 'reason'],
};

export const FORBIDDEN_ACTION_PAYLOAD_KEY_PATTERNS = [
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
