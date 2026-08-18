import { ADS_ACTION_TYPE_REGISTRY } from './ads-action-types.model.js';
import type { AdsActionType } from './ads-action-types.types.js';
import { buildAdsBudgetChangeExamplePayload, validateAdsBudgetChangePayload } from './ads-budget-change-payload.model.js';
import type { AdsBudgetChangePayloadNormalized } from './ads-budget-change-payload.types.js';
import { buildAdsHardCapsExample, buildAdsHardCapsExampleUsage, evaluateAdsHardCaps } from './ads-hard-caps.model.js';
import type { AdsHardCapsEvaluationResult } from './ads-hard-caps.types.js';
import type {
  AdsManualApprovalChecks,
  AdsManualApprovalDecision,
  AdsManualApprovalExecutorEvaluation,
  AdsManualApprovalExecutorInput,
  AdsManualApprovalExecutorReport,
  AdsManualApprovalExecutorSafety,
  AdsManualApprovalExecutorStatus,
} from './ads-manual-approval-executor.types.js';

export const ADS_MANUAL_APPROVAL_EXECUTOR_PHASE = 'phase_14_6_manual_approval_only' as const;
export const ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE = 'v2-phase-14-6-manual-approval-only' as const;
export const ADS_MANUAL_APPROVAL_EXECUTOR_PACKAGE = 'lifesaver-v0.7.0-phase-14-6-manual-approval-only.zip' as const;
export const ADS_MANUAL_APPROVAL_EXECUTOR_NAME = 'manualApprovalOnlyAdsExecutorGate' as const;

const APPROVED_STATUS = 'approved';
const VALID_MANUAL_APPROVAL_METHODS = ['founder_manual', 'admin_manual'];
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSupportedActionType(value: unknown): value is AdsActionType {
  return typeof value === 'string' && ADS_ACTION_TYPE_REGISTRY.includes(value as AdsActionType);
}

