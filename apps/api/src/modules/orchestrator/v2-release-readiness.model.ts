import type {
  V2ReleaseReadinessCheckDefinition,
  V2ReleaseReadinessCheckResult,
  V2ReleaseReadinessEvidenceInput,
  V2ReleaseReadinessPreviewInput,
  V2ReleaseReadinessPreviewResult,
  V2ReleaseReadinessReport,
  V2ReleaseReadinessSafety,
  V2ReleaseReadinessStatus,
} from './v2-release-readiness.types.js';

export const V2_RELEASE_READINESS_PHASE = 'phase_15_10_v2_release_readiness' as const;
export const V2_RELEASE_READINESS_HEALTH_MODE = 'v2-phase-15-10-v2-release-readiness' as const;
export const V2_RELEASE_READINESS_PACKAGE = 'lifesaver-v0.7.0-phase-15-10-v2-release-readiness.zip' as const;

export const V2_RELEASE_READINESS_SAFETY: V2ReleaseReadinessSafety = {
  checklistOnly: true,
  noSchedulerEnabled: true,
  noNotificationSend: true,
  noActionCreation: true,
  noActionApproval: true,
  noExecutorCall: true,
  noAutoRun: true,
  noExternalConnectorCall: true,
  noContentPublishing: true,
  noSupportSending: true,
  noAdsMutation: true,
  noClaudeCallFromModule: true,
  noRawSecretsReturned: true,
  noDatabaseMigrationRequired: true,
};

const SECRET_LIKE_FIELDS = [
  'api_key',
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'password',
  'raw_payload',
  'claude_api_key',
];

