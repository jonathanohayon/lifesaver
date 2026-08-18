import type { AdsActionType } from './ads-action-types.types.js';

export type AdsBudgetPayloadPlatform = 'meta_marketing_api' | 'google_ads_api';
export type AdsBudgetPayloadRiskLevel = 'medium' | 'high' | 'critical';
export type AdsBudgetPayloadDecision = 'valid_schema_preview' | 'invalid_schema_preview';

export interface AdsBudgetChangePayloadInput {
  platform: AdsBudgetPayloadPlatform | string;
  account_id: string;
  campaign_id: string;
  adset_id: string | null;
  current_budget: number;
  proposed_budget: number;
  delta: number;
  percentage_change: number;
  reason: string;
  risk_level: AdsBudgetPayloadRiskLevel | string;
}

export interface AdsBudgetChangePayloadNormalized {
  action_type: Extract<AdsActionType, 'adjust_budget'>;
  platform: AdsBudgetPayloadPlatform;
  account_id: string;
  campaign_id: string;
  adset_id: string | null;
  current_budget: number;
  proposed_budget: number;
  delta: number;
  percentage_change: number;
  reason: string;
  risk_level: AdsBudgetPayloadRiskLevel;
  manual_approval_required: true;
  hard_caps_required_before_execution: true;
  before_after_snapshot_required_before_execution: true;
  result_log_required_after_execution: true;
  external_ad_api_called: false;
}

export interface AdsBudgetChangePayloadFieldSpec {
  field: keyof AdsBudgetChangePayloadInput;
  type: string;
  required: true;
  safetyNote: string;
  validation: string;
}

export interface AdsBudgetChangePayloadValidationResult {
  decision: AdsBudgetPayloadDecision;
  valid: boolean;
  issues: string[];
  warnings: string[];
  computed: {
    expected_delta: number | null;
    expected_percentage_change: number | null;
    recommended_risk_level: AdsBudgetPayloadRiskLevel;
  };
  normalizedPayload: AdsBudgetChangePayloadNormalized | null;
  safety: AdsBudgetChangePayloadSafety;
}

export interface AdsBudgetChangePayloadSafety {
  schemaOnly: true;
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
  noDatabaseMigrationRequired: true;
}

export interface AdsBudgetChangePayloadSchemaReport {
  version: '0.7.0';
  phase: 'phase_14_4_budget_change_payload';
  healthMode: 'v2-phase-14-4-budget-change-payload';
  deliverable: 'ads_payload_schema';
  schemaOnly: true;
  generatedAt: string;
  executiveSummary: string;
  actionType: 'adjust_budget';
  requiredFields: Array<keyof AdsBudgetChangePayloadInput>;
  fields: AdsBudgetChangePayloadFieldSpec[];
  formulaChecks: {
    delta: 'proposed_budget - current_budget';
    percentage_change: '((proposed_budget - current_budget) / current_budget) * 100';
  };
  manualApprovalAndSafetyGates: string[];
  examplePayload: AdsBudgetChangePayloadNormalized;
  safety: AdsBudgetChangePayloadSafety;
  nextStep: 'Phase 14.5 — Hard Caps Table';
}

export interface AdsBudgetChangePayloadStatus {
  phase: 'V2 Phase 14.4 — Budget Change Payload';
  healthMode: 'v2-phase-14-4-budget-change-payload';
  deliverable: 'ads_payload_schema';
  schemaOnly: true;
  requiredFields: Array<keyof AdsBudgetChangePayloadInput>;
  budgetChanged: false;
  adsExecutorAdded: false;
  externalAdApiCalled: false;
  hardCapsTableAdded: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.5 — Hard Caps Table';
}
