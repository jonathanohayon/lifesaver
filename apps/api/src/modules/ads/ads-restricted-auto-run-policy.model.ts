import { buildAdsBudgetChangeExamplePayload, validateAdsBudgetChangePayload } from './ads-budget-change-payload.model.js';
import { buildAdsHardCapsExample, buildAdsHardCapsExampleUsage, evaluateAdsHardCaps } from './ads-hard-caps.model.js';
import type {
  AdsRestrictedAutoRunContextInput,
  AdsRestrictedAutoRunDecision,
  AdsRestrictedAutoRunEvaluationResult,
  AdsRestrictedAutoRunPlatform,
  AdsRestrictedAutoRunPolicyConfig,
  AdsRestrictedAutoRunPolicyReport,
  AdsRestrictedAutoRunPolicyStatus,
  AdsRestrictedAutoRunRiskLevel,
  AdsRestrictedAutoRunSafety,
} from './ads-restricted-auto-run-policy.types.js';

export const ADS_RESTRICTED_AUTO_RUN_PHASE = 'phase_14_9_auto_run_below_threshold_later' as const;
export const ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE = 'v2-phase-14-9-restricted-ads-auto-run-policy' as const;
export const ADS_RESTRICTED_AUTO_RUN_PACKAGE = 'lifesaver-v0.7.0-phase-14-9-restricted-ads-auto-run-policy.zip' as const;

const ALLOWED_PLATFORMS: AdsRestrictedAutoRunPlatform[] = ['meta_marketing_api', 'google_ads_api'];
const ALLOWED_RISK_LEVELS: AdsRestrictedAutoRunRiskLevel[] = ['medium', 'high', 'critical'];
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizePolicy(input: unknown): { policy: AdsRestrictedAutoRunPolicyConfig | null; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) return { policy: null, issues: ['policy must be an object.'], warnings };

  const allowedPlatforms = Array.isArray(input.allowed_platforms) ? input.allowed_platforms : [];
  const allowedRiskLevels = Array.isArray(input.allowed_risk_levels) ? input.allowed_risk_levels : [];

  if (!isBoolean(input.enabled)) issues.push('policy.enabled must be true or false.');
  if (!isBoolean(input.explicit_policy_allows_auto_run)) issues.push('policy.explicit_policy_allows_auto_run must be true or false.');
  if (!isNonEmptyString(input.policy_id)) issues.push('policy.policy_id must be a non-empty string.');
  if (!isNonEmptyString(input.policy_name)) issues.push('policy.policy_name must be a non-empty string.');
  if (allowedPlatforms.length === 0 || !allowedPlatforms.every((item) => typeof item === 'string' && ALLOWED_PLATFORMS.includes(item as AdsRestrictedAutoRunPlatform))) {
    issues.push('policy.allowed_platforms must include only meta_marketing_api and/or google_ads_api.');
  }
  if (!(input.allowed_direction === 'decrease_only' || input.allowed_direction === 'tiny_increase_and_decrease')) {
    issues.push('policy.allowed_direction must be decrease_only or tiny_increase_and_decrease.');
  }
  if (allowedRiskLevels.length === 0 || !allowedRiskLevels.every((item) => typeof item === 'string' && ALLOWED_RISK_LEVELS.includes(item as AdsRestrictedAutoRunRiskLevel))) {
    issues.push('policy.allowed_risk_levels must include one or more of medium, high, critical.');
  }
  if (!isFiniteNumber(input.max_single_budget_change) || input.max_single_budget_change < 0) issues.push('policy.max_single_budget_change must be a finite number greater than or equal to 0.');
  if (!isFiniteNumber(input.max_percentage_change) || input.max_percentage_change < 0 || input.max_percentage_change > 100) issues.push('policy.max_percentage_change must be between 0 and 100.');
  if (!isFiniteNumber(input.max_daily_budget_change) || input.max_daily_budget_change < 0) issues.push('policy.max_daily_budget_change must be a finite number greater than or equal to 0.');
  if (!Number.isInteger(input.max_changes_per_day) || (input.max_changes_per_day as number) < 0) issues.push('policy.max_changes_per_day must be a whole number greater than or equal to 0.');
  if (!isFiniteNumber(input.always_ask_above_delta) || input.always_ask_above_delta < 0) issues.push('policy.always_ask_above_delta must be a finite number greater than or equal to 0.');
  if (!isFiniteNumber(input.minimum_confidence_score) || input.minimum_confidence_score < 0 || input.minimum_confidence_score > 1) issues.push('policy.minimum_confidence_score must be between 0 and 1.');
  if (!isBoolean(input.require_recent_before_snapshot)) issues.push('policy.require_recent_before_snapshot must be true or false.');
  if (!isBoolean(input.require_result_logging)) issues.push('policy.require_result_logging must be true or false.');
  if (!isBoolean(input.require_rollback_plan)) issues.push('policy.require_rollback_plan must be true or false.');
  if (input.enabled_for_live_execution_now !== false) issues.push('policy.enabled_for_live_execution_now must be false in Phase 14.9.');

  if (isFiniteNumber(input.max_single_budget_change) && isFiniteNumber(input.always_ask_above_delta) && input.max_single_budget_change >= input.always_ask_above_delta) {
    warnings.push('policy.max_single_budget_change should stay below policy.always_ask_above_delta for a restricted auto-run lane.');
  }

  if (issues.length > 0) return { policy: null, issues, warnings };

  return {
    policy: {
      enabled: input.enabled as boolean,
      explicit_policy_allows_auto_run: input.explicit_policy_allows_auto_run as boolean,
      policy_id: (input.policy_id as string).trim(),
      policy_name: (input.policy_name as string).trim(),
      allowed_platforms: allowedPlatforms as AdsRestrictedAutoRunPlatform[],
      allowed_direction: input.allowed_direction as AdsRestrictedAutoRunPolicyConfig['allowed_direction'],
      allowed_risk_levels: allowedRiskLevels as AdsRestrictedAutoRunRiskLevel[],
      max_single_budget_change: round(input.max_single_budget_change as number),
      max_percentage_change: round(input.max_percentage_change as number),
      max_daily_budget_change: round(input.max_daily_budget_change as number),
      max_changes_per_day: input.max_changes_per_day as number,
      always_ask_above_delta: round(input.always_ask_above_delta as number),
      minimum_confidence_score: round(input.minimum_confidence_score as number),
      require_recent_before_snapshot: input.require_recent_before_snapshot as boolean,
      require_result_logging: input.require_result_logging as boolean,
      require_rollback_plan: input.require_rollback_plan as boolean,
      enabled_for_live_execution_now: false,
    },
    issues,
    warnings,
  };
}

