import type { RequestClassifierRoute } from './request-classifier.types.js';

export type SpecialistPromptKey =
  | 'content_specialist'
  | 'ads_specialist'
  | 'support_specialist'
  | 'research_specialist'
  | 'dev_specialist';

export type SpecialistPromptRoute = Extract<RequestClassifierRoute, 'content' | 'ads' | 'support' | 'research' | 'dev'>;

export type SpecialistToolAvailability =
  | 'allowed_prompt_context_only'
  | 'allowed_preview_only'
  | 'future_proposed_action_only'
  | 'forbidden_this_phase';

export interface SpecialistPromptPack {
  specialistKey: SpecialistPromptKey;
  route: SpecialistPromptRoute;
  label: string;
  purpose: string;
  founderFacingVoice: 'life_saver_butler_voice';
  specialistInternalRole: string;
  systemPrompt: string;
  responseStyleRules: string[];
  requiredContext: string[];
  allowedOutputsThisPhase: string[];
  forbiddenOutputsThisPhase: string[];
  requiredSafetyGates: string[];
  escalationTriggers: string[];
}

export interface SpecialistToolRegistryEntry {
  specialistKey: SpecialistPromptKey;
  route: SpecialistPromptRoute;
  toolName: string;
  label: string;
  description: string;
  availabilityThisPhase: SpecialistToolAvailability;
  canCallExternalConnectorThisPhase: false;
  canCreateActionThisPhase: false;
  canApproveActionThisPhase: false;
  canExecuteActionThisPhase: false;
  requiresFutureApprovalGate: boolean;
  safetyNotes: string[];
}

export interface SpecialistPromptRegistrySafety {
  promptRegistryOnly: true;
  noClaudeCallFromRegistry: true;
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
  oneLifeSaverVoicePreserved: true;
  noDatabaseMigrationRequired: true;
  noRawSecretsReturned: true;
}

export interface SpecialistPromptRegistryStatus {
  phase: 'V2 Phase 15.2 — Specialist Prompt Packs';
  healthMode: 'v2-phase-15-2-specialist-prompt-packs';
  deliverable: 'specialist_prompt_tool_registry';
  specialists: SpecialistPromptKey[];
  routes: SpecialistPromptRoute[];
  promptRegistryOnly: true;
  specialistExecutionEnabled: false;
  toolInvocationEnabled: false;
  externalConnectorCalled: false;
  realWorldActionCreated: false;
  autoRunEnabled: false;
  oneLifeSaverVoicePreserved: true;
  noDatabaseMigrationRequired: true;
  nextStep: 'Phase 15.3 — Tool Routing';
}

export interface SpecialistPromptPreviewInput {
  route?: RequestClassifierRoute;
  specialistKey?: SpecialistPromptKey;
  founderRequest?: string;
  source?: string;
  context?: Record<string, unknown>;
  force?: boolean;
}

export interface SpecialistPromptPreviewResult {
  version: '0.7.0';
  phase: 'phase_15_2_specialist_prompt_packs';
  healthMode: 'v2-phase-15-2-specialist-prompt-packs';
  deliverable: 'specialist_prompt_tool_registry';
  promptRegistryOnly: true;
  matched: boolean;
  specialistKey: SpecialistPromptKey | null;
  route: SpecialistPromptRoute | null;
  label: string | null;
  founderStillHears: 'LIFE.SAVER';
  voiceBoundary: string;
  promptPack: SpecialistPromptPack | null;
  toolCandidates: SpecialistToolRegistryEntry[];
  safeNextStep: string;
  warnings: string[];
  issues: string[];
  allowedToExecuteSpecialistThisPhase: false;
  allowedToInvokeToolThisPhase: false;
  allowedToCallExternalConnectorThisPhase: false;
  allowedToCreateActionThisPhase: false;
  allowedToAutoRunThisPhase: false;
  safety: SpecialistPromptRegistrySafety;
}

export interface SpecialistPromptRegistryReport {
  version: '0.7.0';
  phase: 'phase_15_2_specialist_prompt_packs';
  healthMode: 'v2-phase-15-2-specialist-prompt-packs';
  deliverable: 'specialist_prompt_tool_registry';
  generatedAt: string;
  executiveSummary: string;
  promptPacks: SpecialistPromptPack[];
  toolRegistry: SpecialistToolRegistryEntry[];
  examplePreviews: Record<SpecialistPromptKey, SpecialistPromptPreviewResult>;
  safety: SpecialistPromptRegistrySafety;
  nextStep: 'Phase 15.3 — Tool Routing';
}
