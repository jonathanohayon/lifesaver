import type {
  AnomalyAlertDefinition,
  CostAnomalyAlertResult,
  CostAnomalyCapResult,
  CostAnomalyLimitInput,
  CostAnomalyPreviewInput,
  CostAnomalyPreviewResult,
  CostAnomalyReport,
  CostAnomalySafety,
  CostAnomalyStatus,
  CostAnomalyUsageInput,
  CostCapDefinition,
} from './cost-anomaly-hardening.types.js';

export const COST_ANOMALY_PHASE = 'phase_15_9_cost_anomaly_hardening' as const;
export const COST_ANOMALY_HEALTH_MODE = 'v2-phase-15-9-cost-anomaly-hardening' as const;
export const COST_ANOMALY_PACKAGE = 'lifesaver-v0.7.0-phase-15-9-cost-caps-anomaly-alerts.zip' as const;

export const COST_ANOMALY_SAFETY: CostAnomalySafety = {
  hardeningOnly: true,
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

const SECRET_LIKE_FIELDS = ['api_key', 'access_token', 'refresh_token', 'authorization', 'client_secret', 'database_url', 'password', 'raw_payload', 'claude_api_key'];

export const COST_CAP_DEFINITIONS: CostCapDefinition[] = [
  {
    key: 'claude_model_usage',
    label: 'Claude/model usage',
    unit: 'usd',
    defaultLimit: 25,
    severityWhenExceeded: 'block',
    description: 'Blocks additional autonomous AI-heavy work when model spend exceeds the configured daily cost cap.',
  },
  {
    key: 'executor_rate',
    label: 'Executor rate',
    unit: 'count',
    defaultLimit: 20,
    severityWhenExceeded: 'block',
    description: 'Blocks executor bursts when too many execution attempts happen within one hour.',
  },
  {
    key: 'notification_sends',
    label: 'Notification sends',
    unit: 'count',
    defaultLimit: 50,
    severityWhenExceeded: 'warning',
    description: 'Warns when notification volume is high so the founder is not spammed by approval/reminder traffic.',
  },
  {
    key: 'auto_actions_per_hour',
    label: 'Auto-actions per hour',
    unit: 'count',
    defaultLimit: 5,
    severityWhenExceeded: 'block',
    description: 'Blocks auto-action bursts above the configured hourly safety cap.',
  },
  {
    key: 'auto_actions_per_day',
    label: 'Auto-actions per day',
    unit: 'count',
    defaultLimit: 15,
    severityWhenExceeded: 'block',
    description: 'Blocks further auto-actions once the daily safety cap is reached.',
  },
];

export const ANOMALY_ALERT_DEFINITIONS: AnomalyAlertDefinition[] = [
  {
    key: 'unexpected_action_volume',
    label: 'Unexpected action volume',
    defaultSeverity: 'critical',
    signals: ['auto_actions_last_hour above threshold', 'executor_calls_last_hour above threshold', 'unexpected_action_volume_count above zero'],
    recommendedResponse: 'Pause autonomy and review recent action creation, policy decisions, and executor logs.',
  },
  {
    key: 'api_failures',
    label: 'API failures',
    defaultSeverity: 'warning',
    signals: ['api_failures_last_hour above threshold'],
    recommendedResponse: 'Stop retries, inspect connector health, and keep failed actions visible in the Daily Action Digest.',
  },
  {
    key: 'cap_exceeded',
    label: 'Cap exceeded',
    defaultSeverity: 'critical',
    signals: ['Any hard cap is exceeded'],
    recommendedResponse: 'Block auto-run and require founder/admin review before raising limits.',
  },
  {
    key: 'suspicious_policy_behavior',
    label: 'Suspicious policy behavior',
    defaultSeverity: 'critical',
    signals: ['policy_changes_last_hour above threshold', 'policy_blocks_last_hour unusually high'],
    recommendedResponse: 'Review policy audit history and keep most-restrictive-wins behavior active.',
  },
];

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 100) / 100;
}

function detectUnsafeKeys(input: unknown, path = ''): string[] {
  if (!input || typeof input !== 'object') return [];
  const issues: string[] = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (SECRET_LIKE_FIELDS.some((secretKey) => key.toLowerCase().includes(secretKey))) {
      issues.push(`Secret-like field is not allowed in cost/anomaly preview input: ${fullPath}`);
      continue;
    }
    if (value && typeof value === 'object') issues.push(...detectUnsafeKeys(value, fullPath));
  }
  return issues;
}

function capResult(key: string, label: string, current: number, limit: number, unit: string, severityWhenExceeded: 'warning' | 'block'): CostAnomalyCapResult {
  const exceeded = current > limit;
  return {
    key,
    label,
    current,
    limit,
    unit,
    exceeded,
    remaining: Math.max(0, Math.round((limit - current) * 100) / 100),
    severity: exceeded ? severityWhenExceeded : 'ok',
  };
}

