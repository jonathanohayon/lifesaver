import { z } from 'zod';

export const CONTENT_ACTION_PAYLOAD_PHASE = 'v0.7.0_phase_9_4' as const;
export const CONTENT_ACTION_PAYLOAD_HEALTH_MODE = 'v2-phase-9-4-content-action-payload' as const;
export const CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION = 'content_publish_payload.v0.7.0.phase_9_4' as const;
export const CONTENT_PUBLISH_ACTION_TYPE = 'content_publish' as const;
export const SELECTED_CONTENT_PUBLISH_PLATFORM = 'linkedin' as const;
export const SELECTED_CONTENT_PUBLISH_ACCOUNT_KIND = 'member' as const;

export const CONTENT_PUBLISH_MEDIA_TYPE_VALUES = [
  'none',
  'link',
  'image',
  'video',
  'document',
] as const;

export type ContentPublishMediaType = typeof CONTENT_PUBLISH_MEDIA_TYPE_VALUES[number];

const SECRET_LIKE_KEY_PATTERN = /(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer|password|secret|cookie|database[_-]?url|credential)/i;
const LINKEDIN_MEMBER_URN_PATTERN = /^urn:li:person:[A-Za-z0-9_-]+$/;
const LINKEDIN_SAFE_ACCOUNT_ID_PATTERN = /^[A-Za-z0-9:._@\-\/]+$/;

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeHashtag(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 60)
    .toLowerCase();

  return cleaned ? `#${cleaned}` : '';
}

function safeIsoDateOrNull(value: string | null | undefined): string | null {
  const text = normalizeNullableString(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error('scheduled_time must be a valid ISO date-time string when provided.');
  }
  return date.toISOString();
}

export function findForbiddenPayloadKeys(value: unknown, path = '$'): string[] {
  const found: string[] = [];

  if (!value || typeof value !== 'object') return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findForbiddenPayloadKeys(item, `${path}[${index}]`));
    });
    return found;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (SECRET_LIKE_KEY_PATTERN.test(key)) {
      found.push(childPath);
    }
    found.push(...findForbiddenPayloadKeys(child, childPath));
  }

  return found;
}

function ensureNoForbiddenPayloadKeys(value: unknown): void {
  const forbidden = findForbiddenPayloadKeys(value);
  if (forbidden.length) {
    throw new Error(`content_publish payload must not include secret/token fields: ${forbidden.join(', ')}`);
  }
}

function assertSafeAccountId(accountId: string): string {
  const id = accountId.trim();

  if (!id) {
    throw new Error('account_id is required.');
  }

  if (!LINKEDIN_SAFE_ACCOUNT_ID_PATTERN.test(id)) {
    throw new Error('account_id contains unsupported characters.');
  }

  if (id.toLowerCase().includes('token') || id.toLowerCase().includes('secret') || id.toLowerCase().includes('bearer')) {
    throw new Error('account_id must be an account/member identifier, not token material.');
  }

  return id;
}

const contentPublishPayloadBaseSchema = z.object({
  schema_version: z.literal(CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION).default(CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION),
  action_type: z.literal(CONTENT_PUBLISH_ACTION_TYPE).default(CONTENT_PUBLISH_ACTION_TYPE),
  platform: z.literal(SELECTED_CONTENT_PUBLISH_PLATFORM),
  account_kind: z.literal(SELECTED_CONTENT_PUBLISH_ACCOUNT_KIND).default(SELECTED_CONTENT_PUBLISH_ACCOUNT_KIND),
  account_id: z.string().trim().min(1).max(500),
  caption: z.string().trim().min(1).max(3000),
  media_url: z.string().trim().url().startsWith('https://').max(2048).optional().nullable(),
  media_type: z.enum(CONTENT_PUBLISH_MEDIA_TYPE_VALUES).default('none'),
  link_url: z.string().trim().url().startsWith('https://').max(2048).optional().nullable(),
  hashtags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  scheduled_time: z.string().trim().datetime().optional().nullable(),
  approval_notes: z.string().trim().max(2000).optional().nullable(),
  source_draft_id: z.string().trim().uuid().optional().nullable(),
  idempotency_hint: z.string().trim().min(8).max(200).optional().nullable(),
  safety: z.object({
    manual_approval_required: z.literal(true).default(true),
    real_publish_allowed_by_payload: z.literal(false).default(false),
    auto_run_allowed_by_payload: z.literal(false).default(false),
    external_api_call_allowed_by_payload: z.literal(false).default(false),
  }).default({
    manual_approval_required: true,
    real_publish_allowed_by_payload: false,
    auto_run_allowed_by_payload: false,
    external_api_call_allowed_by_payload: false,
  }),
}).strict();

