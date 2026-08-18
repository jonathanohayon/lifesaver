export const CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION = 'content_publish_payload.v0.7.0.phase_9_4' as const;
export const CONTENT_PUBLISH_PAYLOAD_PHASE = 'v0.7.0_phase_9_4' as const;
export const CONTENT_PUBLISH_PLATFORM = 'linkedin' as const;
export const CONTENT_PUBLISH_ACTION_TYPE = 'content_publish' as const;

export type LinkedInContentPublishMediaType = 'none' | 'link' | 'image' | 'video' | 'document';

export interface LinkedInContentPublishPayloadV094 {
  schema_version: typeof CONTENT_PUBLISH_PAYLOAD_SCHEMA_VERSION;
  action_type: typeof CONTENT_PUBLISH_ACTION_TYPE;
  platform: typeof CONTENT_PUBLISH_PLATFORM;
  account_kind: 'member';
  account_id: string;
  caption: string;
  media_url?: string | null;
  media_type: LinkedInContentPublishMediaType;
  link_url?: string | null;
  hashtags: string[];
  scheduled_time?: string | null;
  approval_notes?: string | null;
  source_draft_id?: string | null;
  idempotency_hint?: string | null;
  safety: {
    manual_approval_required: true;
    real_publish_allowed_by_payload: false;
    auto_run_allowed_by_payload: false;
    external_api_call_allowed_by_payload: false;
  };
}

export const LINKEDIN_CONTENT_PUBLISH_PAYLOAD_REQUIRED_FIELDS = [
  'caption',
  'platform',
  'account_id',
] as const;

export const LINKEDIN_CONTENT_PUBLISH_PAYLOAD_OPTIONAL_FIELDS = [
  'media_url',
  'media_type',
  'link_url',
  'hashtags',
  'scheduled_time',
  'approval_notes',
  'source_draft_id',
  'idempotency_hint',
] as const;
