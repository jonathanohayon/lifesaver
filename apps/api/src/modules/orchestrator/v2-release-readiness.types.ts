export type V2ReleaseReadinessHealthMode = 'v2-phase-15-10-v2-release-readiness';

export type V2ReleaseReadinessCheckKey =
  | 'v1_still_works'
  | 'approval_queue_works'
  | 'policy_engine_works'
  | 'master_pause_works'
  | 'sandbox_executor_works'
  | 'real_executor_works'
  | 'audit_logs_work'
  | 'rollback_supported_where_available'
  | 'no_hidden_autonomy'
  | 'client_acceptance_passed';

export type V2ReleaseReadinessDecision = 'ready_for_client_acceptance' | 'ready_with_warnings' | 'not_ready';
export type V2ReleaseCheckStatus = 'pass' | 'warning' | 'fail' | 'not_checked';

export interface V2ReleaseReadinessSafety {
  checklistOnly: true;
  noSchedulerEnabled: true;
  noNotificationSend: true;
  noActionCreation: true;
  noActionApproval: true;
  noExecutorCall: true;
  noAutoRun: true;
  noExternalConnectorCall: true;
  noContentPublishing: true;
  noSupportSending: true;
  noAdsMutation: true;
  noClaudeCallFromModule: true;
  noRawSecretsReturned: true;
  noDatabaseMigrationRequired: true;
}

export interface V2ReleaseReadinessEvidenceInput {
  v1_login_passed?: boolean;
  v1_metrics_passed?: boolean;
  v1_chat_passed?: boolean;
  v1_brief_weekly_passed?: boolean;
  v1_drafts_passed?: boolean;
  approval_queue_passed?: boolean;
  policy_engine_passed?: boolean;
  master_pause_passed?: boolean;
  sandbox_executor_passed?: boolean;
  real_executor_manual_approval_gate_passed?: boolean;
  audit_logs_passed?: boolean;
  rollback_supported_paths_passed?: boolean;
  hidden_autonomy_scan_passed?: boolean;
  client_acceptance_passed?: boolean;
  live_domain_checked?: boolean;
  production_env_checked?: boolean;
  security_check_passed?: boolean;
  build_passed?: boolean;
  regression_tests_passed?: boolean;
}

export interface V2ReleaseReadinessPreviewInput {
  evidence?: V2ReleaseReadinessEvidenceInput;
  notes?: string[];
  force?: boolean;
  raw_payload?: unknown;
  api_key?: string;
  access_token?: string;
  claude_api_key?: string;
}

export interface V2ReleaseReadinessCheckDefinition {
  key: V2ReleaseReadinessCheckKey;
  label: string;
  requiredEvidence: string[];
  passMeaning: string;
  failureImpact: string;
}

export interface V2ReleaseReadinessCheckResult {
  key: V2ReleaseReadinessCheckKey;
  label: string;
  status: V2ReleaseCheckStatus;
  evidence: string[];
  missingEvidence: string[];
  recommendation: string;
}

export interface V2ReleaseReadinessPreviewResult {
  phase: 'V2 Phase 15.10 — V2 Release Readiness';
  healthMode: V2ReleaseReadinessHealthMode;
  deliverable: 'v2_operator_release_checklist';
  decision: V2ReleaseReadinessDecision;
  summary: string;
  checks: V2ReleaseReadinessCheckResult[];
  passCount: number;
  warningCount: number;
  failCount: number;
  warnings: string[];
  issues: string[];
  clientSignOffReady: boolean;
  wouldExecuteAnythingThisPhase: false;
  wouldCallExternalConnectorThisPhase: false;
  wouldEnableAutoRunThisPhase: false;
  safety: V2ReleaseReadinessSafety;
}

export interface V2ReleaseReadinessStatus {
  phase: 'V2 Phase 15.10 — V2 Release Readiness';
  healthMode: V2ReleaseReadinessHealthMode;
  deliverable: 'v2_operator_release_checklist';
  checklistDefined: true;
  previewEvaluatorAdded: true;
  clientAcceptanceGateIncluded: true;
  releaseAutomationEnabled: false;
  executorEnabledByThisPhase: false;
  autoRunEnabledByThisPhase: false;
  externalConnectorCallEnabled: false;
  roadmapPhase15Complete: true;
  nextStep: 'Client acceptance, production readiness review, and explicit go/no-go sign-off';
}

export interface V2ReleaseReadinessReport {
  phase: 'V2 Phase 15.10 — V2 Release Readiness';
  healthMode: V2ReleaseReadinessHealthMode;
  deliverable: 'v2_operator_release_checklist';
  purpose: string;
  backendFiles: string[];
  apiEndpoints: string[];
  checks: V2ReleaseReadinessCheckDefinition[];
  recommendedRegressionCommands: string[];
  liveChecks: string[];
  releaseGateRules: string[];
  safetyRules: string[];
  examplePreview: V2ReleaseReadinessPreviewResult;
  safety: V2ReleaseReadinessSafety;
  nextStep: 'Client acceptance, production readiness review, and explicit go/no-go sign-off';
}
