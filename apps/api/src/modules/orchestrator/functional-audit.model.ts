import type {
  FunctionalAuditNextPhase,
  FunctionalAuditPreviewInput,
  FunctionalAuditPreviewResult,
  FunctionalAuditReport,
  FunctionalAuditSafety,
  FunctionalAuditStatus,
  FunctionalAuditSurface,
  FunctionalSurfaceStatus,
} from './functional-audit.types.js';

export const FUNCTIONAL_AUDIT_PHASE = 'v0.8.0_functional_audit' as const;
export const FUNCTIONAL_AUDIT_HEALTH_MODE = 'v2-functional-0-8-0-audit' as const;
export const FUNCTIONAL_AUDIT_PACKAGE = 'lifesaver-v0.8.0-functional-audit.zip' as const;

export const FUNCTIONAL_AUDIT_SAFETY: FunctionalAuditSafety = {
  auditOnly: true,
  noDatabaseMigration: true,
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
};

const SECRET_LIKE_FIELDS = ['api_key', 'access_token', 'refresh_token', 'authorization', 'client_secret', 'database_url', 'password', 'raw_payload', 'claude_api_key'];

export const FUNCTIONAL_AUDIT_SURFACES: FunctionalAuditSurface[] = [
  {
    key: 'dashboard_kpis',
    label: 'Dashboard KPIs',
    domain: 'dashboard',
    page: '/index.html',
    status: 'backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/metrics'],
    currentState: 'Dashboard reads core stored metrics and renders founder KPI cards.',
    missingForFullFunctionality: ['Confirm live Triple Whale sync cadence', 'Add empty/error states per metric lane'],
    recommendedNextStep: 'Keep as functional baseline and include in every regression pass.',
    activationRisk: 'low',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'daily_weekly_briefs',
    label: 'Daily Brief + Weekly Summary',
    domain: 'dashboard',
    page: '/index.html',
    status: 'partial_backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/brief', 'POST /api/v1/brief/generate', 'GET /api/v1/weekly', 'POST /api/v1/weekly/generate'],
    currentState: 'Briefing endpoints exist and stay grounded in stored metrics; scheduling remains controlled.',
    missingForFullFunctionality: ['Confirm production worker schedule', 'Add digest history controls', 'Add visible generated-at/error metadata'],
    recommendedNextStep: 'Connect daily action digest summaries into a persisted briefing timeline later.',
    activationRisk: 'medium',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'ai_chat_voice',
    label: 'AI Chat + Voice Input',
    domain: 'dashboard',
    page: '/index.html',
    status: 'partial_backend_connected',
    mobileReady: true,
    primaryApis: ['POST /api/v1/chat', 'GET /api/v1/orchestrator/voice-input/status'],
    currentState: 'Chat is backend-connected; voice input converts browser speech to text and submits through the existing text path.',
    missingForFullFunctionality: ['Add routed specialist execution after functional review', 'Persist selected conversation metadata if approved'],
    recommendedNextStep: 'Keep voice as text fallback only until orchestrator execution routing is explicitly activated.',
    activationRisk: 'medium',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'approval_queue',
    label: 'Actions + Approval Queue',
    domain: 'actions',
    page: '/actions.html',
    status: 'backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/actions', 'GET /api/v1/actions/:id', 'POST /api/v1/actions/:id/approve', 'POST /api/v1/actions/:id/reject', 'POST /api/v1/actions/:id/cancel'],
    currentState: 'Approval queue is connected to backend lifecycle endpoints with mobile-safe review controls.',
    missingForFullFunctionality: ['Add per-action functional status badges', 'Add operator-level audit filters'],
    recommendedNextStep: 'Treat as the primary safety gate before any real execution path is expanded.',
    activationRisk: 'high',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'rules_ui',
    label: 'Rules + Policy UI',
    domain: 'rules',
    page: '/rules.html',
    status: 'ui_preview_only',
    mobileReady: true,
    primaryApis: ['GET /api/v1/autonomy/status', 'policy simulation UI currently browser-local'],
    currentState: 'Rules UI is mobile-ready but many rule creation/edit flows remain browser-local preview.',
    missingForFullFunctionality: ['Backend policy CRUD endpoints', 'Persist caps/rules to policies table', 'Audit every rule edit'],
    recommendedNextStep: 'Plan v0.8.2 backend persistence for policy/rule management before enabling rule-driven automation.',
    activationRisk: 'critical',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'memory_management',
    label: 'Memory Management',
    domain: 'memory',
    page: '/memory.html',
    status: 'needs_backend_persistence',
    mobileReady: true,
    primaryApis: ['GET /api/v1/orchestrator/memory-schema/status', 'GET /api/v1/orchestrator/memory-ui/report'],
    currentState: 'Memory schema and UI exist; user-visible memory edits remain safe/local preview until persistence is wired.',
    missingForFullFunctionality: ['CRUD endpoints for memory_items', 'Founder approval workflow for suggestions', 'Memory usage audit trail'],
    recommendedNextStep: 'Connect memory UI to the Phase 15.4 memory_items table with strict redaction and approval checks.',
    activationRisk: 'high',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'support_workspace',
    label: 'Support Workspace',
    domain: 'support',
    page: '/support.html',
    status: 'partial_backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/support/* status/report endpoints', 'POST /api/v1/drafts/support-reply'],
    currentState: 'Support read/draft/send-safety modules exist, but real sending remains gated and default-off.',
    missingForFullFunctionality: ['Provider OAuth selection', 'Read-only ticket import persistence review', 'Live send remains manual approval only'],
    recommendedNextStep: 'Audit support connector state before turning any live send path on for a controlled test.',
    activationRisk: 'critical',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'notifications_center',
    label: 'Notifications + Approval Reminders',
    domain: 'notifications',
    page: '/notifications.html',
    status: 'partial_backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/notifications/*', 'GET /api/v1/notification-preferences'],
    currentState: 'Notification preference, center, deep-link, reminders, quiet-hours, delivery-log, and QA foundations exist.',
    missingForFullFunctionality: ['Confirm real delivery provider', 'Founder preference persistence QA', 'Production rate-limit review'],
    recommendedNextStep: 'Keep delivery off unless preferences, quiet hours, delivery logs, and cost caps are verified.',
    activationRisk: 'medium',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'settings_accounts_team',
    label: 'Settings, Connected Accounts + Team',
    domain: 'settings',
    page: '/settings.html',
    status: 'backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/customer-settings', 'PATCH /api/v1/customer-settings/workspace-profile', 'GET/POST/DELETE /api/v1/connect/triplewhale', 'GET/POST/PATCH/DELETE /api/v1/team/members'],
    currentState: 'Workspace settings, encrypted Triple Whale ownership, and team role foundations are backend-connected.',
    missingForFullFunctionality: ['Invite email workflow', 'Billing/account lifecycle later', 'Production secret rotation checklist'],
    recommendedNextStep: 'Keep settings as production readiness baseline; do not expose raw keys.',
    activationRisk: 'medium',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'admin_launch_readiness',
    label: 'Admin + Launch Readiness',
    domain: 'admin',
    page: '/admin.html + /launch-readiness.html',
    status: 'backend_connected',
    mobileReady: true,
    primaryApis: ['GET /api/v1/admin/*', 'GET /api/v1/launch-readiness', 'GET /api/v1/security/status'],
    currentState: 'Admin diagnostics and launch readiness checks are available with mobile release QA polish.',
    missingForFullFunctionality: ['Add v0.8 functional audit status to launch checklist', 'Add owner-only production go/no-go logging'],
    recommendedNextStep: 'Use admin launch readiness together with this functional audit before enabling new live functionality.',
    activationRisk: 'medium',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'proactivity_triggers_digest',
    label: 'Proactivity Triggers + Daily Action Digest',
    domain: 'orchestrator',
    page: '/functional-audit.html',
    status: 'framework_only',
    mobileReady: true,
    primaryApis: ['GET /api/v1/orchestrator/proactivity-triggers/report', 'GET /api/v1/orchestrator/daily-action-digest/report'],
    currentState: 'Framework and digest builders exist; no scheduler or proactive job is enabled by this audit phase.',
    missingForFullFunctionality: ['Scheduler policy', 'Notification preference binding', 'Cost/anomaly cap enforcement review'],
    recommendedNextStep: 'Keep proactivity disabled until the functional audit says persistence, preferences, and caps are ready.',
    activationRisk: 'high',
    canBeConnectedWithoutRealExternalWrites: true,
  },
  {
    key: 'real_execution_paths',
    label: 'Real Executor-Capable Paths',
    domain: 'safety',
    page: '/actions.html',
    status: 'connector_disabled_by_design',
    mobileReady: true,
    primaryApis: ['support send QA endpoints', 'content publish controlled test endpoints', 'ads safety QA endpoints'],
    currentState: 'Real-executor-capable code exists from later phases but remains approval-first, default-off, and protected by safety gates.',
    missingForFullFunctionality: ['Explicit founder/client go/no-go', 'Provider credentials', 'Controlled live test scope', 'Rollback/unsupported rollback notices'],
    recommendedNextStep: 'Do not enable live execution from the audit phase. Prepare a separate controlled-live-test package only after sign-off.',
    activationRisk: 'critical',
    canBeConnectedWithoutRealExternalWrites: false,
  },
];

