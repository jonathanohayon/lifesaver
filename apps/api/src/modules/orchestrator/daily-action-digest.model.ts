import type {
  DailyActionDigestActionInput,
  DailyActionDigestItem,
  DailyActionDigestPreviewInput,
  DailyActionDigestPreviewResult,
  DailyActionDigestReport,
  DailyActionDigestSafety,
  DailyActionDigestStatus,
} from './daily-action-digest.types.js';

export const DAILY_ACTION_DIGEST_PHASE = 'phase_15_8_daily_action_digest' as const;
export const DAILY_ACTION_DIGEST_HEALTH_MODE = 'v2-phase-15-8-daily-action-digest' as const;
export const DAILY_ACTION_DIGEST_PACKAGE = 'lifesaver-v0.7.0-phase-15-8-daily-action-digest.zip' as const;

export const DAILY_ACTION_DIGEST_SAFETY: DailyActionDigestSafety = {
  digestBuilderOnly: true,
  noScheduledJobEnabled: true,
  noActionCreation: true,
  noActionApproval: true,
  noExecutorCall: true,
  noAutoRun: true,
  noExternalConnectorCall: true,
  noContentPublishing: true,
  noSupportSending: true,
  noAdsMutation: true,
  noRawSecretsReturned: true,
  noDatabaseMigrationRequired: true,
};

const SECRET_LIKE_FIELDS = ['api_key', 'access_token', 'refresh_token', 'authorization', 'client_secret', 'database_url', 'password', 'raw_payload'];
const SECRET_LIKE_TEXT = [/api[_\s-]?key/i, /access[_\s-]?token/i, /refresh[_\s-]?token/i, /authorization:\s*bearer/i, /client[_\s-]?secret/i, /database[_\s-]?url/i, /password\s*[:=]/i];

function safeText(value: unknown, fallback = ''): string {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!text) return fallback;
  if (SECRET_LIKE_TEXT.some((pattern) => pattern.test(text))) return '[redacted secret-like text]';
  return text;
}

function normalizeRisk(value: unknown): string {
  const risk = safeText(value, 'medium').toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(risk)) return risk;
  return 'medium';
}

function classifyAction(action: DailyActionDigestActionInput): 'executed' | 'failed' | 'waiting_for_approval' | 'blocked_by_policy' | 'ignore' {
  const status = safeText(action.status, '').toLowerCase();
  const policy = safeText(action.reason || action.blocked_reason || '', '').toLowerCase();

  if (['executed', 'sent', 'published', 'completed', 'rolled_back'].includes(status)) return 'executed';
  if (['failed', 'execution_failed', 'error'].includes(status)) return 'failed';
  if (['proposed', 'approval_required', 'pending_approval', 'approved', 'queued'].includes(status)) return 'waiting_for_approval';
  if (['blocked', 'policy_blocked', 'rejected_by_policy'].includes(status) || policy.includes('policy block')) return 'blocked_by_policy';
  return 'ignore';
}

function toDigestItem(action: DailyActionDigestActionInput): DailyActionDigestItem {
  return {
    id: safeText(action.id, 'action_unknown'),
    title: safeText(action.title, 'Untitled action'),
    actionType: safeText(action.action_type, 'unknown_action'),
    category: safeText(action.category, 'unknown'),
    status: safeText(action.status, 'unknown'),
    riskLevel: normalizeRisk(action.risk_level),
    summary: safeText(action.result_summary || action.summary || action.reason, 'No summary provided.'),
    reason: safeText(action.failure_reason || action.blocked_reason || action.reason, 'No reason provided.'),
    timestamp: safeText(action.executed_at || action.approved_at || action.created_at, '') || null,
  };
}

function detectUnsafeKeys(input: unknown, path = ''): string[] {
  if (!input || typeof input !== 'object') return [];
  const issues: string[] = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (SECRET_LIKE_FIELDS.some((secretKey) => key.toLowerCase().includes(secretKey))) {
      issues.push(`Secret-like field is not allowed in digest preview input: ${fullPath}`);
      continue;
    }
    if (value && typeof value === 'object') issues.push(...detectUnsafeKeys(value, fullPath));
  }
  return issues;
}

