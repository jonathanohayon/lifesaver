import type { ActionRiskLevel, ActionType } from '../actions/actions.types.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

export const POLICY_SCOPE_MATCHING_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const POLICY_SCOPE_FIELDS = [
  'action_type',
  'platform',
  'channel',
  'workspace',
  'risk_level',
  'amount',
  'category',
  'confidence_score',
] as const;

export type PolicyScopeField = typeof POLICY_SCOPE_FIELDS[number];

export type PolicyActionScope = {
  workspaceId: string;
  actionType: ActionType;
  platform: string | null;
  channel: string | null;
  riskLevel: ActionRiskLevel | null;
  amount: number | null;
  category: string | null;
  confidenceScore: number | null;
  raw: {
    platformPath: string | null;
    channelPath: string | null;
    amountPath: string | null;
    categoryPath: string | null;
    confidencePath: string | null;
  };
};

export type PolicyScopeCheckResult = {
  field: PolicyScopeField;
  matched: boolean;
  supported: boolean;
  expected: unknown;
  actual: unknown;
  reason: string;
};

export type PolicyScopeMatchingResult = {
  version: '0.6.0';
  phase: typeof POLICY_SCOPE_MATCHING_PHASE;
  matched: boolean;
  supported: boolean;
  emptyScope: boolean;
  checkedCount: number;
  checked: PolicyScopeCheckResult[];
  actionScope: PolicyActionScope;
  reason: string;
  safety: {
    externalWritesAttempted: false;
    executorRan: false;
    note: string;
  };
};

type JsonObject = Record<string, unknown>;

const RISK_ORDER: Record<ActionRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  const normalized = normalizeString(value);
  return normalized ? [normalized] : [];
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

function normalizeRisk(value: unknown): ActionRiskLevel | null {
  const risk = normalizeString(value) as ActionRiskLevel;
  return risk in RISK_ORDER ? risk : null;
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
    requestedDecision: action.requestedDecision ?? null,
    requested_decision: action.requestedDecision ?? null,
    source: action.source ?? null,
    payloadJson,
    payload_json: payloadJson,
    payload: payloadJson,
    ...payloadJson,
  };
}

function firstDefined(context: JsonObject, paths: string[]): { path: string; value: unknown } | null {
  for (const path of paths) {
    const value = getPath(context, path);
    if (value !== undefined && value !== null && value !== '') return { path, value };
  }
  return null;
}

