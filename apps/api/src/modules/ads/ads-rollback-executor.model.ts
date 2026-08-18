import { ADS_ACTION_TYPE_REGISTRY } from './ads-action-types.model.js';
import type { AdsActionType } from './ads-action-types.types.js';
import { buildAdsManualApprovalExampleInput, evaluateAdsManualApprovalExecutorGate } from './ads-manual-approval-executor.model.js';
import type { AdsManualApprovalExecutorEvaluation, AdsManualApprovalExecutorInput } from './ads-manual-approval-executor.types.js';
import type { AdsAuditSnapshotNormalized } from './ads-before-after-snapshot.types.js';
import type {
  AdsRollbackCurrentStateInput,
  AdsRollbackDecision,
  AdsRollbackExecutorChecks,
  AdsRollbackExecutorEvaluation,
  AdsRollbackExecutorInput,
  AdsRollbackExecutorReport,
  AdsRollbackExecutorSafety,
  AdsRollbackExecutorStatus,
  AdsRollbackPlan,
  AdsRollbackRequestDetailsInput,
  AdsRollbackType,
} from './ads-rollback-executor.types.js';

export const ADS_ROLLBACK_EXECUTOR_PHASE = 'phase_14_8_rollback_reenable' as const;
export const ADS_ROLLBACK_EXECUTOR_HEALTH_MODE = 'v2-phase-14-8-rollback-reenable' as const;
export const ADS_ROLLBACK_EXECUTOR_PACKAGE = 'lifesaver-v0.7.0-phase-14-8-rollback-reenable.zip' as const;
export const ADS_ROLLBACK_EXECUTOR_NAME = 'manualApprovalOnlyAdsRollbackExecutor' as const;

export const ADS_ROLLBACK_TYPES: AdsRollbackType[] = [
  'restore_previous_budget',
  'reenable_paused_adset',
  'reenable_campaign',
];

const ENABLED_STATUSES = ['active', 'enabled'];
const PAUSED_STATUSES = ['paused', 'disabled'];
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

function normalizeNumber(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
}