function isValidManualApprovalMethod(value: unknown): boolean {
  return typeof value === 'string' && VALID_MANUAL_APPROVAL_METHODS.includes(value);
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function buildAdsManualApprovalExecutorSafety(): AdsManualApprovalExecutorSafety {
  return {
    manualApprovalOnly: true,
    approvalGateOnly: true,
    executorShellAdded: true,
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
    noDatabaseMigrationRequired: true,
  };
}

export function buildAdsManualApprovalRequiredEvidence(): string[] {
  return [
    'action status must be approved',
    'manual approval actor must be present',
    'manual approved_at timestamp must be present',
    'manual approval event must exist in action_events',
    'approval method must be founder_manual or admin_manual',
    'auto_approved status is rejected for the first ads executor release',
  ];
}

export function buildAdsManualApprovalExecutionGates(): string[] {
  return [
    'Manual approval evidence must pass for every ads action type.',
    'Force/bypass flags are ignored and never replace approval evidence.',
    'Master pause must be off immediately before any future provider call.',
    'Ads category pause must be off immediately before any future provider call.',
    'Emergency safe mode must be off immediately before any future provider call.',
    'Budget actions must pass Phase 14.4 payload validation and Phase 14.5 hard caps.',
    'Before/after snapshots must be added in Phase 14.7 before live mutation can be attempted.',
    'Result logs must confirm success/failure before LIFE.SAVER claims execution.',
    'Idempotency and duplicate execution protection must block repeated approvals.',
    'Rollback/re-enable planning must exist before live control is attempted.',
  ];
}

export function buildAdsManualApprovalBlockedEvenIfRequested(): string[] {
  return [
    'auto-approved ads execution',
    'force=true execution bypass',
    'bulk ad changes',
    'uncapped budget mutation',
    'provider API call without manual approval event',
    'execution while master pause is active',
    'execution while ads category pause is active',
    'execution while emergency safe mode is active',
    'Meta or Google Ads API call from preview endpoints',
    'returning raw OAuth tokens or raw provider payloads to the browser',
  ];
}

export function buildAdsManualApprovalExampleInput(): AdsManualApprovalExecutorInput {
  return {
    workspace_id: '00000000-0000-4000-8000-000000000014',
    action_id: '00000000-0000-4000-8000-000000000146',
    action_type: 'adjust_budget',
    status: 'approved',
    platform: 'meta_marketing_api',
    account_id: 'act_safe_example_123',
    approval: {
      approved_by_user_id: '00000000-0000-4000-8000-000000000001',
      approved_at: '2026-07-09T12:00:00.000Z',
      approval_event_exists: true,
      approval_event_actor_id: '00000000-0000-4000-8000-000000000001',
      approval_method: 'founder_manual',
    },
    pause: {
      master_pause_active: false,
      ads_pause_active: false,
      emergency_safe_mode_active: false,
    },
    budget_payload: buildAdsBudgetChangeExamplePayload(),
    hard_caps: buildAdsHardCapsExample(),
    hard_caps_usage: buildAdsHardCapsExampleUsage(),
    force: false,
  };
}

function baseChecks(overrides: Partial<AdsManualApprovalChecks> = {}): AdsManualApprovalChecks {
  return {
    actionTypeSupported: false,
    statusApproved: false,
    autoApprovalRejected: false,
    manualApprovalActorPresent: false,
    manualApprovalTimestampPresent: false,
    manualApprovalEventPresent: false,
    manualApprovalMethodValid: false,
    forceIgnored: true,
    masterPauseOff: false,
    adsPauseOff: false,
    emergencySafeModeOff: false,
    hardCapsPresentForBudgetAction: false,
    hardCapsNotExceeded: false,
    budgetPayloadValidWhenRequired: false,
    noProviderClientLoaded: true,
    noExternalAdApiCalled: true,
    ...overrides,
  };
}

function makeEvaluation(params: {
  input: AdsManualApprovalExecutorInput;
  decision: AdsManualApprovalDecision;
  checks: AdsManualApprovalChecks;
  issues?: string[];
  warnings?: string[];
  normalizedActionType?: AdsActionType | null;
  normalizedBudgetPayload?: AdsBudgetChangePayloadNormalized | null;
  hardCapsEvaluation?: AdsHardCapsEvaluationResult | null;
}): AdsManualApprovalExecutorEvaluation {
  const ready = params.decision === 'ready_for_manual_executor_shell';
  return {
    version: '0.7.0',
    phase: ADS_MANUAL_APPROVAL_EXECUTOR_PHASE,
    healthMode: ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE,
    deliverable: 'approval_gated_ads_executor',
    executorName: ADS_MANUAL_APPROVAL_EXECUTOR_NAME,
    decision: params.decision,
    readyForFutureProviderClient: ready,
    allowedToCallProviderApiThisPhase: false,
    manualApprovalRequired: true,
    autoRunAllowed: false,
    issues: params.issues || [],
    warnings: params.warnings || [],
    checks: params.checks,
    normalizedAction: {
      workspace_id: normalizeOptionalString(params.input.workspace_id),
      action_id: normalizeOptionalString(params.input.action_id),
      action_type: params.normalizedActionType || null,
      status: typeof params.input.status === 'string' ? params.input.status : 'invalid',
      platform: normalizeOptionalString(params.input.platform),
      account_id: normalizeOptionalString(params.input.account_id),
    },
    normalizedBudgetPayload: params.normalizedBudgetPayload || null,
    hardCapsEvaluation: params.hardCapsEvaluation || null,
    statusPathPreview: ['approved', 'executing_blocked_until_provider_phase'],
    resultLogRequiredBeforeClaimingExecution: true,
    safety: buildAdsManualApprovalExecutorSafety(),
  };
}

export function evaluateAdsManualApprovalExecutorGate(input: unknown): AdsManualApprovalExecutorEvaluation {
  if (!isPlainObject(input)) {
    return makeEvaluation({
      input: { action_type: 'invalid', status: 'invalid' },
      decision: 'blocked_invalid_action_type',
      checks: baseChecks(),
      issues: ['Input must be an object containing an ads action and manual approval evidence.'],
    });
  }

  const typedInput = input as unknown as AdsManualApprovalExecutorInput;
  const actionTypeSupported = isSupportedActionType(typedInput.action_type);
  const normalizedActionType = actionTypeSupported ? typedInput.action_type as AdsActionType : null;
  const status = typeof typedInput.status === 'string' ? typedInput.status : '';
  const approval = isPlainObject(typedInput.approval) ? typedInput.approval : {};
  const pause = isPlainObject(typedInput.pause) ? typedInput.pause : {};
  const isBudgetAction = normalizedActionType === 'adjust_budget' || normalizedActionType === 'restore_budget';

  const checks = baseChecks({
    actionTypeSupported,
    statusApproved: status === APPROVED_STATUS,
    autoApprovalRejected: status !== 'auto_approved' && approval.approval_method !== 'policy_auto',
    manualApprovalActorPresent: isNonEmptyString(approval.approved_by_user_id) || isNonEmptyString(approval.approval_event_actor_id),
    manualApprovalTimestampPresent: isNonEmptyString(approval.approved_at),
    manualApprovalEventPresent: approval.approval_event_exists === true,
    manualApprovalMethodValid: isValidManualApprovalMethod(approval.approval_method),
    masterPauseOff: pause.master_pause_active !== true,
    adsPauseOff: pause.ads_pause_active !== true,
    emergencySafeModeOff: pause.emergency_safe_mode_active !== true,
    hardCapsPresentForBudgetAction: !isBudgetAction || (isPlainObject(typedInput.hard_caps) && isPlainObject(typedInput.hard_caps_usage)),
  });

  if (!checks.actionTypeSupported) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_invalid_action_type', checks, issues: ['Unsupported ads action type.'] });
  }

  if (status === 'auto_approved' || approval.approval_method === 'policy_auto') {
    return makeEvaluation({ input: typedInput, decision: 'blocked_auto_approval_not_allowed', checks, normalizedActionType, issues: ['Phase 14.6 rejects auto-approved ads actions. Manual founder/admin approval is required for every ad action.'] });
  }

  if (!checks.statusApproved) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_invalid_status', checks, normalizedActionType, issues: ['Ads action status must be approved before the first ads executor gate can continue.'] });
  }

  if (!checks.manualApprovalActorPresent || !checks.manualApprovalTimestampPresent || !checks.manualApprovalEventPresent || !checks.manualApprovalMethodValid) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_manual_approval_required', checks, normalizedActionType, issues: ['Manual approval evidence is incomplete. Required: actor, approved_at timestamp, approval event, and founder/admin manual method.'] });
  }

  if (!checks.masterPauseOff) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_master_pause_active', checks, normalizedActionType, issues: ['Master pause is active and blocks every ads action.'] });
  }

  if (!checks.adsPauseOff) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_ads_pause_active', checks, normalizedActionType, issues: ['Ads category pause is active and blocks ads execution.'] });
  }

  if (!checks.emergencySafeModeOff) {
    return makeEvaluation({ input: typedInput, decision: 'blocked_emergency_safe_mode', checks, normalizedActionType, issues: ['Emergency safe mode is active and blocks every ads action.'] });
  }

  let normalizedBudgetPayload: AdsBudgetChangePayloadNormalized | null = null;
  let hardCapsEvaluation: AdsHardCapsEvaluationResult | null = null;

  if (isBudgetAction) {
    if (!checks.hardCapsPresentForBudgetAction) {
      return makeEvaluation({ input: typedInput, decision: 'blocked_hard_caps_required', checks, normalizedActionType, issues: ['Budget-related ads actions require hard cap settings and current usage before proceeding.'] });
    }

    const budgetResult = validateAdsBudgetChangePayload(typedInput.budget_payload);
    checks.budgetPayloadValidWhenRequired = budgetResult.valid;
    normalizedBudgetPayload = budgetResult.normalizedPayload;
    if (!budgetResult.valid || !normalizedBudgetPayload) {
      return makeEvaluation({ input: typedInput, decision: 'blocked_invalid_budget_payload', checks, normalizedActionType, issues: ['Budget payload failed Phase 14.4 schema validation.', ...budgetResult.issues] });
    }

    hardCapsEvaluation = evaluateAdsHardCaps({
      caps: typedInput.hard_caps!,
      usage: typedInput.hard_caps_usage!,
      budgetPayload: typedInput.budget_payload!,
    });
    checks.hardCapsNotExceeded = hardCapsEvaluation.allowed;
    if (!hardCapsEvaluation.allowed) {
      return makeEvaluation({ input: typedInput, decision: 'blocked_by_hard_cap', checks, normalizedActionType, normalizedBudgetPayload, hardCapsEvaluation, issues: ['Phase 14.5 hard caps block this ads action.', ...hardCapsEvaluation.issues] });
    }
  } else {
    checks.budgetPayloadValidWhenRequired = true;
    checks.hardCapsNotExceeded = true;
  }

  const warnings = [];
  if (typedInput.force === true) {
    warnings.push('force=true was provided but ignored; force does not bypass manual approval, pause, emergency mode, hard caps, or future snapshots.');
  }

  return makeEvaluation({
    input: typedInput,
    decision: 'ready_for_manual_executor_shell',
    checks,
    warnings,
    normalizedActionType,
    normalizedBudgetPayload,
    hardCapsEvaluation,
  });
}