export const FUNCTIONAL_AUDIT_NEXT_PHASES: FunctionalAuditNextPhase[] = [
  {
    version: 'v0.8.2',
    label: 'Backend Persistence Plan',
    goal: 'Choose the first UI-only areas to connect to existing/new database tables safely.',
    deliverable: 'Persistence implementation plan with migrations identified but not run automatically.',
    safetyBoundary: 'No external writes; approval, policy, pause, caps, and audit remain required.',
  },
  {
    version: 'v0.8.2',
    label: 'Memory + Rules Persistence',
    goal: 'Wire memory and policy/rule UI to backend persistence with founder-controlled CRUD and audit logs.',
    deliverable: 'Persisted memory/rules management without auto-run enablement.',
    safetyBoundary: 'Rules can be stored but still cannot cause hidden execution unless later explicitly enabled.',
  },
  {
    version: 'v0.8.3',
    label: 'Functional Page Wiring',
    goal: 'Connect remaining page controls to real status/report endpoints and remove local-only ambiguity.',
    deliverable: 'UI-to-API wiring completion report.',
    safetyBoundary: 'Read/report/preview only unless an existing internal action endpoint is already approval-gated.',
  },
];

function emptyCounts(): Record<FunctionalSurfaceStatus, number> {
  return {
    backend_connected: 0,
    partial_backend_connected: 0,
    ui_preview_only: 0,
    framework_only: 0,
    needs_backend_persistence: 0,
    connector_disabled_by_design: 0,
  };
}

