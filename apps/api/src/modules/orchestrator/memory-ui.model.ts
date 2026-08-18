import { MEMORY_ITEM_TYPES } from './memory-schema.model.js';
import type { MemoryItemStatus, MemoryItemType, MemoryScope, MemorySensitivity } from './memory-schema.types.js';
import type {
  MemoryUiItemPreview,
  MemoryUiOperation,
  MemoryUiPreviewInput,
  MemoryUiPreviewResult,
  MemoryUiReport,
  MemoryUiSafety,
  MemoryUiStatus,
} from './memory-ui.types.js';

export const MEMORY_UI_PHASE = 'phase_15_5_memory_ui' as const;
export const MEMORY_UI_HEALTH_MODE = 'v2-phase-15-5-memory-ui' as const;
export const MEMORY_UI_PACKAGE = 'lifesaver-v0.7.0-phase-15-5-memory-ui.zip' as const;

export const MEMORY_UI_OPERATIONS: MemoryUiOperation[] = [
  'view_memory',
  'edit_memory',
  'delete_memory',
  'approve_suggested_memory',
  'disable_memory_item',
];

const VALID_STATUSES: MemoryItemStatus[] = ['suggested', 'active', 'disabled', 'archived'];
const VALID_SCOPES: MemoryScope[] = ['workspace', 'content', 'support', 'ads', 'founder', 'global_safe_default'];
const VALID_SENSITIVITIES: MemorySensitivity[] = ['normal', 'sensitive_business', 'restricted_no_prompt_injection'];
const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'client_secret',
  'authorization: bearer',
  'raw_provider_payload',
  'raw_payload',
  'x-api-key',
  'database_url',
  'claude_api_key',
  'triple whale api key',
  'gmail raw',
  'mime-version',
];

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function cleanLower(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function truncatePreview(value: string, max = 260): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function normalizeOperation(value: unknown): MemoryUiOperation | null {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return MEMORY_UI_OPERATIONS.includes(normalized as MemoryUiOperation) ? normalized as MemoryUiOperation : null;
}

function normalizeMemoryType(value: unknown): MemoryItemType | null {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return MEMORY_ITEM_TYPES.includes(normalized as MemoryItemType) ? normalized as MemoryItemType : null;
}

function normalizeScope(value: unknown, fallback: MemoryScope = 'workspace'): MemoryScope {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return VALID_SCOPES.includes(normalized as MemoryScope) ? normalized as MemoryScope : fallback;
}

function normalizeStatus(value: unknown, fallback: MemoryItemStatus = 'suggested'): MemoryItemStatus {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return VALID_STATUSES.includes(normalized as MemoryItemStatus) ? normalized as MemoryItemStatus : fallback;
}

function normalizeSensitivity(value: unknown, fallback: MemorySensitivity = 'normal'): MemorySensitivity {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return VALID_SENSITIVITIES.includes(normalized as MemorySensitivity) ? normalized as MemorySensitivity : fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)
    .slice(0, 12);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasForbiddenFragment(value: unknown): string | null {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return FORBIDDEN_OUTPUT_FRAGMENTS.find((fragment) => text.includes(fragment)) || null;
}

function buildItem(input: unknown): MemoryUiItemPreview | null {
  if (!isPlainObject(input)) return null;
  const memoryType = normalizeMemoryType(input.memory_type);
  const title = truncatePreview(cleanString(input.title), 100);
  const valueText = truncatePreview(cleanString(input.value_text), 1200);
  if (!memoryType || !title || !valueText) return null;
  const now = new Date().toISOString();
  return {
    id: cleanString(input.id) || `mem_preview_${memoryType}`,
    workspace_id: cleanString(input.workspace_id) || 'workspace_preview_safe',
    memory_type: memoryType,
    scope: normalizeScope(input.scope),
    title,
    value_text: valueText,
    tags: normalizeTags(input.tags),
    status: normalizeStatus(input.status),
    sensitivity: normalizeSensitivity(input.sensitivity, memoryType === 'banned_phrase' ? 'restricted_no_prompt_injection' : 'normal'),
    source: truncatePreview(cleanString(input.source) || 'memory_ui_preview', 80),
    confidence_score: typeof input.confidence_score === 'number' && Number.isFinite(input.confidence_score)
      ? Math.max(0, Math.min(1, Number(input.confidence_score.toFixed(4))))
      : null,
    created_at: cleanString(input.created_at) || now,
    updated_at: cleanString(input.updated_at) || now,
    approved_at: typeof input.approved_at === 'string' && input.approved_at.trim() ? input.approved_at : null,
    disabled_at: typeof input.disabled_at === 'string' && input.disabled_at.trim() ? input.disabled_at : null,
  };
}

export function buildMemoryUiSafety(): MemoryUiSafety {
  return {
    memoryManagementUi: true,
    founderVisibleReview: true,
    browserLocalPreviewAllowed: true,
    backendPersistenceEnabled: false,
    automaticMemoryCaptureEnabled: false,
    claudeMemoryInjectionEnabled: false,
    specialistExecutionEnabled: false,
    toolInvocationEnabled: false,
    externalConnectorCalled: false,
    actionCreated: false,
    executorCalled: false,
    autoRunEnabled: false,
    rawSecretsBlocked: true,
    rawProviderPayloadBlocked: true,
    noDatabaseMigrationThisPhase: true,
  };
}

export function buildMemoryUiStatus(): MemoryUiStatus {
  return {
    phase: 'V2 Phase 15.5 — Memory UI',
    healthMode: MEMORY_UI_HEALTH_MODE,
    deliverable: 'memory_management_ui',
    uiPage: '/memory.html',
    supportedOperations: MEMORY_UI_OPERATIONS,
    viewMemoryEnabled: true,
    editMemoryPreviewEnabled: true,
    deleteMemoryPreviewEnabled: true,
    approveSuggestedMemoryPreviewEnabled: true,
    disableMemoryPreviewEnabled: true,
    backendPersistenceEnabled: false,
    automaticMemoryCaptureEnabled: false,
    claudeMemoryInjectionEnabled: false,
    autoRunEnabled: false,
    nextStep: 'Phase 15.6 — Proactive Triggers',
  };
}

export function buildMemoryUiReport(): MemoryUiReport {
  return {
    phase: 'V2 Phase 15.5 — Memory UI',
    healthMode: MEMORY_UI_HEALTH_MODE,
    deliverable: 'memory_management_ui',
    purpose: 'Provide a founder-visible memory management page for viewing, editing, deleting, approving suggested memory, and disabling memory items. Phase 15.5 keeps this as safe UI/local preview plus API validation; it does not inject memory into Claude or persist changes automatically.',
    uiPage: '/memory.html',
    apiEndpoints: [
      'GET /api/v1/orchestrator/memory-ui/status',
      'GET /api/v1/orchestrator/memory-ui/report',
      'GET /api/v1/orchestrator/memory-ui/example',
      'POST /api/v1/orchestrator/memory-ui/preview',
    ],
    supportedOperations: MEMORY_UI_OPERATIONS,
    controls: [
      'View memory list grouped by type/status.',
      'Edit a memory item in a founder-visible form.',
      'Delete a browser-local memory preview item.',
      'Approve suggested memory for future active status preview.',
      'Disable an active memory item so it is not eligible for future prompt context.',
    ],
    operationRules: [
      'Suggested memory must be approved before it becomes active.',
      'Disabled, archived, or deleted memory must not be injected into future prompts.',
      'Memory actions stay workspace-scoped and founder-visible.',
      'Secret-like fragments, raw provider payloads, OAuth tokens, and prompt-injection instructions are rejected or warned.',
      'Phase 15.5 does not perform database writes; browser localStorage is used for UI preview only.',
    ],
    safety: buildMemoryUiSafety(),
    nextStep: 'Phase 15.6 — Proactive Triggers',
  };
}

export function buildMemoryUiExampleItems(): MemoryUiItemPreview[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mem_brand_voice_001',
      workspace_id: 'workspace_preview_safe',
      memory_type: 'brand_voice',
      scope: 'workspace',
      title: 'Premium founder voice',
      value_text: 'Speak with calm, concise, premium language. Avoid hype and unsupported claims.',
      tags: ['brand', 'voice'],
      status: 'active',
      sensitivity: 'normal',
      source: 'founder_manual',
      confidence_score: 1,
      created_at: now,
      updated_at: now,
      approved_at: now,
      disabled_at: null,
    },
    {
      id: 'mem_support_tone_001',
      workspace_id: 'workspace_preview_safe',
      memory_type: 'support_tone',
      scope: 'support',
      title: 'Support reply tone',
      value_text: 'Acknowledge the issue first, then provide a clear next step. Never promise refunds automatically.',
      tags: ['support'],
      status: 'suggested',
      sensitivity: 'sensitive_business',
      source: 'support_qa',
      confidence_score: 0.9,
      created_at: now,
      updated_at: now,
      approved_at: null,
      disabled_at: null,
    },
    {
      id: 'mem_banned_phrase_001',
      workspace_id: 'workspace_preview_safe',
      memory_type: 'banned_phrase',
      scope: 'content',
      title: 'Avoid guarantee claims',
      value_text: 'Avoid phrases that imply guaranteed financial results or risk-free outcomes.',
      tags: ['compliance', 'copy'],
      status: 'disabled',
      sensitivity: 'restricted_no_prompt_injection',
      source: 'compliance_review',
      confidence_score: 0.95,
      created_at: now,
      updated_at: now,
      approved_at: now,
      disabled_at: now,
    },
  ];
}

