import type { ActionPolicyDecision, ActionType } from '../actions/actions.types.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

export const POLICY_CAP_VALIDATION_PHASE = 'v0.6.0 Phase 6.6 Global Caps Foundation' as const;

export const POLICY_CAP_KEYS = [
  'max_posts_per_day',
  'max_support_auto_replies_per_day',
  'max_ad_spend_change_per_day',
  'max_model_cost_per_day',
  'max_actions_per_hour',
] as const;

export type PolicyCapKey = typeof POLICY_CAP_KEYS[number];

export type PolicyCapStatus =
  | 'not_applicable_no_policy_match'
  | 'no_caps_defined'
  | 'caps_ok'
  | 'cap_exceeded'
  | 'cap_usage_unavailable'
  | 'blocked_by_pause_or_emergency'
  | 'database_unavailable';

export type PolicyCapUsageSnapshot = {
  workspaceId: string;
  source: 'provided' | 'database' | 'unavailable';
  windowStartedAt: {
    day: string;
    hour: string;
  };
  postsToday: number;
  supportAutoRepliesToday: number;
  adSpendChangeToday: number;
  modelCostTodayUsd: number;
  actionsThisHour: number;
};

export type PolicyCapCheckResult = {
  capKey: PolicyCapKey;
  limit: number;
  current: number;
  increment: number;
  projected: number;
  exceeded: boolean;
  applied: boolean;
  reason: string;
};

export type PolicyCapValidationResult = {
  version: '0.6.0';
  phase: typeof POLICY_CAP_VALIDATION_PHASE;
  status: PolicyCapStatus;
  allowed: boolean;
  checkedCount: number;
  exceededCount: number;
  capsDefined: boolean;
  usageSource: PolicyCapUsageSnapshot['source'];
  checks: PolicyCapCheckResult[];
  usage: PolicyCapUsageSnapshot | null;
  reason: string;
  safety: {
    validationOnly: true;
    executorRan: false;
    externalWritesAttempted: false;
    autoRunTriggered: false;
    note: string;
  };
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s,]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getPath(source: JsonObject, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current: unknown = source;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }

    if (!isObject(current) || !(part in current)) return undefined;
    current = current[part];
  }

  return current;
}

function firstNumber(context: JsonObject, paths: string[]): number | null {
  for (const path of paths) {
    const value = getPath(context, path);
    if (value !== undefined && value !== null && value !== '') {
      const numeric = toNumber(value);
      if (numeric !== null) return numeric;
    }
  }
  return null;
}

function normalizeCaps(capsJson: unknown): Partial<Record<PolicyCapKey, number>> {
  const source = isObject(capsJson) ? capsJson : {};
  const nested = isObject(source.global) ? source.global : {};
  const caps = { ...source, ...nested };

  const read = (keys: string[]): number | null => {
    for (const key of keys) {
      if (key in caps) {
        const numeric = toNumber(caps[key]);
        if (numeric !== null && numeric >= 0) return numeric;
      }
    }
    return null;
  };

  const normalized: Partial<Record<PolicyCapKey, number>> = {};
  const posts = read(['max_posts_per_day', 'maxPostsPerDay', 'posts_per_day', 'postsPerDay']);
  const replies = read(['max_support_auto_replies_per_day', 'maxSupportAutoRepliesPerDay', 'support_auto_replies_per_day', 'supportAutoRepliesPerDay']);
  const adSpend = read(['max_ad_spend_change_per_day', 'maxAdSpendChangePerDay', 'ad_spend_change_per_day', 'adSpendChangePerDay']);
  const modelCost = read(['max_model_cost_per_day', 'maxModelCostPerDay', 'model_cost_per_day', 'modelCostPerDay']);
  const actionsHour = read(['max_actions_per_hour', 'maxActionsPerHour', 'actions_per_hour', 'actionsPerHour']);

  if (posts !== null) normalized.max_posts_per_day = posts;
  if (replies !== null) normalized.max_support_auto_replies_per_day = replies;
  if (adSpend !== null) normalized.max_ad_spend_change_per_day = adSpend;
  if (modelCost !== null) normalized.max_model_cost_per_day = modelCost;
  if (actionsHour !== null) normalized.max_actions_per_hour = actionsHour;
  return normalized;
}

