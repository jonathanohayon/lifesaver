import { z } from 'zod';

export const CONTENT_MEDIA_ASSET_PHASE = 'v0.7.0_phase_9_5' as const;
export const CONTENT_MEDIA_ASSET_HEALTH_MODE = 'v2-phase-9-5-media-asset-handling' as const;
export const CONTENT_MEDIA_ASSET_SCHEMA_VERSION = 'content_media_asset.v0.7.0.phase_9_5' as const;
export const CONTENT_MEDIA_ASSET_FLOW_VERSION = 'content_media_asset_flow.v0.7.0.phase_9_5' as const;
export const CONTENT_MEDIA_SELECTED_PLATFORM = 'linkedin' as const;

export const CONTENT_MEDIA_ASSET_KIND_VALUES = ['image', 'video'] as const;
export type ContentMediaAssetKind = typeof CONTENT_MEDIA_ASSET_KIND_VALUES[number];

export const CONTENT_MEDIA_STORAGE_PROVIDER_VALUES = [
  'supabase_storage',
  's3_compatible',
  'cloudflare_r2',
  'local_dev_private_disk',
] as const;
export type ContentMediaStorageProvider = typeof CONTENT_MEDIA_STORAGE_PROVIDER_VALUES[number];

const KB = 1024;
const MB = 1024 * 1024;

export const CONTENT_MEDIA_ASSET_LIMITS = {
  image: {
    maxBytes: 20 * MB,
    maxPixelCount: 36_152_320,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'] as const,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'] as const,
    maxGifFrameCount: 250,
  },
  video: {
    minBytes: 75 * KB,
    maxBytes: 500 * MB,
    minDurationSeconds: 3,
    maxDurationSeconds: 30 * 60,
    allowedMimeTypes: ['video/mp4'] as const,
    allowedExtensions: ['mp4'] as const,
  },
} as const;

export const CONTENT_MEDIA_STORAGE_FLOW = {
  providerDefault: 'supabase_storage',
  bucketDefault: 'content-media-assets',
  visibility: 'private',
  previewUrlType: 'short_lived_signed_url',
  defaultPreviewTtlSeconds: 300,
  maxPreviewTtlSeconds: 900,
  objectKeyPattern: 'workspace/{workspace_id}/content-media/{asset_id}/{safe_file_name}',
  browserReceivesPermanentStorageUrl: false,
  browserReceivesLinkedInUploadUrl: false,
  browserReceivesAccessToken: false,
} as const;

const SECRET_LIKE_KEY_PATTERN = /(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer|password|secret|cookie|database[_-]?url|credential|upload[_-]?url)/i;
const SAFE_FILE_NAME_PATTERN = /^[A-Za-z0-9._()\- ]+$/;

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function fileExtension(fileName: string): string {
  const safeName = normalizeText(fileName).toLowerCase();
  const dotIndex = safeName.lastIndexOf('.');
  return dotIndex >= 0 ? safeName.slice(dotIndex + 1) : '';
}

export function findForbiddenMediaAssetKeys(value: unknown, path = '$'): string[] {
  const found: string[] = [];

  if (!value || typeof value !== 'object') return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findForbiddenMediaAssetKeys(item, `${path}[${index}]`));
    });
    return found;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (SECRET_LIKE_KEY_PATTERN.test(key)) {
      found.push(childPath);
    }
    found.push(...findForbiddenMediaAssetKeys(child, childPath));
  }

  return found;
}

function ensureNoForbiddenMediaAssetKeys(value: unknown): void {
  const forbidden = findForbiddenMediaAssetKeys(value);
  if (forbidden.length) {
    throw new Error(`media asset metadata must not include secret/upload/token fields: ${forbidden.join(', ')}`);
  }
}

