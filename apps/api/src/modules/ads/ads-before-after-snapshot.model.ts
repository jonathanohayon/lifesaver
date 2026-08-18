import { ADS_ACTION_TYPE_REGISTRY } from './ads-action-types.model.js';
import type { AdsActionType } from './ads-action-types.types.js';
import { buildAdsManualApprovalExampleInput, evaluateAdsManualApprovalExecutorGate } from './ads-manual-approval-executor.model.js';
import type { AdsManualApprovalExecutorEvaluation, AdsManualApprovalExecutorInput } from './ads-manual-approval-executor.types.js';
import type {
  AdsAfterSnapshotPreviewInput,
  AdsAuditSnapshotNormalized,
  AdsBeforeAfterSnapshotChecks,
  AdsBeforeAfterSnapshotEvaluation,
  AdsBeforeAfterSnapshotInput,
  AdsBeforeAfterSnapshotReport,
  AdsBeforeAfterSnapshotSafety,
  AdsBeforeAfterSnapshotStatus,
  AdsBeforeSnapshotInput,
  AdsSnapshotDecision,
} from './ads-before-after-snapshot.types.js';

export const ADS_BEFORE_AFTER_SNAPSHOT_PHASE = 'phase_14_7_before_after_snapshot' as const;
export const ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE = 'v2-phase-14-7-before-after-snapshot' as const;
export const ADS_BEFORE_AFTER_SNAPSHOT_PACKAGE = 'lifesaver-v0.7.0-phase-14-7-before-after-snapshot.zip' as const;
export const ADS_ACTION_SNAPSHOTS_MIGRATION = 'database/migrations/023_create_ads_action_snapshots.sql' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'client_secret=',
  'client_secret:',
  'refresh_token=',
  'refresh_token:',
  'authorization: bearer',
  'bearer ',
  'raw_token',
  'access_token',
  'private_key',
  'ya29.',
  'eaab',
  'provider_raw_response',
  'raw_provider_payload',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRequiredString(value: unknown): string | null {
  return normalizeOptionalString(value);
}

function normalizeCurrency(value: unknown): string {
  const raw = typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : 'USD';
  return raw;
}

function normalizeNumber(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summarizePlatformDataSummary(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return { summary: value.trim().slice(0, 500) };
  }

  if (!isPlainObject(value)) return null;

  const allowedKeys = [
    'summary',
    'source',
    'campaign_name_hint',
    'adset_name_hint',
    'objective',
    'optimization_goal',
    'last_synced_at',
    'provider_status_hint',
  ];
  const safeSummary: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    const current = value[key];
    if (typeof current === 'string') safeSummary[key] = current.slice(0, 500);
    if (typeof current === 'number' && Number.isFinite(current)) safeSummary[key] = current;
    if (typeof current === 'boolean') safeSummary[key] = current;
  }

  return Object.keys(safeSummary).length > 0 ? safeSummary : null;
}

function baseChecks(overrides: Partial<AdsBeforeAfterSnapshotChecks> = {}): AdsBeforeAfterSnapshotChecks {
  return {
    manualApprovalGatePassed: false,
    beforeSnapshotPresent: false,
    currentBudgetValid: false,
    campaignStatusPresent: false,
    timestampValid: false,
    platformSummaryPresent: false,
    rawProviderPayloadRedacted: true,
    noProviderApiCalled: true,
    noBudgetMutated: true,
    noCampaignPaused: true,
    noAdsetPaused: true,
    noDatabaseWriteFromPreview: true,
    ...overrides,
  };
}

export function buildAdsBeforeAfterSnapshotSafety(): AdsBeforeAfterSnapshotSafety {
  return {
    auditSnapshotOnly: true,
    providerReadPlanningOnly: true,
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
    noRawTokensReturned: true,
    noRawProviderPayloadReturned: true,
    migrationAddedButNotRunAutomatically: true,
  };
}

export function buildAdsSnapshotRequiredBeforeExecutionFields(): string[] {
  return [
    'current_budget',
    'campaign_status',
    'adset_status',
    'timestamp',
    'platform_data_summary',
  ];
}