export function buildFunctionalAuditCounts(surfaces = FUNCTIONAL_AUDIT_SURFACES): Record<FunctionalSurfaceStatus, number> {
  const counts = emptyCounts();
  for (const surface of surfaces) counts[surface.status] += 1;
  return counts;
}

function detectUnsafeKeys(input: unknown, path = ''): string[] {
  if (!input || typeof input !== 'object') return [];
  const issues: string[] = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    const normalized = key.toLowerCase();
    if (SECRET_LIKE_FIELDS.some((secretKey) => normalized.includes(secretKey))) {
      issues.push(`Unsafe secret-like field provided: ${currentPath}`);
    }
    if (value && typeof value === 'object') issues.push(...detectUnsafeKeys(value, currentPath));
  }
  return issues;
}

export function getFunctionalAuditStatus(): FunctionalAuditStatus {
  return {
    phase: 'v0.8.0 — Functional Audit',
    healthMode: FUNCTIONAL_AUDIT_HEALTH_MODE,
    deliverable: 'functional_audit_and_ui_to_api_connection_map',
    auditModuleReady: true,
    connectionMapReady: true,
    backendPersistenceEnabledByThisPhase: false,
    realExecutionEnabledByThisPhase: false,
    totalSurfacesMapped: FUNCTIONAL_AUDIT_SURFACES.length,
    safeNextStep: 'v0.8.2 Backend Persistence Plan',
    safety: FUNCTIONAL_AUDIT_SAFETY,
  };
}

export function getFunctionalAuditReport(): FunctionalAuditReport {
  return {
    phase: 'v0.8.0 — Functional Audit',
    healthMode: FUNCTIONAL_AUDIT_HEALTH_MODE,
    deliverable: 'functional_audit_and_ui_to_api_connection_map',
    summary: 'v0.8.0 maps every important LIFE.SAVER page/function to its current backend/API state before making UI-only areas fully functional.',
    counts: buildFunctionalAuditCounts(),
    surfaces: FUNCTIONAL_AUDIT_SURFACES,
    nextPhases: FUNCTIONAL_AUDIT_NEXT_PHASES,
    safety: FUNCTIONAL_AUDIT_SAFETY,
  };
}