export const V2_RELEASE_CHECKS: V2ReleaseReadinessCheckDefinition[] = [
  {
    key: 'v1_still_works',
    label: 'V1 still works',
    requiredEvidence: ['v1_login_passed', 'v1_metrics_passed', 'v1_chat_passed', 'v1_brief_weekly_passed', 'v1_drafts_passed'],
    passMeaning: 'Advisor Mode remains intact: login, Triple Whale metrics, chat, briefs, weekly summary, and drafts still work.',
    failureImpact: 'Do not release V2; V1 cannot regress while operator features are added.',
  },
  {
    key: 'approval_queue_works',
    label: 'Approval queue works',
    requiredEvidence: ['approval_queue_passed'],
    passMeaning: 'Proposed actions can be reviewed safely and approval/rejection state transitions remain stable.',
    failureImpact: 'Do not release operator workflow; founder control depends on approval queue correctness.',
  },
  {
    key: 'policy_engine_works',
    label: 'Policy engine works',
    requiredEvidence: ['policy_engine_passed'],
    passMeaning: 'Default ask, blocks, caps, and most-restrictive-wins policy decisions still behave as expected.',
    failureImpact: 'Do not enable any operator lane; policy gates are a core safety dependency.',
  },
  {
    key: 'master_pause_works',
    label: 'Master pause works',
    requiredEvidence: ['master_pause_passed'],
    passMeaning: 'Global pause, category pause, and emergency safe mode block execution paths immediately.',
    failureImpact: 'Do not release; master pause is a non-negotiable safety switch.',
  },
  {
    key: 'sandbox_executor_works',
    label: 'Sandbox executor works',
    requiredEvidence: ['sandbox_executor_passed'],
    passMeaning: 'Sandbox lifecycle, result logs, failure simulation, and rollback simulation remain safe and testable.',
    failureImpact: 'Do not sign off V2 QA; sandbox proof is required before real execution confidence.',
  },
  {
    key: 'real_executor_works',
    label: 'Real executor works',
    requiredEvidence: ['real_executor_manual_approval_gate_passed'],
    passMeaning: 'Real-executor-capable paths remain manual-approval gated, feature-flag controlled, and do not auto-run by default.',
    failureImpact: 'Do not allow live execution; real executor paths must be approval-first and default-off unless explicitly approved.',
  },
  {
    key: 'audit_logs_work',
    label: 'Audit logs work',
    requiredEvidence: ['audit_logs_passed'],
    passMeaning: 'Action events, result logs, decisions, and QA outputs remain visible and traceable.',
    failureImpact: 'Do not release; failed/blocked/executed actions must not be hidden.',
  },
  {
    key: 'rollback_supported_where_available',
    label: 'Rollback works where supported',
    requiredEvidence: ['rollback_supported_paths_passed'],
    passMeaning: 'Rollback or follow-up handling exists where the platform supports it; unsupported rollback is stated clearly.',
    failureImpact: 'Do not claim rollback support beyond tested platform capability.',
  },
  {
    key: 'no_hidden_autonomy',
    label: 'No hidden autonomy',
    requiredEvidence: ['hidden_autonomy_scan_passed'],
    passMeaning: 'No hidden scheduled jobs, auto-actions, direct external writes, or force-bypass paths are active.',
    failureImpact: 'Do not release; hidden autonomy violates the V2 safety promise.',
  },
  {
    key: 'client_acceptance_passed',
    label: 'Client acceptance passed',
    requiredEvidence: ['client_acceptance_passed', 'live_domain_checked', 'production_env_checked', 'security_check_passed', 'build_passed', 'regression_tests_passed'],
    passMeaning: 'The live app, production environment, security checks, build, and regression suite are ready for client go/no-go.',
    failureImpact: 'Do not call V2 release-ready until the client acceptance checklist is complete.',
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeEvidence(input?: V2ReleaseReadinessEvidenceInput): Required<V2ReleaseReadinessEvidenceInput> {
  const e = input ?? {};
  return {
    v1_login_passed: Boolean(e.v1_login_passed),
    v1_metrics_passed: Boolean(e.v1_metrics_passed),
    v1_chat_passed: Boolean(e.v1_chat_passed),
    v1_brief_weekly_passed: Boolean(e.v1_brief_weekly_passed),
    v1_drafts_passed: Boolean(e.v1_drafts_passed),
    approval_queue_passed: Boolean(e.approval_queue_passed),
    policy_engine_passed: Boolean(e.policy_engine_passed),
    master_pause_passed: Boolean(e.master_pause_passed),
    sandbox_executor_passed: Boolean(e.sandbox_executor_passed),
    real_executor_manual_approval_gate_passed: Boolean(e.real_executor_manual_approval_gate_passed),
    audit_logs_passed: Boolean(e.audit_logs_passed),
    rollback_supported_paths_passed: Boolean(e.rollback_supported_paths_passed),
    hidden_autonomy_scan_passed: Boolean(e.hidden_autonomy_scan_passed),
    client_acceptance_passed: Boolean(e.client_acceptance_passed),
    live_domain_checked: Boolean(e.live_domain_checked),
    production_env_checked: Boolean(e.production_env_checked),
    security_check_passed: Boolean(e.security_check_passed),
    build_passed: Boolean(e.build_passed),
    regression_tests_passed: Boolean(e.regression_tests_passed),
  };
}

function hasSecretLikeInput(input: V2ReleaseReadinessPreviewInput): boolean {
  const body = asRecord(input);
  return SECRET_LIKE_FIELDS.some((field) => field in body && body[field] !== undefined && body[field] !== null);
}

function evaluateCheck(definition: V2ReleaseReadinessCheckDefinition, evidence: Required<V2ReleaseReadinessEvidenceInput>): V2ReleaseReadinessCheckResult {
  const missingEvidence = definition.requiredEvidence.filter((field) => !Boolean(evidence[field as keyof Required<V2ReleaseReadinessEvidenceInput>]));
  const presentEvidence = definition.requiredEvidence.filter((field) => Boolean(evidence[field as keyof Required<V2ReleaseReadinessEvidenceInput>]));
  const status = missingEvidence.length === 0 ? 'pass' : presentEvidence.length > 0 ? 'warning' : 'fail';
  return {
    key: definition.key,
    label: definition.label,
    status,
    evidence: presentEvidence,
    missingEvidence,
    recommendation: status === 'pass'
      ? definition.passMeaning
      : `${definition.failureImpact} Missing evidence: ${missingEvidence.join(', ')}.`,
  };
}

export function getV2ReleaseReadinessStatus(): V2ReleaseReadinessStatus {
  return {
    phase: 'V2 Phase 15.10 — V2 Release Readiness',
    healthMode: V2_RELEASE_READINESS_HEALTH_MODE,
    deliverable: 'v2_operator_release_checklist',
    checklistDefined: true,
    previewEvaluatorAdded: true,
    clientAcceptanceGateIncluded: true,
    releaseAutomationEnabled: false,
    executorEnabledByThisPhase: false,
    autoRunEnabledByThisPhase: false,
    externalConnectorCallEnabled: false,
    roadmapPhase15Complete: true,
    nextStep: 'Client acceptance, production readiness review, and explicit go/no-go sign-off',
  };
}

export function previewV2ReleaseReadiness(input: V2ReleaseReadinessPreviewInput = {}): V2ReleaseReadinessPreviewResult {
  const evidence = normalizeEvidence(input.evidence);
  const checks = V2_RELEASE_CHECKS.map((check) => evaluateCheck(check, evidence));
  const passCount = checks.filter((check) => check.status === 'pass').length;
  const warningCount = checks.filter((check) => check.status === 'warning').length;
  const failCount = checks.filter((check) => check.status === 'fail').length;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (hasSecretLikeInput(input)) {
    issues.push('Secret-like fields are not accepted in release readiness preview input. Send only safe PASS/PARTIAL/FAIL evidence, never raw keys or provider payloads.');
  }
  if (input.force === true) {
    warnings.push('force=true is ignored. V2 release readiness requires evidence and client sign-off, not force bypass.');
  }
  checks.filter((check) => check.status === 'fail').forEach((check) => issues.push(`${check.label} has not passed yet.`));
  checks.filter((check) => check.status === 'warning').forEach((check) => warnings.push(`${check.label} is partially evidenced but not fully passed.`));

  let decision: V2ReleaseReadinessPreviewResult['decision'] = 'not_ready';
  if (issues.length === 0 && failCount === 0 && warningCount === 0) {
    decision = 'ready_for_client_acceptance';
  } else if (issues.length === 0 && failCount === 0) {
    decision = 'ready_with_warnings';
  }

  return {
    phase: 'V2 Phase 15.10 — V2 Release Readiness',
    healthMode: V2_RELEASE_READINESS_HEALTH_MODE,
    deliverable: 'v2_operator_release_checklist',
    decision,
    summary: decision === 'ready_for_client_acceptance'
      ? 'All V2 release-readiness gates are evidenced. The package is ready for client acceptance/go-no-go review.'
      : 'V2 release readiness is not fully signed off yet. Complete the missing evidence before calling the operator release ready.',
    checks,
    passCount,
    warningCount,
    failCount,
    warnings,
    issues,
    clientSignOffReady: decision === 'ready_for_client_acceptance',
    wouldExecuteAnythingThisPhase: false,
    wouldCallExternalConnectorThisPhase: false,
    wouldEnableAutoRunThisPhase: false,
    safety: V2_RELEASE_READINESS_SAFETY,
  };
}

export function getV2ReleaseReadinessExample(): V2ReleaseReadinessPreviewInput {
  return {
    evidence: {
      v1_login_passed: true,
      v1_metrics_passed: true,
      v1_chat_passed: true,
      v1_brief_weekly_passed: true,
      v1_drafts_passed: true,
      approval_queue_passed: true,
      policy_engine_passed: true,
      master_pause_passed: true,
      sandbox_executor_passed: true,
      real_executor_manual_approval_gate_passed: true,
      audit_logs_passed: true,
      rollback_supported_paths_passed: true,
      hidden_autonomy_scan_passed: true,
      client_acceptance_passed: true,
      live_domain_checked: true,
      production_env_checked: true,
      security_check_passed: true,
      build_passed: true,
      regression_tests_passed: true,
    },
    notes: [
      'Use this only as a safe preview example. Actual release sign-off must be based on real local/staging/live test output.',
    ],
  };
}

export function getV2ReleaseReadinessReport(): V2ReleaseReadinessReport {
  return {
    phase: 'V2 Phase 15.10 — V2 Release Readiness',
    healthMode: V2_RELEASE_READINESS_HEALTH_MODE,
    deliverable: 'v2_operator_release_checklist',
    purpose: 'Define a final V2 operator release checklist that verifies V1 did not regress, safety gates remain active, executor foundations are auditable, no hidden autonomy exists, and client acceptance is complete before go/no-go sign-off.',
    backendFiles: [
      'apps/api/src/modules/orchestrator/v2-release-readiness.types.ts',
      'apps/api/src/modules/orchestrator/v2-release-readiness.model.ts',
      'apps/api/src/modules/orchestrator/v2-release-readiness.controller.ts',
      'apps/api/src/modules/orchestrator/v2-release-readiness.routes.ts',
      'apps/api/src/modules/orchestrator/v2-release-readiness-tests.ts',
    ],
    apiEndpoints: [
      'GET /api/v1/orchestrator/v2-release-readiness/status',
      'GET /api/v1/orchestrator/v2-release-readiness/report',
      'GET /api/v1/orchestrator/v2-release-readiness/checklist',
      'GET /api/v1/orchestrator/v2-release-readiness/example',
      'POST /api/v1/orchestrator/v2-release-readiness/preview',
    ],
    checks: V2_RELEASE_CHECKS,
    recommendedRegressionCommands: [
      'npm run build',
      'npm run phase15:v2-release-readiness:test',
      'npm run phase15:cost-anomaly-hardening:test',
      'npm run phase15:daily-action-digest:test',
      'npm run phase15:voice-input:test',
      'npm run phase15:proactivity-triggers:test',
      'npm run phase15:memory-ui:test',
      'npm run phase15:tool-routing:test',
      'npm run phase14:ads-safety-qa:test',
      'npm run phase13:support-send-qa:test',
      'npm run executor:safe-demo-qa:test',
      'npm run policy:tests:test',
      'npm run actions:test:backend',
      'npm run client:test-checklist',
      'npm run security:check',
      'npm run env:check',
    ],
    liveChecks: [
      'https://lifesaveragent.com',
      'https://lifesaveragent.com/api/v1/health',
      'https://lifesaveragent.com/actions.html',
      'https://lifesaveragent.com/rules.html',
      'https://lifesaveragent.com/support.html',
      'https://lifesaveragent.com/memory.html',
      'https://lifesaveragent.com/api/v1/orchestrator/v2-release-readiness/status',
      'https://lifesaveragent.com/api/v1/orchestrator/v2-release-readiness/report',
    ],
    releaseGateRules: [
      'Do not call V2 release-ready unless V1 acceptance checks still pass.',
      'Do not claim real external execution unless an executor result confirms it.',
      'Do not enable hidden scheduled jobs or auto-run lanes without explicit policy, caps, pause, audit, and result-log gates.',
      'Do not treat sandbox/test account QA as production external write approval.',
      'Client acceptance must be explicit before production operator release wording is used.',
    ],
    safetyRules: [
      'This module is checklist/report only.',
      'It does not create actions, approve actions, execute actions, call Claude, call connectors, or enable auto-run.',
      'It rejects secret-like preview input and keeps release evidence safe.',
      'Real-executor-capable code remains manual-approval-first and feature-flag gated unless a later explicit release decision changes it.',
    ],
    examplePreview: previewV2ReleaseReadiness(getV2ReleaseReadinessExample()),
    safety: V2_RELEASE_READINESS_SAFETY,
    nextStep: 'Client acceptance, production readiness review, and explicit go/no-go sign-off',
  };
}