export function buildAdsManualApprovalExecutorReport(): AdsManualApprovalExecutorReport {
  const exampleInput = buildAdsManualApprovalExampleInput();
  return {
    version: '0.7.0',
    phase: ADS_MANUAL_APPROVAL_EXECUTOR_PHASE,
    healthMode: ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE,
    deliverable: 'approval_gated_ads_executor',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 14.6 adds the approval-gated ads executor shell. It enforces that every first-release ads action is manually approved by a founder/admin before a future provider client could run. It still adds no Meta or Google Ads API client and performs no real ad mutations.',
    executorName: ADS_MANUAL_APPROVAL_EXECUTOR_NAME,
    firstReleaseRule: 'every_ads_action_requires_manual_founder_or_admin_approval',
    supportedActionTypes: ADS_ACTION_TYPE_REGISTRY,
    requiredApprovalEvidence: buildAdsManualApprovalRequiredEvidence(),
    requiredExecutionGates: buildAdsManualApprovalExecutionGates(),
    blockedEvenIfRequested: buildAdsManualApprovalBlockedEvenIfRequested(),
    exampleInput,
    exampleEvaluation: evaluateAdsManualApprovalExecutorGate(exampleInput),
    safety: buildAdsManualApprovalExecutorSafety(),
    nextStep: 'Phase 14.7 — Before/After Snapshot',
  };
}