function normalizeContext(input: unknown): { context: AdsRestrictedAutoRunContextInput | null; issues: string[] } {
  const issues: string[] = [];
  if (!isPlainObject(input)) return { context: null, issues: ['context must be an object.'] };
  if (!isBoolean(input.master_pause_active)) issues.push('context.master_pause_active must be true or false.');
  if (!isBoolean(input.ads_pause_active)) issues.push('context.ads_pause_active must be true or false.');
  if (!isBoolean(input.emergency_safe_mode)) issues.push('context.emergency_safe_mode must be true or false.');
  if (!isFiniteNumber(input.confidence_score) || input.confidence_score < 0 || input.confidence_score > 1) issues.push('context.confidence_score must be between 0 and 1.');
  if (!isBoolean(input.before_snapshot_recent)) issues.push('context.before_snapshot_recent must be true or false.');
  if (!isBoolean(input.result_logging_ready)) issues.push('context.result_logging_ready must be true or false.');
  if (!isBoolean(input.rollback_plan_ready)) issues.push('context.rollback_plan_ready must be true or false.');

  return {
    context: issues.length === 0
      ? {
          master_pause_active: input.master_pause_active as boolean,
          ads_pause_active: input.ads_pause_active as boolean,
          emergency_safe_mode: input.emergency_safe_mode as boolean,
          confidence_score: round(input.confidence_score as number),
          before_snapshot_recent: input.before_snapshot_recent as boolean,
          result_logging_ready: input.result_logging_ready as boolean,
          rollback_plan_ready: input.rollback_plan_ready as boolean,
        }
      : null,
    issues,
  };
}

export function buildAdsRestrictedAutoRunSafety(): AdsRestrictedAutoRunSafety {
  return {
    policyOnly: true,
    previewOnly: true,
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
    manualApprovalStillRequiredThisPhase: true,
    noRawTokensReturned: true,
    noRawProviderPayloadReturned: true,
    noDatabaseMigrationRequired: true,
  };
}

