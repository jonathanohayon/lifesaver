import type {
  AdsBudgetChangePayloadFieldSpec,
  AdsBudgetChangePayloadInput,
  AdsBudgetChangePayloadNormalized,
  AdsBudgetChangePayloadSafety,
  AdsBudgetChangePayloadSchemaReport,
  AdsBudgetChangePayloadStatus,
  AdsBudgetChangePayloadValidationResult,
  AdsBudgetPayloadPlatform,
  AdsBudgetPayloadRiskLevel,
} from './ads-budget-change-payload.types.js';

export const ADS_BUDGET_CHANGE_PAYLOAD_PHASE = 'phase_14_4_budget_change_payload' as const;
export const ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE = 'v2-phase-14-4-budget-change-payload' as const;
export const ADS_BUDGET_CHANGE_PAYLOAD_PACKAGE = 'lifesaver-v0.7.0-phase-14-4-budget-change-payload.zip' as const;

export const ADS_BUDGET_CHANGE_REQUIRED_FIELDS: Array<keyof AdsBudgetChangePayloadInput> = [
  'platform',
  'account_id',
  'campaign_id',
  'adset_id',
  'current_budget',
  'proposed_budget',
  'delta',
  'percentage_change',
  'reason',
  'risk_level',
];

const ALLOWED_PLATFORMS: AdsBudgetPayloadPlatform[] = ['meta_marketing_api', 'google_ads_api'];
const ALLOWED_RISK_LEVELS: AdsBudgetPayloadRiskLevel[] = ['medium', 'high', 'critical'];
const CURRENCY_TOLERANCE = 0.01;
const PERCENT_TOLERANCE = 0.05;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'client_secret=',
  'client_secret:',
  'refresh_token=',
  'refresh_token:',
  'authorization: bearer',
  'bearer ',
  'raw_token',
  'private_key',
  'ya29.',
  'eaab',
];

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlatform(value: unknown): value is AdsBudgetPayloadPlatform {
  return typeof value === 'string' && ALLOWED_PLATFORMS.includes(value as AdsBudgetPayloadPlatform);
}

function isRiskLevel(value: unknown): value is AdsBudgetPayloadRiskLevel {
  return typeof value === 'string' && ALLOWED_RISK_LEVELS.includes(value as AdsBudgetPayloadRiskLevel);
}

export function buildAdsBudgetChangeSafety(): AdsBudgetChangePayloadSafety {
  return {
    schemaOnly: true,
    noAdsExecutorAdded: true,
    noMetaAdsApiClientAdded: true,
    noGoogleAdsApiClientAdded: true,
    noAdOAuthRouteAdded: true,
    noAdTokenStorageAdded: true,
    noWriteScopeRequested: true,
    noCampaignPaused: true,
    noAdsetPaused: true,
    noBudgetChanged: true,
    noBudgetRestored: true,
    noCampaignReenabled: true,
    noAdsAutoRunEnabled: true,
    noExternalAdApiCalled: true,
    noRawTokensReturned: true,
    noRawProviderPayloadReturned: true,
    noDatabaseMigrationRequired: true,
  };
}

