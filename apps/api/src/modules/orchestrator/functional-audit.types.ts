export type FunctionalAuditHealthMode = 'v2-functional-0-8-0-audit';

export type FunctionalSurfaceStatus =
  | 'backend_connected'
  | 'partial_backend_connected'
  | 'ui_preview_only'
  | 'framework_only'
  | 'needs_backend_persistence'
  | 'connector_disabled_by_design';

export type FunctionalAuditDomain =
  | 'dashboard'
  | 'actions'
  | 'rules'
  | 'memory'
  | 'support'
  | 'notifications'
  | 'settings'
  | 'admin'
  | 'orchestrator'
  | 'safety';

export type FunctionalAuditRisk = 'low' | 'medium' | 'high' | 'critical';
export type FunctionalAuditDecision = 'audit_only' | 'ready_for_backend_persistence_planning' | 'blocked_until_review';

export interface FunctionalAuditSafety {
  auditOnly: true;
  noDatabaseMigration: true;
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
}

export interface FunctionalAuditSurface {
  key: string;
  label: string;
  domain: FunctionalAuditDomain;
  page: string;
  status: FunctionalSurfaceStatus;
  mobileReady: boolean;
  primaryApis: string[];
  currentState: string;
  missingForFullFunctionality: string[];
  recommendedNextStep: string;
  activationRisk: FunctionalAuditRisk;
  canBeConnectedWithoutRealExternalWrites: boolean;
}

export interface FunctionalAuditNextPhase {
  version: string;
  label: string;
  goal: string;
  deliverable: string;
  safetyBoundary: string;
}

export interface FunctionalAuditStatus {
  phase: 'v0.8.0 — Functional Audit';
  healthMode: FunctionalAuditHealthMode;
  deliverable: 'functional_audit_and_ui_to_api_connection_map';
  auditModuleReady: true;
  connectionMapReady: true;
  backendPersistenceEnabledByThisPhase: false;
  realExecutionEnabledByThisPhase: false;
  totalSurfacesMapped: number;
  safeNextStep: 'v0.8.2 Backend Persistence Plan';
  safety: FunctionalAuditSafety;
}

export interface FunctionalAuditReport {
  phase: 'v0.8.0 — Functional Audit';
  healthMode: FunctionalAuditHealthMode;
  deliverable: 'functional_audit_and_ui_to_api_connection_map';
  summary: string;
  counts: Record<FunctionalSurfaceStatus, number>;
  surfaces: FunctionalAuditSurface[];
  nextPhases: FunctionalAuditNextPhase[];
  safety: FunctionalAuditSafety;
}

export interface FunctionalAuditPreviewInput {
  checkedSurfaceKeys?: string[];
  completedManualChecks?: string[];
  notes?: string[];
  force?: boolean;
  raw_payload?: unknown;
  api_key?: string;
  access_token?: string;
  claude_api_key?: string;
  database_url?: string;
}

export interface FunctionalAuditPreviewResult {
  phase: 'v0.8.0 — Functional Audit';
  healthMode: FunctionalAuditHealthMode;
  deliverable: 'functional_audit_and_ui_to_api_connection_map';
  decision: FunctionalAuditDecision;
  checkedSurfaceKeys: string[];
  uncheckedSurfaceKeys: string[];
  reviewedManualChecks: string[];
  issues: string[];
  warnings: string[];
  recommendedNextStep: string;
  wouldCreateActionThisPhase: false;
  wouldCallExecutorThisPhase: false;
  wouldCallExternalConnectorThisPhase: false;
  safety: FunctionalAuditSafety;
}
