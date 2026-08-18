import { buildAdsBudgetChangeExamplePayload, validateAdsBudgetChangePayload } from './ads-budget-change-payload.model.js';
import type {
  AdsHardCapCheckResult,
  AdsHardCapDecision,
  AdsHardCapKey,
  AdsHardCapsConfigInput,
  AdsHardCapsEvaluationResult,
  AdsHardCapsFieldSpec,
  AdsHardCapsNormalizedConfig,
  AdsHardCapsPlatform,
  AdsHardCapsPreviewInput,
  AdsHardCapsSafety,
  AdsHardCapsStatus,
  AdsHardCapsStorageReport,
  AdsHardCapsUsageInput,
} from './ads-hard-caps.types.js';

export const ADS_HARD_CAPS_PHASE = 'phase_14_5_hard_caps_table' as const;
export const ADS_HARD_CAPS_HEALTH_MODE = 'v2-phase-14-5-hard-caps-table' as const;
export const ADS_HARD_CAPS_PACKAGE = 'lifesaver-v0.7.0-phase-14-5-hard-caps-table.zip' as const;
export const ADS_HARD_CAPS_MIGRATION = '022_create_ads_hard_caps.sql' as const;

export const ADS_HARD_CAP_KEYS: AdsHardCapKey[] = [
  'max_daily_budget_change',
  'max_percentage_change',
  'max_changes_per_day',
  'always_ask_above_threshold',
  'emergency_never_exceed_limit',
];