function buildCapResults(usage: CostAnomalyUsageInput, limits: CostAnomalyLimitInput): CostAnomalyCapResult[] {
  return [
    capResult('max_model_cost_per_day', 'Claude/model cost today', numberValue(usage.claude_model_cost_today), numberValue(limits.max_model_cost_per_day, 25), 'usd', 'block'),
    capResult('max_model_tokens_per_day', 'Claude/model tokens today', numberValue(usage.claude_model_tokens_today), numberValue(limits.max_model_tokens_per_day, 250000), 'tokens', 'block'),
    capResult('max_executor_calls_per_hour', 'Executor calls last hour', numberValue(usage.executor_calls_last_hour), numberValue(limits.max_executor_calls_per_hour, 20), 'count', 'block'),
    capResult('max_notification_sends_per_day', 'Notification sends today', numberValue(usage.notification_sends_today), numberValue(limits.max_notification_sends_per_day, 50), 'count', 'warning'),
    capResult('max_auto_actions_per_hour', 'Auto-actions last hour', numberValue(usage.auto_actions_last_hour), numberValue(limits.max_auto_actions_per_hour, 5), 'count', 'block'),
    capResult('max_auto_actions_per_day', 'Auto-actions today', numberValue(usage.auto_actions_today), numberValue(limits.max_auto_actions_per_day, 15), 'count', 'block'),
  ];
}

function alertResult(def: AnomalyAlertDefinition, triggered: boolean, severity: CostAnomalyAlertResult['severity'], evidence: string[]): CostAnomalyAlertResult {
  return {
    key: def.key,
    label: def.label,
    triggered,
    severity: triggered ? severity : 'info',
    evidence,
    recommendedResponse: def.recommendedResponse,
  };
}

function buildAlerts(usage: CostAnomalyUsageInput, limits: CostAnomalyLimitInput, capResults: CostAnomalyCapResult[]): CostAnomalyAlertResult[] {
  const alerts: CostAnomalyAlertResult[] = [];
  const defs = Object.fromEntries(ANOMALY_ALERT_DEFINITIONS.map((item) => [item.key, item]));

  const actionVolumeEvidence: string[] = [];
  if (numberValue(usage.auto_actions_last_hour) > numberValue(limits.max_auto_actions_per_hour, 5)) actionVolumeEvidence.push('Auto-actions last hour exceeded threshold.');
  if (numberValue(usage.executor_calls_last_hour) > numberValue(limits.max_executor_calls_per_hour, 20)) actionVolumeEvidence.push('Executor calls last hour exceeded threshold.');
  if (numberValue(usage.unexpected_action_volume_count) > 0) actionVolumeEvidence.push('Unexpected action volume signal was provided.');
  alerts.push(alertResult(defs.unexpected_action_volume, actionVolumeEvidence.length > 0, 'critical', actionVolumeEvidence));

  const apiFailureEvidence: string[] = [];
  if (numberValue(usage.api_failures_last_hour) > numberValue(limits.max_api_failures_per_hour, 3)) apiFailureEvidence.push('API failures last hour exceeded threshold.');
  alerts.push(alertResult(defs.api_failures, apiFailureEvidence.length > 0, 'warning', apiFailureEvidence));

  const exceededCaps = capResults.filter((cap) => cap.exceeded);
  const capEvidence = exceededCaps.map((cap) => `${cap.label} exceeded ${cap.limit} ${cap.unit}.`);
  const capExceededSeverity = exceededCaps.some((cap) => cap.severity === 'block') ? 'critical' : 'warning';
  alerts.push(alertResult(defs.cap_exceeded, capEvidence.length > 0, capExceededSeverity, capEvidence));

  const policyEvidence: string[] = [];
  if (numberValue(usage.policy_changes_last_hour) > numberValue(limits.max_policy_changes_per_hour, 2)) policyEvidence.push('Policy changes last hour exceeded threshold.');
  if (numberValue(usage.policy_blocks_last_hour) >= 10) policyEvidence.push('Policy blocks last hour are unusually high.');
  alerts.push(alertResult(defs.suspicious_policy_behavior, policyEvidence.length > 0, 'critical', policyEvidence));

  return alerts;
}

export function buildCostAnomalyStatus(): CostAnomalyStatus {
  return {
    phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts',
    healthMode: COST_ANOMALY_HEALTH_MODE,
    deliverable: 'cost_and_anomaly_hardening',
    costCapsDefined: true,
    anomalyAlertsDefined: true,
    previewEvaluatorAdded: true,
    schedulerEnabled: false,
    notificationSendingEnabled: false,
    actionCreationEnabled: false,
    executorEnabled: false,
    autoRunEnabled: false,
    externalConnectorCallEnabled: false,
    nextStep: 'Phase 15.10 — V2 Release Readiness',
  };
}