function normalizeStatus(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function isRollbackType(value: unknown): value is AdsRollbackType {
  return typeof value === 'string' && ADS_ROLLBACK_TYPES.includes(value as AdsRollbackType);
}

function isSupportedActionType(value: unknown): value is AdsActionType {
  return typeof value === 'string' && ADS_ACTION_TYPE_REGISTRY.includes(value as AdsActionType);
}

function hasArrayOrComma(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  return typeof value === 'string' && value.includes(',');
}

function snapshotBudget(snapshot: unknown): number | null {
  if (!isPlainObject(snapshot)) return null;
  return normalizeNumber(snapshot.budget ?? snapshot.current_budget);
}

function snapshotCampaignStatus(snapshot: unknown): string | null {
  if (!isPlainObject(snapshot)) return null;
  return normalizeStatus(snapshot.campaign_status);
}

function snapshotAdsetStatus(snapshot: unknown): string | null {
  if (!isPlainObject(snapshot)) return null;
  return normalizeStatus(snapshot.adset_status);
}

function snapshotCurrency(snapshot: unknown): string | null {
  if (!isPlainObject(snapshot)) return null;
  return normalizeOptionalString(snapshot.currency);
}

function baseChecks(overrides: Partial<AdsRollbackExecutorChecks> = {}): AdsRollbackExecutorChecks {
  return {
    manualApprovalGatePassed: false,
    rollbackTypeSupported: false,
    sourceSnapshotPresent: false,
    currentStatePresent: false,
    sourceActionReferencePresent: false,
    sourceResultOrSnapshotReferencePresent: false,
    manualRollbackRequested: false,
    singleEntityOnly: true,
    budgetRestoreValid: false,
    adsetReenableValid: false,
    campaignReenableValid: false,
    beforeAfterSnapshotLinked: false,
    noProviderClientLoaded: true,
    noExternalAdApiCalled: true,
    noBudgetRestoredThisPhase: true,
    noCampaignReenabledThisPhase: true,
    noAdsetReenabledThisPhase: true,
    noBulkRollbackSupported: true,
    ...overrides,
  };
}

export function buildAdsRollbackExecutorSafety(): AdsRollbackExecutorSafety {
  return {
    rollbackExecutorShellOnly: true,
    manualApprovalRequired: true,
    providerMutationPlanningOnly: true,
    noMetaAdsApiClientAdded: true,
    noGoogleAdsApiClientAdded: true,
    noAdOAuthRouteAdded: true,
    noAdTokenStorageAdded: true,
    noWriteScopeRequested: true,
    noBudgetRestored: true,
    noCampaignReenabled: true,
    noAdsetReenabled: true,
    noCampaignPaused: true,
    noAdsetPaused: true,
    noBudgetChanged: true,
    noAdsAutoRunEnabled: true,
    noExternalAdApiCalled: true,
    noRawTokensReturned: true,
    noRawProviderPayloadReturned: true,
    noDatabaseMigrationRequired: true,
  };
}

export function buildAdsRollbackExamples(): string[] {
  return [
    'Restore a previous campaign/adset budget from a verified before-execution snapshot.',
    'Re-enable a paused Meta ad set or Google Ads ad group only when the previous status was active/enabled.',
    'Re-enable a campaign only when the previous status was active/enabled and a linked snapshot/result exists.',
  ];
}

export function buildAdsRollbackExampleInput(): AdsRollbackExecutorInput {
  const action = buildAdsManualApprovalExampleInput();
  return {
    action,
    rollback_request: {
      rollback_type: 'restore_previous_budget',
      source_action_id: '00000000-0000-4000-8000-000000000146',
      source_action_result_id: '00000000-0000-4000-8000-000000001146',
      source_snapshot_id: '00000000-0000-4000-8000-000000002146',
      reason: 'Restore the prior safe budget after a manually approved test adjustment.',
      manual_rollback_requested: true,
      requested_by_user_id: '00000000-0000-4000-8000-000000000001',
      requested_at: '2026-07-09T13:00:00.000Z',
    },
    before_snapshot: {
      snapshot_kind: 'before_execution',
      platform: 'meta_marketing_api',
      account_id: 'act_safe_example_123',
      campaign_id: 'cmp_safe_example_123',
      adset_id: 'adset_safe_example_123',
      budget: 100,
      currency: 'USD',
      campaign_status: 'active',
      adset_status: 'active',
      timestamp: '2026-07-09T12:00:00.000Z',
      platform_data_summary: {
        summary: 'Safe summary of before state for rollback planning. No raw provider payload.',
        source: 'manual_fixture',
      },
    },
    current_state: {
      platform: 'meta_marketing_api',
      account_id: 'act_safe_example_123',
      campaign_id: 'cmp_safe_example_123',
      adset_id: 'adset_safe_example_123',
      current_budget: 125,
      currency: 'USD',
      campaign_status: 'active',
      adset_status: 'active',
      timestamp: '2026-07-09T13:00:00.000Z',
      platform_data_summary: 'Current safe state summary for rollback planning. No provider call in this phase.',
    },
    force: false,
  };
}

function makePlan(input: {
  rollbackType: AdsRollbackType;
  action: AdsManualApprovalExecutorInput;
  before: AdsAuditSnapshotNormalized | Record<string, unknown>;
  current: AdsRollbackCurrentStateInput;
}): AdsRollbackPlan {
  const previousBudget = snapshotBudget(input.before);
  const previousCampaignStatus = snapshotCampaignStatus(input.before);
  const previousAdsetStatus = snapshotAdsetStatus(input.before);
  const currency = normalizeOptionalString(input.current.currency) || snapshotCurrency(input.before);
  const plannedProviderOperation = input.rollbackType === 'restore_previous_budget'
    ? 'restore_budget'
    : input.rollbackType === 'reenable_paused_adset'
      ? 'enable_adset_or_ad_group'
      : 'enable_campaign';

  return {
    rollback_type: input.rollbackType,
    executor_name: ADS_ROLLBACK_EXECUTOR_NAME,
    target: {
      platform: normalizeOptionalString(input.action.platform) || normalizeOptionalString(input.current.platform),
      account_id: normalizeOptionalString(input.action.account_id) || normalizeOptionalString(input.current.account_id),
      campaign_id: normalizeOptionalString(input.current.campaign_id) || normalizeOptionalString((input.before as Record<string, unknown>).campaign_id),
      adset_id: normalizeOptionalString(input.current.adset_id) || normalizeOptionalString((input.before as Record<string, unknown>).adset_id),
    },
    planned_provider_operation: plannedProviderOperation,
    planned_safe_restore_value: {
      previous_budget: previousBudget,
      previous_campaign_status: previousCampaignStatus,
      previous_adset_status: previousAdsetStatus,
      currency,
    },
    requiredStorage: {
      actionEvents: ['rollback_requested', 'rollback_started', 'rollback_finished_or_failed'],
      actionResults: 'rollback result row with result_status rollback_success or rollback_failed',
      adsActionSnapshots: 'before rollback and after rollback snapshots must link to action_results when provider phase exists',
    },
  };
}

function makeEvaluation(params: {
  input: AdsRollbackExecutorInput;
  decision: AdsRollbackDecision;
  checks: AdsRollbackExecutorChecks;
  issues?: string[];
  warnings?: string[];
  manualApprovalEvaluation?: AdsManualApprovalExecutorEvaluation | null;
  rollbackPlan?: AdsRollbackPlan | null;
}): AdsRollbackExecutorEvaluation {
  const action = params.input.action || ({} as AdsManualApprovalExecutorInput);
  const ready = params.decision === 'rollback_ready_for_executor_shell';
  return {
    version: '0.7.0',
    phase: ADS_ROLLBACK_EXECUTOR_PHASE,
    healthMode: ADS_ROLLBACK_EXECUTOR_HEALTH_MODE,
    deliverable: 'ads_rollback_executor',
    decision: params.decision,
    readyForFutureProviderRollbackExecutor: ready,
    allowedToCallProviderApiThisPhase: false,
    allowedToMutateAdsThisPhase: false,
    manualApprovalRequired: true,
    autoRunAllowed: false,
    issues: params.issues || [],
    warnings: params.warnings || [],
    checks: params.checks,
    manualApprovalEvaluation: params.manualApprovalEvaluation || null,
    normalizedAction: {
      workspace_id: normalizeOptionalString(action.workspace_id),
      action_id: normalizeOptionalString(action.action_id),
      action_type: isSupportedActionType(action.action_type) ? action.action_type : null,
      platform: normalizeOptionalString(action.platform),
      account_id: normalizeOptionalString(action.account_id),
    },
    rollbackPlan: params.rollbackPlan || null,
    statusPathPreview: ['executed', 'rollback_requested', 'rollback_ready', 'executing_blocked_until_provider_phase'],
    safety: buildAdsRollbackExecutorSafety(),
  };
}

export function evaluateAdsRollbackExecutor(input: unknown): AdsRollbackExecutorEvaluation {
  if (!isPlainObject(input)) {
    return makeEvaluation({
      input: {},
      decision: 'blocked_invalid_input',
      checks: baseChecks(),
      issues: ['Input must be an object containing action, rollback_request, before_snapshot, and current_state.'],
    });
  }

  const typedInput = input as AdsRollbackExecutorInput;
  const action = isPlainObject(typedInput.action) ? typedInput.action as AdsManualApprovalExecutorInput : null;
  if (!action) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_manual_approval_gate_failed',
      checks: baseChecks(),
      issues: ['action is required so the Phase 14.6 manual approval gate can be evaluated before rollback planning.'],
    });
  }

  const manualApprovalEvaluation = evaluateAdsManualApprovalExecutorGate(action);
  const manualApprovalGatePassed = manualApprovalEvaluation.decision === 'ready_for_manual_executor_shell';
  if (!manualApprovalGatePassed) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_manual_approval_gate_failed',
      checks: baseChecks({ manualApprovalGatePassed }),
      issues: ['Phase 14.6 manual approval gate did not pass. Ads rollback/re-enable cannot proceed.', ...manualApprovalEvaluation.issues],
      manualApprovalEvaluation,
    });
  }

  const request = isPlainObject(typedInput.rollback_request) ? typedInput.rollback_request as AdsRollbackRequestDetailsInput : null;
  const rollbackType = request?.rollback_type;
  const rollbackTypeSupported = isRollbackType(rollbackType);
  if (!rollbackTypeSupported) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_invalid_rollback_type',
      checks: baseChecks({ manualApprovalGatePassed, rollbackTypeSupported: false }),
      issues: ['rollback_request.rollback_type must be one of: restore_previous_budget, reenable_paused_adset, reenable_campaign.'],
      manualApprovalEvaluation,
    });
  }

  const before = isPlainObject(typedInput.before_snapshot) ? typedInput.before_snapshot as AdsAuditSnapshotNormalized | Record<string, unknown> : null;
  if (!before) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_missing_source_snapshot',
      checks: baseChecks({ manualApprovalGatePassed, rollbackTypeSupported, sourceSnapshotPresent: false }),
      issues: ['before_snapshot is required. Rollback must be based on a verified Phase 14.7 before-execution snapshot.'],
      manualApprovalEvaluation,
    });
  }

  const current = isPlainObject(typedInput.current_state) ? typedInput.current_state as AdsRollbackCurrentStateInput : null;
  if (!current) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_missing_current_state',
      checks: baseChecks({ manualApprovalGatePassed, rollbackTypeSupported, sourceSnapshotPresent: true, currentStatePresent: false }),
      issues: ['current_state is required. Rollback must compare current known state with the source snapshot.'],
      manualApprovalEvaluation,
    });
  }

  const singleEntityOnly = ![
    action.account_id,
    action.platform,
    current.account_id,
    current.campaign_id,
    current.adset_id,
    (before as Record<string, unknown>).account_id,
    (before as Record<string, unknown>).campaign_id,
    (before as Record<string, unknown>).adset_id,
  ].some(hasArrayOrComma);

  if (!singleEntityOnly) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_bulk_or_multi_entity_request',
      checks: baseChecks({ manualApprovalGatePassed, rollbackTypeSupported, sourceSnapshotPresent: true, currentStatePresent: true, singleEntityOnly }),
      issues: ['Bulk or multi-entity rollback/re-enable is blocked. Phase 14.8 supports one action/entity at a time only.'],
      manualApprovalEvaluation,
    });
  }

  const sourceActionReferencePresent = Boolean(normalizeOptionalString(request?.source_action_id));
  const sourceResultOrSnapshotReferencePresent = Boolean(normalizeOptionalString(request?.source_action_result_id) || normalizeOptionalString(request?.source_snapshot_id));
  const manualRollbackRequested = request?.manual_rollback_requested === true && Boolean(normalizeOptionalString(request.requested_by_user_id));
  const beforeAfterSnapshotLinked = sourceActionReferencePresent && sourceResultOrSnapshotReferencePresent;
  const base = baseChecks({
    manualApprovalGatePassed,
    rollbackTypeSupported,
    sourceSnapshotPresent: true,
    currentStatePresent: true,
    sourceActionReferencePresent,
    sourceResultOrSnapshotReferencePresent,
    manualRollbackRequested,
    singleEntityOnly,
    beforeAfterSnapshotLinked,
  });

  if (!beforeAfterSnapshotLinked || !manualRollbackRequested) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_missing_source_snapshot',
      checks: base,
      issues: [
        ...(!sourceActionReferencePresent ? ['rollback_request.source_action_id is required.'] : []),
        ...(!sourceResultOrSnapshotReferencePresent ? ['rollback_request.source_action_result_id or source_snapshot_id is required.'] : []),
        ...(!manualRollbackRequested ? ['manual rollback request evidence is required.'] : []),
      ],
      manualApprovalEvaluation,
    });
  }

  const previousBudget = snapshotBudget(before);
  const currentBudget = normalizeNumber(current.current_budget);
  const previousCampaignStatus = snapshotCampaignStatus(before);
  const currentCampaignStatus = normalizeStatus(current.campaign_status);
  const previousAdsetStatus = snapshotAdsetStatus(before);
  const currentAdsetStatus = normalizeStatus(current.adset_status);

  const budgetRestoreValid = rollbackType === 'restore_previous_budget' && previousBudget !== null && currentBudget !== null && previousBudget !== currentBudget;
  const adsetReenableValid = rollbackType === 'reenable_paused_adset'
    && Boolean(normalizeOptionalString(current.adset_id) || normalizeOptionalString((before as Record<string, unknown>).adset_id))
    && Boolean(previousAdsetStatus && ENABLED_STATUSES.includes(previousAdsetStatus))
    && Boolean(currentAdsetStatus && PAUSED_STATUSES.includes(currentAdsetStatus));
  const campaignReenableValid = rollbackType === 'reenable_campaign'
    && Boolean(normalizeOptionalString(current.campaign_id) || normalizeOptionalString((before as Record<string, unknown>).campaign_id))
    && Boolean(previousCampaignStatus && ENABLED_STATUSES.includes(previousCampaignStatus))
    && Boolean(currentCampaignStatus && PAUSED_STATUSES.includes(currentCampaignStatus));

  const checks = baseChecks({
    ...base,
    budgetRestoreValid,
    adsetReenableValid,
    campaignReenableValid,
  });

  if (rollbackType === 'restore_previous_budget' && !budgetRestoreValid) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_invalid_budget_restore',
      checks,
      issues: ['Budget restore requires previous snapshot budget, current budget, and different values to restore.'],
      manualApprovalEvaluation,
    });
  }

  if (rollbackType === 'reenable_paused_adset' && !adsetReenableValid) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_invalid_adset_reenable',
      checks,
      issues: ['Adset/ad-group re-enable requires a target adset_id, previous active/enabled status, and current paused/disabled status.'],
      manualApprovalEvaluation,
    });
  }

  if (rollbackType === 'reenable_campaign' && !campaignReenableValid) {
    return makeEvaluation({
      input: typedInput,
      decision: 'blocked_invalid_campaign_reenable',
      checks,
      issues: ['Campaign re-enable requires a target campaign_id, previous active/enabled status, and current paused/disabled status.'],
      manualApprovalEvaluation,
    });
  }

  const warnings = [];
  if (typedInput.force === true) warnings.push('force=true was ignored. Force cannot bypass manual approval, snapshots, source links, hard caps, pause checks, result logs, or rollback safeguards.');

  return makeEvaluation({
    input: typedInput,
    decision: 'rollback_ready_for_executor_shell',
    checks,
    warnings,
    manualApprovalEvaluation,
    rollbackPlan: makePlan({ rollbackType, action, before, current }),
  });
}