const ALLOWED_PLATFORMS: AdsHardCapsPlatform[] = ['global', 'meta_marketing_api', 'google_ads_api'];
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isPlatform(value: unknown): value is AdsHardCapsPlatform {
  return typeof value === 'string' && ALLOWED_PLATFORMS.includes(value as AdsHardCapsPlatform);
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function buildAdsHardCapsSafety(): AdsHardCapsSafety {
  return {
    storageOnly: true,
    migrationAdditiveOnly: true,
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
    databaseMigrationAdded: true,
  };
}

export function buildAdsHardCapsFieldSpecs(): AdsHardCapsFieldSpec[] {
  return [
    {
      field: 'platform',
      type: 'global | meta_marketing_api | google_ads_api',
      required: true,
      validation: 'Global caps apply across platforms. Platform caps can narrow the future execution boundary.',
      safetyNote: 'Triple Whale is intentionally not a control platform because it remains read-only context.',
    },
    {
      field: 'account_id',
      type: 'string | null',
      required: true,
      validation: 'Use null for global/workspace caps, or a safe account reference for future account-specific caps.',
      safetyNote: 'Must not contain OAuth tokens, refresh tokens, client secrets, or raw provider payloads.',
    },
    {
      field: 'currency',
      type: 'ISO-style uppercase currency string',
      required: true,
      validation: 'Must be 3 uppercase letters such as USD, CAD, GBP, AUD, EUR, or AED.',
      safetyNote: 'Currency is display/enforcement context only and does not authorize any spend mutation.',
    },
    {
      field: 'max_daily_budget_change',
      type: 'number',
      required: true,
      validation: 'Must be a finite number greater than or equal to 0.',
      safetyNote: 'Projected daily absolute delta must not exceed this limit before future executor execution.',
    },
    {
      field: 'max_percentage_change',
      type: 'number',
      required: true,
      validation: 'Must be between 0 and 100 inclusive.',
      safetyNote: 'Future executor must block proposals whose absolute percentage change is above this value.',
    },
    {
      field: 'max_changes_per_day',
      type: 'integer',
      required: true,
      validation: 'Must be a whole number greater than or equal to 0.',
      safetyNote: 'Future executor must block after the daily change count reaches this value.',
    },
    {
      field: 'always_ask_above_threshold',
      type: 'number',
      required: true,
      validation: 'Must be a finite number greater than or equal to 0 and no higher than max_daily_budget_change.',
      safetyNote: 'First ads executor release remains manual approval only; this threshold supports future policy explanation.',
    },
    {
      field: 'emergency_never_exceed_limit',
      type: 'number',
      required: true,
      validation: 'Must be a finite number greater than or equal to 0.',
      safetyNote: 'Future executor must never set proposed_budget above this value, even if other caps pass.',
    },
    {
      field: 'enabled',
      type: 'boolean',
      required: true,
      validation: 'Must be explicitly true or false.',
      safetyNote: 'Disabled or unavailable caps should fail closed in future executor phases, not allow uncontrolled ad changes.',
    },
  ];
}

export function buildAdsHardCapsSafetyGates(): string[] {
  return [
    'Ads hard caps must be stored before any real ads executor is enabled.',
    'Manual approval remains required for every ads executor in the first ads release.',
    'Master pause must block every future ad action immediately before execution.',
    'Ads category pause must block every future ad action immediately before execution.',
    'Emergency safe mode must block every future ad action immediately before execution.',
    'Max daily budget change must be checked using absolute projected budget delta.',
    'Max percentage change must be checked before budget mutation.',
    'Max number of changes/day must block duplicate or excessive daily changes.',
    'Always-ask threshold must never be treated as auto-approval permission.',
    'Emergency never-exceed limit must override all lower-priority policy decisions.',
    'Before/after snapshots, idempotency, result logs, and rollback planning remain required before live control.',
  ];
}

export function buildAdsHardCapsExample(): AdsHardCapsNormalizedConfig {
  return {
    platform: 'global',
    account_id: null,
    currency: 'USD',
    max_daily_budget_change: 100,
    max_percentage_change: 15,
    max_changes_per_day: 3,
    always_ask_above_threshold: 25,
    emergency_never_exceed_limit: 500,
    enabled: true,
  };
}

export function buildAdsHardCapsExampleUsage(): AdsHardCapsUsageInput {
  return {
    daily_budget_change_used: 20,
    changes_today: 1,
  };
}

function validateCapsConfig(input: unknown): { normalizedCaps: AdsHardCapsNormalizedConfig | null; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return { normalizedCaps: null, issues: ['caps must be an object.'], warnings };
  }

  const platform = input.platform;
  const accountId = input.account_id;
  const currency = input.currency;
  const maxDailyBudgetChange = input.max_daily_budget_change;
  const maxPercentageChange = input.max_percentage_change;
  const maxChangesPerDay = input.max_changes_per_day;
  const alwaysAskAboveThreshold = input.always_ask_above_threshold;
  const emergencyNeverExceedLimit = input.emergency_never_exceed_limit;
  const enabled = input.enabled;

  if (!isPlatform(platform)) issues.push('caps.platform must be global, meta_marketing_api, or google_ads_api.');
  if (!(accountId === null || isNonEmptyString(accountId))) issues.push('caps.account_id must be a non-empty string or null.');
  if (!isNonEmptyString(currency) || !/^[A-Z]{3}$/u.test(normalizeCurrency(currency))) issues.push('caps.currency must be a 3-letter uppercase currency string.');
  if (!isFiniteNumber(maxDailyBudgetChange) || maxDailyBudgetChange < 0) issues.push('caps.max_daily_budget_change must be a finite number greater than or equal to 0.');
  if (!isFiniteNumber(maxPercentageChange) || maxPercentageChange < 0 || maxPercentageChange > 100) issues.push('caps.max_percentage_change must be between 0 and 100.');
  if (!Number.isInteger(maxChangesPerDay) || (maxChangesPerDay as number) < 0) issues.push('caps.max_changes_per_day must be a whole number greater than or equal to 0.');
  if (!isFiniteNumber(alwaysAskAboveThreshold) || alwaysAskAboveThreshold < 0) issues.push('caps.always_ask_above_threshold must be a finite number greater than or equal to 0.');
  if (!isFiniteNumber(emergencyNeverExceedLimit) || emergencyNeverExceedLimit < 0) issues.push('caps.emergency_never_exceed_limit must be a finite number greater than or equal to 0.');
  if (!isBoolean(enabled)) issues.push('caps.enabled must be true or false.');

  if (isFiniteNumber(alwaysAskAboveThreshold) && isFiniteNumber(maxDailyBudgetChange) && alwaysAskAboveThreshold > maxDailyBudgetChange) {
    issues.push('caps.always_ask_above_threshold must not be higher than caps.max_daily_budget_change.');
  }
  if (isFiniteNumber(emergencyNeverExceedLimit) && isFiniteNumber(maxDailyBudgetChange) && emergencyNeverExceedLimit < maxDailyBudgetChange) {
    warnings.push('emergency_never_exceed_limit is below max_daily_budget_change; emergency limit will be the tighter control.');
  }
  if (enabled === false) warnings.push('caps are disabled; future executor phases should fail closed rather than allow uncontrolled budget mutation.');

  if (issues.length > 0) return { normalizedCaps: null, issues, warnings };

  return {
    normalizedCaps: {
      platform: platform as AdsHardCapsPlatform,
      account_id: accountId === null ? null : (accountId as string).trim(),
      currency: normalizeCurrency(currency as string),
      max_daily_budget_change: roundCurrency(maxDailyBudgetChange as number),
      max_percentage_change: roundPercent(maxPercentageChange as number),
      max_changes_per_day: maxChangesPerDay as number,
      always_ask_above_threshold: roundCurrency(alwaysAskAboveThreshold as number),
      emergency_never_exceed_limit: roundCurrency(emergencyNeverExceedLimit as number),
      enabled: enabled as boolean,
    },
    issues,
    warnings,
  };
}