export function sanitizeMediaFileName(fileName: string): string {
  const trimmed = normalizeText(fileName);
  if (!trimmed) throw new Error('original_file_name is required.');
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new Error('original_file_name must not include path separators.');
  }
  if (!SAFE_FILE_NAME_PATTERN.test(trimmed)) {
    throw new Error('original_file_name contains unsupported characters.');
  }

  return trimmed.replace(/\s+/g, '-').slice(0, 180);
}

const imageMetadataSchema = z.object({
  width_pixels: z.number().int().positive().max(100_000).optional().nullable(),
  height_pixels: z.number().int().positive().max(100_000).optional().nullable(),
  gif_frame_count: z.number().int().positive().max(10_000).optional().nullable(),
  alt_text: z.string().trim().max(4086).optional().nullable(),
}).strict();

const videoMetadataSchema = z.object({
  duration_seconds: z.number().positive().max(24 * 60 * 60).optional().nullable(),
  width_pixels: z.number().int().positive().max(100_000).optional().nullable(),
  height_pixels: z.number().int().positive().max(100_000).optional().nullable(),
  thumbnail_required: z.boolean().default(false),
  captions_required: z.boolean().default(false),
}).strict();

const storageSchema = z.object({
  provider: z.enum(CONTENT_MEDIA_STORAGE_PROVIDER_VALUES).default('supabase_storage'),
  bucket: z.string().trim().min(3).max(120).default('content-media-assets'),
  visibility: z.literal('private').default('private'),
  object_key: z.string().trim().min(10).max(900).optional().nullable(),
}).strict().default({
  provider: 'supabase_storage',
  bucket: 'content-media-assets',
  visibility: 'private',
  object_key: null,
});

const previewSchema = z.object({
  signed_preview_url_ttl_seconds: z.number().int().min(60).max(900).default(300),
  public_preview_url_allowed: z.literal(false).default(false),
}).strict().default({
  signed_preview_url_ttl_seconds: 300,
  public_preview_url_allowed: false,
});

const safetySchema = z.object({
  manual_approval_required: z.literal(true).default(true),
  media_upload_to_linkedin_allowed_by_payload: z.literal(false).default(false),
  real_publish_allowed_by_payload: z.literal(false).default(false),
  auto_run_allowed_by_payload: z.literal(false).default(false),
  external_api_call_allowed_by_payload: z.literal(false).default(false),
}).strict().default({
  manual_approval_required: true,
  media_upload_to_linkedin_allowed_by_payload: false,
  real_publish_allowed_by_payload: false,
  auto_run_allowed_by_payload: false,
  external_api_call_allowed_by_payload: false,
});

const mediaAssetMetadataBaseSchema = z.object({
  schema_version: z.literal(CONTENT_MEDIA_ASSET_SCHEMA_VERSION).default(CONTENT_MEDIA_ASSET_SCHEMA_VERSION),
  platform: z.literal(CONTENT_MEDIA_SELECTED_PLATFORM),
  asset_kind: z.enum(CONTENT_MEDIA_ASSET_KIND_VALUES),
  original_file_name: z.string().trim().min(1).max(240),
  mime_type: z.string().trim().min(3).max(120),
  size_bytes: z.number().int().positive(),
  checksum_sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional().nullable(),
  image: imageMetadataSchema.optional().nullable(),
  video: videoMetadataSchema.optional().nullable(),
  storage: storageSchema,
  preview: previewSchema,
  safety: safetySchema,
}).strict();