export function buildPolicyActionScope(action: EvaluateActionPolicyInput): PolicyActionScope {
  const context = actionContext(action);
  const platform = firstDefined(context, [
    'platform',
    'payload.platform',
    'payloadJson.platform',
    'payload_json.platform',
    'data.platform',
    'payload.data.platform',
    'payloadJson.data.platform',
    'payload_json.data.platform',
    'provider',
    'support_provider',
    'payload.data.support_provider',
    'payloadJson.data.support_provider',
  ]);
  const channel = firstDefined(context, [
    'channel',
    'payload.channel',
    'payloadJson.channel',
    'payload_json.channel',
    'data.channel',
    'payload.data.channel',
    'payloadJson.data.channel',
    'payload_json.data.channel',
    'account_channel',
    'destination_channel',
    'payload.data.account_channel',
    'payload.data.destination_channel',
    'platform',
    'payload.data.platform',
    'payloadJson.data.platform',
  ]);
  const amount = firstDefined(context, [
    'amount',
    'change_amount',
    'delta',
    'value',
    'proposed_budget_delta',
    'data.amount',
    'data.change_amount',
    'data.delta',
    'data.value',
    'data.proposed_budget_delta',
    'payload.amount',
    'payload.change_amount',
    'payload.delta',
    'payload.value',
    'payload.proposed_budget_delta',
    'payload.data.amount',
    'payload.data.change_amount',
    'payload.data.delta',
    'payload.data.value',
    'payload.data.proposed_budget_delta',
    'payloadJson.amount',
    'payloadJson.change_amount',
    'payloadJson.delta',
    'payloadJson.value',
    'payloadJson.proposed_budget_delta',
    'payloadJson.data.amount',
    'payloadJson.data.change_amount',
    'payloadJson.data.delta',
    'payloadJson.data.value',
    'payloadJson.data.proposed_budget_delta',
  ]);
  const category = firstDefined(context, [
    'category',
    'ticket_category',
    'support_category',
    'content_category',
    'classification.category',
    'data.category',
    'data.ticket_category',
    'data.support_category',
    'data.content_category',
    'data.classification.category',
    'payload.category',
    'payload.ticket_category',
    'payload.support_category',
    'payload.content_category',
    'payload.classification.category',
    'payload.data.category',
    'payload.data.ticket_category',
    'payload.data.support_category',
    'payload.data.content_category',
    'payload.data.classification.category',
    'payloadJson.category',
    'payloadJson.ticket_category',
    'payloadJson.support_category',
    'payloadJson.content_category',
    'payloadJson.classification.category',
    'payloadJson.data.category',
    'payloadJson.data.ticket_category',
    'payloadJson.data.support_category',
    'payloadJson.data.content_category',
    'payloadJson.data.classification.category',
  ]);
  const confidence = firstDefined(context, [
    'confidence',
    'confidence_score',
    'classification.confidence',
    'classification.confidence_score',
    'data.confidence',
    'data.confidence_score',
    'data.classification.confidence',
    'data.classification.confidence_score',
    'payload.confidence',
    'payload.confidence_score',
    'payload.classification.confidence',
    'payload.classification.confidence_score',
    'payload.data.confidence',
    'payload.data.confidence_score',
    'payload.data.classification.confidence',
    'payload.data.classification.confidence_score',
    'payloadJson.confidence',
    'payloadJson.confidence_score',
    'payloadJson.classification.confidence',
    'payloadJson.classification.confidence_score',
    'payloadJson.data.confidence',
    'payloadJson.data.confidence_score',
    'payloadJson.data.classification.confidence',
    'payloadJson.data.classification.confidence_score',
  ]);

  return {
    workspaceId: action.workspaceId,
    actionType: action.actionType,
    platform: platform ? normalizeString(platform.value) || null : null,
    channel: channel ? normalizeString(channel.value) || null : null,
    riskLevel: normalizeRisk(action.riskLevel),
    amount: amount ? toNumber(amount.value) : null,
    category: category ? normalizeString(category.value) || null : null,
    confidenceScore: confidence ? toNumber(confidence.value) : null,
    raw: {
      platformPath: platform?.path ?? null,
      channelPath: channel?.path ?? null,
      amountPath: amount?.path ?? null,
      categoryPath: category?.path ?? null,
      confidencePath: confidence?.path ?? null,
    },
  };
}

function extractScopeObject(conditionsJson: unknown): JsonObject {
  if (!isObject(conditionsJson)) return {};
  const explicitScope = isObject(conditionsJson.scope) ? conditionsJson.scope : {};

  const topLevelKeys = [
    'action_type',
    'actionType',
    'action_types',
    'actionTypes',
    'platform',
    'platforms',
    'channel',
    'channels',
    'workspace_id',
    'workspaceId',
    'workspaces',
    'workspaceIds',
    'risk_level',
    'riskLevel',
    'risk_levels',
    'riskLevels',
    'risk_below',
    'riskBelow',
    'amount_below',
    'amountBelow',
    'amount_less_than',
    'amountLessThan',
    'category',
    'categories',
    'confidence_above',
    'confidenceAbove',
  ];

  const topLevelScope = topLevelKeys.reduce<JsonObject>((acc, key) => {
    if (key in conditionsJson) acc[key] = conditionsJson[key];
    return acc;
  }, {});

  return { ...topLevelScope, ...explicitScope };
}

function scopeValue(scope: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in scope) return scope[key];
  }
  return undefined;
}

