import type { AdsActionType } from './ads-action-types.types.js';
import type { AdsManualApprovalExecutorInput, AdsManualApprovalExecutorEvaluation } from './ads-manual-approval-executor.types.js';

export type AdsSnapshotPlatform = 'meta_marketing_api' | 'google_ads_api' | string;
export type AdsSnapshotStatus = 'active' | 'paused' | 'deleted' | 'archived' | 'limited' | 'unknown' | string;
export type AdsSnapshotSource = 'manual_fixture' | 'sandbox_preview' | 'future_provider_read_before_execution' | string;
export type AdsSnapshotDecision =
  | 'snapshot_ready_for_audit_storage'
  | 'blocked_invalid_input'
  | 'blocked_manual_approval_gate_failed'
  | 'blocked_missing_before_snapshot'
  | 'blocked_invalid_budget'
  | 'blocked_invalid_status'
  | 'blocked_missing_platform_summary'
  | 'blocked_unsafe_snapshot_output';

export interface AdsBeforeSnapshotInput {
  snapshot_source?: AdsSnapshotSource;
  platform: AdsSnapshotPlatform;
  account_id: string;
  campaign_id?: string | null;
  adset_id?: string | null;
  current_budget: number | string;
  currency?: string;
  campaign_status: AdsSnapshotStatus;
  adset_status?: AdsSnapshotStatus | null;
  timestamp?: string;
  platform_data_summary: string | Record<string, unknown>;
}

export interface AdsAfterSnapshotPreviewInput {
  proposed_budget?: number | string | null;
  proposed_campaign_status?: AdsSnapshotStatus | null;
  proposed_adset_status?: AdsSnapshotStatus | null;
  reason?: string | null;
}

export interface AdsBeforeAfterSnapshotInput {
  action?: AdsManualApprovalExecutorInput;
  before_snapshot?: AdsBeforeSnapshotInput;
  after_snapshot_preview?: AdsAfterSnapshotPreviewInput;
  persist_now?: boolean;
  force?: boolean;
}

export interface AdsAuditSnapshotNormalized {
  snapshot_kind: 'before_execution' | 'after_execution_preview';
  platform: AdsSnapshotPlatform;
  account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  budget: number | null;
  currency: string;
  campaign_status: string;
  adset_status: string | null;
  timestamp: string;
  platform_data_summary: Record<string, unknown>;
}

export interface AdsBeforeAfterSnapshotChecks {
  manualApprovalGatePassed: boolean;
  beforeSnapshotPresent: boolean;
  currentBudgetValid: boolean;
  campaignStatusPresent: boolean;
  timestampValid: boolean;
  platformSummaryPresent: boolean;
  rawProviderPayloadRedacted: true;
  noProviderApiCalled: true;
  noBudgetMutated: true;
  noCampaignPaused: true;
  noAdsetPaused: true;
  noDatabaseWriteFromPreview: true;
}

export interface AdsBeforeAfterSnapshotSafety {
  auditSnapshotOnly: true;
  providerReadPlanningOnly: true;
  noMetaAdsApiClientAdded: true;
  noGoogleAdsApiClientAdded: true;
  noAdOAuthRouteAdded: true;
  noAdTokenStorageAdded: true;
  noWriteScopeRequested: true;
  noCampaignPaused: true;
  noAdsetPaused: true;
  noBudgetChanged: true;
  noBudgetRestored: true;
  noCampaignReenabled: true;
  noAdsAutoRunEnabled: true;
  noExternalAdApiCalled: true;
  noRawTokensReturned: true;
  noRawProviderPayloadReturned: true;
  migrationAddedButNotRunAutomatically: true;
}

export interface AdsBeforeAfterSnapshotEvaluation {
  version: '0.7.0';
  phase: 'phase_14_7_before_after_snapshot';
  healthMode: 'v2-phase-14-7-before-after-snapshot';
  deliverable: 'before_after_audit_snapshot';
  decision: AdsSnapshotDecision;
  readyForFutureExecutorAuditStorage: boolean;
  allowedToCallProviderApiThisPhase: false;
  allowedToMutateAdsThisPhase: false;
  manualApprovalRequired: true;
  autoRunAllowed: false;
  issues: string[];
  warnings: string[];
  checks: AdsBeforeAfterSnapshotChecks;
  manualApprovalEvaluation: AdsManualApprovalExecutorEvaluation | null;
  normalizedAction: {
    workspace_id: string | null;
    action_id: string | null;
    action_type: AdsActionType | null;
    platform: string | null;
    account_id: string | null;
  };
  beforeSnapshot: AdsAuditSnapshotNormalized | null;
  afterSnapshotPreview: AdsAuditSnapshotNormalized | null;
  recommendedStorage: {
    table: 'ads_action_snapshots';
    beforeSnapshotRequiredBeforeFutureMutation: true;
    afterSnapshotRequiredAfterFutureMutation: true;
    linkToActionResults: true;
    linkToActionEvents: true;
  };
  statusPathPreview: ['approved', 'snapshot_recorded', 'executing_blocked_until_provider_phase'];
  safety: AdsBeforeAfterSnapshotSafety;
}

export interface AdsBeforeAfterSnapshotReport {
  version: '0.7.0';
  phase: 'phase_14_7_before_after_snapshot';
  healthMode: 'v2-phase-14-7-before-after-snapshot';
  deliverable: 'before_after_audit_snapshot';
  generatedAt: string;
  executiveSummary: string;
  requiredBeforeExecutionFields: string[];
  supportedActionTypes: AdsActionType[];
  storageTable: 'ads_action_snapshots';
  migrationFile: 'database/migrations/023_create_ads_action_snapshots.sql';
  exampleInput: AdsBeforeAfterSnapshotInput;
  exampleEvaluation: AdsBeforeAfterSnapshotEvaluation;
  safety: AdsBeforeAfterSnapshotSafety;
  nextStep: 'Phase 14.8 — Rollback/Re-Enable';
}

export interface AdsBeforeAfterSnapshotStatus {
  phase: 'V2 Phase 14.7 — Before/After Snapshot';
  healthMode: 'v2-phase-14-7-before-after-snapshot';
  deliverable: 'before_after_audit_snapshot';
  beforeSnapshotRequiredBeforeFutureMutation: true;
  afterSnapshotRequiredAfterFutureMutation: true;
  providerApiClientAdded: false;
  externalAdApiCalled: false;
  campaignPaused: false;
  adsetPaused: false;
  budgetChanged: false;
  adsAutoRunEnabled: false;
  migrationAddedButNotRunAutomatically: true;
  nextStep: 'Phase 14.8 — Rollback/Re-Enable';
}