export const contentMediaAssetMetadataSchema = mediaAssetMetadataBaseSchema.superRefine((metadata, ctx) => {
  try {
    ensureNoForbiddenMediaAssetKeys(metadata);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Metadata contains forbidden secret/upload/token fields.',
    });
  }

  let safeName = '';
  try {
    safeName = sanitizeMediaFileName(metadata.original_file_name);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['original_file_name'],
      message: error instanceof Error ? error.message : 'Invalid file name.',
    });
  }

  const extension = fileExtension(safeName || metadata.original_file_name);
  const mime = metadata.mime_type.toLowerCase();

  if (metadata.asset_kind === 'image') {
    if (!(CONTENT_MEDIA_ASSET_LIMITS.image.allowedMimeTypes as readonly string[]).includes(mime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mime_type'], message: 'Image MIME type must be image/jpeg, image/png, or image/gif.' });
    }
    if (!(CONTENT_MEDIA_ASSET_LIMITS.image.allowedExtensions as readonly string[]).includes(extension)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original_file_name'], message: 'Image file extension must be jpg, jpeg, png, or gif.' });
    }
    if (metadata.size_bytes > CONTENT_MEDIA_ASSET_LIMITS.image.maxBytes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['size_bytes'], message: 'Image file is above the LIFE.SAVER 20MB safety limit.' });
    }
    if (metadata.video) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['video'], message: 'Image assets must not include video metadata.' });
    }

    const width = metadata.image?.width_pixels || null;
    const height = metadata.image?.height_pixels || null;
    if (width && height && width * height > CONTENT_MEDIA_ASSET_LIMITS.image.maxPixelCount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['image'], message: 'Image pixel count exceeds LinkedIn image limit.' });
    }

    const gifFrames = metadata.image?.gif_frame_count || null;
    if (mime === 'image/gif' && gifFrames && gifFrames > CONTENT_MEDIA_ASSET_LIMITS.image.maxGifFrameCount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['image', 'gif_frame_count'], message: 'GIF frame count exceeds LinkedIn GIF frame limit.' });
    }
  }

  if (metadata.asset_kind === 'video') {
    if (!(CONTENT_MEDIA_ASSET_LIMITS.video.allowedMimeTypes as readonly string[]).includes(mime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mime_type'], message: 'Video MIME type must be video/mp4.' });
    }
    if (!(CONTENT_MEDIA_ASSET_LIMITS.video.allowedExtensions as readonly string[]).includes(extension)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original_file_name'], message: 'Video file extension must be mp4.' });
    }
    if (metadata.size_bytes < CONTENT_MEDIA_ASSET_LIMITS.video.minBytes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['size_bytes'], message: 'Video file is below LinkedIn minimum size guidance.' });
    }
    if (metadata.size_bytes > CONTENT_MEDIA_ASSET_LIMITS.video.maxBytes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['size_bytes'], message: 'Video file is above the initial LIFE.SAVER 500MB safety limit.' });
    }
    if (metadata.image) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['image'], message: 'Video assets must not include image metadata.' });
    }

    const duration = metadata.video?.duration_seconds || null;
    if (duration && duration < CONTENT_MEDIA_ASSET_LIMITS.video.minDurationSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['video', 'duration_seconds'], message: 'Video duration is below LinkedIn minimum duration guidance.' });
    }
    if (duration && duration > CONTENT_MEDIA_ASSET_LIMITS.video.maxDurationSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['video', 'duration_seconds'], message: 'Video duration is above LinkedIn maximum duration guidance.' });
    }
  }
});

export type ContentMediaAssetMetadataInput = z.input<typeof contentMediaAssetMetadataSchema>;
export type ContentMediaAssetMetadata = z.output<typeof contentMediaAssetMetadataSchema>;

export interface NormalizedContentMediaAssetMetadata extends Omit<ContentMediaAssetMetadata, 'original_file_name' | 'mime_type'> {
  original_file_name: string;
  safe_file_name: string;
  extension: string;
  mime_type: string;
  requires_server_file_signature_check: true;
  requires_dimensions_or_duration_probe: boolean;
  storage_visibility: 'private';
  preview_url_type: 'short_lived_signed_url';
  linkedInUploadApi: 'images_api' | 'videos_api';
  linkedInUrnRequiredBeforePost: 'urn:li:image:{id}' | 'urn:li:video:{id}';
  media_upload_endpoint_added: false;
  linkedIn_upload_enabled: false;
  external_api_called: false;
}