function validateUsage(input: unknown): { usage: AdsHardCapsUsageInput | null; issues: string[] } {
  const issues: string[] = [];
  if (!isPlainObject(input)) return { usage: null, issues: ['usage must be an object.'] };

  const dailyBudgetChangeUsed = input.daily_budget_change_used;
  const changesToday = input.changes_today;
  if (!isFiniteNumber(dailyBudgetChangeUsed) || dailyBudgetChangeUsed < 0) issues.push('usage.daily_budget_change_used must be a finite number greater than or equal to 0.');
  if (!Number.isInteger(changesToday) || (changesToday as number) < 0) issues.push('usage.changes_today must be a whole number greater than or equal to 0.');

  return {
    usage: issues.length === 0
      ? {
          daily_budget_change_used: roundCurrency(dailyBudgetChangeUsed as number),
          changes_today: changesToday as number,
        }
      : null,
    issues,
  };
}

function check(capKey: AdsHardCapKey, limit: number, current: number, increment: number, alwaysAskTriggered: boolean, reason: string): AdsHardCapCheckResult {
  const projected = capKey === 'max_percentage_change' || capKey === 'emergency_never_exceed_limit'
    ? increment
    : current + increment;
  return {
    capKey,
    limit,
    current,
    increment,
    projected: roundCurrency(projected),
    exceeded: projected > limit,
    alwaysAskTriggered,
    reason,
  };
}

export function evaluateAdsHardCaps(input: unknown): AdsHardCapsEvaluationResult {
  const safety = buildAdsHardCapsSafety();
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return {
      decision: 'invalid_caps_preview',
      allowed: false,
      manualApprovalRequired: true,
      issues: ['Preview input must be an object with caps, usage, and budgetPayload.'],
      warnings,
      checks: [],
      normalizedCaps: null,
      normalizedBudgetPayload: null,
      computed: {
        absoluteBudgetDelta: null,
        absolutePercentageChange: null,
        projectedDailyBudgetChange: null,
        projectedChangesToday: null,
        emergencyLimitExceeded: true,
        alwaysAskTriggered: false,
      },
      safety,
    };
  }

  const capsValidation = validateCapsConfig(input.caps);
  const usageValidation = validateUsage(input.usage);
  const budgetValidation = validateAdsBudgetChangePayload(input.budgetPayload);
  issues.push(...capsValidation.issues, ...usageValidation.issues);
  warnings.push(...capsValidation.warnings, ...budgetValidation.warnings);

  if (!budgetValidation.valid) {
    issues.push(...budgetValidation.issues.map((issue) => `budgetPayload.${issue}`));
  }

  const normalizedCaps = capsValidation.normalizedCaps;
  const usage = usageValidation.usage;
  const normalizedBudgetPayload = budgetValidation.normalizedPayload;

  if (!normalizedCaps || !usage || !normalizedBudgetPayload) {
    return {
      decision: budgetValidation.valid ? 'invalid_caps_preview' : 'invalid_budget_payload_preview',
      allowed: false,
      manualApprovalRequired: true,
      issues,
      warnings,
      checks: [],
      normalizedCaps,
      normalizedBudgetPayload,
      computed: {
        absoluteBudgetDelta: normalizedBudgetPayload ? Math.abs(normalizedBudgetPayload.delta) : null,
        absolutePercentageChange: normalizedBudgetPayload ? Math.abs(normalizedBudgetPayload.percentage_change) : null,
        projectedDailyBudgetChange: null,
        projectedChangesToday: null,
        emergencyLimitExceeded: true,
        alwaysAskTriggered: false,
      },
      safety,
    };
  }

  const absoluteBudgetDelta = roundCurrency(Math.abs(normalizedBudgetPayload.delta));
  const absolutePercentageChange = roundPercent(Math.abs(normalizedBudgetPayload.percentage_change));
  const projectedDailyBudgetChange = roundCurrency(usage.daily_budget_change_used + absoluteBudgetDelta);
  const projectedChangesToday = usage.changes_today + 1;
  const alwaysAskTriggered = absoluteBudgetDelta >= normalizedCaps.always_ask_above_threshold;

  const checks: AdsHardCapCheckResult[] = [
    check(
      'max_daily_budget_change',
      normalizedCaps.max_daily_budget_change,
      usage.daily_budget_change_used,
      absoluteBudgetDelta,
      false,
      'Projected daily absolute budget-change amount must remain inside the configured hard cap.',
    ),
    check(
      'max_percentage_change',
      normalizedCaps.max_percentage_change,
      0,
      absolutePercentageChange,
      false,
      'Single budget-change percentage must remain inside the configured hard cap.',
    ),
    check(
      'max_changes_per_day',
      normalizedCaps.max_changes_per_day,
      usage.changes_today,
      1,
      false,
      'Daily number of budget-control changes must remain inside the configured hard cap.',
    ),
    check(
      'always_ask_above_threshold',
      normalizedCaps.always_ask_above_threshold,
      0,
      absoluteBudgetDelta,
      alwaysAskTriggered,
      'Crossing this value requires ask/manual review and must never become auto-approval permission.',
    ),
    check(
      'emergency_never_exceed_limit',
      normalizedCaps.emergency_never_exceed_limit,
      0,
      normalizedBudgetPayload.proposed_budget,
      false,
      'Proposed budget must never exceed the emergency never-exceed limit.',
    ),
  ];

  if (!normalizedCaps.enabled) issues.push('Ads hard caps are disabled; future executor phases must fail closed.');

  const capExceeded = checks.some((item) => item.capKey !== 'always_ask_above_threshold' && item.exceeded);
  const emergencyLimitExceeded = checks.some((item) => item.capKey === 'emergency_never_exceed_limit' && item.exceeded);
  let decision: AdsHardCapDecision = 'allowed_manual_review';
  if (capExceeded || issues.length > 0) decision = 'blocked_by_hard_cap';
  else if (alwaysAskTriggered) decision = 'always_ask_required';

  return {
    decision,
    allowed: decision === 'allowed_manual_review' || decision === 'always_ask_required',
    manualApprovalRequired: true,
    issues,
    warnings,
    checks,
    normalizedCaps,
    normalizedBudgetPayload,
    computed: {
      absoluteBudgetDelta,
      absolutePercentageChange,
      projectedDailyBudgetChange,
      projectedChangesToday,
      emergencyLimitExceeded,
      alwaysAskTriggered,
    },
    safety,
  };
}