export function buildAdsBeforeAfterSnapshotExampleInput(): AdsBeforeAfterSnapshotInput {
  const action = buildAdsManualApprovalExampleInput();
  return {
    action,
    before_snapshot: {
      snapshot_source: 'manual_fixture',
      platform: 'meta_marketing_api',
      account_id: 'act_safe_example_123',
      campaign_id: 'campaign_safe_example_456',
      adset_id: 'adset_safe_example_789',
      current_budget: 100,
      currency: 'USD',
      campaign_status: 'active',
      adset_status: 'active',
      timestamp: '2026-07-09T12:00:00.000Z',
      platform_data_summary: {
        summary: 'Safe fixture summary only. Future provider reads must be summarized before storage.',
        source: 'manual_fixture',
        campaign_name_hint: 'Prospecting — safe example',
        adset_name_hint: 'Broad — safe example',
        objective: 'sales',
        provider_status_hint: 'active',
      },
    },
    after_snapshot_preview: {
      proposed_budget: 110,
      proposed_campaign_status: 'active',
      proposed_adset_status: 'active',
      reason: 'Preview expected state after a future approved budget adjustment.',
    },
    persist_now: false,
    force: false,
  };
}

function normalizeBeforeSnapshot(input: AdsBeforeSnapshotInput): { snapshot: AdsAuditSnapshotNormalized | null; issues: string[]; checks: Partial<AdsBeforeAfterSnapshotChecks> } {
  const issues: string[] = [];
  const platform = normalizeRequiredString(input.platform);
  const accountId = normalizeRequiredString(input.account_id);
  const currentBudget = normalizeNumber(input.current_budget);
  const campaignStatus = normalizeRequiredString(input.campaign_status);
  const timestamp = normalizeTimestamp(input.timestamp);
  const platformSummary = summarizePlatformDataSummary(input.platform_data_summary);

  if (!platform) issues.push('before_snapshot.platform is required.');
  if (!accountId) issues.push('before_snapshot.account_id is required.');
  if (currentBudget === null) issues.push('before_snapshot.current_budget must be a non-negative number.');
  if (!campaignStatus) issues.push('before_snapshot.campaign_status is required.');
  if (!timestamp) issues.push('before_snapshot.timestamp must be a valid ISO date/time.');
  if (!platformSummary) issues.push('before_snapshot.platform_data_summary is required and must be a safe summary object or string.');

  if (issues.length > 0 || !platform || !accountId || currentBudget === null || !campaignStatus || !timestamp || !platformSummary) {
    return {
      snapshot: null,
      issues,
      checks: {
        currentBudgetValid: currentBudget !== null,
        campaignStatusPresent: Boolean(campaignStatus),
        timestampValid: Boolean(timestamp),
        platformSummaryPresent: Boolean(platformSummary),
      },
    };
  }

  return {
    snapshot: {
      snapshot_kind: 'before_execution',
      platform,
      account_id: accountId,
      campaign_id: normalizeOptionalString(input.campaign_id),
      adset_id: normalizeOptionalString(input.adset_id),
      budget: currentBudget,
      currency: normalizeCurrency(input.currency),
      campaign_status: campaignStatus,
      adset_status: normalizeOptionalString(input.adset_status),
      timestamp,
      platform_data_summary: platformSummary,
    },
    issues: [],
    checks: {
      currentBudgetValid: true,
      campaignStatusPresent: true,
      timestampValid: true,
      platformSummaryPresent: true,
    },
  };
}

function normalizeAfterPreview(before: AdsAuditSnapshotNormalized, preview: AdsAfterSnapshotPreviewInput | undefined): AdsAuditSnapshotNormalized {
  return {
    snapshot_kind: 'after_execution_preview',
    platform: before.platform,
    account_id: before.account_id,
    campaign_id: before.campaign_id,
    adset_id: before.adset_id,
    budget: normalizeNumber(preview?.proposed_budget) ?? before.budget,
    currency: before.currency,
    campaign_status: normalizeOptionalString(preview?.proposed_campaign_status) || before.campaign_status,
    adset_status: normalizeOptionalString(preview?.proposed_adset_status) || before.adset_status,
    timestamp: before.timestamp,
    platform_data_summary: {
      summary: normalizeOptionalString(preview?.reason) || 'After-state preview for future executor audit trail. Not a provider response.',
      source: 'after_snapshot_preview',
    },
  };
}

