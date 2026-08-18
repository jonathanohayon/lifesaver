export type MemorySchemaHealthMode = 'v2-phase-15-4-memory-table';

export type MemoryItemType =
  | 'brand_voice'
  | 'approved_content_style'
  | 'support_tone'
  | 'past_decision'
  | 'discount_policy'
  | 'banned_phrase'
  | 'founder_preference';

export type MemoryItemStatus = 'suggested' | 'active' | 'disabled' | 'archived';
export type MemoryScope = 'workspace' | 'content' | 'support' | 'ads' | 'founder' | 'global_safe_default';
export type MemorySensitivity = 'normal' | 'sensitive_business' | 'restricted_no_prompt_injection';

export interface MemoryColumnDefinition {
  column: string;
  type: string;
  required: boolean;
  description: string;
  safetyNote?: string;
}

export interface MemoryTypeDefinition {
  memoryType: MemoryItemType;
  label: string;
  description: string;
  examples: string[];
  recommendedScopes: MemoryScope[];
  defaultStatus: MemoryItemStatus;
  sensitivity: MemorySensitivity;
  promptUsePolicy: string;
  blockedUses: string[];
}

export interface MemorySchemaSafety {
  schemaOnly: true;
  noMemoryUi: true;
  noAutomaticMemoryCapture: true;
  noPromptInjectionAllowed: true;
  noClaudeCallFromSchema: true;
  noToolInvocation: true;
  noExternalConnectorCalled: true;
  noActionCreated: true;
  noExecutorCalled: true;
  noAutoRunEnabled: true;
  noRawSecretsAllowed: true;
  additiveMigrationOnly: true;
}

export interface MemorySchemaReport {
  phase: 'V2 Phase 15.4 — Memory Table';
  healthMode: MemorySchemaHealthMode;
  deliverable: 'memory_schema';
  tableName: 'memory_items';
  migrationFile: '024_create_memory_items.sql';
  purpose: string;
  columns: MemoryColumnDefinition[];
  memoryTypes: MemoryTypeDefinition[];
  indexes: string[];
  retentionAndControlNotes: string[];
  safety: MemorySchemaSafety;
  nextStep: 'Phase 15.5 — Memory UI';
}

export interface MemorySchemaStatus {
  phase: 'V2 Phase 15.4 — Memory Table';
  healthMode: MemorySchemaHealthMode;
  deliverable: 'memory_schema';
  tableName: 'memory_items';
  supportedMemoryTypes: MemoryItemType[];
  schemaDefined: true;
  migrationAdded: true;
  memoryUiEnabled: false;
  automaticMemoryCaptureEnabled: false;
  claudeMemoryInjectionEnabled: false;
  toolInvocationEnabled: false;
  externalConnectorCalled: false;
  actionCreated: false;
  autoRunEnabled: false;
  nextStep: 'Phase 15.5 — Memory UI';
}

export interface MemorySchemaPreviewInput {
  memory_type?: MemoryItemType | string;
  scope?: MemoryScope | string;
  title?: string;
  value_text?: string;
  value_json?: Record<string, unknown>;
  source?: string;
  confidence_score?: number;
  status?: MemoryItemStatus | string;
  tags?: string[];
  force?: boolean;
}

export interface MemorySchemaPreviewResult {
  phase: 'V2 Phase 15.4 — Memory Table';
  healthMode: MemorySchemaHealthMode;
  tableName: 'memory_items';
  normalizedMemoryType: MemoryItemType | null;
  normalizedScope: MemoryScope;
  normalizedStatus: MemoryItemStatus;
  readyForFutureStorage: boolean;
  canStoreThisPhase: false;
  canInjectIntoClaudeThisPhase: false;
  canAutoCaptureThisPhase: false;
  sanitizedPreview: {
    memory_type: MemoryItemType | null;
    scope: MemoryScope;
    title: string;
    value_text_preview: string;
    value_json_keys: string[];
    source: string;
    confidence_score: number | null;
    status: MemoryItemStatus;
    tags: string[];
  };
  requiredHumanControl: string[];
  issues: string[];
  warnings: string[];
  safety: MemorySchemaSafety;
}
