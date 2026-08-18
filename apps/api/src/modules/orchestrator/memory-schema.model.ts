import type {
  MemoryColumnDefinition,
  MemoryItemStatus,
  MemoryItemType,
  MemorySchemaPreviewInput,
  MemorySchemaPreviewResult,
  MemorySchemaReport,
  MemorySchemaSafety,
  MemorySchemaStatus,
  MemoryScope,
  MemoryTypeDefinition,
} from './memory-schema.types.js';

export const MEMORY_SCHEMA_PHASE = 'phase_15_4_memory_table' as const;
export const MEMORY_SCHEMA_HEALTH_MODE = 'v2-phase-15-4-memory-table' as const;
export const MEMORY_SCHEMA_PACKAGE = 'lifesaver-v0.7.0-phase-15-4-memory-table.zip' as const;

export const MEMORY_ITEM_TYPES: MemoryItemType[] = [
  'brand_voice',
  'approved_content_style',
  'support_tone',
  'past_decision',
  'discount_policy',
  'banned_phrase',
  'founder_preference',
];

const MEMORY_SCOPES: MemoryScope[] = ['workspace', 'content', 'support', 'ads', 'founder', 'global_safe_default'];
const MEMORY_STATUSES: MemoryItemStatus[] = ['suggested', 'active', 'disabled', 'archived'];

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'client_secret=',
  'client_secret:',
  'refresh_token=',
  'refresh_token:',
  'authorization: bearer',
  'bearer ',
  'raw_token',
  'access_token',
  'private_key',
  'claude_api_key',
  'triple_whale_api_key',
  'gmail_refresh_token',
  'google_ads_refresh_token',
  'meta_access_token',
  'password=',
  'api_key=',
  'secret_key=',
  'provider_raw_response',
  'raw_provider_payload',
  'raw_mime',
  'base64mime',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanLower(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function truncatePreview(value: string, max = 160): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function normalizeMemoryType(value: unknown): MemoryItemType | null {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return MEMORY_ITEM_TYPES.includes(normalized as MemoryItemType) ? normalized as MemoryItemType : null;
}

function normalizeScope(value: unknown, memoryType: MemoryItemType | null): MemoryScope {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  if (MEMORY_SCOPES.includes(normalized as MemoryScope)) return normalized as MemoryScope;
  switch (memoryType) {
    case 'approved_content_style':
    case 'banned_phrase':
      return 'content';
    case 'support_tone':
      return 'support';
    case 'discount_policy':
    case 'founder_preference':
      return 'founder';
    default:
      return 'workspace';
  }
}

function normalizeStatus(value: unknown): MemoryItemStatus {
  const normalized = cleanLower(value).replace(/[\s-]+/g, '_');
  return MEMORY_STATUSES.includes(normalized as MemoryItemStatus) ? normalized as MemoryItemStatus : 'suggested';
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean)
    .slice(0, 12);
}

function hasForbiddenFragment(value: unknown): string | null {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return FORBIDDEN_OUTPUT_FRAGMENTS.find((fragment) => text.includes(fragment)) || null;
}

export function buildMemorySchemaSafety(): MemorySchemaSafety {
  return {
    schemaOnly: true,
    noMemoryUi: true,
    noAutomaticMemoryCapture: true,
    noPromptInjectionAllowed: true,
    noClaudeCallFromSchema: true,
    noToolInvocation: true,
    noExternalConnectorCalled: true,
    noActionCreated: true,
    noExecutorCalled: true,
    noAutoRunEnabled: true,
    noRawSecretsAllowed: true,
    additiveMigrationOnly: true,
  };
}