export const contentPublishPayloadSchema = contentPublishPayloadBaseSchema.superRefine((payload, ctx) => {
  try {
    ensureNoForbiddenPayloadKeys(payload);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Payload contains forbidden secret-like fields.',
    });
  }

  try {
    assertSafeAccountId(payload.account_id);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['account_id'],
      message: error instanceof Error ? error.message : 'Invalid account_id.',
    });
  }

  if (payload.media_type === 'none' && payload.media_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['media_type'],
      message: 'media_type must not be none when media_url is provided.',
    });
  }

  if (payload.media_type !== 'none' && !payload.media_url && payload.media_type !== 'link') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['media_url'],
      message: 'media_url is required for image, video, and document payload placeholders.',
    });
  }

  if (payload.media_type === 'link' && !payload.link_url && !payload.media_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['link_url'],
      message: 'link_url or media_url is required for link payload placeholders.',
    });
  }
});

export type ContentPublishPayloadInput = z.input<typeof contentPublishPayloadSchema>;
export type ContentPublishPayload = z.output<typeof contentPublishPayloadSchema>;

export type NormalizedContentPublishPayload = Omit<ContentPublishPayload, 'account_id' | 'hashtags' | 'scheduled_time' | 'approval_notes' | 'media_url' | 'link_url'> & {
  account_id: string;
  account_id_is_linkedin_member_urn: boolean;
  hashtags: string[];
  scheduled_time: string | null;
  approval_notes: string | null;
  media_url: string | null;
  link_url: string | null;
  browser_receives_token: false;
  publish_ready: false;
  executor_enabled: false;
  external_api_called: false;
};

export function parseContentPublishPayload(input: unknown): NormalizedContentPublishPayload {
  ensureNoForbiddenPayloadKeys(input);

  const parsed = contentPublishPayloadSchema.parse(input);
  const accountId = assertSafeAccountId(parsed.account_id);
  const normalizedHashtags = Array.from(new Set(parsed.hashtags.map(normalizeHashtag).filter(Boolean))).slice(0, 30);
  const scheduledTime = safeIsoDateOrNull(parsed.scheduled_time);
  const approvalNotes = normalizeNullableString(parsed.approval_notes);
  const mediaUrl = normalizeNullableString(parsed.media_url);
  const linkUrl = normalizeNullableString(parsed.link_url);

  return {
    ...parsed,
    account_id: accountId,
    account_id_is_linkedin_member_urn: LINKEDIN_MEMBER_URN_PATTERN.test(accountId),
    hashtags: normalizedHashtags,
    scheduled_time: scheduledTime,
    approval_notes: approvalNotes,
    media_url: mediaUrl,
    link_url: linkUrl,
    browser_receives_token: false,
    publish_ready: false,
    executor_enabled: false,
    external_api_called: false,
  };
}

export function buildContentPublishPayloadPreview(input: unknown): Record<string, unknown> {
  const payload = parseContentPublishPayload(input);

  return {
    schema_version: payload.schema_version,
    action_type: payload.action_type,
    platform: payload.platform,
    account_kind: payload.account_kind,
    account_id_hint: payload.account_id_is_linkedin_member_urn ? 'linkedin_member_urn_present' : 'account_id_present',
    caption_preview: payload.caption.slice(0, 180),
    caption_length: payload.caption.length,
    media_type: payload.media_type,
    has_media_url: Boolean(payload.media_url),
    has_link_url: Boolean(payload.link_url),
    hashtags: payload.hashtags,
    scheduled_time: payload.scheduled_time,
    has_approval_notes: Boolean(payload.approval_notes),
    source_draft_id: payload.source_draft_id || null,
    idempotency_hint_present: Boolean(payload.idempotency_hint),
    safety: {
      manual_approval_required: true,
      publish_ready: false,
      executor_enabled: false,
      external_api_called: false,
      browser_receives_token: false,
      raw_payload_in_browser_preview: false,
    },
  };
}

export const contentActionPayloadModel = {
  phase: CONTENT_ACTION_PAYLOAD_PHASE,
  healthMode: CONTENT_ACTION_PAYLOAD_HEALTH_MODE,
  schemaVersion: CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION,
  selectedPlatform: SELECTED_CONTENT_PUBLISH_PLATFORM,
  selectedAccountKind: SELECTED_CONTENT_PUBLISH_ACCOUNT_KIND,
  actionType: CONTENT_PUBLISH_ACTION_TYPE,
  requiredFields: [
    'caption',
    'platform',
    'account_id',
  ],
  optionalFields: [
    'media_url',
    'media_type',
    'link_url',
    'hashtags',
    'scheduled_time',
    'approval_notes',
    'source_draft_id',
    'idempotency_hint',
  ],
  manualApprovalRequired: true,
  realPublishingEnabled: false,
  executorAdded: false,
  externalApiCalled: false,
  autoRunEnabled: false,
};
