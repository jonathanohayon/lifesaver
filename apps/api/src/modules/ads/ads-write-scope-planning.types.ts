export type AdsWriteScopePlatformId = 'meta_marketing_api' | 'google_ads_api';

export type AdsWriteScopeRequirementCategory =
  | 'account_permission'
  | 'oauth'
  | 'app_review'
  | 'least_privilege'
  | 'token_storage';

export type AdsWriteScopeRequirementStatus =
  | 'planned_not_requested'
  | 'requires_founder_platform_access'
  | 'requires_developer_console_setup'
  | 'requires_review_before_live_use'
  | 'blocked_until_future_executor_phase';

export interface AdsWriteScopeChecklistItem {
  platform: AdsWriteScopePlatformId;
  category: AdsWriteScopeRequirementCategory;
  label: string;
  currentStatus: AdsWriteScopeRequirementStatus;
  requiredBeforeExecutor: boolean;
  ownerActionNeeded: string;
  evidenceNeeded: string;
  leastPrivilegeNote: string;
  safetyGate: string;
  notes: string[];
}

export interface AdsWriteScopePlatformPlan {
  platform: AdsWriteScopePlatformId;
  label: 'Meta Marketing API' | 'Google Ads API';
  futureControls: string[];
  requiredAccountPermissions: string[];
  oauthPlan: string[];
  appReviewPlan: string[];
  leastPrivilegePlan: string[];
  tokenStoragePlan: string[];
  notAddedInThisPhase: string[];
}

export interface AdsWriteScopeChecklistReport {
  version: '0.7.0';
  phase: 'phase_14_2_write_scope_planning';
  healthMode: 'v2-phase-14-2-write-scope-planning';
  deliverable: 'ads_write_scope_checklist';
  planningOnly: true;
  generatedAt: string;
  executiveSummary: string;
  platforms: AdsWriteScopePlatformPlan[];
  checklist: AdsWriteScopeChecklistItem[];
  sharedSafetyGates: string[];
  tokenStoragePolicy: {
    encryptedAtRestRequired: true;
    keyHintOnlyInBrowser: true;
    rawTokenReturnedToBrowser: false;
    rawTokenLogged: false;
    rotationPlanRequired: true;
    disconnectRequired: true;
  };
  safety: {
    planningOnly: true;
    noAdApiClientAdded: true;
    noOAuthRouteAdded: true;
    noTokenStorageAdded: true;
    noWriteScopeRequested: true;
    noCampaignPaused: true;
    noBudgetChanged: true;
    noAdsAutoRunEnabled: true;
    noExternalAdApiCalled: true;
    tripleWhaleReadOnlyStill: true;
    noRawTokensReturned: true;
    noRawProviderPayloadReturned: true;
    noDatabaseMigrationRequired: true;
  };
  nextStep: 'Phase 14.3 — Ads Action Types';
}

export interface AdsWriteScopeStatus {
  phase: 'V2 Phase 14.2 — Write Scope Planning';
  healthMode: 'v2-phase-14-2-write-scope-planning';
  deliverable: 'ads_write_scope_checklist';
  planningOnly: true;
  platforms: ['Meta Marketing API', 'Google Ads API'];
  accountPermissionPlanned: true;
  oauthPlanned: true;
  appReviewPlanned: true;
  leastPrivilegePlanned: true;
  encryptedTokenStoragePlanned: true;
  adApiClientAdded: false;
  oauthRouteAdded: false;
  tokenStorageAdded: false;
  writeScopeRequested: false;
  campaignPaused: false;
  budgetChanged: false;
  adsAutoRunEnabled: false;
  externalAdApiCalled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.3 — Ads Action Types';
}
