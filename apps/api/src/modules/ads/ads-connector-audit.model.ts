import type { AdsConnectorAuditReport, AdsConnectorAuditStatus, AdsConnectorDependencyItem, AdsControlBoundary, AdsPlatformId } from './ads-connector-audit.types.js';

export const ADS_CONNECTOR_AUDIT_PHASE = 'phase_14_1_ads_connector_audit' as const;
export const ADS_CONNECTOR_AUDIT_HEALTH_MODE = 'v2-phase-14-1-ads-connector-audit' as const;
export const ADS_CONNECTOR_AUDIT_PACKAGE = 'lifesaver-v0.7.0-phase-14-1-ads-connector-audit.zip' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'raw_provider_payload',
];

export function buildAdsControlBoundaries(): AdsControlBoundary[] {
  return [
    {
      source: 'triple_whale',
      purpose: 'Read-only performance intelligence and attribution context. Triple Whale helps LIFE.SAVER understand performance, but it must not be treated as the control plane for changing ad platforms.',
      allowedInPhase141: true,
      examples: ['Revenue', 'orders', 'AOV', 'paid media spend', 'ROAS', 'attribution/readiness context', 'channel spend summaries'],
      forbiddenInPhase141: ['Pause campaigns', 'change budgets', 'edit adsets', 'create ads', 'write back to Triple Whale'],
    },
    {
      source: 'direct_platform_api',
      purpose: 'Future execution/control layer for real ad actions such as pausing campaigns or adjusting budgets. This requires each platform API, OAuth/app setup, encrypted tokens, least-privilege scopes, manual approval, caps, pause gates, audit logs, and result logs.',
      allowedInPhase141: false,
      examples: ['Meta Marketing API', 'Google Ads API', 'TikTok Business API', 'Snapchat Marketing API', 'Microsoft Ads API'],
      forbiddenInPhase141: ['Request write scopes', 'store ad platform tokens', 'call ad APIs', 'pause campaigns', 'adjust budgets', 'enable ads auto-run'],
    },
  ];
}