export function buildAdsHardCapsStorageReport(): AdsHardCapsStorageReport {
  const exampleCaps = buildAdsHardCapsExample();
  const exampleBudgetPayload = buildAdsBudgetChangeExamplePayload();
  const exampleEvaluation = evaluateAdsHardCaps({
    caps: exampleCaps,
    usage: buildAdsHardCapsExampleUsage(),
    budgetPayload: exampleBudgetPayload,
  });

  return {
    version: '0.7.0',
    phase: ADS_HARD_CAPS_PHASE,
    healthMode: ADS_HARD_CAPS_HEALTH_MODE,
    deliverable: 'ads_hard_caps_storage',
    storageOnly: true,
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.5 adds additive database storage and preview evaluation for ads hard caps: max daily budget change, max percentage change, max number of changes/day, always-ask threshold, and emergency never-exceed limit. It does not add ads executors, ad API clients, OAuth, token storage, auto-run, or external ad writes.',
    migration: ADS_HARD_CAPS_MIGRATION,
    tableName: 'ads_hard_caps',
    capKeys: ADS_HARD_CAP_KEYS,
    fields: buildAdsHardCapsFieldSpecs(),
    safetyGates: buildAdsHardCapsSafetyGates(),
    exampleCaps,
    exampleBudgetPayload,
    exampleEvaluation,
    safety: buildAdsHardCapsSafety(),
    nextStep: 'Phase 14.6 — Manual Approval Only',
  };
}

export function buildAdsHardCapsStatus(): AdsHardCapsStatus {
  return {
    phase: 'V2 Phase 14.5 — Hard Caps Table',
    healthMode: ADS_HARD_CAPS_HEALTH_MODE,
    deliverable: 'ads_hard_caps_storage',
    storageOnly: true,
    migration: ADS_HARD_CAPS_MIGRATION,
    tableName: 'ads_hard_caps',
    capKeys: ADS_HARD_CAP_KEYS,
    budgetChanged: false,
    adsExecutorAdded: false,
    externalAdApiCalled: false,
    adsAutoRunEnabled: false,
    databaseMigrationAdded: true,
    nextStep: 'Phase 14.6 — Manual Approval Only',
  };
}

export function assertAdsHardCapsSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads hard caps output contains forbidden fragment: ${fragment}`);
    }
  }
}