export function buildMemoryColumns(): MemoryColumnDefinition[] {
  return [
    { column: 'id', type: 'uuid primary key', required: true, description: 'Stable memory item ID.' },
    { column: 'workspace_id', type: 'uuid references workspaces(id)', required: true, description: 'Workspace owner for tenant-safe memory scoping.' },
    { column: 'memory_type', type: 'text check', required: true, description: 'One of the Phase 15.4 memory types: brand voice, content style, support tone, decision, discount policy, banned phrase, or founder preference.' },
    { column: 'scope', type: 'text check', required: true, description: 'Where memory may be considered later: workspace, content, support, ads, founder, or global safe default.' },
    { column: 'title', type: 'text', required: true, description: 'Short human-readable label.' },
    { column: 'value_text', type: 'text', required: true, description: 'Plain-language memory value safe for future review.', safetyNote: 'Must not contain secrets, OAuth tokens, raw provider payloads, customer private data, or prompt-injection commands.' },
    { column: 'value_json', type: 'jsonb', required: false, description: 'Optional structured safe details for future prompt/context assembly.', safetyNote: 'Safe summary only; raw payloads and secrets are forbidden.' },
    { column: 'tags', type: 'text[]', required: false, description: 'Optional normalized tags for future filtering.' },
    { column: 'status', type: 'text check', required: true, description: 'suggested, active, disabled, or archived. New records should start suggested unless explicitly approved.' },
    { column: 'sensitivity', type: 'text check', required: true, description: 'normal, sensitive_business, or restricted_no_prompt_injection.' },
    { column: 'source', type: 'text', required: true, description: 'Where the memory came from, such as founder_manual, action_decision, support_qa, or imported_safe_default.' },
    { column: 'confidence_score', type: 'numeric(5,4)', required: false, description: 'Optional confidence score from 0 to 1 for future suggested memory review.' },
    { column: 'approved_by_user_id', type: 'uuid references users(id)', required: false, description: 'User who approved suggested memory for active use.' },
    { column: 'created_by_user_id', type: 'uuid references users(id)', required: false, description: 'User or system actor that created the item.' },
    { column: 'updated_by_user_id', type: 'uuid references users(id)', required: false, description: 'Last user or system actor that changed the item.' },
    { column: 'approved_at', type: 'timestamptz', required: false, description: 'When suggested memory was approved.' },
    { column: 'disabled_at', type: 'timestamptz', required: false, description: 'When memory was disabled.' },
    { column: 'created_at', type: 'timestamptz', required: true, description: 'Creation timestamp.' },
    { column: 'updated_at', type: 'timestamptz', required: true, description: 'Update timestamp.' },
  ];
}

export function buildMemoryTypeDefinitions(): MemoryTypeDefinition[] {
  return [
    {
      memoryType: 'brand_voice',
      label: 'Brand voice',
      description: 'Durable tone and style instructions for the business brand.',
      examples: ['Confident, calm, premium, concise.', 'Avoid hype-heavy claims.'],
      recommendedScopes: ['workspace', 'content'],
      defaultStatus: 'suggested',
      sensitivity: 'normal',
      promptUsePolicy: 'May be used later as approved context for content/support drafting after human review.',
      blockedUses: ['Do not override safety policy.', 'Do not include prompt-injection commands.'],
    },
    {
      memoryType: 'approved_content_style',
      label: 'Approved content style',
      description: 'Specific content patterns the founder has approved.',
      examples: ['Short educational LinkedIn posts with one CTA.', 'Use founder-approved disclaimers for regulated categories.'],
      recommendedScopes: ['content'],
      defaultStatus: 'suggested',
      sensitivity: 'normal',
      promptUsePolicy: 'May support future content specialist drafting, not automatic publishing by itself.',
      blockedUses: ['Cannot enable auto-publish.', 'Cannot bypass content risk scoring.'],
    },
    {
      memoryType: 'support_tone',
      label: 'Support tone',
      description: 'How support replies should sound when drafted.',
      examples: ['Warm, direct, apologetic when appropriate.', 'Do not overpromise refunds or shipping outcomes.'],
      recommendedScopes: ['support'],
      defaultStatus: 'suggested',
      sensitivity: 'sensitive_business',
      promptUsePolicy: 'May guide future support drafts after safeguards; never a send permission.',
      blockedUses: ['Cannot bypass sensitive-ticket guard.', 'Cannot auto-send replies.'],
    },
    {
      memoryType: 'past_decision',
      label: 'Past decision',
      description: 'Founder decisions that may help future recommendations stay consistent.',
      examples: ['Founder rejected discounting during launch week.', 'Founder approved manual review for high-risk ads.'],
      recommendedScopes: ['workspace', 'founder', 'ads', 'support', 'content'],
      defaultStatus: 'suggested',
      sensitivity: 'sensitive_business',
      promptUsePolicy: 'May inform later recommendations and explanations after approval.',
      blockedUses: ['Cannot act as execution approval.', 'Cannot override current policy/caps/pause.'],
    },
    {
      memoryType: 'discount_policy',
      label: 'Discount policy',
      description: 'Durable discounting preferences or restrictions.',
      examples: ['Do not discount premium bundles.', 'Ask before offering coupon codes.'],
      recommendedScopes: ['founder', 'content', 'support'],
      defaultStatus: 'suggested',
      sensitivity: 'sensitive_business',
      promptUsePolicy: 'May help drafts avoid unwanted discount promises.',
      blockedUses: ['Cannot create discounts.', 'Cannot approve refunds or financial actions.'],
    },
    {
      memoryType: 'banned_phrase',
      label: 'Banned phrase',
      description: 'Words or phrases to avoid in future drafts.',
      examples: ['Guaranteed results', 'Risk-free profit'],
      recommendedScopes: ['content', 'support'],
      defaultStatus: 'suggested',
      sensitivity: 'restricted_no_prompt_injection',
      promptUsePolicy: 'May be used as a future negative style constraint only.',
      blockedUses: ['Cannot contain executable instructions.', 'Cannot contain hidden prompts or secrets.'],
    },
    {
      memoryType: 'founder_preference',
      label: 'Founder preference',
      description: 'Durable founder preference for how LIFE.SAVER should advise or prioritize.',
      examples: ['Prioritize cashflow protection over aggressive growth.', 'Ask before changing customer-facing copy.'],
      recommendedScopes: ['founder', 'workspace'],
      defaultStatus: 'suggested',
      sensitivity: 'sensitive_business',
      promptUsePolicy: 'May inform future assistant strategy after founder-visible review.',
      blockedUses: ['Cannot bypass approval gates.', 'Cannot store overly personal/sensitive attributes unless explicitly requested by founder.'],
    },
  ];
}