export function parseContentMediaAssetMetadata(input: unknown): NormalizedContentMediaAssetMetadata {
  ensureNoForbiddenMediaAssetKeys(input);

  const parsed = contentMediaAssetMetadataSchema.parse(input);
  const safeFileName = sanitizeMediaFileName(parsed.original_file_name);
  const extension = fileExtension(safeFileName);
  const mime = parsed.mime_type.toLowerCase();

  const requiresProbe = parsed.asset_kind === 'image'
    ? !(parsed.image?.width_pixels && parsed.image?.height_pixels)
    : !parsed.video?.duration_seconds;

  return {
    ...parsed,
    original_file_name: parsed.original_file_name.trim(),
    safe_file_name: safeFileName,
    extension,
    mime_type: mime,
    requires_server_file_signature_check: true,
    requires_dimensions_or_duration_probe: Boolean(requiresProbe),
    storage_visibility: 'private',
    preview_url_type: 'short_lived_signed_url',
    linkedInUploadApi: parsed.asset_kind === 'image' ? 'images_api' : 'videos_api',
    linkedInUrnRequiredBeforePost: parsed.asset_kind === 'image' ? 'urn:li:image:{id}' : 'urn:li:video:{id}',
    media_upload_endpoint_added: false,
    linkedIn_upload_enabled: false,
    external_api_called: false,
  };
}

export function buildContentMediaAssetPreview(input: unknown): Record<string, unknown> {
  const asset = parseContentMediaAssetMetadata(input);

  return {
    schema_version: asset.schema_version,
    platform: asset.platform,
    asset_kind: asset.asset_kind,
    safe_file_name: asset.safe_file_name,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    size_mb_approx: Number((asset.size_bytes / MB).toFixed(2)),
    has_checksum: Boolean(asset.checksum_sha256),
    image: asset.asset_kind === 'image' ? {
      width_pixels: asset.image?.width_pixels || null,
      height_pixels: asset.image?.height_pixels || null,
      pixel_count: asset.image?.width_pixels && asset.image?.height_pixels ? asset.image.width_pixels * asset.image.height_pixels : null,
      has_alt_text: Boolean(normalizeNullableText(asset.image?.alt_text)),
    } : null,
    video: asset.asset_kind === 'video' ? {
      duration_seconds: asset.video?.duration_seconds || null,
      width_pixels: asset.video?.width_pixels || null,
      height_pixels: asset.video?.height_pixels || null,
      thumbnail_required: asset.video?.thumbnail_required || false,
      captions_required: asset.video?.captions_required || false,
    } : null,
    storage: {
      provider: asset.storage.provider,
      bucket_hint: asset.storage.bucket ? 'private_bucket_configured' : 'private_bucket_missing',
      visibility: 'private',
      object_key_present: Boolean(asset.storage.object_key),
      object_key_exposed_to_browser: false,
    },
    preview: {
      url_type: 'short_lived_signed_url',
      signed_preview_url_ttl_seconds: asset.preview.signed_preview_url_ttl_seconds,
      public_preview_url_allowed: false,
      permanent_public_url_allowed: false,
    },
    linkedin: {
      future_upload_api: asset.linkedInUploadApi,
      urn_required_before_post: asset.linkedInUrnRequiredBeforePost,
      linkedIn_upload_enabled_now: false,
      external_api_called: false,
    },
    safety: {
      manual_approval_required: true,
      media_upload_endpoint_added: false,
      publish_executor_added: false,
      auto_run_enabled: false,
      browser_receives_access_token: false,
      browser_receives_linkedin_upload_url: false,
      raw_upload_url_in_preview: false,
    },
  };
}