function makeEvaluation(params: {
  input: AdsBeforeAfterSnapshotInput;
  decision: AdsSnapshotDecision;
  checks: AdsBeforeAfterSnapshotChecks;
  issues?: string[];
  warnings?: string[];
  beforeSnapshot?: AdsAuditSnapshotNormalized | null;
  afterSnapshotPreview?: AdsAuditSnapshotNormalized | null;
  manualApprovalEvaluation?: AdsManualApprovalExecutorEvaluation | null;
}): AdsBeforeAfterSnapshotEvaluation {
  const action = params.input.action || ({} as AdsManualApprovalExecutorInput);
  const ready = params.decision === 'snapshot_ready_for_audit_storage';
  const manual = params.manualApprovalEvaluation || null;
  return {
    version: '0.7.0',
    phase: ADS_BEFORE_AFTER_SNAPSHOT_PHASE,
    healthMode: ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE,
    deliverable: 'before_after_audit_snapshot',
    decision: params.decision,
    readyForFutureExecutorAuditStorage: ready,
    allowedToCallProviderApiThisPhase: false,
    allowedToMutateAdsThisPhase: false,
    manualApprovalRequired: true,
    autoRunAllowed: false,
    issues: params.issues || [],
    warnings: params.warnings || [],
    checks: params.checks,
    manualApprovalEvaluation: manual,
    normalizedAction: {
      workspace_id: normalizeOptionalString(action.workspace_id),
      action_id: normalizeOptionalString(action.action_id),
      action_type: ADS_ACTION_TYPE_REGISTRY.includes(action.action_type as AdsActionType) ? action.action_type as AdsActionType : null,
      platform: normalizeOptionalString(action.platform),
      account_id: normalizeOptionalString(action.account_id),
    },
    beforeSnapshot: params.beforeSnapshot || null,
    afterSnapshotPreview: params.afterSnapshotPreview || null,
    recommendedStorage: {
      table: 'ads_action_snapshots',
      beforeSnapshotRequiredBeforeFutureMutation: true,
      afterSnapshotRequiredAfterFutureMutation: true,
      linkToActionResults: true,
      linkToActionEvents: true,
    },
    statusPathPreview: ['approved', 'snapshot_recorded', 'executing_blocked_until_provider_phase'],
    safety: buildAdsBeforeAfterSnapshotSafety(),
  };
}

export function evaluateAdsBeforeAfterSnapshot(input: unknown): AdsBeforeAfterSnapshotEvaluation {
  if (!isPlainObject(input)) {
    return makeEvaluation({
      input: {},
      decision: 'blocked_invalid_input',
      checks: baseChecks(),
      issues: ['Input must be an object containing action and before_snapshot data.'],
    });
  }

  const typedInput = input as AdsBeforeAfterSnapshotInput;
  const action = isPlainObject(typedInput.action) ? typedInput.action as AdsManualApprovalExecutorInput : null;
  if (!action) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_manual_approval_gate_failed',
      checks: baseChecks(),
      issues: ['action is required so the Phase 14.6 manual approval gate can be evaluated before snapshot storage.'],
    });
  }

  const manualApprovalEvaluation = evaluateAdsManualApprovalExecutorGate(action);
  const manualApprovalGatePassed = manualApprovalEvaluation.decision === 'ready_for_manual_executor_shell';
  if (!manualApprovalGatePassed) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_manual_approval_gate_failed',
      checks: baseChecks({ manualApprovalGatePassed }),
      issues: ['Phase 14.6 manual approval gate did not pass. Before/after snapshot storage cannot proceed for this action.', ...manualApprovalEvaluation.issues],
      manualApprovalEvaluation,
    });
  }

  if (!isPlainObject(typedInput.before_snapshot)) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_missing_before_snapshot',
      checks: baseChecks({ manualApprovalGatePassed, beforeSnapshotPresent: false }),
      issues: ['before_snapshot is required before any future ads execution can continue.'],
      manualApprovalEvaluation,
    });
  }

  const normalizedBefore = normalizeBeforeSnapshot(typedInput.before_snapshot as AdsBeforeSnapshotInput);
  const checks = baseChecks({
    manualApprovalGatePassed,
    beforeSnapshotPresent: true,
    ...normalizedBefore.checks,
  });

  if (!checks.currentBudgetValid) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_invalid_budget', checks, issues: normalizedBefore.issues, manualApprovalEvaluation });
  }

  if (!checks.campaignStatusPresent) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_invalid_status', checks, issues: normalizedBefore.issues, manualApprovalEvaluation });
  }

  if (!checks.platformSummaryPresent || !normalizedBefore.snapshot) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_missing_platform_summary', checks, issues: normalizedBefore.issues, manualApprovalEvaluation });
  }

  const afterPreview = normalizeAfterPreview(normalizedBefore.snapshot, typedInput.after_snapshot_preview);
  const warnings = [];
  if (typedInput.force === true) warnings.push('force=true was ignored. Force cannot bypass manual approval, caps, pause, snapshots, logs, or rollback planning.');
  if (typedInput.persist_now === true) warnings.push('persist_now=true was requested but preview endpoints do not write to the database; use the future repository path after migration is intentionally applied.');

  return makeEvaluation({
    input: typedInput,
    decision: 'snapshot_ready_for_audit_storage',
    checks,
    warnings,
    beforeSnapshot: normalizedBefore.snapshot,
    afterSnapshotPreview: afterPreview,
    manualApprovalEvaluation,
  });
}