export function buildAdsConnectorDependencies(): AdsConnectorDependencyItem[] {
  return [
    {
      platform: 'triple_whale',
      label: 'Triple Whale',
      role: 'read_performance_only',
      decision: 'current_read_source',
      currentPhaseStatus: 'available_via_triple_whale_read',
      whatTripleWhaleCanProvide: ['Aggregated paid media spend', 'blended ROAS', 'channel-level reporting context', 'attribution context when production-ready', 'performance trend signals'],
      whatDirectPlatformMustControl: ['None. Triple Whale is not the write/control plane for ad changes in LIFE.SAVER.'],
      dependenciesBeforeControl: ['Keep Triple Whale connector read-only', 'Do not add write-back behavior', 'Keep raw payloads separate from normalized metrics'],
      safetyNotes: ['Use Triple Whale to propose ad actions, never to execute them.', 'Never treat attribution revenue as a budget-control API.', 'No external writes are added in Phase 14.1.'],
    },
    {
      platform: 'meta_ads',
      label: 'Meta Ads / Facebook Ads / Instagram Ads',
      role: 'direct_control_required',
      decision: 'required_for_control',
      currentPhaseStatus: 'audit_only_not_connected',
      whatTripleWhaleCanProvide: ['Meta spend summary', 'Meta ROAS/attribution context when mapped safely', 'Performance trend signal for proposal generation'],
      whatDirectPlatformMustControl: ['Pause campaign', 'pause ad set', 'adjust campaign/ad set budget', 'restore previous budget', 'read current campaign/ad set status for before/after snapshots'],
      dependenciesBeforeControl: ['Meta developer app', 'Business Manager access', 'Marketing API permissions', 'OAuth flow', 'token refresh/expiry handling', 'encrypted token storage', 'ad account ID mapping', 'test ad account or sandbox-safe live test plan'],
      safetyNotes: ['Manual approval first for every ad action.', 'Hard caps must block excessive budget changes.', 'Master pause and ads pause must block execution immediately.'],
    },
    {
      platform: 'google_ads',
      label: 'Google Ads',
      role: 'direct_control_required',
      decision: 'required_for_control',
      currentPhaseStatus: 'audit_only_not_connected',
      whatTripleWhaleCanProvide: ['Google Ads spend summary', 'blended performance context', 'ROAS trend signal for proposal generation'],
      whatDirectPlatformMustControl: ['Pause campaign', 'adjust campaign budget', 'restore previous budget', 'read campaign status/budget for before/after snapshots'],
      dependenciesBeforeControl: ['Google Cloud project', 'Google Ads developer token', 'OAuth consent setup', 'customer ID mapping', 'manager account consideration', 'least-privilege OAuth scopes', 'encrypted token storage', 'test account first'],
      safetyNotes: ['Google Ads affects real money and must remain manual-approval-only initially.', 'Never run budget changes from Triple Whale data alone without current platform state validation.'],
    },
    {
      platform: 'tiktok_ads',
      label: 'TikTok Ads',
      role: 'future_optional_control',
      decision: 'deferred',
      currentPhaseStatus: 'deferred_not_connected',
      whatTripleWhaleCanProvide: ['TikTok spend and performance context when available', 'Trend signal for future proposal generation'],
      whatDirectPlatformMustControl: ['Campaign/ad group pause', 'budget changes', 'before/after snapshots'],
      dependenciesBeforeControl: ['TikTok Business API app access', 'OAuth/app review', 'ad account mapping', 'encrypted tokens', 'provider-specific rate limit plan'],
      safetyNotes: ['Defer until Meta/Google control path is proven.', 'No TikTok write connector is added in Phase 14.1.'],
    },
    {
      platform: 'snapchat_ads',
      label: 'Snapchat Ads',
      role: 'future_optional_control',
      decision: 'deferred',
      currentPhaseStatus: 'deferred_not_connected',
      whatTripleWhaleCanProvide: ['Snapchat spend context when mapped', 'Trend signal for proposals'],
      whatDirectPlatformMustControl: ['Campaign pause', 'budget/status changes', 'before/after snapshots'],
      dependenciesBeforeControl: ['Snapchat Marketing API app access', 'OAuth flow', 'ad account mapping', 'encrypted tokens', 'rate limit handling'],
      safetyNotes: ['Defer until primary ads executor architecture is proven.', 'No Snapchat write connector is added in Phase 14.1.'],
    },
    {
      platform: 'pinterest_ads',
      label: 'Pinterest Ads',
      role: 'future_optional_control',
      decision: 'deferred',
      currentPhaseStatus: 'deferred_not_connected',
      whatTripleWhaleCanProvide: ['Pinterest spend context when available'],
      whatDirectPlatformMustControl: ['Campaign/status and budget changes through Pinterest Ads API'],
      dependenciesBeforeControl: ['Pinterest app setup', 'OAuth flow', 'ad account mapping', 'encrypted tokens'],
      safetyNotes: ['Defer until higher-priority platforms are stable.', 'No Pinterest write connector is added in Phase 14.1.'],
    },
    {
      platform: 'microsoft_ads',
      label: 'Microsoft Ads / Bing Ads',
      role: 'future_optional_control',
      decision: 'deferred',
      currentPhaseStatus: 'deferred_not_connected',
      whatTripleWhaleCanProvide: ['Microsoft/Bing spend context when available'],
      whatDirectPlatformMustControl: ['Campaign pause and budget changes through Microsoft Advertising API'],
      dependenciesBeforeControl: ['Microsoft Advertising app setup', 'OAuth flow', 'customer/account ID mapping', 'encrypted tokens'],
      safetyNotes: ['Defer until Meta/Google foundations are proven.', 'No Microsoft Ads write connector is added in Phase 14.1.'],
    },
  ];
}

