import type {
  AdsActionCategory,
  AdsActionPlatform,
  AdsActionTaxonomyReport,
  AdsActionType,
  AdsActionTypeDefinition,
  AdsActionTypesStatus,
} from './ads-action-types.types.js';

export const ADS_ACTION_TYPES_PHASE = 'phase_14_3_ads_action_types' as const;
export const ADS_ACTION_TYPES_HEALTH_MODE = 'v2-phase-14-3-ads-action-types' as const;
export const ADS_ACTION_TYPES_PACKAGE = 'lifesaver-v0.7.0-phase-14-3-ads-action-types.zip' as const;

export const ADS_ACTION_TYPE_REGISTRY: AdsActionType[] = [
  'pause_campaign',
  'pause_adset',
  'adjust_budget',
  'restore_budget',
  'reenable_campaign',
];

const PLANNED_PLATFORMS: AdsActionPlatform[] = ['meta_marketing_api', 'google_ads_api'];

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

export function buildAdsActionSharedSafetyGates(): string[] {
  return [
    'Manual approval is required for every ads executor in the first ads release.',
    'Master pause must block every ad action immediately before execution.',
    'Ads category pause must block every ad action immediately before execution.',
    'Emergency safe mode must block every ad action immediately before execution.',
    'Hard caps must be checked before budget mutation, restore, pause, or re-enable paths.',
    'Before/after snapshots must be captured before real control is attempted in a later phase.',
    'Idempotency and duplicate-execution protection must block repeated approvals/clicks.',
    'Result logs must prove success/failure before LIFE.SAVER claims an ad action executed.',
    'Rollback or re-enable planning must exist before live control is attempted.',
    'Triple Whale remains read-only context; direct ad platform APIs are required for future control.',
  ];
}

function definition(
  actionType: AdsActionType,
  label: string,
  category: AdsActionCategory,
  initialRiskLevel: AdsActionTypeDefinition['initialRiskLevel'],
  currentPhasePurpose: string,
  futureExecutorPurpose: string,
  plannedPayloadFields: string[],
  forbiddenUntilLaterPhase: string[],
  notes: string[],
): AdsActionTypeDefinition {
  return {
    actionType,
    label,
    category,
    currentPhasePurpose,
    futureExecutorPurpose,
    supportedPlatformsPlanned: PLANNED_PLATFORMS,
    initialRiskLevel,
    approvalMode: 'manual_approval_required_first_release',
    requiredSafetyGates: buildAdsActionSharedSafetyGates(),
    plannedPayloadFields,
    forbiddenUntilLaterPhase,
    notes,
  };
}

export function buildAdsActionTypeDefinitions(): AdsActionTypeDefinition[] {
  return [
    definition(
      'pause_campaign',
      'Pause campaign',
      'status_control',
      'high',
      'Define the taxonomy entry for pausing an entire campaign. No campaign is paused in this phase.',
      'Future executor may pause a specific campaign after manual approval, pause checks, caps, snapshot, idempotency, and result logging.',
      ['platform', 'account_id', 'campaign_id', 'current_status', 'reason', 'risk_level', 'approval_notes'],
      ['real campaign pause', 'bulk campaign pause', 'auto-run campaign pause', 'provider API call'],
      ['High risk because pausing a campaign can stop revenue-producing traffic.'],
    ),
    definition(
      'pause_adset',
      'Pause ad set / ad group',
      'status_control',
      'high',
      'Define the taxonomy entry for pausing a narrower campaign child object. No ad set or ad group is paused in this phase.',
      'Future executor may pause a specific Meta ad set or Google Ads ad group where supported, after manual approval and audit gates.',
      ['platform', 'account_id', 'campaign_id', 'adset_id_or_ad_group_id', 'current_status', 'reason', 'risk_level', 'approval_notes'],
      ['real ad set pause', 'real ad group pause', 'bulk ad set pause', 'auto-run pause', 'provider API call'],
      ['Still high risk because it can affect live spend and conversion volume.'],
    ),
    definition(
      'adjust_budget',
      'Adjust budget',
      'budget_control',
      'critical',
      'Define the taxonomy entry for budget mutation. No budget is changed in this phase.',
      'Future executor may change a campaign/ad set budget only after manual approval, hard caps, before/after snapshot, and result logging.',
      ['platform', 'account_id', 'campaign_id', 'adset_id_or_ad_group_id', 'current_budget', 'proposed_budget', 'delta', 'percentage_change', 'currency', 'reason', 'risk_level', 'approval_notes'],
      ['real budget increase', 'real budget decrease', 'uncapped budget change', 'auto-run budget change', 'provider API call'],
      ['Critical risk because it directly affects real money. Phase 14.5 hard caps and Phase 14.6 manual approval are required before execution.'],
    ),
    definition(
      'restore_budget',
      'Restore budget',
      'restore_control',
      'high',
      'Define the taxonomy entry for restoring a previous budget from an audit snapshot. No budget is restored in this phase.',
      'Future rollback path may restore a prior budget value using a verified before/after snapshot and manual approval.',
      ['platform', 'account_id', 'campaign_id', 'adset_id_or_ad_group_id', 'previous_budget', 'current_budget', 'currency', 'source_result_id', 'rollback_reason', 'approval_notes'],
      ['real budget restore', 'restore without snapshot', 'automatic restore', 'provider API call'],
      ['Restore is not automatically safe; it still changes spend and must be manually approved in the first release.'],
    ),
    definition(
      'reenable_campaign',
      'Re-enable campaign',
      'restore_control',
      'high',
      'Define the taxonomy entry for re-enabling a previously paused campaign. No campaign is re-enabled in this phase.',
      'Future executor may re-enable a campaign only from a known safe prior state with manual approval and result logging.',
      ['platform', 'account_id', 'campaign_id', 'previous_status', 'current_status', 'source_result_id', 'reenable_reason', 'risk_level', 'approval_notes'],
      ['real campaign re-enable', 'bulk campaign re-enable', 'auto-run re-enable', 'provider API call'],
      ['Re-enabling can restart spend, so it remains high risk and manual-approval-only in the first release.'],
    ),
  ];
}

