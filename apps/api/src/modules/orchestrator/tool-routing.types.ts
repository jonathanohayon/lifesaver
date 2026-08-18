import type { RequestClassificationResult, RequestClassifierInput, RequestClassifierRoute } from './request-classifier.types.js';
import type { SpecialistPromptKey, SpecialistPromptPack, SpecialistPromptPreviewResult, SpecialistToolRegistryEntry } from './specialist-prompt-registry.types.js';

export type ToolRoutingPhase = 'phase_15_3_tool_routing';
export type ToolRoutingHealthMode = 'v2-phase-15-3-tool-routing';
export type ToolRoutingDeliverable = 'unified_orchestrator_routing';

export type ToolRoutingHandlerKind =
  | 'specialist_prompt_pack'
  | 'metrics_read_only_toolset'
  | 'general_advisor_front_voice';

export type ToolRoutingToolAvailability =
  | 'candidate_only_no_invocation'
  | 'read_only_candidate_no_invocation'
  | 'future_proposed_action_only'
  | 'forbidden_this_phase';

export interface ToolRoutingInput extends RequestClassifierInput {
  preferredRoute?: RequestClassifierRoute;
  preferredTool?: string;
  founderRequest?: string;
  dryRun?: boolean;
}

export interface ToolRoutingCandidateTool {
  toolName: string;
  label: string;
  route: RequestClassifierRoute;
  handlerKind: ToolRoutingHandlerKind;
  availabilityThisPhase: ToolRoutingToolAvailability;
  description: string;
  canInvokeThisPhase: false;
  canCallExternalConnectorThisPhase: false;
  canCreateActionThisPhase: false;
  canApproveActionThisPhase: false;
  canExecuteActionThisPhase: false;
  requiresApprovalGateBeforeFutureUse: boolean;
  safetyNotes: string[];
}

export interface ToolRoutingPlan {
  route: RequestClassifierRoute;
  routeLabel: string;
  handlerKind: ToolRoutingHandlerKind;
  specialistKey: SpecialistPromptKey | 'metrics_front_voice' | 'general_advisor';
  specialistPromptPack: SpecialistPromptPack | null;
  candidateTools: ToolRoutingCandidateTool[];
  selectedTool: ToolRoutingCandidateTool | null;
  selectionReason: string;
  requiredSafetyGates: string[];
  blockedActionsThisPhase: string[];
  safeNextStep: string;
}

export interface ToolRoutingSafety {
  routingPlanOnly: true;
  classifierUsedSafely: true;
  promptRegistryUsedSafely: true;
  noClaudeCallFromRouter: true;
  noSpecialistExecution: true;
  noToolInvocation: true;
  noExternalConnectorCalled: true;
  noActionCreated: true;
  noActionApproved: true;
  noExecutorCalled: true;
  noAutoRunEnabled: true;
  noContentPublished: true;
  noSupportReplySent: true;
  noAdsMutation: true;
  noDatabaseMigrationRequired: true;
  noRawSecretsReturned: true;
}

export interface ToolRoutingPreviewResult {
  version: '0.7.0';
  phase: ToolRoutingPhase;
  healthMode: ToolRoutingHealthMode;
  deliverable: ToolRoutingDeliverable;
  unifiedRoutingOnly: true;
  founderStillHears: 'LIFE.SAVER';
  classification: RequestClassificationResult;
  specialistPreview: SpecialistPromptPreviewResult | null;
  routingPlan: ToolRoutingPlan;
  warnings: string[];
  issues: string[];
  allowedToExecuteSpecialistThisPhase: false;
  allowedToInvokeToolThisPhase: false;
  allowedToCallExternalConnectorThisPhase: false;
  allowedToCreateActionThisPhase: false;
  allowedToApproveActionThisPhase: false;
  allowedToExecuteActionThisPhase: false;
  allowedToAutoRunThisPhase: false;
  safety: ToolRoutingSafety;
}

export interface ToolRoutingStatus {
  phase: 'V2 Phase 15.3 — Tool Routing';
  healthMode: ToolRoutingHealthMode;
  deliverable: ToolRoutingDeliverable;
  routes: RequestClassifierRoute[];
  unifiedRoutingOnly: true;
  specialistExecutionEnabled: false;
  toolInvocationEnabled: false;
  externalConnectorCalled: false;
  realWorldActionCreated: false;
  actionAutoApproved: false;
  autoRunEnabled: false;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 15.4 — Memory Table';
}

export interface ToolRoutingReport {
  version: '0.7.0';
  phase: ToolRoutingPhase;
  healthMode: ToolRoutingHealthMode;
  deliverable: ToolRoutingDeliverable;
  generatedAt: string;
  executiveSummary: string;
  routeMap: ToolRoutingPlan[];
  examplePreviews: Record<RequestClassifierRoute, ToolRoutingPreviewResult>;
  safety: ToolRoutingSafety;
  nextStep: 'Phase 15.4 — Memory Table';
}