export function buildAdsRestrictedAutoRunRequirements(): string[] {
  return [
    'A clear founder policy must explicitly allow a restricted ads auto-run lane.',
    'The budget change must be under the configured daily amount threshold and single-action amount threshold.',
    'The budget change must be under the configured percentage threshold.',
    'The daily number of ads budget changes must remain under the configured cap.',
    'The action must pass Phase 14.4 budget payload validation.',
    'The action must pass Phase 14.5 hard caps.',
    'The action must have a recent Phase 14.7 before snapshot.',
    'The action must have result logging and rollback planning ready.',
    'Master pause, ads pause, or emergency safe mode must block the lane immediately.',
    'Phase 14.9 defines preview policy only; it does not enable live ads auto-run execution.',
  ];
}

export function buildAdsRestrictedAutoRunExamplePolicy(): AdsRestrictedAutoRunPolicyConfig {
  return {
    enabled: true,
    explicit_policy_allows_auto_run: true,
    policy_id: 'policy_ads_tiny_budget_changes_example',
    policy_name: 'Tiny ads budget changes only',
    allowed_platforms: ['meta_marketing_api', 'google_ads_api'],
    allowed_direction: 'tiny_increase_and_decrease',
    allowed_risk_levels: ['medium', 'high', 'critical'],
    max_single_budget_change: 10,
    max_percentage_change: 5,
    max_daily_budget_change: 30,
    max_changes_per_day: 2,
    always_ask_above_delta: 15,
    minimum_confidence_score: 0.9,
    require_recent_before_snapshot: true,
    require_result_logging: true,
    require_rollback_plan: true,
    enabled_for_live_execution_now: false,
  };
}

export function buildAdsRestrictedAutoRunExampleContext(): AdsRestrictedAutoRunContextInput {
  return {
    master_pause_active: false,
    ads_pause_active: false,
    emergency_safe_mode: false,
    confidence_score: 0.94,
    before_snapshot_recent: true,
    result_logging_ready: true,
    rollback_plan_ready: true,
  };
}

export function buildAdsRestrictedAutoRunExampleInput() {
  const budgetPayload = {
    ...buildAdsBudgetChangeExamplePayload(),
    current_budget: 100,
    proposed_budget: 105,
    delta: 5,
    percentage_change: 5,
    risk_level: 'critical',
  };
  return {
    policy: buildAdsRestrictedAutoRunExamplePolicy(),
    hardCaps: buildAdsHardCapsExample(),
    usage: { ...buildAdsHardCapsExampleUsage(), daily_budget_change_used: 0, changes_today: 0 },
    budgetPayload,
    context: buildAdsRestrictedAutoRunExampleContext(),
  };
}

