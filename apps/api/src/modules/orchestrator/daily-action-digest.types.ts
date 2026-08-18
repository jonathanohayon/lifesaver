export type DailyActionDigestHealthMode = 'v2-phase-15-8-daily-action-digest';

export type DailyActionDigestBucket = 'executed' | 'failed' | 'waiting_for_approval' | 'blocked_by_policy';
export type DailyActionDigestDecision = 'digest_ready' | 'digest_ready_with_warnings' | 'blocked_by_safety_gate';

export interface DailyActionDigestSafety {
  digestBuilderOnly: true;
  noScheduledJobEnabled: true;
  noActionCreation: true;
  noActionApproval: true;
  noExecutorCall: true;
  noAutoRun: true;
  noExternalConnectorCall: true;
  noContentPublishing: true;
  noSupportSending: true;
  noAdsMutation: true;
  noRawSecretsReturned: true;
  noDatabaseMigrationRequired: true;
}

export interface DailyActionDigestActionInput {
  id?: string;
  title?: string;
  action_type?: string;
  category?: 'content' | 'support' | 'ads' | 'research' | 'dev' | 'notification' | 'unknown' | string;
  status?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical' | string;
  summary?: string;
  reason?: string;
  blocked_reason?: string;
  failure_reason?: string;
  created_at?: string;
  approved_at?: string;
  executed_at?: string;
  result_summary?: string;
}

export interface DailyActionDigestPreviewInput {
  generated_at?: string;
  business_day_label?: string;
  actions?: DailyActionDigestActionInput[];
  include_recommendations?: boolean;
  master_pause_active?: boolean;
  emergency_safe_mode?: boolean;
  force?: boolean;
  raw_payload?: unknown;
  api_key?: string;
  access_token?: string;
}

export interface DailyActionDigestItem {
  id: string;
  title: string;
  actionType: string;
  category: string;
  status: string;
  riskLevel: string;
  summary: string;
  reason: string;
  timestamp: string | null;
}

export interface DailyActionDigestCounts {
  total: number;
  executed: number;
  failed: number;
  waitingForApproval: number;
  blockedByPolicy: number;
}

export interface DailyActionDigestSections {
  actionsExecuted: DailyActionDigestItem[];
  actionsFailed: DailyActionDigestItem[];
  waitingForApproval: DailyActionDigestItem[];
  blockedByPolicy: DailyActionDigestItem[];
}

export interface DailyActionDigestPreviewResult {
  phase: 'V2 Phase 15.8 — Daily Action Digest';
  healthMode: DailyActionDigestHealthMode;
  deliverable: 'v2_daily_brief_action_digest';
  decision: DailyActionDigestDecision;
  businessDayLabel: string;
  generatedAt: string;
  counts: DailyActionDigestCounts;
  sections: DailyActionDigestSections;
  briefText: string;
  recommendations: string[];
  issues: string[];
  warnings: string[];
  wouldUpdateDailyBriefContent: true;
  wouldCreateActionThisPhase: false;
  wouldExecuteActionThisPhase: false;
  wouldCallExternalConnectorThisPhase: false;
  safety: DailyActionDigestSafety;
}

export interface DailyActionDigestStatus {
  phase: 'V2 Phase 15.8 — Daily Action Digest';
  healthMode: DailyActionDigestHealthMode;
  deliverable: 'v2_daily_brief_action_digest';
  digestBuilderAdded: true;
  actionsExecutedReported: true;
  actionsFailedReported: true;
  waitingForApprovalReported: true;
  blockedByPolicyReported: true;
  recommendationsReported: true;
  scheduledJobEnabled: false;
  actionCreationEnabled: false;
  executorEnabled: false;
  autoRunEnabled: false;
  externalConnectorCallEnabled: false;
  nextStep: 'Phase 15.9 — Cost Caps + Anomaly Alerts';
}

export interface DailyActionDigestReport {
  phase: 'V2 Phase 15.8 — Daily Action Digest';
  healthMode: DailyActionDigestHealthMode;
  deliverable: 'v2_daily_brief_action_digest';
  purpose: string;
  backendFiles: string[];
  apiEndpoints: string[];
  dailyBriefSections: string[];
  recommendationRules: string[];
  safetyRules: string[];
  examplePreview: DailyActionDigestPreviewResult;
  safety: DailyActionDigestSafety;
  nextStep: 'Phase 15.9 — Cost Caps + Anomaly Alerts';
}
