import type { ActionRiskLevel, ActionType } from '../actions/actions.types.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

export const POLICY_CONDITION_OPERATOR_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export const POLICY_CONDITION_OPERATORS = [
  'equals',
  'contains',
  'less_than',
  'greater_than',
  'channel_is',
  'risk_below',
  'confidence_above',
  'amount_below',
] as const;

export type PolicyConditionOperator = typeof POLICY_CONDITION_OPERATORS[number];

export type PolicyConditionResult = {
  operator: PolicyConditionOperator | 'always' | 'all' | 'any' | 'not' | 'unknown';
  matched: boolean;
  supported: boolean;
  field?: string | null;
  expected?: unknown;
  actual?: unknown;
  reason: string;
};

export type PolicyConditionsEvaluationResult = {
  version: '0.6.0';
  phase: typeof POLICY_CONDITION_OPERATOR_PHASE;
  matched: boolean;
  supported: boolean;
  emptyConditions: boolean;
  matchMode: 'empty' | 'always' | 'all' | 'any' | 'single' | 'unsupported';
  checked: PolicyConditionResult[];
  reason: string;
  safety: {
    externalWritesAttempted: false;
    executorRan: false;
    note: string;
  };
};

type ConditionExpression = Record<string, unknown>;

type NormalizedCondition = {
  operator: PolicyConditionOperator | 'always' | 'unknown';
  field: string | null;
  value: unknown;
  raw: unknown;
};


const POLICY_SCOPE_CONDITION_KEYS = new Set([
  'scope',
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
  'workspaceIds',
  'workspaces',
  'risk_level',
  'riskLevel',
  'risk_levels',
  'riskLevels',
  'amount_less_than',
  'amountLessThan',
  'category',
  'categories',
]);

const RISK_ORDER: Record<ActionRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isEmptyObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