export function buildAdsManualApprovalExecutorStatus(): AdsManualApprovalExecutorStatus {
  return {
    phase: 'V2 Phase 14.6 — Manual Approval Only',
    healthMode: ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE,
    deliverable: 'approval_gated_ads_executor',
    executorName: ADS_MANUAL_APPROVAL_EXECUTOR_NAME,
    manualApprovalRequiredForEveryAdsAction: true,
    autoApprovalAccepted: false,
    forceBypassAllowed: false,
    providerApiClientAdded: false,
    externalAdApiCalled: false,
    campaignPaused: false,
    adsetPaused: false,
    budgetChanged: false,
    adsAutoRunEnabled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 14.7 — Before/After Snapshot',
  };
}

export function assertAdsManualApprovalExecutorSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Ads manual approval executor output contains forbidden fragment: ${fragment}`);
    }
  }

  const asRecord = value as Partial<AdsManualApprovalExecutorEvaluation>;
  if (asRecord.allowedToCallProviderApiThisPhase !== undefined && asRecord.allowedToCallProviderApiThisPhase !== false) {
    throw new Error('Phase 14.6 must not allow provider API calls.');
  }
  if (asRecord.autoRunAllowed !== undefined && asRecord.autoRunAllowed !== false) {
    throw new Error('Phase 14.6 must not allow ads auto-run.');
  }
}
