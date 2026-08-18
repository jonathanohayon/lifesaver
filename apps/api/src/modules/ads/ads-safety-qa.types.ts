import type { AdsHardCapsEvaluationResult, AdsHardCapsNormalizedConfig, AdsHardCapsUsageInput } from './ads-hard-caps.types.js';
import type { AdsBudgetChangePayloadInput } from './ads-budget-change-payload.types.js';
import type { AdsManualApprovalExecutorEvaluation, AdsManualApprovalExecutorInput } from './ads-manual-approval-executor.types.js';
import type { AdsRollbackExecutorEvaluation, AdsRollbackExecutorInput } from './ads-rollback-executor.types.js';
import type { AdsBeforeAfterSnapshotEvaluation, AdsBeforeAfterSnapshotInput } from './ads-before-after-snapshot.types.js';

export type AdsSafetyQaDecision = 'ads_safety_qa_passed' | 'ads_safety_qa_failed' | 'ads_safety_qa_requires_review' | 'invalid_qa_input';

export interface AdsSafetyQaDuplicateExecutionInput {
  action_id: string;
  idempotency_key: string;
  action_hash: string;
  existing_execution_ids: string[];
  current_execution_attempt_id: string;
}

export interface AdsSafetyQaRiskSignOffInput {
  signed_by_user_id: string;
  signed_at: string;
  notes?: string;
  acknowledges_manual_approval_required: boolean;
  acknowledges_sandbox_or_test_account_first: boolean;
  acknowledges_no_live_provider_call_from_qa: boolean;
  acknowledges_hard_caps_pause_rollback_duplicate_gates: boolean;
}

export interface AdsSafetyQaHardCapCaseInput {
  caps: AdsHardCapsNormalizedConfig;
  usage: AdsHardCapsUsageInput;
  budgetPayload: AdsBudgetChangePayloadInput;
}

export interface AdsSafetyQaInput {
  sandbox_or_test_account_first: boolean;
  manual_approval_case: AdsManualApprovalExecutorInput;
  hard_cap_exceeded_case: AdsSafetyQaHardCapCaseInput;
  pause_active_case: AdsManualApprovalExecutorInput;
  rollback_case: AdsRollbackExecutorInput;
  before_after_snapshot_case: AdsBeforeAfterSnapshotInput;
  duplicate_execution_case: AdsSafetyQaDuplicateExecutionInput;
  result_logging_ready: boolean;
  risk_signoff: AdsSafetyQaRiskSignOffInput;
  force?: boolean;
}

export interface AdsSafetyQaCheck {
  key:
    | 'sandbox_test_account_first'
    | 'manual_approval_required'
    | 'hard_cap_exceeded_blocks'
    | 'pause_active_blocks'
    | 'rollback_supported'
    | 'before_after_snapshot_ready'
    | 'no_duplicate_execution'
    | 'result_logs_required'
    | 'risk_signoff_present'
    | 'no_live_provider_api_called'
    | 'no_force_bypass';
  passed: boolean;
  reason: string;
}

export interface AdsSafetyQaSafety {
  qaReportOnly: true;
  sandboxOrTestAccountFirst: true;
  noLiveProviderSendFromQa: true;
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

export interface AdsSafetyQaEvaluation {
  version: '0.7.0';
  phase: 'phase_14_10_ads_safety_qa';
  healthMode: 'v2-phase-14-10-ads-safety-qa';
  deliverable: 'ads_executor_qa_and_risk_signoff';
  decision: AdsSafetyQaDecision;
  qaPassed: boolean;
  riskSignOffReady: boolean;
  allowedToCallProviderApiThisPhase: false;
  allowedToMutateAdsThisPhase: false;
  issues: string[];
  warnings: string[];
  checks: AdsSafetyQaCheck[];
  manualApprovalEvaluation: AdsManualApprovalExecutorEvaluation | null;
  hardCapExceededEvaluation: AdsHardCapsEvaluationResult | null;
  pauseActiveEvaluation: AdsManualApprovalExecutorEvaluation | null;
  rollbackEvaluation: AdsRollbackExecutorEvaluation | null;
  beforeAfterSnapshotEvaluation: AdsBeforeAfterSnapshotEvaluation | null;
  duplicateExecution: {
    duplicateBlocked: boolean;
    action_id: string | null;
    idempotency_key: string | null;
    current_execution_attempt_id: string | null;
    existing_execution_count: number;
  };
  requiredEvidence: string[];
  safety: AdsSafetyQaSafety;
}

export interface AdsSafetyQaReport {
  version: '0.7.0';
  phase: 'phase_14_10_ads_safety_qa';
  healthMode: 'v2-phase-14-10-ads-safety-qa';
  deliverable: 'ads_executor_qa_and_risk_signoff';
  generatedAt: string;
  executiveSummary: string;
  roadmapTests: string[];
  exampleInput: AdsSafetyQaInput;
  exampleEvaluation: AdsSafetyQaEvaluation;
  riskSignOff: {
    status: 'qa_passed_for_executor_shell_only';
    liveProviderExecutionApproved: false;
    notes: string[];
  };
  safety: AdsSafetyQaSafety;
  nextStep: 'Phase 15.1 — Request Classifier';
}

export interface AdsSafetyQaStatus {
  phase: 'V2 Phase 14.10 — Ads Safety QA';
  healthMode: 'v2-phase-14-10-ads-safety-qa';
  deliverable: 'ads_executor_qa_and_risk_signoff';
  qaReportOnly: true;
  sandboxOrTestAccountFirst: true;
  liveProviderExecutionApproved: false;
  externalAdApiCalled: false;
  budgetChanged: false;
  campaignPaused: false;
  adsetPaused: false;
  rollbackSupported: true;
  duplicateExecutionBlockedByPolicy: true;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 15.1 — Request Classifier';
}