function toComparableString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeString(value: unknown, caseInsensitive = true): string {
  const str = toComparableString(value);
  return caseInsensitive ? str.toLowerCase() : str;
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

function getPath(source: Record<string, unknown>, path: string): unknown {
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

function actionContext(action: EvaluateActionPolicyInput): Record<string, unknown> {
  const payloadJson = isObject(action.payloadJson) ? action.payloadJson : {};
  return {
    workspaceId: action.workspaceId,
    actionId: action.actionId ?? null,
    actionType: action.actionType,
    riskLevel: action.riskLevel ?? null,
    requestedDecision: action.requestedDecision ?? null,
    source: action.source ?? null,
    payloadJson,
    payload: payloadJson,
    ...payloadJson,
  };
}

function firstDefined(context: Record<string, unknown>, paths: string[]): { path: string; value: unknown } | null {
  for (const path of paths) {
    const value = getPath(context, path);
    if (value !== undefined && value !== null && value !== '') return { path, value };
  }
  return null;
}

function conditionFieldValue(action: EvaluateActionPolicyInput, field: string | null): unknown {
  if (!field) return undefined;
  return getPath(actionContext(action), field);
}

function normalizeCondition(operator: PolicyConditionOperator, rawValue: unknown): NormalizedCondition {
  if (isObject(rawValue)) {
    const field = typeof rawValue.field === 'string' ? rawValue.field : null;
    const value = 'value' in rawValue ? rawValue.value : 'expected' in rawValue ? rawValue.expected : rawValue.equals;
    return { operator, field, value, raw: rawValue };
  }

  return { operator, field: null, value: rawValue, raw: rawValue };
}

function evaluateEquals(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition('equals', rawValue);
  const actual = condition.field ? conditionFieldValue(action, condition.field) : undefined;
  const matched = normalizeString(actual) === normalizeString(condition.value);

  return {
    operator: 'equals',
    matched,
    supported: Boolean(condition.field),
    field: condition.field,
    expected: condition.value,
    actual,
    reason: condition.field
      ? matched
        ? `equals matched: ${condition.field} equals ${String(condition.value)}.`
        : `equals did not match: ${condition.field} was ${String(actual)}.`
      : 'equals requires a field and value object, for example { "equals": { "field": "platform", "value": "instagram" } }.',
  };
}

function evaluateContains(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition('contains', rawValue);
  const raw = isObject(condition.raw) ? condition.raw : {};
  const caseInsensitive = raw.caseInsensitive !== false;
  const actual = condition.field ? conditionFieldValue(action, condition.field) : undefined;
  const expected = condition.value;

  let matched = false;
  if (Array.isArray(actual)) {
    matched = actual.some((item) => normalizeString(item, caseInsensitive) === normalizeString(expected, caseInsensitive));
  } else {
    matched = normalizeString(actual, caseInsensitive).includes(normalizeString(expected, caseInsensitive));
  }

  return {
    operator: 'contains',
    matched,
    supported: Boolean(condition.field),
    field: condition.field,
    expected,
    actual,
    reason: condition.field
      ? matched
        ? `contains matched: ${condition.field} contains ${String(expected)}.`
        : `contains did not match: ${condition.field} does not contain ${String(expected)}.`
      : 'contains requires a field and value object, for example { "contains": { "field": "caption", "value": "new drop" } }.',
  };
}

function evaluateNumberCompare(action: EvaluateActionPolicyInput, operator: 'less_than' | 'greater_than', rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition(operator, rawValue);
  const actualRaw = condition.field ? conditionFieldValue(action, condition.field) : undefined;
  const actual = toNumber(actualRaw);
  const expected = toNumber(condition.value);
  const supported = Boolean(condition.field) && actual !== null && expected !== null;
  const matched = supported
    ? operator === 'less_than'
      ? actual < expected
      : actual > expected
    : false;

  return {
    operator,
    matched,
    supported,
    field: condition.field,
    expected: condition.value,
    actual: actualRaw,
    reason: supported
      ? matched
        ? `${operator} matched: ${condition.field} ${operator === 'less_than' ? '<' : '>'} ${expected}.`
        : `${operator} did not match: ${condition.field} was ${String(actualRaw)}.`
      : `${operator} requires a numeric field and numeric value.`,
  };
}

function evaluateChannelIs(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition('channel_is', rawValue);
  const expected = condition.value;
  const context = actionContext(action);
  const explicitField = condition.field ? { path: condition.field, value: conditionFieldValue(action, condition.field) } : null;
  const actual = explicitField || firstDefined(context, [
    'channel',
    'platform',
    'payload.channel',
    'payload.platform',
    'payloadJson.channel',
    'payloadJson.platform',
    'payloadJson.account_channel',
    'payloadJson.destination_channel',
  ]);
  const actualValue = actual?.value;
  const matched = normalizeString(actualValue) === normalizeString(expected);

  return {
    operator: 'channel_is',
    matched,
    supported: expected !== undefined && expected !== null && actual !== null,
    field: actual?.path ?? condition.field,
    expected,
    actual: actualValue,
    reason: actual
      ? matched
        ? `channel_is matched: ${actual.path} is ${String(expected)}.`
        : `channel_is did not match: ${actual.path} was ${String(actualValue)}.`
      : 'channel_is could not find channel/platform in the action payload.',
  };
}

function evaluateRiskBelow(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const expectedRisk = normalizeString(isObject(rawValue) && 'value' in rawValue ? rawValue.value : rawValue) as ActionRiskLevel;
  const actualRisk = action.riskLevel || null;
  const actualRank = actualRisk ? RISK_ORDER[actualRisk] : undefined;
  const expectedRank = RISK_ORDER[expectedRisk];
  const supported = Boolean(actualRank && expectedRank);
  const matched = supported ? Number(actualRank) < Number(expectedRank) : false;

  return {
    operator: 'risk_below',
    matched,
    supported,
    field: 'riskLevel',
    expected: expectedRisk,
    actual: actualRisk,
    reason: supported
      ? matched
        ? `risk_below matched: ${actualRisk} is below ${expectedRisk}.`
        : `risk_below did not match: ${actualRisk} is not below ${expectedRisk}.`
      : 'risk_below requires a valid risk level: low, medium, high, or critical.',
  };
}

function evaluateConfidenceAbove(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition('confidence_above', rawValue);
  const context = actionContext(action);
  const expected = toNumber(condition.value);
  const explicitField = condition.field ? { path: condition.field, value: conditionFieldValue(action, condition.field) } : null;
  const actual = explicitField || firstDefined(context, [
    'confidence',
    'confidence_score',
    'payload.confidence',
    'payload.confidence_score',
    'payloadJson.confidence',
    'payloadJson.confidence_score',
    'payloadJson.classification.confidence',
  ]);
  const actualNumber = toNumber(actual?.value);
  const supported = expected !== null && actualNumber !== null;
  const matched = supported ? Number(actualNumber) > Number(expected) : false;

  return {
    operator: 'confidence_above',
    matched,
    supported,
    field: actual?.path ?? condition.field,
    expected: condition.value,
    actual: actual?.value,
    reason: supported
      ? matched
        ? `confidence_above matched: ${actual?.path} is above ${expected}.`
        : `confidence_above did not match: ${actual?.path} was ${String(actual?.value)}.`
      : 'confidence_above requires a numeric confidence value in the payload and a numeric threshold.',
  };
}

function evaluateAmountBelow(action: EvaluateActionPolicyInput, rawValue: unknown): PolicyConditionResult {
  const condition = normalizeCondition('amount_below', rawValue);
  const context = actionContext(action);
  const expected = toNumber(condition.value);
  const explicitField = condition.field ? { path: condition.field, value: conditionFieldValue(action, condition.field) } : null;
  const actual = explicitField || firstDefined(context, [
    'amount',
    'change_amount',
    'delta',
    'value',
    'payload.amount',
    'payload.change_amount',
    'payload.delta',
    'payload.value',
    'payloadJson.amount',
    'payloadJson.change_amount',
    'payloadJson.delta',
    'payloadJson.value',
    'payloadJson.proposed_budget_delta',
  ]);
  const actualNumber = toNumber(actual?.value);
  const supported = expected !== null && actualNumber !== null;
  const matched = supported ? Math.abs(Number(actualNumber)) < Number(expected) : false;

  return {
    operator: 'amount_below',
    matched,
    supported,
    field: actual?.path ?? condition.field,
    expected: condition.value,
    actual: actual?.value,
    reason: supported
      ? matched
        ? `amount_below matched: absolute amount ${Math.abs(Number(actualNumber))} is below ${expected}.`
        : `amount_below did not match: absolute amount ${Math.abs(Number(actualNumber))} is not below ${expected}.`
      : 'amount_below requires a numeric amount/change_amount/delta in the payload and a numeric threshold.',
  };
}

function evaluateSingleOperator(action: EvaluateActionPolicyInput, operator: string, rawValue: unknown): PolicyConditionResult {
  switch (operator) {
    case 'equals':
      return evaluateEquals(action, rawValue);
    case 'contains':
      return evaluateContains(action, rawValue);
    case 'less_than':
      return evaluateNumberCompare(action, 'less_than', rawValue);
    case 'greater_than':
      return evaluateNumberCompare(action, 'greater_than', rawValue);
    case 'channel_is':
      return evaluateChannelIs(action, rawValue);
    case 'risk_below':
      return evaluateRiskBelow(action, rawValue);
    case 'confidence_above':
      return evaluateConfidenceAbove(action, rawValue);
    case 'amount_below':
      return evaluateAmountBelow(action, rawValue);
    default:
      return {
        operator: 'unknown',
        matched: false,
        supported: false,
        expected: rawValue,
        reason: `Unsupported policy condition operator: ${operator}.`,
      };
  }
}

function evaluateExpression(action: EvaluateActionPolicyInput, expression: unknown): PolicyConditionsEvaluationResult {
  const conditions = isObject(expression) ? expression : {};

  if (isEmptyObject(conditions)) {
    return buildResult({
      matched: true,
      supported: true,
      emptyConditions: true,
      matchMode: 'empty',
      checked: [],
      reason: 'Policy has empty conditions_json, so it matches at workspace/action-type level.',
    });
  }

  if (conditions.always === true) {
    return buildResult({
      matched: true,
      supported: true,
      emptyConditions: false,
      matchMode: 'always',
      checked: [{ operator: 'always', matched: true, supported: true, expected: true, actual: true, reason: 'always=true matched.' }],
      reason: 'Policy conditions_json contains always=true.',
    });
  }

  if (Array.isArray(conditions.all)) {
    const nested = conditions.all.map((item) => evaluateExpression(action, isObject(item) && typeof item.operator === 'string'
      ? { [item.operator]: { ...item, operator: undefined } }
      : item));
    const checked = nested.flatMap((item) => item.checked);
    const supported = nested.every((item) => item.supported);
    const matched = supported && nested.every((item) => item.matched);
    return buildResult({
      matched,
      supported,
      emptyConditions: false,
      matchMode: 'all',
      checked,
      reason: matched ? 'All policy conditions matched.' : supported ? 'At least one policy condition did not match.' : 'At least one policy condition is unsupported.',
    });
  }

  if (Array.isArray(conditions.any)) {
    const nested = conditions.any.map((item) => evaluateExpression(action, isObject(item) && typeof item.operator === 'string'
      ? { [item.operator]: { ...item, operator: undefined } }
      : item));
    const checked = nested.flatMap((item) => item.checked);
    const supported = nested.some((item) => item.supported);
    const matched = nested.some((item) => item.supported && item.matched);
    return buildResult({
      matched,
      supported,
      emptyConditions: false,
      matchMode: 'any',
      checked,
      reason: matched ? 'At least one policy condition matched.' : supported ? 'No policy condition matched.' : 'No supported policy conditions were found.',
    });
  }

  if ('not' in conditions) {
    const nested = evaluateExpression(action, conditions.not);
    const checked = nested.checked.map((item) => ({ ...item, reason: `NOT wrapper: ${item.reason}` }));
    return buildResult({
      matched: nested.supported && !nested.matched,
      supported: nested.supported,
      emptyConditions: false,
      matchMode: 'single',
      checked,
      reason: nested.supported && !nested.matched ? 'NOT condition matched because nested condition did not match.' : 'NOT condition did not match.',
    });
  }

  if (Array.isArray(conditions.conditions)) {
    return evaluateExpression(action, { all: conditions.conditions });
  }

  const operatorEntries = Object.entries(conditions)
    .filter(([operator]) => operator !== 'operator' && !POLICY_SCOPE_CONDITION_KEYS.has(operator));

  if (operatorEntries.length === 0) {
    return buildResult({
      matched: true,
      supported: true,
      emptyConditions: false,
      matchMode: 'empty',
      checked: [],
      reason: 'No condition-operator fields remained after Phase 6.5 scope matching, so condition matching passes.',
    });
  }

  const checked = operatorEntries
    .map(([operator, rawValue]) => evaluateSingleOperator(action, operator, rawValue));

  const supported = checked.length > 0 && checked.every((item) => item.supported);
  const matched = supported && checked.every((item) => item.matched);

  return buildResult({
    matched,
    supported,
    emptyConditions: false,
    matchMode: checked.length === 1 ? 'single' : supported ? 'all' : 'unsupported',
    checked,
    reason: matched
      ? 'Policy condition operators matched.'
      : supported
        ? 'Supported policy condition operators did not match.'
        : 'One or more policy condition operators are unsupported or invalid.',
  });
}

function buildResult(params: Omit<PolicyConditionsEvaluationResult, 'version' | 'phase' | 'safety'>): PolicyConditionsEvaluationResult {
  return {
    version: '0.6.0',
    phase: POLICY_CONDITION_OPERATOR_PHASE,
    ...params,
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      note: 'Phase 6.6 evaluates policy condition operators after action-scope matching. It does not approve, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write externally.',
    },
  };
}

export function evaluatePolicyConditions(params: {
  action: EvaluateActionPolicyInput;
  conditionsJson: unknown;
}): PolicyConditionsEvaluationResult {
  return evaluateExpression(params.action, params.conditionsJson);
}

export function conditionOperatorLibraryStatus() {
  return {
    version: '0.6.0',
    phase: POLICY_CONDITION_OPERATOR_PHASE,
    operators: POLICY_CONDITION_OPERATORS,
    supportedConditionShapes: [
      '{ "always": true }',
      '{ "equals": { "field": "platform", "value": "instagram" } }',
      '{ "contains": { "field": "caption", "value": "sale" } }',
      '{ "less_than": { "field": "amount", "value": 100 } }',
      '{ "greater_than": { "field": "confidence", "value": 0.85 } }',
      '{ "channel_is": "instagram" }',
      '{ "risk_below": "high" }',
      '{ "confidence_above": 0.9 }',
      '{ "amount_below": 50 }',
      '{ "all": [ ...conditions ] }',
      '{ "any": [ ...conditions ] }',
      '{ "not": { ...condition } }',
    ],
    externalWritesEnabled: false,
    executorEnabled: false,
  };
}

export function policyConditionActionContextForTest(action: EvaluateActionPolicyInput): Record<string, unknown> {
  return actionContext(action);
}

export type PolicyConditionActionContext = ReturnType<typeof policyConditionActionContextForTest>;
export type PolicyConditionActionType = ActionType;
