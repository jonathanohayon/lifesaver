export type AdsActionType =
  | 'pause_campaign'
  | 'pause_adset'
  | 'adjust_budget'
  | 'restore_budget'
  | 'reenable_campaign';

export type AdsActionCategory = 'status_control' | 'budget_control' | 'restore_control';
export type AdsActionRiskLevel = 'medium' | 'high' | 'critical';
export type AdsActionPlatform = 'meta_marketing_api' | 'google_ads_api';
export type AdsActionApprovalMode = 'manual_approval_required_first_release';

export interface AdsActionTypeDefinition {
  actionType: AdsActionType;
  label: string;
  category: AdsActionCategory;
  currentPhasePurpose: string;
  futureExecutorPurpose: string;
  supportedPlatformsPlanned: AdsActionPlatform[];
  initialRiskLevel: AdsActionRiskLevel;
  approvalMode: AdsActionApprovalMode;
  requiredSafetyGates: string[];
  plannedPayloadFields: string[];
  forbiddenUntilLaterPhase: string[];
  notes: string[];
}

export interface AdsActionTaxonomyReport {
  version: '0.7.0';
  phase: 'phase_14_3_ads_action_types';
  healthMode: 'v2-phase-14-3-ads-action-types';
  deliverable: 'ads_action_taxonomy';
  taxonomyOnly: true;
  generatedAt: string;
  executiveSummary: string;
  actionTypes: AdsActionTypeDefinition[];
  actionTypeRegistry: AdsActionType[];
  categories: AdsActionCategory[];
  sharedRequiredSafetyGates: string[];
  platformBoundary: {
    tripleWhaleRole: 'read_only_performance_context_for_recommendations';
    directPlatformRole: 'future_manual_approved_control_execution';
    directPlatformsPlanned: ['Meta Marketing API', 'Google Ads API'];
  };
  safety: {
    taxonomyOnly: true;
    noExecutorAdded: true;
    noAdApiClientAdded: true;
    noOAuthRouteAdded: true;
    noTokenStorageAdded: true;
    noWriteScopeRequested: true;
    noCampaignPaused: true;
    noAdsetPaused: true;
    noBudgetChanged: true;
    noBudgetRestored: true;
    noCampaignReenabled: true;
    noAdsAutoRunEnabled: true;
    noExternalAdApiCalled: true;
    tripleWhaleReadOnlyStill: true;
    noRawTokensReturned: true;
    noRawProviderPayloadReturned: true;
    noDatabaseMigrationRequired: true;
  };
  nextStep: 'Phase 14.4 — Budget Change Payload';
}

export interface AdsActionTypesStatus {
  phase: 'V2 Phase 14.3 — Ads Action Types';
  healthMode: 'v2-phase-14-3-ads-action-types';
  deliverable: 'ads_action_taxonomy';
  taxonomyOnly: true;
  actionTypes: AdsActionType[];
  manualApprovalRequiredFirstRelease: true;
  executorAdded: false;
  adApiClientAdded: false;
  oauthRouteAdded: false;
  tokenStorageAdded: false;
  writeScopeRequested: false;
  campaignPaused: false;
  adsetPaused: false;
  budgetChanged: false;
  adsAutoRunEnabled: false;
  externalAdApiCalled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.4 — Budget Change Payload';
}
