import type { AdsActionType } from './ads-action-types.types.js';
import type { AdsManualApprovalExecutorInput, AdsManualApprovalExecutorEvaluation } from './ads-manual-approval-executor.types.js';
import type { AdsAuditSnapshotNormalized } from './ads-before-after-snapshot.types.js';

export type AdsRollbackType = 'restore_previous_budget' | 'reenable_paused_adset' | 'reenable_campaign';
export type AdsRollbackDecision =
  | 'rollback_ready_for_executor_shell'
  | 'blocked_invalid_input'
  | 'blocked_manual_approval_gate_failed'
  | 'blocked_invalid_rollback_type'
  | 'blocked_missing_source_snapshot'
  | 'blocked_missing_current_state'
  | 'blocked_invalid_budget_restore'
  | 'blocked_invalid_adset_reenable'
  | 'blocked_invalid_campaign_reenable'
  | 'blocked_bulk_or_multi_entity_request'
  | 'blocked_unsafe_rollback_output';

export interface AdsRollbackCurrentStateInput {
  platform?: string | null;
  account_id?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  current_budget?: number | string | null;
  currency?: string | null;
  campaign_status?: string | null;
  adset_status?: string | null;
  timestamp?: string | null;
  platform_data_summary?: string | Record<string, unknown> | null;
}

export interface AdsRollbackRequestDetailsInput {
  rollback_type: AdsRollbackType | string;
  source_action_id?: string | null;
  source_action_result_id?: string | null;
  source_snapshot_id?: string | null;
  reason?: string | null;
  manual_rollback_requested?: boolean;
  requested_by_user_id?: string | null;
  requested_at?: string | null;
}

export interface AdsRollbackExecutorInput {
  action?: AdsManualApprovalExecutorInput;
  rollback_request?: AdsRollbackRequestDetailsInput;
  before_snapshot?: AdsAuditSnapshotNormalized | Record<string, unknown> | null;
  current_state?: AdsRollbackCurrentStateInput | null;
  force?: boolean;
}

export interface AdsRollbackExecutorChecks {
  manualApprovalGatePassed: boolean;
  rollbackTypeSupported: boolean;
  sourceSnapshotPresent: boolean;
  currentStatePresent: boolean;
  sourceActionReferencePresent: boolean;
  sourceResultOrSnapshotReferencePresent: boolean;
  manualRollbackRequested: boolean;
  singleEntityOnly: boolean;
  budgetRestoreValid: boolean;
  adsetReenableValid: boolean;
  campaignReenableValid: boolean;
  beforeAfterSnapshotLinked: boolean;
  noProviderClientLoaded: true;
  noExternalAdApiCalled: true;
  noBudgetRestoredThisPhase: true;
  noCampaignReenabledThisPhase: true;
  noAdsetReenabledThisPhase: true;
  noBulkRollbackSupported: true;
}

export interface AdsRollbackExecutorSafety {
  rollbackExecutorShellOnly: true;
  manualApprovalRequired: true;
  providerMutationPlanningOnly: true;
  noMetaAdsApiClientAdded: true;
  noGoogleAdsApiClientAdded: true;
  noAdOAuthRouteAdded: true;
  noAdTokenStorageAdded: true;
  noWriteScopeRequested: true;
  noBudgetRestored: true;
  noCampaignReenabled: true;
  noAdsetReenabled: true;
  noCampaignPaused: true;
  noAdsetPaused: true;
  noBudgetChanged: true;
  noAdsAutoRunEnabled: true;
  noExternalAdApiCalled: true;
  noRawTokensReturned: true;
  noRawProviderPayloadReturned: true;
  noDatabaseMigrationRequired: true;
}

export interface AdsRollbackPlan {
  rollback_type: AdsRollbackType;
  executor_name: 'manualApprovalOnlyAdsRollbackExecutor';
  target: {
    platform: string | null;
    account_id: string | null;
    campaign_id: string | null;
    adset_id: string | null;
  };
  planned_provider_operation: 'restore_budget' | 'enable_adset_or_ad_group' | 'enable_campaign';
  planned_safe_restore_value: {
    previous_budget: number | null;
    previous_campaign_status: string | null;
    previous_adset_status: string | null;
    currency: string | null;
  };
  requiredStorage: {
    actionEvents: ['rollback_requested', 'rollback_started', 'rollback_finished_or_failed'];
    actionResults: 'rollback result row with result_status rollback_success or rollback_failed';
    adsActionSnapshots: 'before rollback and after rollback snapshots must link to action_results when provider phase exists';
  };
}

export interface AdsRollbackExecutorEvaluation {
  version: '0.7.0';
  phase: 'phase_14_8_rollback_reenable';
  healthMode: 'v2-phase-14-8-rollback-reenable';
  deliverable: 'ads_rollback_executor';
  decision: AdsRollbackDecision;
  readyForFutureProviderRollbackExecutor: boolean;
  allowedToCallProviderApiThisPhase: false;
  allowedToMutateAdsThisPhase: false;
  manualApprovalRequired: true;
  autoRunAllowed: false;
  issues: string[];
  warnings: string[];
  checks: AdsRollbackExecutorChecks;
  manualApprovalEvaluation: AdsManualApprovalExecutorEvaluation | null;
  normalizedAction: {
    workspace_id: string | null;
    action_id: string | null;
    action_type: AdsActionType | null;
    platform: string | null;
    account_id: string | null;
  };
  rollbackPlan: AdsRollbackPlan | null;
  statusPathPreview: ['executed', 'rollback_requested', 'rollback_ready', 'executing_blocked_until_provider_phase'];
  safety: AdsRollbackExecutorSafety;
}

export interface AdsRollbackExecutorReport {
  version: '0.7.0';
  phase: 'phase_14_8_rollback_reenable';
  healthMode: 'v2-phase-14-8-rollback-reenable';
  deliverable: 'ads_rollback_executor';
  generatedAt: string;
  executiveSummary: string;
  supportedRollbackTypes: AdsRollbackType[];
  rollbackExamples: string[];
  exampleInput: AdsRollbackExecutorInput;
  exampleEvaluation: AdsRollbackExecutorEvaluation;
  safety: AdsRollbackExecutorSafety;
  nextStep: 'Phase 14.9 — Auto-Run Below Threshold Later';
}

export interface AdsRollbackExecutorStatus {
  phase: 'V2 Phase 14.8 — Rollback/Re-Enable';
  healthMode: 'v2-phase-14-8-rollback-reenable';
  deliverable: 'ads_rollback_executor';
  rollbackExecutorShellAdded: true;
  providerApiClientAdded: false;
  externalAdApiCalled: false;
  budgetRestored: false;
  campaignReenabled: false;
  adsetReenabled: false;
  adsAutoRunEnabled: false;
  manualApprovalRequired: true;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.9 — Auto-Run Below Threshold Later';
}