export function buildAdsBudgetChangeFieldSpecs(): AdsBudgetChangePayloadFieldSpec[] {
  return [
    {
      field: 'platform',
      type: 'meta_marketing_api | google_ads_api',
      required: true,
      validation: 'Must identify the future direct ad platform control layer, not Triple Whale.',
      safetyNote: 'Triple Whale remains read-only performance context and cannot mutate ads.',
    },
    {
      field: 'account_id',
      type: 'string',
      required: true,
      validation: 'Must be the target ad account identifier or safe provider account reference.',
      safetyNote: 'Never include OAuth tokens, refresh tokens, client secrets, or raw provider credentials.',
    },
    {
      field: 'campaign_id',
      type: 'string',
      required: true,
      validation: 'Must be the campaign being evaluated for a future budget change.',
      safetyNote: 'No campaign lookup or provider mutation occurs in this phase.',
    },
    {
      field: 'adset_id',
      type: 'string | null',
      required: true,
      validation: 'Use a string for ad set/ad group level changes, or null for campaign-level budget changes.',
      safetyNote: 'A null value must not be interpreted as permission to change multiple ad sets.',
    },
    {
      field: 'current_budget',
      type: 'number',
      required: true,
      validation: 'Must be a finite number greater than or equal to zero.',
      safetyNote: 'Before a real executor exists, this is planned payload data only.',
    },
    {
      field: 'proposed_budget',
      type: 'number',
      required: true,
      validation: 'Must be a finite number greater than or equal to zero.',
      safetyNote: 'Hard caps are required in Phase 14.5 before any executor can use this value.',
    },
    {
      field: 'delta',
      type: 'number',
      required: true,
      validation: 'Must equal proposed_budget - current_budget within currency tolerance.',
      safetyNote: 'Delta must be checked again immediately before any future execution.',
    },
    {
      field: 'percentage_change',
      type: 'number',
      required: true,
      validation: 'Must equal ((proposed_budget - current_budget) / current_budget) * 100 when current_budget is greater than zero.',
      safetyNote: 'Percentage changes are used for future hard-cap enforcement and risk display.',
    },
    {
      field: 'reason',
      type: 'string',
      required: true,
      validation: 'Must explain why the budget change is being proposed.',
      safetyNote: 'The reason should be safe to show in approval UI without exposing raw provider payloads.',
    },
    {
      field: 'risk_level',
      type: 'medium | high | critical',
      required: true,
      validation: 'Budget increases should be critical by default; budget decreases should be at least high.',
      safetyNote: 'Risk level does not approve execution; founder approval and hard caps remain required.',
    },
  ];
}

export function buildAdsBudgetChangeSafetyGates(): string[] {
  return [
    'Manual approval is required before any future ads budget executor can run.',
    'Master pause must be checked immediately before any future budget mutation.',
    'Ads category pause must be checked immediately before any future budget mutation.',
    'Emergency safe mode must block every future ads budget mutation.',
    'Hard caps table and cap evaluation must exist before execution phases.',
    'Before/after snapshot must be stored before a future real budget change is attempted.',
    'Idempotency must prevent duplicate budget changes from double-clicks, retries, or worker replay.',
    'Result logs must record success/failure before LIFE.SAVER claims anything changed.',
    'Rollback/restore planning must exist before live control is attempted.',
    'No auto-run budget changes are allowed in this phase.',
  ];
}

export function computeAdsBudgetDelta(currentBudget: number, proposedBudget: number): number {
  return roundCurrency(proposedBudget - currentBudget);
}

export function computeAdsBudgetPercentageChange(currentBudget: number, proposedBudget: number): number | null {
  if (!Number.isFinite(currentBudget) || currentBudget <= 0) return null;
  return roundPercent(((proposedBudget - currentBudget) / currentBudget) * 100);
}

export function recommendAdsBudgetRiskLevel(currentBudget: number, proposedBudget: number): AdsBudgetPayloadRiskLevel {
  if (!Number.isFinite(currentBudget) || !Number.isFinite(proposedBudget)) return 'critical';
  const delta = proposedBudget - currentBudget;
  const percentageChange = computeAdsBudgetPercentageChange(currentBudget, proposedBudget);

  if (delta > 0) return 'critical';
  if (percentageChange === null) return 'critical';
  if (Math.abs(percentageChange) >= 20) return 'critical';
  return 'high';
}

export function buildAdsBudgetChangeExamplePayload(): AdsBudgetChangePayloadNormalized {
  const current_budget = 100;
  const proposed_budget = 110;
  return {
    action_type: 'adjust_budget',
    platform: 'meta_marketing_api',
    account_id: 'act_sandbox_example_account',
    campaign_id: 'campaign_sandbox_example_001',
    adset_id: 'adset_sandbox_example_001',
    current_budget,
    proposed_budget,
    delta: computeAdsBudgetDelta(current_budget, proposed_budget),
    percentage_change: computeAdsBudgetPercentageChange(current_budget, proposed_budget) ?? 0,
    reason: 'ROAS improved in the latest read-only performance context, so LIFE.SAVER is proposing a small manual-reviewed budget test.',
    risk_level: 'critical',
    manual_approval_required: true,
    hard_caps_required_before_execution: true,
    before_after_snapshot_required_before_execution: true,
    result_log_required_after_execution: true,
    external_ad_api_called: false,
  };
}

