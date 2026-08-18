export const CONTENT_MEDIA_ASSET_SCHEMA_VERSION = 'content_media_asset.v0.7.0.phase_9_5' as const;
export const CONTENT_MEDIA_ASSET_PHASE = 'v0.7.0_phase_9_5' as const;
export const CONTENT_MEDIA_SELECTED_PLATFORM = 'linkedin' as const;

export type LinkedInContentMediaAssetKind = 'image' | 'video';
export type ContentMediaStorageProvider = 'supabase_storage' | 's3_compatible' | 'cloudflare_r2' | 'local_dev_private_disk';

export interface LinkedInContentMediaAssetMetadataV095 {
  schema_version: typeof CONTENT_MEDIA_ASSET_SCHEMA_VERSION;
  platform: typeof CONTENT_MEDIA_SELECTED_PLATFORM;
  asset_kind: LinkedInContentMediaAssetKind;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256?: string | null;
  image?: {
    width_pixels?: number | null;
    height_pixels?: number | null;
    gif_frame_count?: number | null;
    alt_text?: string | null;
  } | null;
  video?: {
    duration_seconds?: number | null;
    width_pixels?: number | null;
    height_pixels?: number | null;
    thumbnail_required?: boolean;
    captions_required?: boolean;
  } | null;
  storage: {
    provider: ContentMediaStorageProvider;
    bucket: string;
    visibility: 'private';
    object_key?: string | null;
  };
  preview: {
    signed_preview_url_ttl_seconds: number;
    public_preview_url_allowed: false;
  };
  safety: {
    manual_approval_required: true;
    media_upload_to_linkedin_allowed_by_payload: false;
    real_publish_allowed_by_payload: false;
    auto_run_allowed_by_payload: false;
    external_api_call_allowed_by_payload: false;
  };
}

export const LINKEDIN_CONTENT_MEDIA_IMAGE_LIMITS = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'],
  maxBytes: 20 * 1024 * 1024,
  maxPixelCount: 36_152_320,
  maxGifFrameCount: 250,
} as const;

export const LINKEDIN_CONTENT_MEDIA_VIDEO_LIMITS = {
  allowedMimeTypes: ['video/mp4'],
  allowedExtensions: ['mp4'],
  minBytes: 75 * 1024,
  maxBytes: 500 * 1024 * 1024,
  minDurationSeconds: 3,
  maxDurationSeconds: 30 * 60,
} as const;

export const LINKEDIN_CONTENT_MEDIA_STORAGE_FLOW = {
  visibility: 'private',
  previewUrlType: 'short_lived_signed_url',
  browserReceivesPermanentStorageUrl: false,
  browserReceivesLinkedInUploadUrl: false,
  browserReceivesAccessToken: false,
} as const;