export function buildAdsRollbackExecutorReport(): AdsRollbackExecutorReport {
  const exampleInput = buildAdsRollbackExampleInput();
  return {
    version: '0.7.0',
    phase: ADS_ROLLBACK_EXECUTOR_PHASE,
    healthMode: ADS_ROLLBACK_EXECUTOR_HEALTH_MODE,
    deliverable: 'ads_rollback_executor',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.8 adds the approval-gated ads rollback/re-enable executor shell. It defines safe rollback plans for restoring a previous budget, re-enabling a paused ad set/ad group, and re-enabling a campaign from verified snapshots. This phase still adds no Meta/Google API client and performs no live ad mutation.',
    supportedRollbackTypes: ADS_ROLLBACK_TYPES,
    rollbackExamples: buildAdsRollbackExamples(),
    exampleInput,
    exampleEvaluation: evaluateAdsRollbackExecutor(exampleInput),
    safety: buildAdsRollbackExecutorSafety(),
    nextStep: 'Phase 14.9 — Auto-Run Below Threshold Later',
  };
}

export function buildAdsRollbackExecutorStatus(): AdsRollbackExecutorStatus {
  return {
    phase: 'V2 Phase 14.8 — Rollback/Re-Enable',
    healthMode: ADS_ROLLBACK_EXECUTOR_HEALTH_MODE,
    deliverable: 'ads_rollback_executor',
    rollbackExecutorShellAdded: true,
    providerApiClientAdded: false,
    externalAdApiCalled: false,
    budgetRestored: false,
    campaignReenabled: false,
    adsetReenabled: false,
    adsAutoRunEnabled: false,
    manualApprovalRequired: true,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.9 — Auto-Run Below Threshold Later',
  };
}

export function assertAdsRollbackExecutorSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Ads rollback executor output contains forbidden fragment: ${fragment}`);
    }
  }

  const asRecord = value as Partial<AdsRollbackExecutorEvaluation>;
  if (asRecord.allowedToCallProviderApiThisPhase !== undefined && asRecord.allowedToCallProviderApiThisPhase !== false) {
    throw new Error('Phase 14.8 must not allow provider API calls.');
  }
  if (asRecord.allowedToMutateAdsThisPhase !== undefined && asRecord.allowedToMutateAdsThisPhase !== false) {
    throw new Error('Phase 14.8 must not allow ads mutation.');
  }
  if (asRecord.autoRunAllowed !== undefined && asRecord.autoRunAllowed !== false) {
    throw new Error('Phase 14.8 must not allow ads auto-run.');
  }
}
