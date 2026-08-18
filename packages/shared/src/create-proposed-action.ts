export const CREATE_PROPOSED_ACTION_SERVICE_VERSION = 'create-proposed-action/v0.6.0-phase-3.4' as const;

export const CREATE_PROPOSED_ACTION_ALLOWED_SOURCES = [
  'chat',
  'draft_content',
  'draft_support_reply',
  'worker',
  'future_ad_tool',
  'proactive_scheduler',
  'system',
] as const;

export type CreateProposedActionSource = typeof CREATE_PROPOSED_ACTION_ALLOWED_SOURCES[number];

export const CREATE_PROPOSED_ACTION_SERVICE_STEPS = [
  'validate_database_configured',
  'validate_workspace_id',
  'validate_creator_membership_when_user_id_is_present',
  'validate_action_type',
  'validate_title',
  'validate_payload_action_type_match',
  'validate_required_payload_data_fields',
  'reject_forbidden_secret_like_payload_keys',
  'default_risk_level',
  'default_approval_required_true',
  'default_policy_decision_ask',
  'generate_or_accept_idempotency_key',
  'generate_or_accept_action_hash',
  'check_duplicate_by_idempotency_key',
  'check_duplicate_by_active_action_hash',
  'insert_proposed_action',
  'insert_action_created_event',
  'return_safe_summary',
  'do_not_approve',
  'do_not_execute',
] as const;

export const CREATE_PROPOSED_ACTION_DISABLED_CAPABILITIES = [
  'public_create_action_endpoint',
  'approve_action',
  'reject_action',
  'cancel_action',
  'queue_action',
  'execute_action',
  'publish_content',
  'send_support_reply',
  'change_ad_spend',
  'pause_campaign',
  'write_to_external_platform',
] as const;

export const CREATE_PROPOSED_ACTION_RESULT_FLAGS = {
  status: 'proposed',
  externalWritesEnabled: false,
  canExecuteFromThisService: false,
  eventCreated: 'action_created',
} as const;
