import type { AdsActionType } from './ads-action-types.types.js';
import type { AdsBudgetChangePayloadInput, AdsBudgetChangePayloadNormalized } from './ads-budget-change-payload.types.js';
import type { AdsHardCapsConfigInput, AdsHardCapsEvaluationResult, AdsHardCapsUsageInput } from './ads-hard-caps.types.js';

export type AdsManualApprovalActionStatus = 'proposed' | 'approval_required' | 'approved' | 'auto_approved' | 'executing' | 'executed' | 'failed' | 'rejected' | 'cancelled' | 'rollback_requested' | 'rolled_back' | string;

export type AdsManualApprovalDecision =
  | 'ready_for_manual_executor_shell'
  | 'blocked_invalid_action_type'
  | 'blocked_invalid_status'
  | 'blocked_manual_approval_required'
  | 'blocked_auto_approval_not_allowed'
  | 'blocked_master_pause_active'
  | 'blocked_ads_pause_active'
  | 'blocked_emergency_safe_mode'
  | 'blocked_hard_caps_required'
  | 'blocked_by_hard_cap'
  | 'blocked_invalid_budget_payload'
  | 'blocked_unsafe_provider_output';

export interface AdsManualApprovalEvidenceInput {
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  approval_event_exists?: boolean;
  approval_event_actor_id?: string | null;
  approval_method?: 'founder_manual' | 'admin_manual' | 'policy_auto' | 'system' | string;
}

export interface AdsManualApprovalPauseInput {
  master_pause_active?: boolean;
  ads_pause_active?: boolean;
  emergency_safe_mode_active?: boolean;
}

export interface AdsManualApprovalExecutorInput {
  workspace_id?: string;
  action_id?: string;
  action_type: AdsActionType | string;
  status: AdsManualApprovalActionStatus;
  platform?: 'meta_marketing_api' | 'google_ads_api' | string;
  account_id?: string | null;
  approval?: AdsManualApprovalEvidenceInput;
  pause?: AdsManualApprovalPauseInput;
  budget_payload?: AdsBudgetChangePayloadInput;
  hard_caps?: AdsHardCapsConfigInput;
  hard_caps_usage?: AdsHardCapsUsageInput;
  force?: boolean;
}

export interface AdsManualApprovalChecks {
  actionTypeSupported: boolean;
  statusApproved: boolean;
  autoApprovalRejected: boolean;
  manualApprovalActorPresent: boolean;
  manualApprovalTimestampPresent: boolean;
  manualApprovalEventPresent: boolean;
  manualApprovalMethodValid: boolean;
  forceIgnored: true;
  masterPauseOff: boolean;
  adsPauseOff: boolean;
  emergencySafeModeOff: boolean;
  hardCapsPresentForBudgetAction: boolean;
  hardCapsNotExceeded: boolean;
  budgetPayloadValidWhenRequired: boolean;
  noProviderClientLoaded: true;
  noExternalAdApiCalled: true;
}

export interface AdsManualApprovalExecutorEvaluation {
  version: '0.7.0';
  phase: 'phase_14_6_manual_approval_only';
  healthMode: 'v2-phase-14-6-manual-approval-only';
  deliverable: 'approval_gated_ads_executor';
  executorName: 'manualApprovalOnlyAdsExecutorGate';
  decision: AdsManualApprovalDecision;
  readyForFutureProviderClient: boolean;
  allowedToCallProviderApiThisPhase: false;
  manualApprovalRequired: true;
  autoRunAllowed: false;
  issues: string[];
  warnings: string[];
  checks: AdsManualApprovalChecks;
  normalizedAction: {
    workspace_id: string | null;
    action_id: string | null;
    action_type: AdsActionType | null;
    status: string;
    platform: string | null;
    account_id: string | null;
  };
  normalizedBudgetPayload: AdsBudgetChangePayloadNormalized | null;
  hardCapsEvaluation: AdsHardCapsEvaluationResult | null;
  statusPathPreview: ['approved', 'executing_blocked_until_provider_phase'];
  resultLogRequiredBeforeClaimingExecution: true;
  safety: AdsManualApprovalExecutorSafety;
}

export interface AdsManualApprovalExecutorSafety {
  manualApprovalOnly: true;
  approvalGateOnly: true;
  executorShellAdded: true;
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
  noDatabaseMigrationRequired: true;
}

export interface AdsManualApprovalExecutorReport {
  version: '0.7.0';
  phase: 'phase_14_6_manual_approval_only';
  healthMode: 'v2-phase-14-6-manual-approval-only';
  deliverable: 'approval_gated_ads_executor';
  generatedAt: string;
  executiveSummary: string;
  executorName: 'manualApprovalOnlyAdsExecutorGate';
  firstReleaseRule: 'every_ads_action_requires_manual_founder_or_admin_approval';
  supportedActionTypes: AdsActionType[];
  requiredApprovalEvidence: string[];
  requiredExecutionGates: string[];
  blockedEvenIfRequested: string[];
  exampleInput: AdsManualApprovalExecutorInput;
  exampleEvaluation: AdsManualApprovalExecutorEvaluation;
  safety: AdsManualApprovalExecutorSafety;
  nextStep: 'Phase 14.7 — Before/After Snapshot';
}

export interface AdsManualApprovalExecutorStatus {
  phase: 'V2 Phase 14.6 — Manual Approval Only';
  healthMode: 'v2-phase-14-6-manual-approval-only';
  deliverable: 'approval_gated_ads_executor';
  executorName: 'manualApprovalOnlyAdsExecutorGate';
  manualApprovalRequiredForEveryAdsAction: true;
  autoApprovalAccepted: false;
  forceBypassAllowed: false;
  providerApiClientAdded: false;
  externalAdApiCalled: false;
  campaignPaused: false;
  adsetPaused: false;
  budgetChanged: false;
  adsAutoRunEnabled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 14.7 — Before/After Snapshot';
}