export function buildAdsActionCategories(): AdsActionCategory[] {
  return ['status_control', 'budget_control', 'restore_control'];
}

export function buildAdsActionTaxonomyReport(): AdsActionTaxonomyReport {
  return {
    version: '0.7.0',
    phase: ADS_ACTION_TYPES_PHASE,
    healthMode: ADS_ACTION_TYPES_HEALTH_MODE,
    deliverable: 'ads_action_taxonomy',
    taxonomyOnly: true,
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.3 defines the initial ads action taxonomy: pause_campaign, pause_adset, adjust_budget, restore_budget, and reenable_campaign. This phase does not add executors, OAuth, token storage, write scopes, or external ad API calls.',
    actionTypes: buildAdsActionTypeDefinitions(),
    actionTypeRegistry: ADS_ACTION_TYPE_REGISTRY,
    categories: buildAdsActionCategories(),
    sharedRequiredSafetyGates: buildAdsActionSharedSafetyGates(),
    platformBoundary: {
      tripleWhaleRole: 'read_only_performance_context_for_recommendations',
      directPlatformRole: 'future_manual_approved_control_execution',
      directPlatformsPlanned: ['Meta Marketing API', 'Google Ads API'],
    },
    safety: {
      taxonomyOnly: true,
      noExecutorAdded: true,
      noAdApiClientAdded: true,
      noOAuthRouteAdded: true,
      noTokenStorageAdded: true,
      noWriteScopeRequested: true,
      noCampaignPaused: true,
      noAdsetPaused: true,
      noBudgetChanged: true,
      noBudgetRestored: true,
      noCampaignReenabled: true,
      noAdsAutoRunEnabled: true,
      noExternalAdApiCalled: true,
      tripleWhaleReadOnlyStill: true,
      noRawTokensReturned: true,
      noRawProviderPayloadReturned: true,
      noDatabaseMigrationRequired: true,
    },
    nextStep: 'Phase 14.4 — Budget Change Payload',
  };
}

export function buildAdsActionTypesStatus(): AdsActionTypesStatus {
  return {
    phase: 'V2 Phase 14.3 — Ads Action Types',
    healthMode: ADS_ACTION_TYPES_HEALTH_MODE,
    deliverable: 'ads_action_taxonomy',
    taxonomyOnly: true,
    actionTypes: ADS_ACTION_TYPE_REGISTRY,
    manualApprovalRequiredFirstRelease: true,
    executorAdded: false,
    adApiClientAdded: false,
    oauthRouteAdded: false,
    tokenStorageAdded: false,
    writeScopeRequested: false,
    campaignPaused: false,
    adsetPaused: false,
    budgetChanged: false,
    adsAutoRunEnabled: false,
    externalAdApiCalled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.4 — Budget Change Payload',
  };
}

export function assertAdsActionTypesSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads action taxonomy output contains forbidden fragment: ${fragment}`);
    }
  }
}