function checkExactList(params: {
  field: PolicyScopeField;
  expected: unknown;
  actual: unknown;
  label: string;
}): PolicyScopeCheckResult {
  const expected = normalizeList(params.expected);
  const actual = normalizeString(params.actual);
  const supported = expected.length > 0 && Boolean(actual);
  const matched = supported && expected.includes(actual);
  return {
    field: params.field,
    matched,
    supported,
    expected: params.expected,
    actual: params.actual,
    reason: supported
      ? matched
        ? `${params.label} scope matched ${actual}.`
        : `${params.label} scope did not match. Actual ${actual || 'missing'} was not in ${expected.join(', ')}.`
      : `${params.label} scope requires at least one expected value and an action value.`,
  };
}

function checkRiskExact(expectedRaw: unknown, actualRisk: ActionRiskLevel | null): PolicyScopeCheckResult {
  const expected = normalizeList(expectedRaw);
  const actual = actualRisk ? normalizeString(actualRisk) : '';
  const supported = expected.length > 0 && Boolean(actual);
  const matched = supported && expected.includes(actual);
  return {
    field: 'risk_level',
    matched,
    supported,
    expected: expectedRaw,
    actual: actualRisk,
    reason: supported
      ? matched
        ? `Risk scope matched ${actual}.`
        : `Risk scope did not match. Actual ${actual || 'missing'} was not in ${expected.join(', ')}.`
      : 'Risk scope requires a valid expected risk level and action risk level.',
  };
}

function checkRiskBelow(expectedRaw: unknown, actualRisk: ActionRiskLevel | null): PolicyScopeCheckResult {
  const expectedRisk = normalizeRisk(expectedRaw);
  const actualRank = actualRisk ? RISK_ORDER[actualRisk] : null;
  const expectedRank = expectedRisk ? RISK_ORDER[expectedRisk] : null;
  const supported = actualRank !== null && expectedRank !== null;
  const matched = supported ? Number(actualRank) < Number(expectedRank) : false;
  return {
    field: 'risk_level',
    matched,
    supported,
    expected: expectedRaw,
    actual: actualRisk,
    reason: supported
      ? matched
        ? `Risk-below scope matched: ${actualRisk} is below ${expectedRisk}.`
        : `Risk-below scope did not match: ${actualRisk} is not below ${expectedRisk}.`
      : 'Risk-below scope requires a valid expected risk level and action risk level.',
  };
}

function checkAmountBelow(expectedRaw: unknown, actualAmount: number | null): PolicyScopeCheckResult {
  const expected = toNumber(expectedRaw);
  const supported = expected !== null && actualAmount !== null;
  const matched = supported ? Math.abs(Number(actualAmount)) < Number(expected) : false;
  return {
    field: 'amount',
    matched,
    supported,
    expected: expectedRaw,
    actual: actualAmount,
    reason: supported
      ? matched
        ? `Amount scope matched: absolute amount ${Math.abs(Number(actualAmount))} is below ${expected}.`
        : `Amount scope did not match: absolute amount ${Math.abs(Number(actualAmount))} is not below ${expected}.`
      : 'Amount scope requires a numeric threshold and a numeric action amount/change amount.',
  };
}

function checkConfidenceAbove(expectedRaw: unknown, actualConfidence: number | null): PolicyScopeCheckResult {
  const expected = toNumber(expectedRaw);
  const supported = expected !== null && actualConfidence !== null;
  const matched = supported ? Number(actualConfidence) > Number(expected) : false;
  return {
    field: 'confidence_score',
    matched,
    supported,
    expected: expectedRaw,
    actual: actualConfidence,
    reason: supported
      ? matched
        ? `Confidence scope matched: ${actualConfidence} is above ${expected}.`
        : `Confidence scope did not match: ${actualConfidence} is not above ${expected}.`
      : 'Confidence scope requires a numeric threshold and a numeric action confidence score.',
  };
}