export function buildAdsBeforeAfterSnapshotReport(): AdsBeforeAfterSnapshotReport {
  const exampleInput = buildAdsBeforeAfterSnapshotExampleInput();
  return {
    version: '0.7.0',
    phase: ADS_BEFORE_AFTER_SNAPSHOT_PHASE,
    healthMode: ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE,
    deliverable: 'before_after_audit_snapshot',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.7 adds the before/after ads audit snapshot contract and additive database migration. Future ads execution must record the current budget, campaign status, adset status, timestamp, and safe platform data summary before mutation. This package still performs no ad API calls and no budget/campaign mutations.',
    requiredBeforeExecutionFields: buildAdsSnapshotRequiredBeforeExecutionFields(),
    supportedActionTypes: ADS_ACTION_TYPE_REGISTRY,
    storageTable: 'ads_action_snapshots',
    migrationFile: ADS_ACTION_SNAPSHOTS_MIGRATION,
    exampleInput,
    exampleEvaluation: evaluateAdsBeforeAfterSnapshot(exampleInput),
    safety: buildAdsBeforeAfterSnapshotSafety(),
    nextStep: 'Phase 14.8 — Rollback/Re-Enable',
  };
}

export function buildAdsBeforeAfterSnapshotStatus(): AdsBeforeAfterSnapshotStatus {
  return {
    phase: 'V2 Phase 14.7 — Before/After Snapshot',
    healthMode: ADS_BEFORE_AFTER_SNAPSHOT_HEALTH_MODE,
    deliverable: 'before_after_audit_snapshot',
    beforeSnapshotRequiredBeforeFutureMutation: true,
    afterSnapshotRequiredAfterFutureMutation: true,
    providerApiClientAdded: false,
    externalAdApiCalled: false,
    campaignPaused: false,
    adsetPaused: false,
    budgetChanged: false,
    adsAutoRunEnabled: false,
    migrationAddedButNotRunAutomatically: true,
    nextStep: 'Phase 14.8 — Rollback/Re-Enable',
  };
}

export function assertAdsBeforeAfterSnapshotSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Ads before/after snapshot output contains forbidden fragment: ${fragment}`);
    }
  }

  const asRecord = value as Partial<AdsBeforeAfterSnapshotEvaluation>;
  if (asRecord.allowedToCallProviderApiThisPhase !== undefined && asRecord.allowedToCallProviderApiThisPhase !== false) {
    throw new Error('Phase 14.7 must not allow provider API calls.');
  }
  if (asRecord.allowedToMutateAdsThisPhase !== undefined && asRecord.allowedToMutateAdsThisPhase !== false) {
    throw new Error('Phase 14.7 must not allow ads mutation.');
  }
  if (asRecord.autoRunAllowed !== undefined && asRecord.autoRunAllowed !== false) {
    throw new Error('Phase 14.7 must not allow ads auto-run.');
  }
}