export function buildContentMediaAssetHandlingFlow(assetKind: ContentMediaAssetKind = 'image'): Record<string, unknown> {
  const isImage = assetKind === 'image';

  return {
    flow_version: CONTENT_MEDIA_ASSET_FLOW_VERSION,
    phase: CONTENT_MEDIA_ASSET_PHASE,
    platform: CONTENT_MEDIA_SELECTED_PLATFORM,
    asset_kind: assetKind,
    safety_mode: 'planning_and_validation_only',
    steps: [
      'Founder selects file in browser on a future content action screen.',
      'Browser sends metadata and file to LIFE.SAVER backend upload endpoint in a later phase.',
      'Backend validates auth, workspace, file name, MIME type, extension, size, and file signature.',
      'Backend probes dimensions or duration and stores the file in private object storage.',
      'Backend stores only safe asset metadata and returns a browser-safe preview record.',
      'Browser preview uses a short-lived signed URL, not a permanent public URL.',
      'A later manually-approved executor uploads the stored asset to LinkedIn and receives a LinkedIn media URN.',
      'Only after approval and policy checks can the future post executor attach that LinkedIn media URN to a post.',
    ],
    storage: CONTENT_MEDIA_STORAGE_FLOW,
    validation: isImage ? {
      allowedMimeTypes: CONTENT_MEDIA_ASSET_LIMITS.image.allowedMimeTypes,
      allowedExtensions: CONTENT_MEDIA_ASSET_LIMITS.image.allowedExtensions,
      maxBytes: CONTENT_MEDIA_ASSET_LIMITS.image.maxBytes,
      maxPixelCount: CONTENT_MEDIA_ASSET_LIMITS.image.maxPixelCount,
      maxGifFrameCount: CONTENT_MEDIA_ASSET_LIMITS.image.maxGifFrameCount,
    } : {
      allowedMimeTypes: CONTENT_MEDIA_ASSET_LIMITS.video.allowedMimeTypes,
      allowedExtensions: CONTENT_MEDIA_ASSET_LIMITS.video.allowedExtensions,
      minBytes: CONTENT_MEDIA_ASSET_LIMITS.video.minBytes,
      maxBytes: CONTENT_MEDIA_ASSET_LIMITS.video.maxBytes,
      minDurationSeconds: CONTENT_MEDIA_ASSET_LIMITS.video.minDurationSeconds,
      maxDurationSeconds: CONTENT_MEDIA_ASSET_LIMITS.video.maxDurationSeconds,
    },
    linkedInFutureUpload: isImage ? {
      api: 'Images API',
      initializeStep: 'initializeUpload',
      resultNeededBeforePost: 'urn:li:image:{id}',
    } : {
      api: 'Videos API',
      initializeStep: 'initializeUpload',
      resultNeededBeforePost: 'urn:li:video:{id}',
      multipartUploadExpected: true,
    },
    currentPhaseDoesNotAdd: [
      'file upload endpoint',
      'object storage write implementation',
      'LinkedIn media upload',
      'LinkedIn post publishing',
      'external API calls',
      'auto-run execution',
    ],
  };
}

export const contentMediaAssetHandlingModel = {
  phase: CONTENT_MEDIA_ASSET_PHASE,
  healthMode: CONTENT_MEDIA_ASSET_HEALTH_MODE,
  schemaVersion: CONTENT_MEDIA_ASSET_SCHEMA_VERSION,
  flowVersion: CONTENT_MEDIA_ASSET_FLOW_VERSION,
  selectedPlatform: CONTENT_MEDIA_SELECTED_PLATFORM,
  uploadFlowDefined: true,
  storagePlanDefined: true,
  validationRulesDefined: true,
  fileSizeLimitsDefined: true,
  mimeChecksDefined: true,
  previewContractDefined: true,
  mediaUploadEndpointAdded: false,
  storageImplementationAdded: false,
  linkedInMediaUploadAdded: false,
  linkedInPostExecutorAdded: false,
  externalApiCalled: false,
  autoRunEnabled: false,
  realPublishingEnabled: false,
  manualApprovalRequired: true,
};
