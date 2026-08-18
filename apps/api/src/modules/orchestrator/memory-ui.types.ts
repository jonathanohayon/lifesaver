import type { MemoryItemStatus, MemoryItemType, MemoryScope, MemorySensitivity } from './memory-schema.types.js';

export type MemoryUiHealthMode = 'v2-phase-15-5-memory-ui';

export type MemoryUiOperation =
  | 'view_memory'
  | 'edit_memory'
  | 'delete_memory'
  | 'approve_suggested_memory'
  | 'disable_memory_item';

export interface MemoryUiItemPreview {
  id: string;
  workspace_id: string;
  memory_type: MemoryItemType;
  scope: MemoryScope;
  title: string;
  value_text: string;
  tags: string[];
  status: MemoryItemStatus;
  sensitivity: MemorySensitivity;
  source: string;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  disabled_at: string | null;
}

export interface MemoryUiSafety {
  memoryManagementUi: true;
  founderVisibleReview: true;
  browserLocalPreviewAllowed: true;
  backendPersistenceEnabled: false;
  automaticMemoryCaptureEnabled: false;
  claudeMemoryInjectionEnabled: false;
  specialistExecutionEnabled: false;
  toolInvocationEnabled: false;
  externalConnectorCalled: false;
  actionCreated: false;
  executorCalled: false;
  autoRunEnabled: false;
  rawSecretsBlocked: true;
  rawProviderPayloadBlocked: true;
  noDatabaseMigrationThisPhase: true;
}

export interface MemoryUiStatus {
  phase: 'V2 Phase 15.5 — Memory UI';
  healthMode: MemoryUiHealthMode;
  deliverable: 'memory_management_ui';
  uiPage: '/memory.html';
  supportedOperations: MemoryUiOperation[];
  viewMemoryEnabled: true;
  editMemoryPreviewEnabled: true;
  deleteMemoryPreviewEnabled: true;
  approveSuggestedMemoryPreviewEnabled: true;
  disableMemoryPreviewEnabled: true;
  backendPersistenceEnabled: false;
  automaticMemoryCaptureEnabled: false;
  claudeMemoryInjectionEnabled: false;
  autoRunEnabled: false;
  nextStep: 'Phase 15.6 — Proactive Triggers';
}

export interface MemoryUiReport {
  phase: 'V2 Phase 15.5 — Memory UI';
  healthMode: MemoryUiHealthMode;
  deliverable: 'memory_management_ui';
  purpose: string;
  uiPage: '/memory.html';
  apiEndpoints: string[];
  supportedOperations: MemoryUiOperation[];
  controls: string[];
  operationRules: string[];
  safety: MemoryUiSafety;
  nextStep: 'Phase 15.6 — Proactive Triggers';
}

export interface MemoryUiPreviewInput {
  operation?: MemoryUiOperation | string;
  item?: Partial<MemoryUiItemPreview>;
  patch?: Partial<MemoryUiItemPreview>;
  actor_user_id?: string;
  reason?: string;
  force?: boolean;
}

export interface MemoryUiPreviewResult {
  phase: 'V2 Phase 15.5 — Memory UI';
  healthMode: MemoryUiHealthMode;
  operation: MemoryUiOperation | null;
  allowedInUiPreview: boolean;
  wouldPersistToDatabaseThisPhase: false;
  wouldInjectIntoClaudeThisPhase: false;
  wouldInvokeToolThisPhase: false;
  updatedItemPreview: MemoryUiItemPreview | null;
  requiredHumanControl: string[];
  issues: string[];
  warnings: string[];
  safety: MemoryUiSafety;
}
