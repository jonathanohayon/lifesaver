export type RequestClassifierRoute =
  | 'content'
  | 'ads'
  | 'support'
  | 'research'
  | 'dev'
  | 'metrics'
  | 'general_advisor';

export type RequestClassifierSource =
  | 'user_chat'
  | 'worker_event'
  | 'system_event'
  | 'support_ticket'
  | 'metrics_event'
  | 'approval_event'
  | 'unknown';

export type RequestClassifierConfidence = 'low' | 'medium' | 'high';

export interface RequestClassifierContext {
  action_type?: string;
  event_type?: string;
  page?: string;
  platform?: string;
  channel?: string;
  ticket_category?: string;
  metric_names?: string[];
  payload_preview?: Record<string, unknown>;
}

export interface RequestClassifierInput {
  message?: string;
  source?: RequestClassifierSource;
  event_type?: string;
  context?: RequestClassifierContext;
  force?: boolean;
}

export interface RequestClassifierRouteDefinition {
  route: RequestClassifierRoute;
  label: string;
  specialistKey: string;
  purpose: string;
  examples: string[];
  signalKeywords: string[];
  safeAllowedOutputsThisPhase: string[];
  forbiddenThisPhase: string[];
}

export interface RequestClassifierRouteScore {
  route: RequestClassifierRoute;
  score: number;
  matchedSignals: string[];
}

export interface RequestClassificationResult {
  version: '0.7.0';
  phase: 'phase_15_1_request_classifier';
  healthMode: 'v2-phase-15-1-request-classifier';
  deliverable: 'request_classification_service';
  classificationOnly: true;
  route: RequestClassifierRoute;
  routeLabel: string;
  specialistKey: string;
  confidence: RequestClassifierConfidence;
  score: number;
  matchedSignals: string[];
  reasons: string[];
  warnings: string[];
  issues: string[];
  routeScores: RequestClassifierRouteScore[];
  safeNextStep: string;
  allowedToExecuteActionThisPhase: false;
  allowedToCallExternalConnectorThisPhase: false;
  allowedToAutoRunThisPhase: false;
  safeToolingBoundary: string[];
}

export interface RequestClassifierReport {
  version: '0.7.0';
  phase: 'phase_15_1_request_classifier';
  healthMode: 'v2-phase-15-1-request-classifier';
  deliverable: 'request_classification_service';
  generatedAt: string;
  executiveSummary: string;
  routeDefinitions: RequestClassifierRouteDefinition[];
  exampleInputs: Record<RequestClassifierRoute, RequestClassifierInput>;
  exampleEvaluations: Record<RequestClassifierRoute, RequestClassificationResult>;
  safety: RequestClassifierSafety;
  nextStep: 'Phase 15.2 — Specialist Prompt Packs';
}

export interface RequestClassifierSafety {
  classifierOnly: true;
  noSpecialistExecution: true;
  noToolRoutingExecution: true;
  noExternalConnectorCalled: true;
  noRealWorldActionCreated: true;
  noActionAutoApproved: true;
  noAutoRunEnabled: true;
  noContentPublished: true;
  noSupportReplySent: true;
  noAdsMutation: true;
  noDatabaseMigrationRequired: true;
  noRawSecretsReturned: true;
}

export interface RequestClassifierStatus {
  phase: 'V2 Phase 15.1 — Request Classifier';
  healthMode: 'v2-phase-15-1-request-classifier';
  deliverable: 'request_classification_service';
  routes: RequestClassifierRoute[];
  classifierOnly: true;
  specialistExecutionEnabled: false;
  toolRoutingExecutionEnabled: false;
  externalConnectorCalled: false;
  realWorldActionCreated: false;
  actionAutoApproved: false;
  autoRunEnabled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 15.2 — Specialist Prompt Packs';
}