export function getFunctionalAuditMap() {
  return {
    phase: 'v0.8.0 — Functional Audit',
    healthMode: FUNCTIONAL_AUDIT_HEALTH_MODE,
    packageName: FUNCTIONAL_AUDIT_PACKAGE,
    byDomain: FUNCTIONAL_AUDIT_SURFACES.reduce<Record<string, FunctionalAuditSurface[]>>((acc, surface) => {
      acc[surface.domain] = acc[surface.domain] || [];
      acc[surface.domain].push(surface);
      return acc;
    }, {}),
    surfaces: FUNCTIONAL_AUDIT_SURFACES,
  };
}

export function getFunctionalAuditChecklist() {
  return {
    phase: 'v0.8.0 — Functional Audit',
    healthMode: FUNCTIONAL_AUDIT_HEALTH_MODE,
    checklist: [
      'Confirm every top-level page loads on desktop and mobile.',
      'Confirm every visible button is either backend-connected or labelled as preview/framework only.',
      'Confirm no UI-only control pretends to create real external outcomes.',
      'Confirm rules and memory persistence gaps are documented before implementation.',
      'Confirm approval queue remains the safety gate for operator actions.',
      'Confirm master pause, category pause, caps, and no-hidden-autonomy remain non-negotiable.',
      'Confirm no secrets appear in browser output, audit reports, console logs, or docs.',
    ],
    requiredBeforeV081: ['Functional audit report reviewed', 'First persistence target selected', 'Migration needs identified', 'Safety gates preserved'],
  };
}

export function getFunctionalAuditExample() {
  return previewFunctionalAudit({
    checkedSurfaceKeys: ['dashboard_kpis', 'approval_queue', 'rules_ui', 'memory_management'],
    completedManualChecks: ['mobile_smoke_test', 'no_horizontal_overflow', 'health_endpoint_checked'],
    notes: ['Example only. No persistence or executor call is made by this preview.'],
  });
}

export function previewFunctionalAudit(input: FunctionalAuditPreviewInput = {}): FunctionalAuditPreviewResult {
  const safeInput = input && typeof input === 'object' ? input : {};
  const checked = Array.isArray(safeInput.checkedSurfaceKeys) ? safeInput.checkedSurfaceKeys.filter((key): key is string => typeof key === 'string') : [];
  const reviewedManualChecks = Array.isArray(safeInput.completedManualChecks) ? safeInput.completedManualChecks.filter((key): key is string => typeof key === 'string') : [];
  const validKeys = new Set(FUNCTIONAL_AUDIT_SURFACES.map((surface) => surface.key));
  const unknown = checked.filter((key) => !validKeys.has(key));
  const uncheckedSurfaceKeys = FUNCTIONAL_AUDIT_SURFACES.map((surface) => surface.key).filter((key) => !checked.includes(key));
  const issues = detectUnsafeKeys(safeInput);
  if (unknown.length) issues.push(`Unknown surface keys: ${unknown.join(', ')}`);
  if (safeInput.force === true) issues.push('force=true is ignored; functional audit cannot bypass safety gates.');
  const warnings: string[] = [];
  if (uncheckedSurfaceKeys.length) warnings.push(`${uncheckedSurfaceKeys.length} mapped surfaces still need manual review.`);
  const highRiskUnchecked = FUNCTIONAL_AUDIT_SURFACES.filter((surface) => uncheckedSurfaceKeys.includes(surface.key) && ['high', 'critical'].includes(surface.activationRisk));
  if (highRiskUnchecked.length) warnings.push(`${highRiskUnchecked.length} high/critical-risk surfaces are not checked yet.`);
  const decision = issues.length > 0 ? 'blocked_until_review' : uncheckedSurfaceKeys.length === 0 ? 'ready_for_backend_persistence_planning' : 'audit_only';
  return {
    phase: 'v0.8.0 — Functional Audit',
    healthMode: FUNCTIONAL_AUDIT_HEALTH_MODE,
    deliverable: 'functional_audit_and_ui_to_api_connection_map',
    decision,
    checkedSurfaceKeys: checked,
    uncheckedSurfaceKeys,
    reviewedManualChecks,
    issues,
    warnings,
    recommendedNextStep: decision === 'ready_for_backend_persistence_planning'
      ? 'Proceed to v0.8.2 Backend Persistence Plan with explicit founder-selected target areas.'
      : 'Review the unchecked surfaces and resolve any issues before persistence work.',
    wouldCreateActionThisPhase: false,
    wouldCallExecutorThisPhase: false,
    wouldCallExternalConnectorThisPhase: false,
    safety: FUNCTIONAL_AUDIT_SAFETY,
  };
}
