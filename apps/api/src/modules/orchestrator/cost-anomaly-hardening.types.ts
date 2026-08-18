export type CostAnomalyHealthMode = 'v2-phase-15-9-cost-anomaly-hardening';

export type CostCapKey =
  | 'claude_model_usage'
  | 'executor_rate'
  | 'notification_sends'
  | 'auto_actions_per_hour'
  | 'auto_actions_per_day';

export type AnomalyAlertKey =
  | 'unexpected_action_volume'
  | 'api_failures'
  | 'cap_exceeded'
  | 'suspicious_policy_behavior';

export type CostAnomalyDecision = 'within_caps' | 'warning' | 'blocked_by_cap' | 'blocked_by_safety_gate';

export interface CostAnomalySafety {
  hardeningOnly: true;
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

export interface CostCapDefinition {
  key: CostCapKey;
  label: string;
  unit: 'usd' | 'tokens' | 'count';
  defaultLimit: number;
  severityWhenExceeded: 'warning' | 'block';
  description: string;
}

export interface AnomalyAlertDefinition {
  key: AnomalyAlertKey;
  label: string;
  defaultSeverity: 'warning' | 'critical';
  signals: string[];
  recommendedResponse: string;
}

export interface CostAnomalyUsageInput {
  claude_model_cost_today?: number;
  claude_model_tokens_today?: number;
  executor_calls_last_hour?: number;
  executor_calls_today?: number;
  notification_sends_today?: number;
  auto_actions_last_hour?: number;
  auto_actions_today?: number;
  api_failures_last_hour?: number;
  policy_blocks_last_hour?: number;
  policy_changes_last_hour?: number;
  unexpected_action_volume_count?: number;
}

export interface CostAnomalyLimitInput {
  max_model_cost_per_day?: number;
  max_model_tokens_per_day?: number;
  max_executor_calls_per_hour?: number;
  max_notification_sends_per_day?: number;
  max_auto_actions_per_hour?: number;
  max_auto_actions_per_day?: number;
  max_api_failures_per_hour?: number;
  max_policy_changes_per_hour?: number;
}

export interface CostAnomalyPreviewInput {
  usage?: CostAnomalyUsageInput;
  limits?: CostAnomalyLimitInput;
  master_pause_active?: boolean;
  emergency_safe_mode?: boolean;
  force?: boolean;
  raw_payload?: unknown;
  api_key?: string;
  access_token?: string;
  claude_api_key?: string;
}

export interface CostAnomalyCapResult {
  key: string;
  label: string;
  current: number;
  limit: number;
  unit: string;
  exceeded: boolean;
  remaining: number;
  severity: 'ok' | 'warning' | 'block';
}

export interface CostAnomalyAlertResult {
  key: AnomalyAlertKey;
  label: string;
  triggered: boolean;
  severity: 'info' | 'warning' | 'critical';
  evidence: string[];
  recommendedResponse: string;
}

export interface CostAnomalyPreviewResult {
  phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts';
  healthMode: CostAnomalyHealthMode;
  deliverable: 'cost_and_anomaly_hardening';
  decision: CostAnomalyDecision;
  capResults: CostAnomalyCapResult[];
  alerts: CostAnomalyAlertResult[];
  summary: string;
  issues: string[];
  warnings: string[];
  wouldSendNotificationThisPhase: false;
  wouldCreateActionThisPhase: false;
  wouldExecuteActionThisPhase: false;
  wouldCallClaudeThisPhase: false;
  wouldCallExternalConnectorThisPhase: false;
  safety: CostAnomalySafety;
}

export interface CostAnomalyStatus {
  phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts';
  healthMode: CostAnomalyHealthMode;
  deliverable: 'cost_and_anomaly_hardening';
  costCapsDefined: true;
  anomalyAlertsDefined: true;
  previewEvaluatorAdded: true;
  schedulerEnabled: false;
  notificationSendingEnabled: false;
  actionCreationEnabled: false;
  executorEnabled: false;
  autoRunEnabled: false;
  externalConnectorCallEnabled: false;
  nextStep: 'Phase 15.10 — V2 Release Readiness';
}

export interface CostAnomalyReport {
  phase: 'V2 Phase 15.9 — Cost Caps + Anomaly Alerts';
  healthMode: CostAnomalyHealthMode;
  deliverable: 'cost_and_anomaly_hardening';
  purpose: string;
  backendFiles: string[];
  apiEndpoints: string[];
  costCaps: CostCapDefinition[];
  anomalyAlerts: AnomalyAlertDefinition[];
  safetyRules: string[];
  examplePreview: CostAnomalyPreviewResult;
  safety: CostAnomalySafety;
  nextStep: 'Phase 15.10 — V2 Release Readiness';
}
