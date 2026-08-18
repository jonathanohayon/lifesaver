import type { AdsBudgetChangePayloadInput, AdsBudgetChangePayloadNormalized } from './ads-budget-change-payload.types.js';

export type AdsHardCapsPlatform = 'global' | 'meta_marketing_api' | 'google_ads_api';
export type AdsHardCapDecision = 'allowed_manual_review' | 'always_ask_required' | 'blocked_by_hard_cap' | 'invalid_caps_preview' | 'invalid_budget_payload_preview';
export type AdsHardCapKey =
  | 'max_daily_budget_change'
  | 'max_percentage_change'
  | 'max_changes_per_day'
  | 'always_ask_above_threshold'
  | 'emergency_never_exceed_limit';

export interface AdsHardCapsConfigInput {
  workspace_id?: string;
  platform: AdsHardCapsPlatform | string;
  account_id: string | null;
  currency: string;
  max_daily_budget_change: number;
  max_percentage_change: number;
  max_changes_per_day: number;
  always_ask_above_threshold: number;
  emergency_never_exceed_limit: number;
  enabled: boolean;
}

export interface AdsHardCapsUsageInput {
  daily_budget_change_used: number;
  changes_today: number;
}

export interface AdsHardCapsPreviewInput {
  caps: AdsHardCapsConfigInput;
  usage: AdsHardCapsUsageInput;
  budgetPayload: AdsBudgetChangePayloadInput;
}

export interface AdsHardCapsNormalizedConfig {
  platform: AdsHardCapsPlatform;
  account_id: string | null;
  currency: string;
  max_daily_budget_change: number;
  max_percentage_change: number;
  max_changes_per_day: number;
  always_ask_above_threshold: number;
  emergency_never_exceed_limit: number;
  enabled: boolean;
}

export interface AdsHardCapsFieldSpec {
  field: AdsHardCapKey | 'platform' | 'account_id' | 'currency' | 'enabled';
  type: string;
  required: true;
  safetyNote: string;
  validation: string;
}

export interface AdsHardCapCheckResult {
  capKey: AdsHardCapKey;
  limit: number;
  current: number;
  increment: number;
  projected: number;
  exceeded: boolean;
  alwaysAskTriggered: boolean;
  reason: string;
}

export interface AdsHardCapsEvaluationResult {
  decision: AdsHardCapDecision;
  allowed: boolean;
  manualApprovalRequired: true;
  issues: string[];
  warnings: string[];
  checks: AdsHardCapCheckResult[];
  normalizedCaps: AdsHardCapsNormalizedConfig | null;
  normalizedBudgetPayload: AdsBudgetChangePayloadNormalized | null;
  computed: {
    absoluteBudgetDelta: number | null;
    absolutePercentageChange: number | null;
    projectedDailyBudgetChange: number | null;
    projectedChangesToday: number | null;
    emergencyLimitExceeded: boolean;
    alwaysAskTriggered: boolean;
  };
  safety: AdsHardCapsSafety;
}

export interface AdsHardCapsSafety {
  storageOnly: boolean;
  migrationAdditiveOnly: true;
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
  noRawTokensReturned: true;
  noRawProviderPayloadReturned: true;
  databaseMigrationAdded: true;
}

export interface AdsHardCapsStorageReport {
  version: '0.7.0';
  phase: 'phase_14_5_hard_caps_table';
  healthMode: 'v2-phase-14-5-hard-caps-table';
  deliverable: 'ads_hard_caps_storage';
  storageOnly: boolean;
  generatedAt: string;
  executiveSummary: string;
  migration: '022_create_ads_hard_caps.sql';
  tableName: 'ads_hard_caps';
  capKeys: AdsHardCapKey[];
  fields: AdsHardCapsFieldSpec[];
  safetyGates: string[];
  exampleCaps: AdsHardCapsNormalizedConfig;
  exampleBudgetPayload: AdsBudgetChangePayloadNormalized;
  exampleEvaluation: AdsHardCapsEvaluationResult;
  safety: AdsHardCapsSafety;
  nextStep: 'Phase 14.6 — Manual Approval Only';
}

export interface AdsHardCapsStatus {
  phase: 'V2 Phase 14.5 — Hard Caps Table';
  healthMode: 'v2-phase-14-5-hard-caps-table';
  deliverable: 'ads_hard_caps_storage';
  storageOnly: boolean;
  migration: '022_create_ads_hard_caps.sql';
  tableName: 'ads_hard_caps';
  capKeys: AdsHardCapKey[];
  budgetChanged: false;
  adsExecutorAdded: false;
  externalAdApiCalled: false;
  adsAutoRunEnabled: false;
  databaseMigrationAdded: true;
  nextStep: 'Phase 14.6 — Manual Approval Only';
}