export function evaluatePolicyScopeMatch(params: {
  action: EvaluateActionPolicyInput;
  conditionsJson: unknown;
}): PolicyScopeMatchingResult {
  const actionScope = buildPolicyActionScope(params.action);
  const scope = extractScopeObject(params.conditionsJson);
  const checked: PolicyScopeCheckResult[] = [];

  const workspaceExpected = scopeValue(scope, ['workspace_id', 'workspaceId', 'workspaceIds', 'workspaces']);
  if (workspaceExpected !== undefined) {
    checked.push(checkExactList({ field: 'workspace', expected: workspaceExpected, actual: actionScope.workspaceId, label: 'Workspace' }));
  }

  const actionTypeExpected = scopeValue(scope, ['action_type', 'actionType', 'action_types', 'actionTypes']);
  if (actionTypeExpected !== undefined) {
    checked.push(checkExactList({ field: 'action_type', expected: actionTypeExpected, actual: actionScope.actionType, label: 'Action type' }));
  }

  const platformExpected = scopeValue(scope, ['platform', 'platforms']);
  if (platformExpected !== undefined) {
    checked.push(checkExactList({ field: 'platform', expected: platformExpected, actual: actionScope.platform, label: 'Platform' }));
  }

  const channelExpected = scopeValue(scope, ['channel', 'channels']);
  if (channelExpected !== undefined) {
    checked.push(checkExactList({ field: 'channel', expected: channelExpected, actual: actionScope.channel, label: 'Channel' }));
  }

  const riskExpected = scopeValue(scope, ['risk_level', 'riskLevel', 'risk_levels', 'riskLevels']);
  if (riskExpected !== undefined) {
    checked.push(checkRiskExact(riskExpected, actionScope.riskLevel));
  }

  const riskBelowExpected = scopeValue(scope, ['risk_below', 'riskBelow']);
  if (riskBelowExpected !== undefined) {
    checked.push(checkRiskBelow(riskBelowExpected, actionScope.riskLevel));
  }

  const amountBelowExpected = scopeValue(scope, ['amount_below', 'amountBelow', 'amount_less_than', 'amountLessThan']);
  if (amountBelowExpected !== undefined) {
    checked.push(checkAmountBelow(amountBelowExpected, actionScope.amount));
  }

  const categoryExpected = scopeValue(scope, ['category', 'categories']);
  if (categoryExpected !== undefined) {
    checked.push(checkExactList({ field: 'category', expected: categoryExpected, actual: actionScope.category, label: 'Category' }));
  }

  const confidenceAboveExpected = scopeValue(scope, ['confidence_above', 'confidenceAbove']);
  if (confidenceAboveExpected !== undefined) {
    checked.push(checkConfidenceAbove(confidenceAboveExpected, actionScope.confidenceScore));
  }

  const emptyScope = checked.length === 0;
  const supported = emptyScope || checked.every((item) => item.supported);
  const matched = supported && (emptyScope || checked.every((item) => item.matched));

  return {
    version: '0.6.0',
    phase: POLICY_SCOPE_MATCHING_PHASE,
    matched,
    supported,
    emptyScope,
    checkedCount: checked.length,
    checked,
    actionScope,
    reason: emptyScope
      ? 'No explicit scope fields were present, so scope matching passes through to condition operators.'
      : matched
        ? 'All explicit action scope fields matched.'
        : supported
          ? 'One or more explicit action scope fields did not match.'
          : 'One or more explicit action scope fields could not be safely evaluated.',
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Phase 6.5 matches action scope only. It does not approve by itself, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
    },
  };
}

export function policyScopeMatchingLibraryStatus() {
  return {
    version: '0.6.0',
    phase: POLICY_SCOPE_MATCHING_PHASE,
    fields: POLICY_SCOPE_FIELDS,
    supportedScopeShape: {
      scope: {
        action_type: 'content_publish',
        platform: 'instagram',
        channel: 'instagram',
        workspace_id: 'workspace uuid',
        risk_below: 'medium',
        amount_below: 50,
        category: 'shipping',
        confidence_above: 0.9,
      },
    },
    alsoSupportsTopLevelScopeKeys: true,
    executorEnabled: false,
    externalWritesEnabled: false,
  };
}
