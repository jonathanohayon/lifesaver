import type {
  AdsWriteScopeChecklistItem,
  AdsWriteScopeChecklistReport,
  AdsWriteScopePlatformId,
  AdsWriteScopePlatformPlan,
  AdsWriteScopeRequirementCategory,
  AdsWriteScopeStatus,
} from './ads-write-scope-planning.types.js';

export const ADS_WRITE_SCOPE_PHASE = 'phase_14_2_write_scope_planning' as const;
export const ADS_WRITE_SCOPE_HEALTH_MODE = 'v2-phase-14-2-write-scope-planning' as const;
export const ADS_WRITE_SCOPE_PACKAGE = 'lifesaver-v0.7.0-phase-14-2-write-scope-planning.zip' as const;

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

export function buildAdsWriteScopePlatformPlans(): AdsWriteScopePlatformPlan[] {
  return [
    {
      platform: 'meta_marketing_api',
      label: 'Meta Marketing API',
      futureControls: [
        'pause campaign',
        'pause ad set',
        'restore campaign/ad set status',
        'read before/after state directly from Meta before execution',
        'future controlled budget adjustment when hard caps exist',
      ],
      requiredAccountPermissions: [
        'Business Manager access confirmed by founder/client',
        'Ad account ID confirmed and workspace-scoped',
        'User/app has only the minimum roles needed for future control operations',
        'Test/sandbox ad account preferred before any live ad account control',
      ],
      oauthPlan: [
        'Use OAuth only in a later connector phase after action taxonomy, hard caps, and manual approval gates are in place',
        'Store only encrypted token material server-side when implemented',
        'Show browser users connection status and account hint only',
        'Support disconnect/revoke flow before any executor is enabled',
      ],
      appReviewPlan: [
        'Document Meta app review requirements before requesting live write permissions',
        'Prepare screencast showing manual approval, pause, caps, and audit logs',
        'Request only permissions required for the approved control lane',
      ],
      leastPrivilegePlan: [
        'Start with read/insight verification where possible',
        'Request pause/status control permissions before budget mutation if platform separation allows it',
        'Do not request broad business-management permissions unless a future phase proves they are required',
      ],
      tokenStoragePlan: [
        'Encrypt token material with the same environment-stable encryption-key strategy used for customer connectors',
        'Persist token expiry/refresh metadata without returning raw token values',
        'Log token status only as connected, expired, revoked, or reconnect_required',
      ],
      notAddedInThisPhase: [
        'Meta SDK/API client',
        'Meta OAuth route',
        'Meta token storage table/migration',
        'Meta campaign pause or budget mutation',
      ],
    },
    {
      platform: 'google_ads_api',
      label: 'Google Ads API',
      futureControls: [
        'pause campaign',
        'pause ad group where supported by approved scope',
        'restore previous status',
        'read before/after state directly from Google Ads before execution',
        'future controlled budget adjustment when hard caps exist',
      ],
      requiredAccountPermissions: [
        'Google Ads customer ID confirmed and workspace-scoped',
        'Manager account relationship confirmed if MCC is used',
        'Founder/client grants only the minimum user/app access needed',
        'Test account or limited live account validation preferred before production control',
      ],
      oauthPlan: [
        'Use OAuth only in a later connector phase after executor safety gates are complete',
        'Confirm developer token status before any live control path is designed',
        'Store encrypted token material server-side only when implemented',
        'Support disconnect/reconnect and expired-token handling before any executor is enabled',
      ],
      appReviewPlan: [
        'Document Google Ads API developer-token and OAuth verification requirements',
        'Prepare least-privilege scope justification for review',
        'Prepare QA evidence showing manual approval, caps, pause, idempotency, and result logs',
      ],
      leastPrivilegePlan: [
        'Start with read verification and status-control planning before budget mutation',
        'Avoid requesting broad account-management capabilities unless a future phase proves they are required',
        'Keep budget adjustment behind explicit hard-cap and manual approval gates',
      ],
      tokenStoragePlan: [
        'Encrypt token material server-side and never return raw values to browser/admin screens',
        'Store customer/account hints only for display',
        'Track expiry/revocation/reconnect status without exposing provider payloads',
      ],
      notAddedInThisPhase: [
        'Google Ads SDK/API client',
        'Google Ads OAuth route',
        'Google Ads token storage table/migration',
        'Google Ads campaign pause or budget mutation',
      ],
    },
  ];
}