function actionContext(action: EvaluateActionPolicyInput): JsonObject {
  const payloadJson = isObject(action.payloadJson) ? action.payloadJson : {};
  return {
    workspaceId: action.workspaceId,
    workspace_id: action.workspaceId,
    actionId: action.actionId ?? null,
    action_id: action.actionId ?? null,
    actionType: action.actionType,
    action_type: action.actionType,
    riskLevel: action.riskLevel ?? null,
    risk_level: action.riskLevel ?? null,
    payloadJson,
    payload_json: payloadJson,
    payload: payloadJson,
    ...payloadJson,
  };
}

function estimateAdSpendIncrement(action: EvaluateActionPolicyInput): number {
  if (action.actionType !== 'ad_budget_adjust') return 0;
  const context = actionContext(action);
  const amount = firstNumber(context, [
    'change_amount',
    'delta',
    'amount',
    'proposed_budget_delta',
    'data.change_amount',
    'data.delta',
    'data.amount',
    'data.proposed_budget_delta',
    'payload.change_amount',
    'payload.delta',
    'payload.amount',
    'payload.proposed_budget_delta',
    'payload.data.change_amount',
    'payload.data.delta',
    'payload.data.amount',
    'payload.data.proposed_budget_delta',
    'payloadJson.change_amount',
    'payloadJson.delta',
    'payloadJson.amount',
    'payloadJson.proposed_budget_delta',
    'payloadJson.data.change_amount',
    'payloadJson.data.delta',
    'payloadJson.data.amount',
    'payloadJson.data.proposed_budget_delta',
  ]);
  return amount === null ? 0 : Math.abs(amount);
}

function estimateModelCostIncrement(action: EvaluateActionPolicyInput): number {
  const context = actionContext(action);
  const amount = firstNumber(context, [
    'estimated_model_cost_usd',
    'model_cost_usd',
    'estimatedCostUsd',
    'data.estimated_model_cost_usd',
    'data.model_cost_usd',
    'payload.estimated_model_cost_usd',
    'payload.model_cost_usd',
    'payload.data.estimated_model_cost_usd',
    'payload.data.model_cost_usd',
    'payloadJson.estimated_model_cost_usd',
    'payloadJson.model_cost_usd',
    'payloadJson.data.estimated_model_cost_usd',
    'payloadJson.data.model_cost_usd',
  ]);
  return amount === null ? 0 : Math.max(0, amount);
}

function capAppliesToAction(capKey: PolicyCapKey, actionType: ActionType): boolean {
  if (capKey === 'max_posts_per_day') return actionType === 'content_publish';
  if (capKey === 'max_support_auto_replies_per_day') return actionType === 'support_reply_send';
  if (capKey === 'max_ad_spend_change_per_day') return actionType === 'ad_budget_adjust';
  return true;
}

function capIncrement(capKey: PolicyCapKey, action: EvaluateActionPolicyInput): number {
  switch (capKey) {
    case 'max_posts_per_day':
      return action.actionType === 'content_publish' ? 1 : 0;
    case 'max_support_auto_replies_per_day':
      return action.actionType === 'support_reply_send' ? 1 : 0;
    case 'max_ad_spend_change_per_day':
      return estimateAdSpendIncrement(action);
    case 'max_model_cost_per_day':
      return estimateModelCostIncrement(action);
    case 'max_actions_per_hour':
      return 1;
    default:
      return 0;
  }
}

function currentUsageForCap(capKey: PolicyCapKey, usage: PolicyCapUsageSnapshot): number {
  switch (capKey) {
    case 'max_posts_per_day':
      return usage.postsToday;
    case 'max_support_auto_replies_per_day':
      return usage.supportAutoRepliesToday;
    case 'max_ad_spend_change_per_day':
      return usage.adSpendChangeToday;
    case 'max_model_cost_per_day':
      return usage.modelCostTodayUsd;
    case 'max_actions_per_hour':
      return usage.actionsThisHour;
    default:
      return 0;
  }
}

function buildEmptyUsage(workspaceId: string, source: PolicyCapUsageSnapshot['source']): PolicyCapUsageSnapshot {
  const now = new Date();
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return {
    workspaceId,
    source,
    windowStartedAt: {
      day: day.toISOString(),
      hour: hour.toISOString(),
    },
    postsToday: 0,
    supportAutoRepliesToday: 0,
    adSpendChangeToday: 0,
    modelCostTodayUsd: 0,
    actionsThisHour: 0,
  };
}