export function evaluateAdsRestrictedAutoRunPolicy(input: unknown): AdsRestrictedAutoRunEvaluationResult {
  const safety = buildAdsRestrictedAutoRunSafety();
  const issues: string[] = [];
  const warnings: string[] = [];
  const checks: AdsRestrictedAutoRunEvaluationResult['checks'] = [];

  if (!isPlainObject(input)) {
    return {
      decision: 'invalid_policy_preview',
      eligibleForFutureRestrictedAutoRun: false,
      autoRunEnabledNow: false,
      manualApprovalStillRequiredThisPhase: true,
      issues: ['Preview input must be an object with policy, hardCaps, usage, budgetPayload, and context.'],
      warnings,
      normalizedPolicy: null,
      normalizedBudgetPayload: null,
      hardCapEvaluation: null,
      checks,
      computed: {
        absoluteBudgetDelta: null,
        absolutePercentageChange: null,
        projectedDailyBudgetChange: null,
        projectedChangesToday: null,
        direction: null,
      },
      safety,
    };
  }

  const policyValidation = normalizePolicy(input.policy);
  const contextValidation = normalizeContext(input.context);
  const budgetValidation = validateAdsBudgetChangePayload(input.budgetPayload);
  const hardCapEvaluation = evaluateAdsHardCaps({ caps: input.hardCaps, usage: input.usage, budgetPayload: input.budgetPayload });

  issues.push(...policyValidation.issues, ...contextValidation.issues);
  warnings.push(...policyValidation.warnings, ...budgetValidation.warnings, ...hardCapEvaluation.warnings);
  if (!budgetValidation.valid) issues.push(...budgetValidation.issues.map((issue) => `budgetPayload.${issue}`));

  const policy = policyValidation.policy;
  const context = contextValidation.context;
  const payload = budgetValidation.normalizedPayload;

  const absoluteBudgetDelta = payload ? round(Math.abs(payload.delta)) : null;
  const absolutePercentageChange = payload ? round(Math.abs(payload.percentage_change)) : null;
  const projectedDailyBudgetChange = payload && isPlainObject(input.usage) && isFiniteNumber(input.usage.daily_budget_change_used)
    ? round((input.usage.daily_budget_change_used as number) + Math.abs(payload.delta))
    : null;
  const projectedChangesToday = isPlainObject(input.usage) && Number.isInteger(input.usage.changes_today)
    ? (input.usage.changes_today as number) + 1
    : null;
  const direction = payload ? (payload.delta > 0 ? 'increase' : payload.delta < 0 ? 'decrease' : 'no_change') : null;

  if (!policy || !context || !payload) {
    return {
      decision: budgetValidation.valid ? 'invalid_policy_preview' : 'invalid_budget_payload_preview',
      eligibleForFutureRestrictedAutoRun: false,
      autoRunEnabledNow: false,
      manualApprovalStillRequiredThisPhase: true,
      issues,
      warnings,
      normalizedPolicy: policy,
      normalizedBudgetPayload: payload,
      hardCapEvaluation,
      checks,
      computed: { absoluteBudgetDelta, absolutePercentageChange, projectedDailyBudgetChange, projectedChangesToday, direction },
      safety,
    };
  }

  function addCheck(key: string, passed: boolean, reason: string) {
    checks.push({ key, passed, reason });
  }

  addCheck('policy_enabled', policy.enabled, 'Restricted ads auto-run policy must be enabled.');
  addCheck('explicit_policy_allows_auto_run', policy.explicit_policy_allows_auto_run, 'Founder rule must explicitly allow this narrow future auto-run lane.');
  addCheck('live_execution_disabled_this_phase', policy.enabled_for_live_execution_now === false, 'Phase 14.9 must not enable live ads auto-run execution.');
  addCheck('platform_allowed', policy.allowed_platforms.includes(payload.platform), 'Budget payload platform must match the explicit policy.');
  addCheck('risk_level_allowed', policy.allowed_risk_levels.includes(payload.risk_level), 'Budget payload risk level must be allowed by the policy.');
  addCheck('direction_allowed', policy.allowed_direction === 'tiny_increase_and_decrease' || direction !== 'increase', 'Policy direction must allow the proposed budget direction.');
  addCheck('single_delta_under_policy_threshold', absoluteBudgetDelta !== null && absoluteBudgetDelta <= policy.max_single_budget_change, 'Single budget delta must be under policy threshold.');
  addCheck('percentage_under_policy_threshold', absolutePercentageChange !== null && absolutePercentageChange <= policy.max_percentage_change, 'Percentage change must be under policy threshold.');
  addCheck('daily_delta_under_policy_threshold', projectedDailyBudgetChange !== null && projectedDailyBudgetChange <= policy.max_daily_budget_change, 'Projected daily budget change must be under policy threshold.');
  addCheck('daily_count_under_policy_threshold', projectedChangesToday !== null && projectedChangesToday <= policy.max_changes_per_day, 'Projected daily number of changes must be under policy threshold.');
  addCheck('always_ask_not_triggered', absoluteBudgetDelta !== null && absoluteBudgetDelta < policy.always_ask_above_delta, 'Crossing the policy always-ask threshold must require manual approval.');
  addCheck('confidence_high_enough', context.confidence_score >= policy.minimum_confidence_score, 'Confidence must be high enough for a future restricted auto-run lane.');
  addCheck('master_pause_off', !context.master_pause_active, 'Master pause blocks all autonomy.');
  addCheck('ads_pause_off', !context.ads_pause_active, 'Ads category pause blocks ads autonomy.');
  addCheck('emergency_safe_mode_off', !context.emergency_safe_mode, 'Emergency safe mode blocks all execution.');
  addCheck('before_snapshot_ready', !policy.require_recent_before_snapshot || context.before_snapshot_recent, 'Before snapshot must be ready before any future live ads execution.');
  addCheck('result_logging_ready', !policy.require_result_logging || context.result_logging_ready, 'Result logging must be ready before any future live ads execution.');
  addCheck('rollback_plan_ready', !policy.require_rollback_plan || context.rollback_plan_ready, 'Rollback planning must be ready before any future live ads execution.');
  addCheck('hard_caps_allow', hardCapEvaluation.allowed, 'Phase 14.5 hard caps must pass.');
  addCheck('hard_caps_do_not_force_always_ask', !hardCapEvaluation.computed.alwaysAskTriggered, 'Hard caps always-ask threshold must prevent auto-run eligibility.');

  const hardCapBlocked = !hardCapEvaluation.allowed;
  const policyBlocked = context.master_pause_active || context.ads_pause_active || context.emergency_safe_mode;
  const eligible = checks.every((item) => item.passed) && issues.length === 0;

  let decision: AdsRestrictedAutoRunDecision = 'manual_review_required';
  if (hardCapBlocked) decision = 'blocked_by_hard_cap';
  else if (policyBlocked) decision = 'blocked_by_policy';
  else if (eligible) decision = 'eligible_for_future_restricted_auto_run';

  if (decision !== 'eligible_for_future_restricted_auto_run') {
    const failed = checks.filter((item) => !item.passed).map((item) => `${item.key}: ${item.reason}`);
    warnings.push(...failed);
  }

  return {
    decision,
    eligibleForFutureRestrictedAutoRun: decision === 'eligible_for_future_restricted_auto_run',
    autoRunEnabledNow: false,
    manualApprovalStillRequiredThisPhase: true,
    issues,
    warnings,
    normalizedPolicy: policy,
    normalizedBudgetPayload: payload,
    hardCapEvaluation,
    checks,
    computed: { absoluteBudgetDelta, absolutePercentageChange, projectedDailyBudgetChange, projectedChangesToday, direction },
    safety,
  };
}