export function previewMemoryUiOperation(input: unknown): MemoryUiPreviewResult {
  const typed = isPlainObject(input) ? input as MemoryUiPreviewInput : {};
  const operation = normalizeOperation(typed.operation);
  const item = buildItem(typed.item);
  const patch = isPlainObject(typed.patch) ? typed.patch : {};
  const actor = cleanString(typed.actor_user_id);
  const reason = truncatePreview(cleanString(typed.reason), 160);
  const issues: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  if (!operation) issues.push('A supported memory UI operation is required.');
  if (!item && operation !== 'view_memory') issues.push('A valid memory item is required for this operation preview.');
  if (typed.force === true) warnings.push('force=true ignored; memory UI cannot bypass review, safety checks, persistence policy, or prompt-injection protection.');

  let updated: MemoryUiItemPreview | null = item ? { ...item } : null;

  if (operation === 'view_memory') {
    updated = item;
  }

  if (operation === 'edit_memory' && updated) {
    if (typeof patch.title === 'string') updated.title = truncatePreview(cleanString(patch.title), 100);
    if (typeof patch.value_text === 'string') updated.value_text = truncatePreview(cleanString(patch.value_text), 1200);
    if (patch.memory_type) {
      const nextType = normalizeMemoryType(patch.memory_type);
      if (nextType) updated.memory_type = nextType;
      else issues.push('Edited memory_type is not supported.');
    }
    if (patch.scope) updated.scope = normalizeScope(patch.scope, updated.scope);
    if (patch.tags) updated.tags = normalizeTags(patch.tags);
    updated.updated_at = now;
    if (!updated.title) issues.push('Edited title cannot be empty.');
    if (!updated.value_text) issues.push('Edited value_text cannot be empty.');
    if (updated.status === 'active') warnings.push('Editing active memory should normally return it to suggested review before future prompt use.');
  }

  if (operation === 'approve_suggested_memory' && updated) {
    if (updated.status !== 'suggested') issues.push('Only suggested memory can be approved in this operation.');
    if (!actor) issues.push('actor_user_id is required to approve suggested memory.');
    updated.status = issues.length ? updated.status : 'active';
    updated.approved_at = issues.length ? updated.approved_at : now;
    updated.updated_at = now;
  }

  if (operation === 'disable_memory_item' && updated) {
    if (updated.status === 'archived') issues.push('Archived memory cannot be disabled again.');
    if (!reason) warnings.push('A disable reason is recommended for audit clarity.');
    updated.status = issues.length ? updated.status : 'disabled';
    updated.disabled_at = issues.length ? updated.disabled_at : now;
    updated.updated_at = now;
  }

  if (operation === 'delete_memory' && updated) {
    if (!reason) warnings.push('A delete/archive reason is recommended for audit clarity.');
    updated.status = 'archived';
    updated.disabled_at = updated.disabled_at || now;
    updated.updated_at = now;
    warnings.push('Future backend implementation should use soft-delete/archive for audit safety. The Phase 15.5 browser UI may remove local preview items from display.');
  }

  const forbidden = hasForbiddenFragment({ item, patch, reason });
  if (forbidden) issues.push(`Memory UI preview contains forbidden secret/raw-payload fragment: ${forbidden}`);

  const combinedText = JSON.stringify({ item, patch }).toLowerCase();
  const injectionSignals = ['ignore previous instructions', 'system prompt', 'developer message', 'run this command', 'bypass approval', 'disable safety'];
  if (injectionSignals.some((signal) => combinedText.includes(signal))) {
    warnings.push('Potential prompt-injection or safety-bypass text detected. Keep memory review-only and do not inject into Claude.');
  }

  return {
    phase: 'V2 Phase 15.5 — Memory UI',
    healthMode: MEMORY_UI_HEALTH_MODE,
    operation,
    allowedInUiPreview: issues.length === 0 && Boolean(operation),
    wouldPersistToDatabaseThisPhase: false,
    wouldInjectIntoClaudeThisPhase: false,
    wouldInvokeToolThisPhase: false,
    updatedItemPreview: updated,
    requiredHumanControl: [
      'Founder/admin visible review before active memory is used later.',
      'Disabled, archived, or deleted memory must not be used in future prompts.',
      'Workspace scoping and role checks are required before future backend persistence.',
      'Memory UI actions do not approve actions, invoke tools, or enable auto-run.',
    ],
    issues,
    warnings,
    safety: buildMemoryUiSafety(),
  };
}

export function assertMemoryUiSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Memory UI output contains forbidden fragment: ${fragment}`);
    }
  }
}
