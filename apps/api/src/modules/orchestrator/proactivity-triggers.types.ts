import type { RequestClassifierRoute } from './request-classifier.types.js';

export type ProactivityTriggerHealthMode = 'v2-phase-15-6-proactive-triggers';

export type ProactivityTriggerKey =
  | 'roas_drop'
  | 'new_support_ticket'
  | 'scheduled_content_slot'
  | 'weekly_ad_review'
  | 'pending_action_reminder'
  | 'failed_executor_event';

export type ProactivityTriggerSource =
  | 'metrics_event'
  | 'support_ticket'
  | 'scheduled_job'
  | 'action_event'
  | 'executor_event'
  | 'manual_preview';

export type ProactivityTriggerSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ProactivityTriggerDecision = 'ignored' | 'eligible_for_future_review' | 'blocked_by_safety_gate';

export interface ProactivityTriggerDefinition {
  triggerKey: ProactivityTriggerKey;
  label: string;
  purpose: string;
  acceptedSources: ProactivityTriggerSource[];
  targetRoute: RequestClassifierRoute;
  targetSpecialist: string;
  signalFields: string[];
  defaultSeverity: ProactivityTriggerSeverity;
  futureSafeOutput: string;
  requiredSafetyGates: string[];
  forbiddenThisPhase: string[];
}

export interface ProactivityTriggerSafety {
  triggerFrameworkOnly: true;
  noBackgroundSchedulerEnabled: true;
  noProactiveJobsEnabled: true;
  noEventListenerEnabled: true;
  noActionCreated: true;
  noNotificationSent: true;
  noClaudeCallFromTrigger: true;
  noToolInvocation: true;
  noExternalConnectorCalled: true;
  noExecutorCalled: true;
  noAutoRunEnabled: true;
  noContentPublished: true;
  noSupportReplySent: true;
  noAdsMutation: true;
  noDatabaseMigrationRequired: true;
  noRawSecretsReturned: true;
}

export interface ProactivityTriggerInput {
  trigger_key?: ProactivityTriggerKey | string;
  source?: ProactivityTriggerSource | string;
  event_type?: string;
  workspace_id?: string;
  payload?: Record<string, unknown>;
  master_pause_active?: boolean;
  category_pause_active?: boolean;
  emergency_safe_mode?: boolean;
  force?: boolean;
}

export interface ProactivityTriggerPreviewResult {
  phase: 'V2 Phase 15.6 — Proactive Triggers';
  healthMode: ProactivityTriggerHealthMode;
  deliverable: 'proactivity_trigger_framework';
  triggerKey: ProactivityTriggerKey | null;
  decision: ProactivityTriggerDecision;
  matchedDefinition: ProactivityTriggerDefinition | null;
  targetRoute: RequestClassifierRoute | null;
  targetSpecialist: string | null;
  severity: ProactivityTriggerSeverity;
  wouldCreateActionThisPhase: false;
  wouldSendNotificationThisPhase: false;
  wouldCallClaudeThisPhase: false;
  wouldInvokeToolThisPhase: false;
  wouldExecuteThisPhase: false;
  recommendedFutureHandling: string[];
  issues: string[];
  warnings: string[];
  safety: ProactivityTriggerSafety;
}

export interface ProactivityTriggerStatus {
  phase: 'V2 Phase 15.6 — Proactive Triggers';
  healthMode: ProactivityTriggerHealthMode;
  deliverable: 'proactivity_trigger_framework';
  supportedTriggers: ProactivityTriggerKey[];
  frameworkOnly: true;
  backgroundSchedulerEnabled: false;
  proactiveJobsEnabled: false;
  eventListenerEnabled: false;
  actionCreationEnabled: false;
  notificationSendingEnabled: false;
  claudeTriggerCallEnabled: false;
  toolInvocationEnabled: false;
  executorEnabled: false;
  autoRunEnabled: false;
  nextStep: 'Phase 15.7 — Voice Input';
}

export interface ProactivityTriggerReport {
  phase: 'V2 Phase 15.6 — Proactive Triggers';
  healthMode: ProactivityTriggerHealthMode;
  deliverable: 'proactivity_trigger_framework';
  purpose: string;
  definitions: ProactivityTriggerDefinition[];
  apiEndpoints: string[];
  frameworkRules: string[];
  exampleInputs: Record<ProactivityTriggerKey, ProactivityTriggerInput>;
  examplePreviews: Record<ProactivityTriggerKey, ProactivityTriggerPreviewResult>;
  safety: ProactivityTriggerSafety;
  nextStep: 'Phase 15.7 — Voice Input';
}
