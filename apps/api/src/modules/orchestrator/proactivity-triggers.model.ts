import type { RequestClassifierRoute } from './request-classifier.types.js';
import type {
  ProactivityTriggerDefinition,
  ProactivityTriggerInput,
  ProactivityTriggerKey,
  ProactivityTriggerPreviewResult,
  ProactivityTriggerReport,
  ProactivityTriggerSafety,
  ProactivityTriggerSeverity,
  ProactivityTriggerSource,
  ProactivityTriggerStatus,
} from './proactivity-triggers.types.js';

export const PROACTIVITY_TRIGGERS_PHASE = 'phase_15_6_proactive_triggers' as const;
export const PROACTIVITY_TRIGGERS_HEALTH_MODE = 'v2-phase-15-6-proactive-triggers' as const;
export const PROACTIVITY_TRIGGERS_PACKAGE = 'lifesaver-v0.7.0-phase-15-6-proactive-triggers.zip' as const;

export const PROACTIVITY_TRIGGER_KEYS: ProactivityTriggerKey[] = [
  'roas_drop',
  'new_support_ticket',
  'scheduled_content_slot',
  'weekly_ad_review',
  'pending_action_reminder',
  'failed_executor_event',
];

const VALID_SOURCES: ProactivityTriggerSource[] = [
  'metrics_event',
  'support_ticket',
  'scheduled_job',
  'action_event',
  'executor_event',
  'manual_preview',
];

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'client_secret',
  'authorization: bearer',
  'raw_provider_payload',
  'raw_payload',
  'x-api-key',
  'database_url',
  'claude_api_key',
  'triple whale api key',
  'gmail raw',
  'mime-version',
  'meta access token',
  'google ads refresh token',
];