export function validateAdsBudgetChangePayload(input: unknown): AdsBudgetChangePayloadValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return {
      decision: 'invalid_schema_preview',
      valid: false,
      issues: ['Payload must be an object.'],
      warnings,
      computed: {
        expected_delta: null,
        expected_percentage_change: null,
        recommended_risk_level: 'critical',
      },
      normalizedPayload: null,
      safety: buildAdsBudgetChangeSafety(),
    };
  }

  for (const field of ADS_BUDGET_CHANGE_REQUIRED_FIELDS) {
    if (!(field in input)) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  const platform = input.platform;
  const accountId = input.account_id;
  const campaignId = input.campaign_id;
  const adsetId = input.adset_id;
  const currentBudget = input.current_budget;
  const proposedBudget = input.proposed_budget;
  const delta = input.delta;
  const percentageChange = input.percentage_change;
  const reason = input.reason;
  const riskLevel = input.risk_level;

  if (!isPlatform(platform)) {
    issues.push('platform must be meta_marketing_api or google_ads_api.');
  }
  if (!isNonEmptyString(accountId)) {
    issues.push('account_id must be a non-empty string.');
  }
  if (!isNonEmptyString(campaignId)) {
    issues.push('campaign_id must be a non-empty string.');
  }
  if (!(adsetId === null || isNonEmptyString(adsetId))) {
    issues.push('adset_id must be a non-empty string or null for campaign-level budget changes.');
  }
  if (!isFiniteNumber(currentBudget) || currentBudget < 0) {
    issues.push('current_budget must be a finite number greater than or equal to 0.');
  }
  if (!isFiniteNumber(proposedBudget) || proposedBudget < 0) {
    issues.push('proposed_budget must be a finite number greater than or equal to 0.');
  }
  if (!isFiniteNumber(delta)) {
    issues.push('delta must be a finite number.');
  }
  if (!isFiniteNumber(percentageChange)) {
    issues.push('percentage_change must be a finite number.');
  }
  if (!isNonEmptyString(reason) || reason.trim().length < 10) {
    issues.push('reason must be a useful non-empty explanation of at least 10 characters.');
  }
  if (!isRiskLevel(riskLevel)) {
    issues.push('risk_level must be medium, high, or critical.');
  }

  const expectedDelta = isFiniteNumber(currentBudget) && isFiniteNumber(proposedBudget)
    ? computeAdsBudgetDelta(currentBudget, proposedBudget)
    : null;
  const expectedPercentageChange = isFiniteNumber(currentBudget) && isFiniteNumber(proposedBudget)
    ? computeAdsBudgetPercentageChange(currentBudget, proposedBudget)
    : null;
  const recommendedRiskLevel = isFiniteNumber(currentBudget) && isFiniteNumber(proposedBudget)
    ? recommendAdsBudgetRiskLevel(currentBudget, proposedBudget)
    : 'critical';

  if (expectedDelta !== null && isFiniteNumber(delta) && Math.abs(roundCurrency(delta) - expectedDelta) > CURRENCY_TOLERANCE) {
    issues.push(`delta must match proposed_budget - current_budget. Expected ${expectedDelta}.`);
  }

  if (expectedPercentageChange === null) {
    issues.push('percentage_change cannot be verified when current_budget is 0; current_budget must be greater than 0 for a budget-change proposal.');
  } else if (isFiniteNumber(percentageChange) && Math.abs(roundPercent(percentageChange) - expectedPercentageChange) > PERCENT_TOLERANCE) {
    issues.push(`percentage_change must match the computed budget change. Expected ${expectedPercentageChange}.`);
  }

  if (expectedDelta === 0) {
    warnings.push('Proposed budget equals current budget; this is a no-op proposal and should normally not create an action.');
  }

  if (isRiskLevel(riskLevel)) {
    const order: Record<AdsBudgetPayloadRiskLevel, number> = { medium: 1, high: 2, critical: 3 };
    if (order[riskLevel] < order[recommendedRiskLevel]) {
      issues.push(`risk_level is too low for this budget change. Recommended ${recommendedRiskLevel}.`);
    }
  }

  const valid = issues.length === 0;
  const normalizedPayload: AdsBudgetChangePayloadNormalized | null = valid
    ? {
        action_type: 'adjust_budget',
        platform: platform as AdsBudgetPayloadPlatform,
        account_id: (accountId as string).trim(),
        campaign_id: (campaignId as string).trim(),
        adset_id: adsetId === null ? null : (adsetId as string).trim(),
        current_budget: roundCurrency(currentBudget as number),
        proposed_budget: roundCurrency(proposedBudget as number),
        delta: expectedDelta as number,
        percentage_change: expectedPercentageChange as number,
        reason: (reason as string).trim(),
        risk_level: riskLevel as AdsBudgetPayloadRiskLevel,
        manual_approval_required: true,
        hard_caps_required_before_execution: true,
        before_after_snapshot_required_before_execution: true,
        result_log_required_after_execution: true,
        external_ad_api_called: false,
      }
    : null;

  return {
    decision: valid ? 'valid_schema_preview' : 'invalid_schema_preview',
    valid,
    issues,
    warnings,
    computed: {
      expected_delta: expectedDelta,
      expected_percentage_change: expectedPercentageChange,
      recommended_risk_level: recommendedRiskLevel,
    },
    normalizedPayload,
    safety: buildAdsBudgetChangeSafety(),
  };
}