export function buildMemorySchemaReport(): MemorySchemaReport {
  return {
    phase: 'V2 Phase 15.4 — Memory Table',
    healthMode: MEMORY_SCHEMA_HEALTH_MODE,
    deliverable: 'memory_schema',
    tableName: 'memory_items',
    migrationFile: '024_create_memory_items.sql',
    purpose: 'Define durable, workspace-scoped memory storage for brand voice, approved content style, support tone, past decisions, discount policy, banned phrases, and founder preferences. Phase 15.4 adds schema and preview validation only; Phase 15.5 will add founder-visible memory UI.',
    columns: buildMemoryColumns(),
    memoryTypes: buildMemoryTypeDefinitions(),
    indexes: [
      'idx_memory_items_workspace_type_status',
      'idx_memory_items_workspace_scope_status',
      'idx_memory_items_workspace_tags_gin',
      'idx_memory_items_active_unique_title',
      'idx_memory_items_created_by',
      'idx_memory_items_approved_by',
    ],
    retentionAndControlNotes: [
      'New memory should begin as suggested unless a founder/admin explicitly approves it.',
      'Disabled and archived memory must not be injected into future prompts.',
      'Memory must remain workspace-scoped; no cross-workspace recall.',
      'Prompt-injection text, raw provider payloads, OAuth tokens, API keys, and customer private data are forbidden.',
      'Memory schema does not create UI, automatic capture, prompt injection into Claude, tool calls, actions, or execution.',
    ],
    safety: buildMemorySchemaSafety(),
    nextStep: 'Phase 15.5 — Memory UI',
  };
}

export function buildMemorySchemaStatus(): MemorySchemaStatus {
  return {
    phase: 'V2 Phase 15.4 — Memory Table',
    healthMode: MEMORY_SCHEMA_HEALTH_MODE,
    deliverable: 'memory_schema',
    tableName: 'memory_items',
    supportedMemoryTypes: MEMORY_ITEM_TYPES,
    schemaDefined: true,
    migrationAdded: true,
    memoryUiEnabled: false,
    automaticMemoryCaptureEnabled: false,
    claudeMemoryInjectionEnabled: false,
    toolInvocationEnabled: false,
    externalConnectorCalled: false,
    actionCreated: false,
    autoRunEnabled: false,
    nextStep: 'Phase 15.5 — Memory UI',
  };
}

