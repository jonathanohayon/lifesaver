import type { AdsBudgetChangePayloadNormalized } from './ads-budget-change-payload.types.js';
import type { AdsHardCapCheckResult, AdsHardCapsEvaluationResult, AdsHardCapsNormalizedConfig, AdsHardCapsUsageInput } from './ads-hard-caps.types.js';

export type AdsRestrictedAutoRunPlatform = 'meta_marketing_api' | 'google_ads_api';
export type AdsRestrictedAutoRunDirection = 'decrease_only' | 'tiny_increase_and_decrease';
export type AdsRestrictedAutoRunRiskLevel = 'medium' | 'high' | 'critical';
export type AdsRestrictedAutoRunDecision =
  | 'eligible_for_future_restricted_auto_run'
  | 'manual_review_required'
  | 'blocked_by_policy'
  | 'blocked_by_hard_cap'
  | 'invalid_policy_preview'
  | 'invalid_budget_payload_preview';

export interface AdsRestrictedAutoRunPolicyConfig {
  enabled: boolean;
  explicit_policy_allows_auto_run: boolean;
  policy_id: string;
  policy_name: string;
  allowed_platforms: AdsRestrictedAutoRunPlatform[];
  allowed_direction: AdsRestrictedAutoRunDirection;
  allowed_risk_levels: AdsRestrictedAutoRunRiskLevel[];
  max_single_budget_change: number;
  max_percentage_change: number;
  max_daily_budget_change: number;
  max_changes_per_day: number;
  always_ask_above_delta: number;
  minimum_confidence_score: number;
  require_recent_before_snapshot: boolean;
  require_result_logging: boolean;
  require_rollback_plan: boolean;
  enabled_for_live_execution_now: false;
}

export interface AdsRestrictedAutoRunContextInput {
  master_pause_active: boolean;
  ads_pause_active: boolean;
  emergency_safe_mode: boolean;
  confidence_score: number;
  before_snapshot_recent: boolean;
  result_logging_ready: boolean;
  rollback_plan_ready: boolean;
}

export interface AdsRestrictedAutoRunPreviewInput {
  policy: AdsRestrictedAutoRunPolicyConfig;
  hardCaps: AdsHardCapsNormalizedConfig;
  usage: AdsHardCapsUsageInput;
  budgetPayload: unknown;
  context: AdsRestrictedAutoRunContextInput;
}

export interface AdsRestrictedAutoRunSafety {
  policyOnly: true;
  previewOnly: true;
  noAdsExecutorAdded: true;
  noMetaAdsApiClientAdded: true;
  noGoogleAdsApiClientAdded: true;
  noAdOAuthRouteAdded: true;
  noAdTokenStorageAdded: true;
  noWriteScopeRequested: true;
  noCampaignPaused: true;
  noAdsetPaused: true;
  noBudgetChanged: true;
  noBudgetRestored: true;
  noCampaignReenabled: true;
  noAdsAutoRunEnabled: true;
  noExternalAdApiCalled: true;
  manualApprovalStillRequiredThisPhase: true;
  noRawTokensReturned: true;
  noRawProviderPayloadReturned: true;
  noDatabaseMigrationRequired: true;
}

export interface AdsRestrictedAutoRunEvaluationResult {
  decision: AdsRestrictedAutoRunDecision;
  eligibleForFutureRestrictedAutoRun: boolean;
  autoRunEnabledNow: false;
  manualApprovalStillRequiredThisPhase: true;
  issues: string[];
  warnings: string[];
  normalizedPolicy: AdsRestrictedAutoRunPolicyConfig | null;
  normalizedBudgetPayload: AdsBudgetChangePayloadNormalized | null;
  hardCapEvaluation: AdsHardCapsEvaluationResult | null;
  checks: Array<{
    key: string;
    passed: boolean;
    reason: string;
  }>;
  computed: {
    absoluteBudgetDelta: number | null;
    absolutePercentageChange: number | null;
    projectedDailyBudgetChange: number | null;
    projectedChangesToday: number | null;
    direction: 'increase' | 'decrease' | 'no_change' | null;
  };
  safety: AdsRestrictedAutoRunSafety;
}

export interface AdsRestrictedAutoRunPolicyReport {
  version: '0.7.0';
  phase: 'phase_14_9_auto_run_below_threshold_later';
  healthMode: 'v2-phase-14-9-restricted-ads-auto-run-policy';
  deliverable: 'restricted_ads_auto_run_policy';
  policyOnly: true;
  generatedAt: string;
  executiveSummary: string;
  allowedFutureLane: 'tiny_safe_ads_budget_changes_inside_explicit_policy_only';
  requirements: string[];
  futureAutoRunEligibilityRules: string[];
  examplePolicy: AdsRestrictedAutoRunPolicyConfig;
  exampleEvaluation: AdsRestrictedAutoRunEvaluationResult;
  hardCapChecksUsed: AdsHardCapCheckResult[];
  safety: AdsRestrictedAutoRunSafety;
  nextStep: 'Phase 14.10 — Ads Safety QA';
}

export interface AdsRestrictedAutoRunPolicyStatus {
  phase: 'V2 Phase 14.9 — Auto-Run Below Threshold Later';
  healthMode: 'v2-phase-14-9-restricted-ads-auto-run-policy';
  deliverable: 'restricted_ads_auto_run_policy';
  policyOnly: true;
  autoRunEnabledNow: false;
  manualApprovalStillRequiredThisPhase: true;
  adsExecutorAdded: false;
  externalAdApiCalled: false;
  budgetChanged: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.10 — Ads Safety QA';
}