export const PROACTIVITY_TRIGGER_DEFINITIONS: ProactivityTriggerDefinition[] = [
  {
    triggerKey: 'roas_drop',
    label: 'ROAS drop',
    purpose: 'Detect a meaningful ROAS decline and route it to ads/research review without mutating campaigns.',
    acceptedSources: ['metrics_event', 'manual_preview'],
    targetRoute: 'ads',
    targetSpecialist: 'ads_specialist',
    signalFields: ['roas_current', 'roas_previous', 'roas_delta_percent', 'ad_spend_current', 'window'],
    defaultSeverity: 'high',
    futureSafeOutput: 'Create a reviewed ads investigation or proposed action only after policy and approval gates pass.',
    requiredSafetyGates: ['metrics must be verified', 'ads caps must pass', 'master pause off', 'ads pause off', 'no direct budget mutation'],
    forbiddenThisPhase: ['No Meta/Google Ads API calls', 'No budget change', 'No campaign pause', 'No automatic action creation'],
  },
  {
    triggerKey: 'new_support_ticket',
    label: 'New support ticket',
    purpose: 'Route a newly imported support ticket to support classification and draft review.',
    acceptedSources: ['support_ticket', 'manual_preview'],
    targetRoute: 'support',
    targetSpecialist: 'support_specialist',
    signalFields: ['ticket_id', 'thread_id', 'category', 'confidence_score', 'sensitive_flag'],
    defaultSeverity: 'medium',
    futureSafeOutput: 'Create a support draft or proposed reply only after ticket privacy and sensitive-ticket gates pass.',
    requiredSafetyGates: ['support connector read-only import stable', 'sensitive ticket guard', 'bulk send guard', 'thread association'],
    forbiddenThisPhase: ['No support auto-send', 'No Gmail send', 'No raw ticket payload exposure', 'No automatic action creation'],
  },
  {
    triggerKey: 'scheduled_content_slot',
    label: 'Scheduled content slot',
    purpose: 'Detect a future content slot and route it to content planning/drafting, not publishing.',
    acceptedSources: ['scheduled_job', 'manual_preview'],
    targetRoute: 'content',
    targetSpecialist: 'content_specialist',
    signalFields: ['slot_at', 'platform', 'campaign', 'content_type', 'brand_voice_id'],
    defaultSeverity: 'low',
    futureSafeOutput: 'Create a draft or proposed content action only after content rules and caps pass.',
    requiredSafetyGates: ['content pause off', 'post cap ready', 'approved style available', 'manual approval if real publishing'],
    forbiddenThisPhase: ['No scheduled publish job', 'No content publish', 'No external social API call', 'No automatic action creation'],
  },
  {
    triggerKey: 'weekly_ad_review',
    label: 'Weekly ad review',
    purpose: 'Route weekly paid-media review to ads specialist recommendations without direct ad control.',
    acceptedSources: ['scheduled_job', 'metrics_event', 'manual_preview'],
    targetRoute: 'ads',
    targetSpecialist: 'ads_specialist',
    signalFields: ['week_start', 'week_end', 'spend', 'roas', 'campaign_count'],
    defaultSeverity: 'info',
    futureSafeOutput: 'Create a weekly ad review brief and optional proposed actions for approval.',
    requiredSafetyGates: ['Triple Whale read-only metrics', 'ads connector audit separation', 'hard caps for any later action'],
    forbiddenThisPhase: ['No ad API writes', 'No budget changes', 'No campaign pauses', 'No automatic action creation'],
  },
  {
    triggerKey: 'pending_action_reminder',
    label: 'Pending action reminder',
    purpose: 'Detect old pending actions and prepare reminder metadata without sending a notification.',
    acceptedSources: ['action_event', 'scheduled_job', 'manual_preview'],
    targetRoute: 'general_advisor',
    targetSpecialist: 'life_saver_front_voice',
    signalFields: ['action_id', 'action_type', 'age_hours', 'risk_level', 'status'],
    defaultSeverity: 'medium',
    futureSafeOutput: 'Create a notification/reminder only after notification preferences and quiet hours pass.',
    requiredSafetyGates: ['auth required', 'deep link requires login', 'quiet hours respected', 'no auto-approval from link'],
    forbiddenThisPhase: ['No notification send', 'No email send', 'No auto-approval', 'No automatic action creation'],
  },
  {
    triggerKey: 'failed_executor_event',
    label: 'Failed executor event',
    purpose: 'Route failed executor results to human review, risk sign-off, and potential rollback planning.',
    acceptedSources: ['executor_event', 'action_event', 'manual_preview'],
    targetRoute: 'dev',
    targetSpecialist: 'dev_specialist',
    signalFields: ['action_id', 'executor_name', 'result_status', 'failure_reason', 'rollback_supported'],
    defaultSeverity: 'critical',
    futureSafeOutput: 'Mark for human review and draft a rollback/follow-up recommendation; never hide the failure.',
    requiredSafetyGates: ['result log exists', 'failure visible', 'rollback policy followed', 'manual approval for any correction action'],
    forbiddenThisPhase: ['No automatic rollback', 'No external API call', 'No retry loop', 'No failure suppression'],
  },
];

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function cleanLower(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function normalizeKey(value: unknown): ProactivityTriggerKey | null {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return PROACTIVITY_TRIGGER_KEYS.includes(normalized as ProactivityTriggerKey) ? normalized as ProactivityTriggerKey : null;
}

function normalizeSource(value: unknown): ProactivityTriggerSource {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return VALID_SOURCES.includes(normalized as ProactivityTriggerSource) ? normalized as ProactivityTriggerSource : 'manual_preview';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasForbiddenFragment(value: unknown): string | null {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return FORBIDDEN_OUTPUT_FRAGMENTS.find((fragment) => text.includes(fragment)) || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function inferTriggerFromInput(input: ProactivityTriggerInput): ProactivityTriggerKey | null {
  const explicit = normalizeKey(input.trigger_key);
  if (explicit) return explicit;
  const eventType = cleanLower(input.event_type).replace(/[\s-]+/g, '_');
  const source = normalizeSource(input.source);
  if (eventType.includes('roas') || eventType.includes('performance_drop')) return 'roas_drop';
  if (eventType.includes('support') || eventType.includes('ticket') || source === 'support_ticket') return 'new_support_ticket';
  if (eventType.includes('content_slot') || eventType.includes('scheduled_content')) return 'scheduled_content_slot';
  if (eventType.includes('weekly_ad') || eventType.includes('ad_review')) return 'weekly_ad_review';
  if (eventType.includes('pending') || eventType.includes('reminder')) return 'pending_action_reminder';
  if (eventType.includes('failed') || eventType.includes('executor') || source === 'executor_event') return 'failed_executor_event';
  return null;
}

function computeSeverity(key: ProactivityTriggerKey | null, payload: Record<string, unknown>): ProactivityTriggerSeverity {
  if (!key) return 'low';
  if (key === 'roas_drop') {
    const delta = asNumber(payload.roas_delta_percent);
    if (delta !== null && delta <= -50) return 'critical';
    if (delta !== null && delta <= -20) return 'high';
    return 'medium';
  }
  if (key === 'new_support_ticket') {
    if (payload.sensitive_flag === true) return 'high';
    const confidence = asNumber(payload.confidence_score);
    if (confidence !== null && confidence < 0.65) return 'high';
    return 'medium';
  }
  if (key === 'pending_action_reminder') {
    const ageHours = asNumber(payload.age_hours);
    if (ageHours !== null && ageHours >= 48) return 'high';
    return 'medium';
  }
  if (key === 'failed_executor_event') return 'critical';
  return PROACTIVITY_TRIGGER_DEFINITIONS.find((item) => item.triggerKey === key)?.defaultSeverity || 'low';
}

export function buildProactivityTriggerSafety(): ProactivityTriggerSafety {
  return {
    triggerFrameworkOnly: true,
    noBackgroundSchedulerEnabled: true,
    noProactiveJobsEnabled: true,
    noEventListenerEnabled: true,
    noActionCreated: true,
    noNotificationSent: true,
    noClaudeCallFromTrigger: true,
    noToolInvocation: true,
    noExternalConnectorCalled: true,
    noExecutorCalled: true,
    noAutoRunEnabled: true,
    noContentPublished: true,
    noSupportReplySent: true,
    noAdsMutation: true,
    noDatabaseMigrationRequired: true,
    noRawSecretsReturned: true,
  };
}

export function buildProactivityTriggerStatus(): ProactivityTriggerStatus {
  return {
    phase: 'V2 Phase 15.6 — Proactive Triggers',
    healthMode: PROACTIVITY_TRIGGERS_HEALTH_MODE,
    deliverable: 'proactivity_trigger_framework',
    supportedTriggers: PROACTIVITY_TRIGGER_KEYS,
    frameworkOnly: true,
    backgroundSchedulerEnabled: false,
    proactiveJobsEnabled: false,
    eventListenerEnabled: false,
    actionCreationEnabled: false,
    notificationSendingEnabled: false,
    claudeTriggerCallEnabled: false,
    toolInvocationEnabled: false,
    executorEnabled: false,
    autoRunEnabled: false,
    nextStep: 'Phase 15.7 — Voice Input',
  };
}

export function buildProactivityTriggerExamples(): Record<ProactivityTriggerKey, ProactivityTriggerInput> {
  return {
    roas_drop: {
      trigger_key: 'roas_drop',
      source: 'metrics_event',
      event_type: 'roas_drop_detected',
      workspace_id: 'workspace_preview_safe',
      payload: { roas_current: 1.4, roas_previous: 2.2, roas_delta_percent: -36.36, ad_spend_current: 2400, window: '24h' },
    },
    new_support_ticket: {
      trigger_key: 'new_support_ticket',
      source: 'support_ticket',
      event_type: 'new_support_ticket_imported',
      workspace_id: 'workspace_preview_safe',
      payload: { ticket_id: 'ticket_preview_001', thread_id: 'gmail_thread_preview_001', category: 'faq', confidence_score: 0.91, sensitive_flag: false },
    },
    scheduled_content_slot: {
      trigger_key: 'scheduled_content_slot',
      source: 'scheduled_job',
      event_type: 'scheduled_content_slot_due',
      workspace_id: 'workspace_preview_safe',
      payload: { slot_at: '2026-07-10T10:00:00Z', platform: 'linkedin', campaign: 'weekly founder insight', content_type: 'text_post' },
    },
    weekly_ad_review: {
      trigger_key: 'weekly_ad_review',
      source: 'scheduled_job',
      event_type: 'weekly_ad_review_due',
      workspace_id: 'workspace_preview_safe',
      payload: { week_start: '2026-07-01', week_end: '2026-07-07', spend: 8400, roas: 2.1, campaign_count: 9 },
    },
    pending_action_reminder: {
      trigger_key: 'pending_action_reminder',
      source: 'action_event',
      event_type: 'pending_action_reminder_due',
      workspace_id: 'workspace_preview_safe',
      payload: { action_id: 'action_preview_001', action_type: 'support_reply_send', age_hours: 18, risk_level: 'medium', status: 'approval_required' },
    },
    failed_executor_event: {
      trigger_key: 'failed_executor_event',
      source: 'executor_event',
      event_type: 'executor_failed',
      workspace_id: 'workspace_preview_safe',
      payload: { action_id: 'action_preview_002', executor_name: 'sandbox_ads_budget_executor', result_status: 'failed', failure_reason: 'sandbox forced failure', rollback_supported: true },
    },
  };
}

export function previewProactivityTrigger(input: unknown): ProactivityTriggerPreviewResult {
  const typed = isPlainObject(input) ? input as ProactivityTriggerInput : {};
  const payload = isPlainObject(typed.payload) ? typed.payload : {};
  const triggerKey = inferTriggerFromInput(typed);
  const definition = triggerKey ? PROACTIVITY_TRIGGER_DEFINITIONS.find((item) => item.triggerKey === triggerKey) || null : null;
  const source = normalizeSource(typed.source);
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!triggerKey) issues.push('A supported trigger_key or recognizable event_type is required.');
  if (definition && !definition.acceptedSources.includes(source)) {
    issues.push(`Source ${source} is not accepted for trigger ${definition.triggerKey}.`);
  }
  if (typed.master_pause_active === true) issues.push('Master pause is active; proactive trigger handling is blocked.');
  if (typed.category_pause_active === true) issues.push('Relevant category pause is active; proactive trigger handling is blocked.');
  if (typed.emergency_safe_mode === true) issues.push('Emergency safe mode is active; proactive trigger handling is blocked.');
  if (typed.force === true) warnings.push('force=true ignored; proactive triggers cannot bypass pause, approval, caps, policy, or manual review.');

  const forbidden = hasForbiddenFragment(typed);
  if (forbidden) issues.push(`Input contains forbidden secret/raw-payload fragment: ${forbidden}`);

  if (definition) {
    const missingSignals = definition.signalFields.filter((field) => !(field in payload));
    if (missingSignals.length) warnings.push(`Missing optional signal fields for richer future evaluation: ${missingSignals.slice(0, 4).join(', ')}${missingSignals.length > 4 ? '…' : ''}`);
  }

  const decision = issues.length ? 'blocked_by_safety_gate' : definition ? 'eligible_for_future_review' : 'ignored';
  const severity = computeSeverity(triggerKey, payload);
  const route: RequestClassifierRoute | null = definition?.targetRoute ?? null;

  return {
    phase: 'V2 Phase 15.6 — Proactive Triggers',
    healthMode: PROACTIVITY_TRIGGERS_HEALTH_MODE,
    deliverable: 'proactivity_trigger_framework',
    triggerKey,
    decision,
    matchedDefinition: definition,
    targetRoute: route,
    targetSpecialist: definition?.targetSpecialist ?? null,
    severity,
    wouldCreateActionThisPhase: false,
    wouldSendNotificationThisPhase: false,
    wouldCallClaudeThisPhase: false,
    wouldInvokeToolThisPhase: false,
    wouldExecuteThisPhase: false,
    recommendedFutureHandling: definition ? [
      definition.futureSafeOutput,
      'Keep founder-visible review before any action creation, notification, execution, or rollback.',
      'Respect master pause, category pause, emergency safe mode, hard caps, permissions, audit logs, and result logs.',
    ] : [
      'Ignore unrecognized event until a supported trigger definition exists.',
    ],
    issues,
    warnings,
    safety: buildProactivityTriggerSafety(),
  };
}

export function buildProactivityTriggerReport(): ProactivityTriggerReport {
  const examples = buildProactivityTriggerExamples();
  const previews = Object.fromEntries(
    PROACTIVITY_TRIGGER_KEYS.map((key) => [key, previewProactivityTrigger(examples[key])]),
  ) as Record<ProactivityTriggerKey, ProactivityTriggerPreviewResult>;
  return {
    phase: 'V2 Phase 15.6 — Proactive Triggers',
    healthMode: PROACTIVITY_TRIGGERS_HEALTH_MODE,
    deliverable: 'proactivity_trigger_framework',
    purpose: 'Define the safe V2 proactivity trigger framework for ROAS drops, new support tickets, scheduled content slots, weekly ad reviews, pending action reminders, and failed executor events. Phase 15.6 evaluates and routes trigger intent only; it does not enable background jobs, event listeners, notifications, action creation, tool invocation, external connectors, executors, or auto-run.',
    definitions: PROACTIVITY_TRIGGER_DEFINITIONS,
    apiEndpoints: [
      'GET /api/v1/orchestrator/proactivity-triggers/status',
      'GET /api/v1/orchestrator/proactivity-triggers/report',
      'GET /api/v1/orchestrator/proactivity-triggers/registry',
      'GET /api/v1/orchestrator/proactivity-triggers/example',
      'POST /api/v1/orchestrator/proactivity-triggers/preview',
    ],
    frameworkRules: [
      'A proactive trigger may identify a future route/specialist, but it cannot create an action in this phase.',
      'A proactive trigger cannot send notifications, call Claude, invoke tools, call external connectors, execute, or auto-run in this phase.',
      'Master pause, category pause, and emergency safe mode block trigger handling.',
      'Secret-like payload fragments and raw provider payloads are rejected.',
      'Any future action created from a trigger must use existing approval, policy, hard-cap, audit, and result-log gates.',
      'Failed executor events must remain visible and must never be hidden by proactivity logic.',
    ],
    exampleInputs: examples,
    examplePreviews: previews,
    safety: buildProactivityTriggerSafety(),
    nextStep: 'Phase 15.7 — Voice Input',
  };
}

export function assertProactivityTriggerSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Proactivity trigger output contains forbidden fragment: ${fragment}`);
    }
  }
}