function checklistItem(
  platform: AdsWriteScopePlatformId,
  category: AdsWriteScopeRequirementCategory,
  label: string,
  ownerActionNeeded: string,
  evidenceNeeded: string,
  leastPrivilegeNote: string,
  safetyGate: string,
  notes: string[],
): AdsWriteScopeChecklistItem {
  return {
    platform,
    category,
    label,
    currentStatus: category === 'app_review' ? 'requires_review_before_live_use' : 'planned_not_requested',
    requiredBeforeExecutor: true,
    ownerActionNeeded,
    evidenceNeeded,
    leastPrivilegeNote,
    safetyGate,
    notes,
  };
}

export function buildAdsWriteScopeChecklist(): AdsWriteScopeChecklistItem[] {
  return [
    checklistItem(
      'meta_marketing_api',
      'account_permission',
      'Confirm Meta Business Manager and ad account permissions',
      'Founder/client confirms Business Manager, ad account ID, and role availability.',
      'Workspace-scoped ad account hint, role checklist, and test account preference recorded.',
      'Do not request roles beyond future pause/status/budget-control needs.',
      'Blocked until Phase 14.6 manual-approval-only executor gate exists.',
      ['Use direct Meta account permission for control; Triple Whale remains read-only.'],
    ),
    checklistItem(
      'meta_marketing_api',
      'oauth',
      'Plan Meta OAuth consent and reconnect flow',
      'Founder/client approves OAuth connection flow and disconnect behavior.',
      'OAuth screen copy, callback domain plan, reconnect/expiry behavior, and test mode notes.',
      'Request only scopes needed for the first approved Meta control lane.',
      'No Meta OAuth route is added in this phase.',
      ['Do not place app secret or token values in browser, logs, docs, or tests.'],
    ),
    checklistItem(
      'meta_marketing_api',
      'app_review',
      'Prepare Meta app review evidence before live write permissions',
      'Founder/client approves the permission request purpose and app review package.',
      'Screencast plan proving manual approval, master pause, hard caps, audit logs, result logs, and rollback planning.',
      'Ask for the smallest permission set that can satisfy the selected future executor.',
      'No write permission is requested until review requirements are documented and approved.',
      ['Do not submit for broad ad-management access without a phase-specific justification.'],
    ),
    checklistItem(
      'meta_marketing_api',
      'least_privilege',
      'Define Meta least-privilege permission boundary',
      'Founder/client agrees to start with the narrowest viable control capability.',
      'List of allowed future operations and explicitly forbidden operations.',
      'Pause/status control first; budget mutation only after hard caps and before/after snapshots.',
      'Any unsupported action type remains blocked by executor registry and policy gates.',
      ['No ads auto-run is enabled.'],
    ),
    checklistItem(
      'meta_marketing_api',
      'token_storage',
      'Plan encrypted Meta token storage and token status display',
      'Founder/client approves token ownership model and disconnect expectations.',
      'Encrypted storage design, key-hint display model, token expiry/revoke states, and rotation notes.',
      'Browser/admin screens display only connected status and account hint.',
      'No token table/migration is added in this phase.',
      ['APP_ENCRYPTION_KEY stability remains critical when token storage is implemented.'],
    ),
    checklistItem(
      'google_ads_api',
      'account_permission',
      'Confirm Google Ads account and manager access requirements',
      'Founder/client confirms customer ID, manager account relationship, and role availability.',
      'Workspace-scoped customer/account hint, role checklist, and test account preference recorded.',
      'Grant only the minimum account access needed for the selected future control lane.',
      'Blocked until Phase 14.6 manual-approval-only executor gate exists.',
      ['Use direct Google Ads access for control; Triple Whale remains read-only.'],
    ),
    checklistItem(
      'google_ads_api',
      'oauth',
      'Plan Google Ads OAuth consent and reconnect flow',
      'Founder/client approves OAuth connection flow, disconnect behavior, and developer-token dependency.',
      'OAuth screen copy, callback domain plan, reconnect/expiry behavior, and developer-token readiness notes.',
      'Request only scopes needed for approved Google Ads operations.',
      'No Google Ads OAuth route is added in this phase.',
      ['Do not expose app credentials, token values, or provider payloads.'],
    ),
    checklistItem(
      'google_ads_api',
      'app_review',
      'Prepare Google Ads API verification and developer-token checklist',
      'Founder/client approves verification path and selected control use case.',
      'Developer-token status plan, OAuth verification notes, policy evidence, and QA proof requirements.',
      'Avoid broad account management unless required by the selected operation and approved later.',
      'No live write/control access is requested in this phase.',
      ['Do not begin ad control development before token/app review risk is documented.'],
    ),
    checklistItem(
      'google_ads_api',
      'least_privilege',
      'Define Google Ads least-privilege permission boundary',
      'Founder/client agrees to restrict first control path to a narrow manual-approved operation.',
      'Allowed future operations list, forbidden operations list, and hard-cap dependency notes.',
      'Pause/status control first where possible; budget mutation only after hard caps and snapshots.',
      'Any action outside the selected executor remains blocked.',
      ['No ads auto-run is enabled.'],
    ),
    checklistItem(
      'google_ads_api',
      'token_storage',
      'Plan encrypted Google Ads token storage and token status display',
      'Founder/client approves token ownership model and reconnect expectations.',
      'Encrypted storage design, account hint display model, expiry/revoke states, and rotation notes.',
      'Browser/admin screens display only connected status and customer/account hint.',
      'No token table/migration is added in this phase.',
      ['APP_ENCRYPTION_KEY stability remains critical when token storage is implemented.'],
    ),
  ];
}