export function unavailablePolicyCapUsage(workspaceId: string): PolicyCapUsageSnapshot {
  return buildEmptyUsage(workspaceId, 'unavailable');
}

export function validatePolicyCaps(params: {
  action: EvaluateActionPolicyInput;
  capsJson: unknown;
  usage: PolicyCapUsageSnapshot | null | undefined;
  requestedDecision?: ActionPolicyDecision | null;
}): PolicyCapValidationResult {
  const caps = normalizeCaps(params.capsJson);
  const entries = Object.entries(caps) as Array<[PolicyCapKey, number]>;

  if (entries.length === 0) {
    return {
      version: '0.6.0',
      phase: POLICY_CAP_VALIDATION_PHASE,
      status: 'no_caps_defined',
      allowed: true,
      checkedCount: 0,
      exceededCount: 0,
      capsDefined: false,
      usageSource: params.usage?.source || 'unavailable',
      checks: [],
      usage: params.usage || null,
      reason: 'No global caps were defined on the matched policy.',
      safety: {
        validationOnly: true,
        executorRan: false,
        externalWritesAttempted: false,
        autoRunTriggered: false,
        note: 'Phase 6.6 cap validation is internal decision support only. It never executes actions or writes externally.',
      },
    };
  }

  if (!params.usage || params.usage.source === 'unavailable') {
    return {
      version: '0.6.0',
      phase: POLICY_CAP_VALIDATION_PHASE,
      status: 'cap_usage_unavailable',
      allowed: false,
      checkedCount: 0,
      exceededCount: 0,
      capsDefined: true,
      usageSource: 'unavailable',
      checks: [],
      usage: params.usage || unavailablePolicyCapUsage(params.action.workspaceId),
      reason: 'Caps are defined, but current usage could not be verified. Auto-approval must not continue when caps cannot be checked.',
      safety: {
        validationOnly: true,
        executorRan: false,
        externalWritesAttempted: false,
        autoRunTriggered: false,
        note: 'Fail-closed cap behavior: unverified caps must not produce auto-approval.',
      },
    };
  }

  const checks = entries.map(([capKey, limit]) => {
    const applied = capAppliesToAction(capKey, params.action.actionType);
    const current = currentUsageForCap(capKey, params.usage as PolicyCapUsageSnapshot);
    const increment = applied ? capIncrement(capKey, params.action) : 0;
    const projected = current + increment;
    const exceeded = applied && projected > limit;
    return {
      capKey,
      limit,
      current,
      increment,
      projected,
      exceeded,
      applied,
      reason: applied
        ? exceeded
          ? `${capKey} exceeded: projected ${projected} is above limit ${limit}.`
          : `${capKey} ok: projected ${projected} is within limit ${limit}.`
        : `${capKey} does not apply to ${params.action.actionType}, but remains visible in the cap summary.`,
    } satisfies PolicyCapCheckResult;
  });

  const exceeded = checks.filter((check) => check.exceeded);
  return {
    version: '0.6.0',
    phase: POLICY_CAP_VALIDATION_PHASE,
    status: exceeded.length > 0 ? 'cap_exceeded' : 'caps_ok',
    allowed: exceeded.length === 0,
    checkedCount: checks.filter((check) => check.applied).length,
    exceededCount: exceeded.length,
    capsDefined: true,
    usageSource: params.usage.source,
    checks,
    usage: params.usage,
    reason: exceeded.length > 0
      ? `One or more global caps would be exceeded: ${exceeded.map((item) => item.capKey).join(', ')}.`
      : 'Global caps were checked and no cap would be exceeded.',
    safety: {
      validationOnly: true,
      executorRan: false,
      externalWritesAttempted: false,
      autoRunTriggered: false,
      note: 'Phase 6.6 validates caps only. It does not queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
    },
  };
}

export function policyCapValidationLibraryStatus() {
  return {
    version: '0.6.0',
    phase: POLICY_CAP_VALIDATION_PHASE,
    caps: POLICY_CAP_KEYS,
    statusValues: [
      'not_applicable_no_policy_match',
      'no_caps_defined',
      'caps_ok',
      'cap_exceeded',
      'cap_usage_unavailable',
      'blocked_by_pause_or_emergency',
      'database_unavailable',
    ] as const,
    executorEnabled: false,
    externalWritesEnabled: false,
  };
}