export function buildRequiredBeforeAnyAdsExecutor(): string[] {
  return [
    'Phase 14.2 write-scope planning completed per platform',
    'Least-privilege OAuth/app permissions documented',
    'Encrypted direct-platform token storage designed and tested',
    'Ad account/campaign/adset ID ownership and workspace scoping confirmed',
    'Manual approval required for every first-version ad action',
    'Master pause, ads pause, and emergency safe mode enforced immediately before execution',
    'Hard caps for daily budget delta, percentage change, changes per day, and emergency ceiling designed',
    'Before/after platform state snapshot defined',
    'Action result logs and failure logs defined',
    'Rollback/re-enable strategy planned before any live control test',
  ];
}

export function buildHardCapDependenciesForFuturePhases(): string[] {
  return [
    'max_daily_budget_change',
    'max_percentage_change',
    'max_number_of_ad_changes_per_day',
    'always_ask_above_threshold',
    'never_exceed_emergency_limit',
    'duplicate execution/idempotency protection',
    'provider rate limit protection',
    'workspace-scoped cap accounting',
  ];
}

export function buildRecommendedAdsControlOrder(): AdsPlatformId[] {
  return ['meta_ads', 'google_ads', 'tiktok_ads', 'snapchat_ads', 'pinterest_ads', 'microsoft_ads'];
}

export function buildAdsConnectorAuditReport(): AdsConnectorAuditReport {
  return {
    version: '0.7.0',
    phase: ADS_CONNECTOR_AUDIT_PHASE,
    healthMode: ADS_CONNECTOR_AUDIT_HEALTH_MODE,
    deliverable: 'ads_connector_dependency_report',
    planningOnly: true,
    generatedAt: '2026-07-08T00:00:00.000Z',
    executiveSummary: 'Phase 14.1 separates the current read-only Triple Whale intelligence layer from future direct ad platform control APIs. Triple Whale remains the performance source for proposals; Meta/Google and other ad platforms are the future execution/control layer.',
    coreFinding: 'Triple Whale can tell LIFE.SAVER what is happening in paid media, but direct ad platform APIs must be used to safely pause campaigns, adjust budgets, restore budgets, and capture before/after control snapshots.',
    boundaries: buildAdsControlBoundaries(),
    connectorDependencies: buildAdsConnectorDependencies(),
    recommendedControlOrder: buildRecommendedAdsControlOrder(),
    requiredBeforeAnyAdsExecutor: buildRequiredBeforeAnyAdsExecutor(),
    hardCapDependenciesForFuturePhases: buildHardCapDependenciesForFuturePhases(),
    safety: {
      auditOnly: true,
      tripleWhaleReadOnlyStill: true,
      directAdPlatformApiClientAdded: false,
      oauthRoutesAdded: false,
      tokenStorageAdded: false,
      adWriteScopeRequested: false,
      campaignPaused: false,
      budgetChanged: false,
      autoRunAdsEnabled: false,
      externalApiCalled: false,
      noRawTokensReturned: true,
      noRawProviderPayloadReturned: true,
      noDatabaseMigrationRequired: true,
    },
    nextStep: 'Phase 14.2 — Write Scope Planning',
  };
}

export function buildAdsConnectorAuditStatus(): AdsConnectorAuditStatus {
  return {
    phase: 'V2 Phase 14.1 — Ads Connector Audit',
    healthMode: ADS_CONNECTOR_AUDIT_HEALTH_MODE,
    deliverable: 'ads_connector_dependency_report',
    planningOnly: true,
    separatesTripleWhaleReadsFromDirectControls: true,
    tripleWhaleReadOnlyStill: true,
    directAdPlatformApiClientAdded: false,
    adWriteScopeRequested: false,
    campaignPaused: false,
    budgetChanged: false,
    autoRunAdsEnabled: false,
    externalApiCalled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.2 — Write Scope Planning',
  };
}

export function assertAdsConnectorAuditSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads connector audit output contains forbidden fragment: ${fragment}`);
    }
  }
}