export function buildDailyActionDigestStatus(): DailyActionDigestStatus {
  return {
    phase: 'V2 Phase 15.8 — Daily Action Digest',
    healthMode: DAILY_ACTION_DIGEST_HEALTH_MODE,
    deliverable: 'v2_daily_brief_action_digest',
    digestBuilderAdded: true,
    actionsExecutedReported: true,
    actionsFailedReported: true,
    waitingForApprovalReported: true,
    blockedByPolicyReported: true,
    recommendationsReported: true,
    scheduledJobEnabled: false,
    actionCreationEnabled: false,
    executorEnabled: false,
    autoRunEnabled: false,
    externalConnectorCallEnabled: false,
    nextStep: 'Phase 15.9 — Cost Caps + Anomaly Alerts',
  };
}

export function previewDailyActionDigest(input: DailyActionDigestPreviewInput = {}): DailyActionDigestPreviewResult {
  const generatedAt = safeText(input.generated_at, new Date('2026-07-09T09:00:00.000Z').toISOString());
  const businessDayLabel = safeText(input.business_day_label, 'Today');
  const issues = detectUnsafeKeys(input);
  const warnings: string[] = [];
  if (input.master_pause_active) warnings.push('Master pause is active. Digest may report status, but must not create or execute actions.');
  if (input.emergency_safe_mode) warnings.push('Emergency safe mode is active. Digest remains reporting-only.');
  if (input.force) warnings.push('force=true is ignored by the Daily Action Digest module.');

  const buckets = {
    actionsExecuted: [] as DailyActionDigestItem[],
    actionsFailed: [] as DailyActionDigestItem[],
    waitingForApproval: [] as DailyActionDigestItem[],
    blockedByPolicy: [] as DailyActionDigestItem[],
  };

  for (const action of input.actions ?? []) {
    const item = toDigestItem(action);
    const bucket = classifyAction(action);
    if (bucket === 'executed') buckets.actionsExecuted.push(item);
    if (bucket === 'failed') buckets.actionsFailed.push(item);
    if (bucket === 'waiting_for_approval') buckets.waitingForApproval.push(item);
    if (bucket === 'blocked_by_policy') buckets.blockedByPolicy.push(item);
  }

  const counts = {
    total: buckets.actionsExecuted.length + buckets.actionsFailed.length + buckets.waitingForApproval.length + buckets.blockedByPolicy.length,
    executed: buckets.actionsExecuted.length,
    failed: buckets.actionsFailed.length,
    waitingForApproval: buckets.waitingForApproval.length,
    blockedByPolicy: buckets.blockedByPolicy.length,
  };

  const recommendations: string[] = [];
  if (counts.failed > 0) recommendations.push('Review failed actions first and check executor/result logs before retrying.');
  if (counts.waitingForApproval > 0) recommendations.push('Review pending approvals so safe founder-approved actions do not stall.');
  if (counts.blockedByPolicy > 0) recommendations.push('Keep blocked actions blocked unless the founder intentionally updates policy rules.');
  if (counts.executed > 0 && counts.failed === 0) recommendations.push('Executed actions look clean; keep monitoring result logs and customer/ad performance.');
  if (counts.total === 0) recommendations.push('No V2 actions need attention; continue monitoring metrics and inbox signals.');

  const briefText = [
    `${businessDayLabel}: ${counts.executed} action(s) executed, ${counts.failed} failed, ${counts.waitingForApproval} waiting for approval, and ${counts.blockedByPolicy} blocked by policy.`,
    recommendations[0] ? `Recommended next: ${recommendations[0]}` : 'Recommended next: continue monitoring.',
  ].join(' ');

  let decision: DailyActionDigestPreviewResult['decision'] = warnings.length ? 'digest_ready_with_warnings' : 'digest_ready';
  if (issues.length > 0 || input.emergency_safe_mode) decision = 'blocked_by_safety_gate';

  return {
    phase: 'V2 Phase 15.8 — Daily Action Digest',
    healthMode: DAILY_ACTION_DIGEST_HEALTH_MODE,
    deliverable: 'v2_daily_brief_action_digest',
    decision,
    businessDayLabel,
    generatedAt,
    counts,
    sections: buckets,
    briefText,
    recommendations: input.include_recommendations === false ? [] : recommendations,
    issues,
    warnings,
    wouldUpdateDailyBriefContent: true,
    wouldCreateActionThisPhase: false,
    wouldExecuteActionThisPhase: false,
    wouldCallExternalConnectorThisPhase: false,
    safety: DAILY_ACTION_DIGEST_SAFETY,
  };
}

