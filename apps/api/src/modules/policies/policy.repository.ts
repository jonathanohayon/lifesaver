import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { ActionPolicyDecision, ActionType } from '../actions/actions.types.js';

export type PolicyEvaluationRuleRow = {
  id: string;
  workspace_id: string;
  name: string;
  action_type: ActionType;
  conditions_json: Record<string, unknown>;
  decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
  caps_json: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function serializePolicyEvaluationRuleRow(row: PolicyEvaluationRuleRow): PolicyEvaluationRuleRow {
  return {
    ...row,
    conditions_json: asJsonObject(row.conditions_json),
    caps_json: asJsonObject(row.caps_json),
  };
}

export async function listEnabledPolicyRulesForAction(params: {
  workspaceId: string;
  actionType: ActionType;
  limit?: number;
}): Promise<PolicyEvaluationRuleRow[]> {
  if (!isDatabaseConfigured) return [];

  const limit = Number.isFinite(params.limit || 0)
    ? Math.min(Math.max(Math.floor(Number(params.limit)), 1), 100)
    : 50;

  const result = await query<PolicyEvaluationRuleRow>(
    `SELECT
       id,
       workspace_id,
       name,
       action_type,
       conditions_json,
       decision,
       caps_json,
       priority,
       enabled,
       created_by,
       updated_by,
       created_at,
       updated_at
     FROM policies
     WHERE workspace_id = $1
       AND action_type = $2
       AND enabled = TRUE
     ORDER BY priority ASC, created_at DESC, id ASC
     LIMIT $3;`,
    [params.workspaceId, params.actionType, limit]
  );

  return result.rows.map(serializePolicyEvaluationRuleRow);
}

export type PolicyCapUsageSnapshotRow = {
  posts_today: string | number;
  support_auto_replies_today: string | number;
  ad_spend_change_today: string | number;
  model_cost_today_usd: string | number;
  actions_this_hour: string | number;
  day_window_started_at: Date;
  hour_window_started_at: Date;
};

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function getPolicyCapUsageSnapshot(params: {
  workspaceId: string;
}) {
  if (!isDatabaseConfigured) return null;

  const result = await query<PolicyCapUsageSnapshotRow>(
    `WITH windows AS (
       SELECT date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day_start,
              date_trunc('hour', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS hour_start
     ), action_usage AS (
       SELECT
         COUNT(*) FILTER (
           WHERE action_type = 'content_publish'
             AND created_at >= (SELECT day_start FROM windows)
             AND status NOT IN ('rejected', 'cancelled')
             AND policy_decision IN ('auto_approve', 'ask', 'block')
         ) AS posts_today,
         COUNT(*) FILTER (
           WHERE action_type = 'support_reply_send'
             AND created_at >= (SELECT day_start FROM windows)
             AND status NOT IN ('rejected', 'cancelled')
             AND policy_decision IN ('auto_approve', 'ask', 'block')
         ) AS support_auto_replies_today,
         COALESCE(SUM(
           CASE
             WHEN action_type = 'ad_budget_adjust'
              AND created_at >= (SELECT day_start FROM windows)
              AND status NOT IN ('rejected', 'cancelled')
              AND policy_decision IN ('auto_approve', 'ask', 'block')
             THEN ABS(COALESCE(
               NULLIF(payload_json #>> '{data,change_amount}', '')::numeric,
               NULLIF(payload_json #>> '{data,delta}', '')::numeric,
               NULLIF(payload_json #>> '{data,amount}', '')::numeric,
               NULLIF(payload_json #>> '{change_amount}', '')::numeric,
               NULLIF(payload_json #>> '{delta}', '')::numeric,
               NULLIF(payload_json #>> '{amount}', '')::numeric,
               0
             ))
             ELSE 0
           END
         ), 0) AS ad_spend_change_today,
         COUNT(*) FILTER (
           WHERE created_at >= (SELECT hour_start FROM windows)
             AND status NOT IN ('rejected', 'cancelled')
             AND policy_decision IN ('auto_approve', 'ask', 'block')
         ) AS actions_this_hour
       FROM actions
       WHERE workspace_id = $1
     ), model_usage AS (
       SELECT COALESCE(SUM(estimated_cost_usd), 0) AS model_cost_today_usd
       FROM usage_logs
       WHERE workspace_id = $1
         AND created_at >= (SELECT day_start FROM windows)
     )
     SELECT
       action_usage.posts_today,
       action_usage.support_auto_replies_today,
       action_usage.ad_spend_change_today,
       model_usage.model_cost_today_usd,
       action_usage.actions_this_hour,
       (SELECT day_start FROM windows) AS day_window_started_at,
       (SELECT hour_start FROM windows) AS hour_window_started_at
     FROM action_usage, model_usage;`,
    [params.workspaceId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    workspaceId: params.workspaceId,
    source: 'database' as const,
    windowStartedAt: {
      day: row.day_window_started_at.toISOString(),
      hour: row.hour_window_started_at.toISOString(),
    },
    postsToday: toNumber(row.posts_today),
    supportAutoRepliesToday: toNumber(row.support_auto_replies_today),
    adSpendChangeToday: toNumber(row.ad_spend_change_today),
    modelCostTodayUsd: toNumber(row.model_cost_today_usd),
    actionsThisHour: toNumber(row.actions_this_hour),
  };
}