export function buildAdsBudgetChangePayloadSchemaReport(): AdsBudgetChangePayloadSchemaReport {
  return {
    version: '0.7.0',
    phase: ADS_BUDGET_CHANGE_PAYLOAD_PHASE,
    healthMode: ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE,
    deliverable: 'ads_payload_schema',
    schemaOnly: true,
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.4 defines the safe ads budget-change payload schema for future manual-approved budget executors. It validates platform, account, campaign/ad set targeting, current/proposed budget, delta, percentage change, reason, and risk level without adding any ad API client, OAuth, token storage, executor, auto-run, or real budget mutation.',
    actionType: 'adjust_budget',
    requiredFields: ADS_BUDGET_CHANGE_REQUIRED_FIELDS,
    fields: buildAdsBudgetChangeFieldSpecs(),
    formulaChecks: {
      delta: 'proposed_budget - current_budget',
      percentage_change: '((proposed_budget - current_budget) / current_budget) * 100',
    },
    manualApprovalAndSafetyGates: buildAdsBudgetChangeSafetyGates(),
    examplePayload: buildAdsBudgetChangeExamplePayload(),
    safety: buildAdsBudgetChangeSafety(),
    nextStep: 'Phase 14.5 — Hard Caps Table',
  };
}

export function buildAdsBudgetChangePayloadStatus(): AdsBudgetChangePayloadStatus {
  return {
    phase: 'V2 Phase 14.4 — Budget Change Payload',
    healthMode: ADS_BUDGET_CHANGE_PAYLOAD_HEALTH_MODE,
    deliverable: 'ads_payload_schema',
    schemaOnly: true,
    requiredFields: ADS_BUDGET_CHANGE_REQUIRED_FIELDS,
    budgetChanged: false,
    adsExecutorAdded: false,
    externalAdApiCalled: false,
    hardCapsTableAdded: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.5 — Hard Caps Table',
  };
}

export function assertAdsBudgetChangePayloadSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads budget-change payload output contains forbidden fragment: ${fragment}`);
    }
  }
}