export function previewCostAnomalyHardening(input: CostAnomalyPreviewInput = {}): CostAnomalyPreviewResult {
  const usage = input.usage ?? {};
  const limits = input.limits ?? {};
  const issues = detectUnsafeKeys(input);
  const warnings: string[] = [];

  if (input.master_pause_active) warnings.push('Master pause is active. Cost/anomaly hardening remains reporting-only and cannot create or execute actions.');
  if (input.emergency_safe_mode) warnings.push('Emergency safe mode is active. All autonomy must remain blocked.');
  if (input.force) warnings.push('force=true is ignored by the Cost Caps + Anomaly Alerts module.');

  const capResults = buildCapResults(usage, limits);
  const alerts = buildAlerts(usage, limits, capResults);
  const blockingCap = capResults.some((cap) => cap.exceeded && cap.severity === 'block');
  const warningCap = capResults.some((cap) => cap.exceeded && cap.severity === 'warning');
  const criticalAlert = alerts.some((alert) => alert.triggered && alert.severity === 'critical');
  const warningAlert = alerts.some((alert) => alert.triggered && alert.severity === 'warning');

  let decision: CostAnomalyPreviewResult['decision'] = 'within_caps';
  if (warningCap || warningAlert) decision = 'warning';
  if (blockingCap || criticalAlert) decision = 'blocked_by_cap';
  if (issues.length > 0 || input.emergency_safe_mode) decision = 'blocked_by_safety_gate';

  const exceededCount = capResults.filter((cap) => cap.exceeded).length;
  const triggeredAlerts = alerts.filter((alert) => alert.triggered).length;
  const summary = `${exceededCount} cap(s) exceeded and ${triggeredAlerts} anomaly alert(s) triggered. Decision: ${decision}.`;

  return {
    phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts',
    healthMode: COST_ANOMALY_HEALTH_MODE,
    deliverable: 'cost_and_anomaly_hardening',
    decision,
    capResults,
    alerts,
    summary,
    issues,
    warnings,
    wouldSendNotificationThisPhase: false,
    wouldCreateActionThisPhase: false,
    wouldExecuteActionThisPhase: false,
    wouldCallClaudeThisPhase: false,
    wouldCallExternalConnectorThisPhase: false,
    safety: COST_ANOMALY_SAFETY,
  };
}

export function buildCostAnomalyExample(): CostAnomalyPreviewResult {
  return previewCostAnomalyHardening({
    usage: {
      claude_model_cost_today: 18,
      claude_model_tokens_today: 150000,
      executor_calls_last_hour: 8,
      notification_sends_today: 12,
      auto_actions_last_hour: 2,
      auto_actions_today: 7,
      api_failures_last_hour: 1,
      policy_blocks_last_hour: 3,
      policy_changes_last_hour: 0,
    },
    limits: {
      max_model_cost_per_day: 25,
      max_model_tokens_per_day: 250000,
      max_executor_calls_per_hour: 20,
      max_notification_sends_per_day: 50,
      max_auto_actions_per_hour: 5,
      max_auto_actions_per_day: 15,
      max_api_failures_per_hour: 3,
      max_policy_changes_per_hour: 2,
    },
  });
}

export function buildCostAnomalyReport(): CostAnomalyReport {
  return {
    phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts',
    healthMode: COST_ANOMALY_HEALTH_MODE,
    deliverable: 'cost_and_anomaly_hardening',
    purpose: 'Define cost caps and anomaly-alert evaluation for Claude/model usage, executor rate, notification sends, auto-actions, unexpected action volume, API failures, cap exceeded conditions, and suspicious policy behavior.',
    backendFiles: [
      'apps/api/src/modules/orchestrator/cost-anomaly-hardening.types.ts',
      'apps/api/src/modules/orchestrator/cost-anomaly-hardening.model.ts',
      'apps/api/src/modules/orchestrator/cost-anomaly-hardening.controller.ts',
      'apps/api/src/modules/orchestrator/cost-anomaly-hardening.routes.ts',
      'apps/api/src/modules/orchestrator/cost-anomaly-hardening-tests.ts',
    ],
    apiEndpoints: [
      'GET /api/v1/orchestrator/cost-anomaly-hardening/status',
      'GET /api/v1/orchestrator/cost-anomaly-hardening/report',
      'GET /api/v1/orchestrator/cost-anomaly-hardening/example',
      'POST /api/v1/orchestrator/cost-anomaly-hardening/preview',
    ],
    costCaps: COST_CAP_DEFINITIONS,
    anomalyAlerts: ANOMALY_ALERT_DEFINITIONS,
    safetyRules: [
      'Hardening/evaluation only; no scheduler or notification sending in this phase.',
      'No action creation, approval, executor call, auto-run, Claude call, or external connector call.',
      'Cap exceedance blocks future autonomy paths until founder/admin review, but this phase only reports the decision.',
      'Secret-like input is rejected and raw secrets/provider payloads are never returned.',
    ],
    examplePreview: buildCostAnomalyExample(),
    safety: COST_ANOMALY_SAFETY,
    nextStep: 'Phase 15.10 — V2 Release Readiness',
  };
}

export function assertCostAnomalyOutputSafe(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const field of SECRET_LIKE_FIELDS) {
    if (serialized.includes(`"${field}"`)) {
      throw new Error(`Unsafe cost/anomaly output contains secret-like field ${field}`);
    }
  }
}