export function buildAdsWriteScopeSharedSafetyGates(): string[] {
  return [
    'Triple Whale remains read-only performance intelligence, not an ads-control connector.',
    'No ad platform OAuth route is added until a later connector phase explicitly approves it.',
    'No ad token storage migration is added until the encrypted credential model is designed and approved.',
    'No ad API client is added in this phase.',
    'No campaign/ad set/ad group status is changed in this phase.',
    'No budget is changed in this phase.',
    'Any future ad executor must enforce manual approval first, master pause, ads category pause, emergency safe mode, hard caps, idempotency, before/after snapshots, result logs, and rollback/re-enable planning.',
  ];
}

export function buildAdsWriteScopeReport(): AdsWriteScopeChecklistReport {
  return {
    version: '0.7.0',
    phase: ADS_WRITE_SCOPE_PHASE,
    healthMode: ADS_WRITE_SCOPE_HEALTH_MODE,
    deliverable: 'ads_write_scope_checklist',
    planningOnly: true,
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.2 documents the write-scope requirements for Meta Marketing API and Google Ads API before any ads-control connector, OAuth route, token storage, or executor is built.',
    platforms: buildAdsWriteScopePlatformPlans(),
    checklist: buildAdsWriteScopeChecklist(),
    sharedSafetyGates: buildAdsWriteScopeSharedSafetyGates(),
    tokenStoragePolicy: {
      encryptedAtRestRequired: true,
      keyHintOnlyInBrowser: true,
      rawTokenReturnedToBrowser: false,
      rawTokenLogged: false,
      rotationPlanRequired: true,
      disconnectRequired: true,
    },
    safety: {
      planningOnly: true,
      noAdApiClientAdded: true,
      noOAuthRouteAdded: true,
      noTokenStorageAdded: true,
      noWriteScopeRequested: true,
      noCampaignPaused: true,
      noBudgetChanged: true,
      noAdsAutoRunEnabled: true,
      noExternalAdApiCalled: true,
      tripleWhaleReadOnlyStill: true,
      noRawTokensReturned: true,
      noRawProviderPayloadReturned: true,
      noDatabaseMigrationRequired: true,
    },
    nextStep: 'Phase 14.3 — Ads Action Types',
  };
}

export function buildAdsWriteScopeStatus(): AdsWriteScopeStatus {
  return {
    phase: 'V2 Phase 14.2 — Write Scope Planning',
    healthMode: ADS_WRITE_SCOPE_HEALTH_MODE,
    deliverable: 'ads_write_scope_checklist',
    planningOnly: true,
    platforms: ['Meta Marketing API', 'Google Ads API'],
    accountPermissionPlanned: true,
    oauthPlanned: true,
    appReviewPlanned: true,
    leastPrivilegePlanned: true,
    encryptedTokenStoragePlanned: true,
    adApiClientAdded: false,
    oauthRouteAdded: false,
    tokenStorageAdded: false,
    writeScopeRequested: false,
    campaignPaused: false,
    budgetChanged: false,
    adsAutoRunEnabled: false,
    externalAdApiCalled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.3 — Ads Action Types',
  };
}

export function assertAdsWriteScopeSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Ads write-scope output contains forbidden fragment: ${fragment}`);
    }
  }
}
