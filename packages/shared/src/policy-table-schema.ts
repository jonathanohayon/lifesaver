export const POLICY_TABLE_SCHEMA_PHASE = 'v0.6.0 Phase 6.1 Policy Table Schema' as const;

export const POLICY_TABLE_NAME = 'policies' as const;

export const POLICY_DECISIONS = ['ask', 'auto_approve', 'block'] as const;
export type PolicyDecision = typeof POLICY_DECISIONS[number];

export const POLICY_ACTION_TYPES = [
  'content_publish',
  'support_reply_send',
  'ad_budget_adjust',
  'ad_pause',
  'research_task',
  'dev_task',
  'notification_send',
  'rollback_action',
] as const;
export type PolicyActionType = typeof POLICY_ACTION_TYPES[number];

export type PolicyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  actionType: PolicyActionType;
  conditionsJson: Record<string, unknown>;
  decision: PolicyDecision;
  capsJson: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const POLICY_TABLE_COLUMNS = [
  'id',
  'workspace_id',
  'name',
  'action_type',
  'conditions_json',
  'decision',
  'caps_json',
  'priority',
  'enabled',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
] as const;

export const POLICY_SCHEMA_SAFETY_RULES = [
  'The policies table stores rule definitions only.',
  'This phase does not evaluate policy rules.',
  'This phase does not auto-approve actions.',
  'This phase does not queue or execute actions.',
  'Future policy evaluation must check emergency safe mode, master pause, category pause, caps, roles, audit logs, and executor pause guard before execution.',
  'conditions_json and caps_json must never store raw secrets, API keys, OAuth tokens, passwords, database URLs, or raw .env values.',
] as const;

export const DEFAULT_POLICY_SCHEMA_CONTRACT = {
  version: '0.6.0',
  phase: POLICY_TABLE_SCHEMA_PHASE,
  table: POLICY_TABLE_NAME,
  migration: '015_create_policies_table.sql',
  decisions: POLICY_DECISIONS,
  actionTypes: POLICY_ACTION_TYPES,
  columns: POLICY_TABLE_COLUMNS,
  safety: {
    storageOnly: true,
    evaluatorAdded: false,
    autoApprovalEnabled: false,
    executorEnabled: false,
    externalWritesEnabled: false,
  },
} as const;
