export type AdsPlatformId = 'triple_whale' | 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'snapchat_ads' | 'pinterest_ads' | 'microsoft_ads';

export type AdsConnectorRole = 'read_performance_only' | 'direct_control_required' | 'future_optional_control';

export type AdsConnectorDecision = 'current_read_source' | 'required_for_control' | 'deferred';

export interface AdsConnectorDependencyItem {
  platform: AdsPlatformId;
  label: string;
  role: AdsConnectorRole;
  decision: AdsConnectorDecision;
  currentPhaseStatus: 'available_via_triple_whale_read' | 'audit_only_not_connected' | 'deferred_not_connected';
  whatTripleWhaleCanProvide: string[];
  whatDirectPlatformMustControl: string[];
  dependenciesBeforeControl: string[];
  safetyNotes: string[];
}

export interface AdsControlBoundary {
  source: 'triple_whale' | 'direct_platform_api';
  purpose: string;
  allowedInPhase141: boolean;
  examples: string[];
  forbiddenInPhase141: string[];
}

export interface AdsConnectorAuditReport {
  version: '0.7.0';
  phase: 'phase_14_1_ads_connector_audit';
  healthMode: 'v2-phase-14-1-ads-connector-audit';
  deliverable: 'ads_connector_dependency_report';
  planningOnly: true;
  generatedAt: string;
  executiveSummary: string;
  coreFinding: string;
  boundaries: AdsControlBoundary[];
  connectorDependencies: AdsConnectorDependencyItem[];
  recommendedControlOrder: AdsPlatformId[];
  requiredBeforeAnyAdsExecutor: string[];
  hardCapDependenciesForFuturePhases: string[];
  safety: {
    auditOnly: true;
    tripleWhaleReadOnlyStill: true;
    directAdPlatformApiClientAdded: false;
    oauthRoutesAdded: false;
    tokenStorageAdded: false;
    adWriteScopeRequested: false;
    campaignPaused: false;
    budgetChanged: false;
    autoRunAdsEnabled: false;
    externalApiCalled: false;
    noRawTokensReturned: true;
    noRawProviderPayloadReturned: true;
    noDatabaseMigrationRequired: true;
  };
  nextStep: 'Phase 14.2 — Write Scope Planning';
}

export interface AdsConnectorAuditStatus {
  phase: 'V2 Phase 14.1 — Ads Connector Audit';
  healthMode: 'v2-phase-14-1-ads-connector-audit';
  deliverable: 'ads_connector_dependency_report';
  planningOnly: true;
  separatesTripleWhaleReadsFromDirectControls: true;
  tripleWhaleReadOnlyStill: true;
  directAdPlatformApiClientAdded: false;
  adWriteScopeRequested: false;
  campaignPaused: false;
  budgetChanged: false;
  autoRunAdsEnabled: false;
  externalApiCalled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.2 — Write Scope Planning';
}