export function buildDailyActionDigestExample(): DailyActionDigestPreviewResult {
  return previewDailyActionDigest({
    business_day_label: 'Today',
    include_recommendations: true,
    actions: [
      {
        id: 'act_content_001',
        title: 'Published approved Instagram post',
        action_type: 'content_publish',
        category: 'content',
        status: 'executed',
        risk_level: 'low',
        result_summary: 'Sandbox/approved result log confirmed publication path.',
        executed_at: '2026-07-09T08:10:00.000Z',
      },
      {
        id: 'act_support_002',
        title: 'Support reply to shipping question',
        action_type: 'support_reply_send',
        category: 'support',
        status: 'approval_required',
        risk_level: 'medium',
        reason: 'Manual approval remains required for support sends.',
        created_at: '2026-07-09T08:30:00.000Z',
      },
      {
        id: 'act_ads_003',
        title: 'Increase Meta budget by 20%',
        action_type: 'adjust_budget',
        category: 'ads',
        status: 'policy_blocked',
        risk_level: 'critical',
        blocked_reason: 'Policy blocked because budget change exceeded hard cap.',
        created_at: '2026-07-09T08:45:00.000Z',
      },
      {
        id: 'act_support_004',
        title: 'Send support reply',
        action_type: 'support_reply_send',
        category: 'support',
        status: 'failed',
        risk_level: 'high',
        failure_reason: 'Thread association failed before provider call.',
        created_at: '2026-07-09T08:55:00.000Z',
      },
    ],
  });
}

export function buildDailyActionDigestReport(): DailyActionDigestReport {
  return {
    phase: 'V2 Phase 15.8 — Daily Action Digest',
    healthMode: DAILY_ACTION_DIGEST_HEALTH_MODE,
    deliverable: 'v2_daily_brief_action_digest',
    purpose: 'Add a V2 Daily Brief action digest builder that summarizes executed actions, failed actions, pending approvals, policy-blocked actions, and recommended next steps without creating or executing any action.',
    backendFiles: [
      'apps/api/src/modules/orchestrator/daily-action-digest.types.ts',
      'apps/api/src/modules/orchestrator/daily-action-digest.model.ts',
      'apps/api/src/modules/orchestrator/daily-action-digest.controller.ts',
      'apps/api/src/modules/orchestrator/daily-action-digest.routes.ts',
      'apps/api/src/modules/orchestrator/daily-action-digest-tests.ts',
    ],
    apiEndpoints: [
      'GET /api/v1/orchestrator/daily-action-digest/status',
      'GET /api/v1/orchestrator/daily-action-digest/report',
      'GET /api/v1/orchestrator/daily-action-digest/example',
      'POST /api/v1/orchestrator/daily-action-digest/preview',
    ],
    dailyBriefSections: [
      'Actions executed',
      'Actions failed',
      'Actions waiting for approval',
      'Actions blocked by policy',
      'What LIFE.SAVER recommends next',
    ],
    recommendationRules: [
      'Failed actions come first because hidden failures are forbidden.',
      'Pending approvals are surfaced so the founder can decide.',
      'Policy-blocked actions stay blocked unless policy is intentionally changed.',
      'Executed actions are reported only when result status confirms execution.',
    ],
    safetyRules: [
      'Digest builder only; no scheduler/job enablement in this phase.',
      'No action creation, approval, execution, auto-run, connector call, or real-world mutation.',
      'No raw secrets, raw provider payloads, or sensitive internal payloads in digest output.',
    ],
    examplePreview: buildDailyActionDigestExample(),
    safety: DAILY_ACTION_DIGEST_SAFETY,
    nextStep: 'Phase 15.9 — Cost Caps + Anomaly Alerts',
  };
}

export function assertDailyActionDigestSafe(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const field of SECRET_LIKE_FIELDS) {
    if (serialized.includes(`"${field}"`)) {
      throw new Error(`Unsafe digest output contains secret-like field ${field}`);
    }
  }
}