export function buildAdsRestrictedAutoRunPolicyReport(): AdsRestrictedAutoRunPolicyReport {
  const exampleEvaluation = evaluateAdsRestrictedAutoRunPolicy(buildAdsRestrictedAutoRunExampleInput());
  return {
    version: '0.7.0',
    phase: ADS_RESTRICTED_AUTO_RUN_PHASE,
    healthMode: ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE,
    deliverable: 'restricted_ads_auto_run_policy',
    policyOnly: true,
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.9 defines a restricted ads auto-run policy for a later phase: only tiny safe ads budget changes inside an explicit founder rule, under daily and percentage caps, with pause/emergency gates, snapshot, result-log, and rollback readiness. It does not enable ads auto-run or call ad APIs.',
    allowedFutureLane: 'tiny_safe_ads_budget_changes_inside_explicit_policy_only',
    requirements: buildAdsRestrictedAutoRunRequirements(),
    futureAutoRunEligibilityRules: [
      'Explicit policy must allow restricted ads auto-run.',
      'Budget change must remain below $X/day and Y% thresholds configured by the founder.',
      'The change must pass hard caps and never exceed emergency limit.',
      'The action must remain single-entity, non-bulk, and supported by before/after snapshot and result logs.',
      'Pause and emergency gates must be checked immediately before future execution.',
    ],
    examplePolicy: buildAdsRestrictedAutoRunExamplePolicy(),
    exampleEvaluation,
    hardCapChecksUsed: exampleEvaluation.hardCapEvaluation?.checks ?? [],
    safety: buildAdsRestrictedAutoRunSafety(),
    nextStep: 'Phase 14.10 — Ads Safety QA',
  };
}

export function buildAdsRestrictedAutoRunPolicyStatus(): AdsRestrictedAutoRunPolicyStatus {
  return {
    phase: 'V2 Phase 14.9 — Auto-Run Below Threshold Later',
    healthMode: ADS_RESTRICTED_AUTO_RUN_HEALTH_MODE,
    deliverable: 'restricted_ads_auto_run_policy',
    policyOnly: true,
    autoRunEnabledNow: false,
    manualApprovalStillRequiredThisPhase: true,
    adsExecutorAdded: false,
    externalAdApiCalled: false,
    budgetChanged: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.10 — Ads Safety QA',
  };
}

export function assertAdsRestrictedAutoRunPolicySafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Restricted ads auto-run policy output contains forbidden fragment: ${fragment}`);
    }
  }
}