export function buildMemorySchemaExampleInputs(): Record<MemoryItemType, MemorySchemaPreviewInput> {
  return {
    brand_voice: {
      memory_type: 'brand_voice',
      scope: 'workspace',
      title: 'Brand voice baseline',
      value_text: 'Speak with a calm, premium, founder-focused tone. Avoid hype and unsupported claims.',
      source: 'founder_manual',
      confidence_score: 1,
      status: 'suggested',
      tags: ['voice', 'brand'],
    },
    approved_content_style: {
      memory_type: 'approved_content_style',
      scope: 'content',
      title: 'LinkedIn educational post style',
      value_text: 'Use short educational posts with one clear CTA and no exaggerated performance promises.',
      source: 'past_content_decision',
      confidence_score: 0.92,
      tags: ['linkedin', 'content'],
    },
    support_tone: {
      memory_type: 'support_tone',
      scope: 'support',
      title: 'Support reply tone',
      value_text: 'Be warm, direct, and helpful. Acknowledge frustration before explaining next steps.',
      source: 'support_qa',
      confidence_score: 0.9,
      tags: ['support'],
    },
    past_decision: {
      memory_type: 'past_decision',
      scope: 'founder',
      title: 'Manual review for high-risk actions',
      value_text: 'Founder prefers manual review for high-risk support and ads actions even if future policy suggests automation.',
      source: 'action_decision',
      confidence_score: 0.88,
      tags: ['approval', 'risk'],
    },
    discount_policy: {
      memory_type: 'discount_policy',
      scope: 'founder',
      title: 'No automatic discount promises',
      value_text: 'Do not promise discounts or coupon codes in support replies unless founder explicitly approves the offer.',
      source: 'founder_manual',
      confidence_score: 1,
      tags: ['discounts', 'support'],
    },
    banned_phrase: {
      memory_type: 'banned_phrase',
      scope: 'content',
      title: 'Avoid guaranteed result claims',
      value_text: 'Avoid phrases that imply guaranteed financial or performance outcomes.',
      source: 'compliance_review',
      confidence_score: 0.95,
      tags: ['compliance', 'copy'],
    },
    founder_preference: {
      memory_type: 'founder_preference',
      scope: 'founder',
      title: 'Cashflow-first advice',
      value_text: 'When recommendations conflict, prioritize cashflow protection and operational safety over aggressive growth.',
      source: 'founder_manual',
      confidence_score: 1,
      tags: ['strategy', 'priorities'],
    },
  };
}

export function previewMemorySchema(input: unknown): MemorySchemaPreviewResult {
  const typed = isPlainObject(input) ? input as MemorySchemaPreviewInput : {};
  const memoryType = normalizeMemoryType(typed.memory_type);
  const scope = normalizeScope(typed.scope, memoryType);
  const status = normalizeStatus(typed.status);
  const title = truncatePreview(cleanString(typed.title), 90);
  const valueText = cleanString(typed.value_text);
  const valueJson = isPlainObject(typed.value_json) ? typed.value_json : undefined;
  const source = truncatePreview(cleanString(typed.source) || 'unspecified_preview_source', 80);
  const confidenceScore = typeof typed.confidence_score === 'number' && Number.isFinite(typed.confidence_score)
    ? Math.min(1, Math.max(0, typed.confidence_score))
    : null;
  const tags = normalizeTags(typed.tags);
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!memoryType) issues.push('memory_type must be one of the Phase 15.4 supported memory types.');
  if (!title) issues.push('title is required for future founder-visible review.');
  if (!valueText) issues.push('value_text is required for reviewable memory storage.');
  if (valueJson && JSON.stringify(valueJson).length > 5000) issues.push('value_json is too large for safe memory preview.');
  if (valueText.length > 2500) issues.push('value_text is too long for a safe memory item.');
  if (typed.force === true) warnings.push('force=true ignored; it cannot store memory, inject memory into prompts, invoke tools, create actions, or enable auto-run.');

  const forbidden = hasForbiddenFragment({ title, valueText, valueJson, source, tags });
  if (forbidden) issues.push(`Memory preview contains forbidden secret/raw-payload fragment: ${forbidden}`);

  const injectionSignals = ['ignore previous instructions', 'system prompt', 'developer message', 'run this command', 'bypass approval', 'disable safety'];
  if (injectionSignals.some((signal) => valueText.toLowerCase().includes(signal))) {
    warnings.push('Potential prompt-injection or safety-bypass instruction detected. Keep memory as review-only and do not inject into Claude.');
  }

  return {
    phase: 'V2 Phase 15.4 — Memory Table',
    healthMode: MEMORY_SCHEMA_HEALTH_MODE,
    tableName: 'memory_items',
    normalizedMemoryType: memoryType,
    normalizedScope: scope,
    normalizedStatus: status,
    readyForFutureStorage: issues.length === 0,
    canStoreThisPhase: false,
    canInjectIntoClaudeThisPhase: false,
    canAutoCaptureThisPhase: false,
    sanitizedPreview: {
      memory_type: memoryType,
      scope,
      title,
      value_text_preview: truncatePreview(valueText),
      value_json_keys: valueJson ? Object.keys(valueJson).slice(0, 24) : [],
      source,
      confidence_score: confidenceScore,
      status,
      tags,
    },
    requiredHumanControl: [
      'Founder/admin review before status becomes active.',
      'Memory UI before users can edit/delete/disable memory.',
      'Prompt-injection scan before any future Claude context injection.',
      'Workspace scoping before any future recall.',
    ],
    issues,
    warnings,
    safety: buildMemorySchemaSafety(),
  };
}

export function assertMemorySchemaSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Memory schema output contains forbidden fragment: ${fragment}`);
    }
  }
}
