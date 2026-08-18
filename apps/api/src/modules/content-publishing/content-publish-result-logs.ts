import type { LinkedInPostClientResponse } from './content-real-publish.executor.js';

export const CONTENT_PUBLISH_RESULT_LOGS_PHASE = 'v0.7.0_phase_9_10' as const;
export const CONTENT_PUBLISH_RESULT_LOGS_HEALTH_MODE = 'v2-phase-9-10-controlled-live-test' as const;
export const CONTENT_PUBLISH_RESULT_LOGS_EXECUTOR_NAME = 'linkedinManualApprovedContentExecutor' as const;
export const CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME = 'linkedinContentRollbackExecutor' as const;

export type ContentPublishResultStatus = 'success' | 'failed' | 'blocked' | 'skipped' | 'rollback_success' | 'rollback_failed';

type JsonObject = Record<string, unknown>;

export type ContentPublishPlatformResponseSummary = {
  platform: 'linkedin';
  httpStatus: number | null;
  success: boolean;
  postIdSource: 'x-restli-id' | 'x-linkedin-id' | 'location' | 'body.id' | 'body.value' | 'body.urn' | 'none';
  permalinkSource: 'body.permalink' | 'body.webUrl' | 'body.url' | 'location' | 'none';
  platformPostIdPresent: boolean;
  permalinkPresent: boolean;
  publishedTimePresent: boolean;
  responseBodyType: string;
  responseBodyKeys: string[];
  safeHeaderKeys: string[];
  rawResponseBodyStored: false;
  rawTokenStored: false;
};

export type ContentPublishResultTracking = {
  platform: 'linkedin';
  platformPostId: string | null;
  permalink: string | null;
  publishedTime: string | null;
  platformResponseSummary: ContentPublishPlatformResponseSummary;
  errorIfFailed: string | null;
  storedInActionResults: boolean;
};

export type ContentPublishResultLogRow = {
  id: string;
  action_id: string;
  workspace_id: string;
  executor_name: string;
  external_id: string | null;
  external_url: string | null;
  result_status: ContentPublishResultStatus;
  result_summary: string | null;
  error_message: string | null;
  metadata_json: JsonObject;
  created_at: Date;
  updated_at: Date;
};

export type SafeContentPublishResultLog = {
  id: string;
  actionId: string;
  workspaceId: string;
  executorName: string;
  resultStatus: ContentPublishResultStatus;
  platformPostId: string | null;
  permalink: string | null;
  publishedTime: string | null;
  platformResponseSummary: ContentPublishPlatformResponseSummary | null;
  resultSummary: string | null;
  errorIfFailed: string | null;
  rollbackStatus: 'rollback_success' | 'rollback_failed' | 'rollback_not_supported' | null;
  createdAt: string;
  updatedAt: string;
  safety: {
    rawTokenReturned: false;
    rawResponseBodyReturned: false;
    rollbackPayloadReturned: false;
  };
};

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isLinkedInHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && /(^|\.)linkedin\.com$/i.test(parsed.hostname);
  } catch (_error) {
    return false;
  }
}

function bodyKeys(body: unknown): string[] {
  const bodyObj = safeObject(body);
  return Object.keys(bodyObj).filter((key) => !/token|secret|password|authorization/i.test(key)).slice(0, 20).sort();
}

function safeHeaderKeys(headers: Record<string, string>): string[] {
  return Object.keys(headers || {})
    .map((key) => key.toLowerCase())
    .filter((key) => !/authorization|token|cookie|secret|password/i.test(key))
    .filter((key) => ['x-restli-id', 'x-linkedin-id', 'location', 'content-type', 'request-id', 'x-li-uuid'].includes(key))
    .sort();
}

export function extractLinkedInPlatformPostId(response: LinkedInPostClientResponse): { id: string | null; source: ContentPublishPlatformResponseSummary['postIdSource'] } {
  const headers = response.headers || {};
  const xRestliId = safeString(headers['x-restli-id']);
  if (xRestliId) return { id: xRestliId, source: 'x-restli-id' };

  const xLinkedInId = safeString(headers['x-linkedin-id']);
  if (xLinkedInId) return { id: xLinkedInId, source: 'x-linkedin-id' };

  const location = safeString(headers.location);
  if (location) return { id: location, source: 'location' };

  const body = safeObject(response.body);
  const bodyId = safeString(body.id);
  if (bodyId) return { id: bodyId, source: 'body.id' };

  const value = safeString(body.value);
  if (value) return { id: value, source: 'body.value' };

  const urn = safeString(body.urn);
  if (urn) return { id: urn, source: 'body.urn' };

  return { id: null, source: 'none' };
}

export function extractLinkedInPermalink(response: LinkedInPostClientResponse): { permalink: string | null; source: ContentPublishPlatformResponseSummary['permalinkSource'] } {
  const body = safeObject(response.body);
  const bodyPermalink = safeString(body.permalink);
  if (isLinkedInHttpUrl(bodyPermalink)) return { permalink: bodyPermalink, source: 'body.permalink' };

  const bodyWebUrl = safeString(body.webUrl);
  if (isLinkedInHttpUrl(bodyWebUrl)) return { permalink: bodyWebUrl, source: 'body.webUrl' };

  const bodyUrl = safeString(body.url);
  if (isLinkedInHttpUrl(bodyUrl)) return { permalink: bodyUrl, source: 'body.url' };

  const location = safeString((response.headers || {}).location);
  if (isLinkedInHttpUrl(location) && !/api\.linkedin\.com/i.test(location)) {
    return { permalink: location, source: 'location' };
  }

  return { permalink: null, source: 'none' };
}

export function buildPlatformResponseSummary(params: {
  response: LinkedInPostClientResponse | null;
  success: boolean;
  platformPostId: string | null;
  postIdSource: ContentPublishPlatformResponseSummary['postIdSource'];
  permalink: string | null;
  permalinkSource: ContentPublishPlatformResponseSummary['permalinkSource'];
  publishedTime: string | null;
}): ContentPublishPlatformResponseSummary {
  const response = params.response;
  const headers = response?.headers || {};
  return {
    platform: 'linkedin',
    httpStatus: response?.status ?? null,
    success: params.success,
    postIdSource: params.postIdSource,
    permalinkSource: params.permalinkSource,
    platformPostIdPresent: Boolean(params.platformPostId),
    permalinkPresent: Boolean(params.permalink),
    publishedTimePresent: Boolean(params.publishedTime),
    responseBodyType: response ? (Array.isArray(response.body) ? 'array' : typeof response.body) : 'none',
    responseBodyKeys: response ? bodyKeys(response.body) : [],
    safeHeaderKeys: safeHeaderKeys(headers),
    rawResponseBodyStored: false,
    rawTokenStored: false,
  };
}

export function buildContentPublishResultTracking(params: {
  response: LinkedInPostClientResponse | null;
  success: boolean;
  platformPostId: string | null;
  postIdSource: ContentPublishPlatformResponseSummary['postIdSource'];
  permalink: string | null;
  permalinkSource: ContentPublishPlatformResponseSummary['permalinkSource'];
  publishedTime: string | null;
  errorIfFailed: string | null;
  storedInActionResults: boolean;
}): ContentPublishResultTracking {
  return {
    platform: 'linkedin',
    platformPostId: params.platformPostId,
    permalink: params.permalink,
    publishedTime: params.publishedTime,
    platformResponseSummary: buildPlatformResponseSummary({
      response: params.response,
      success: params.success,
      platformPostId: params.platformPostId,
      postIdSource: params.postIdSource,
      permalink: params.permalink,
      permalinkSource: params.permalinkSource,
      publishedTime: params.publishedTime,
    }),
    errorIfFailed: params.errorIfFailed,
    storedInActionResults: params.storedInActionResults,
  };
}

export function buildContentPublishResultMetadata(params: {
  publishedTime: string | null;
  platformPostId: string | null;
  permalink: string | null;
  platformResponseSummary: ContentPublishPlatformResponseSummary;
  errorIfFailed: string | null;
  requestBodyPreview?: JsonObject;
  extra?: JsonObject;
}): JsonObject {
  return {
    phase: CONTENT_PUBLISH_RESULT_LOGS_PHASE,
    result_tracking_version: 'phase_9_7',
    platform: 'linkedin',
    platform_post_id: params.platformPostId,
    permalink: params.permalink,
    published_time: params.publishedTime,
    platform_response_summary: params.platformResponseSummary,
    error_if_failed: params.errorIfFailed,
    request_body_preview: safeObject(params.requestBodyPreview),
    raw_token_returned: false,
    raw_token_stored: false,
    raw_response_body_stored: false,
    external_writes_attempted: params.platformResponseSummary.httpStatus !== null,
    external_writes_succeeded: params.platformResponseSummary.success,
    ...safeObject(params.extra),
  };
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function formatSafeContentPublishResultLog(row: ContentPublishResultLogRow): SafeContentPublishResultLog {
  const metadata = safeObject(row.metadata_json);
  const platformSummary = safeObject(metadata.platform_response_summary) as ContentPublishPlatformResponseSummary | null;
  return {
    id: row.id,
    actionId: row.action_id,
    workspaceId: row.workspace_id,
    executorName: row.executor_name,
    resultStatus: row.result_status,
    platformPostId: row.external_id || safeString(metadata.platform_post_id),
    permalink: row.external_url || safeString(metadata.permalink),
    publishedTime: safeString(metadata.published_time),
    platformResponseSummary: platformSummary && Object.keys(platformSummary).length ? platformSummary : null,
    resultSummary: row.result_summary,
    errorIfFailed: row.error_message || safeString(metadata.error_if_failed),
    rollbackStatus: ['rollback_success', 'rollback_failed', 'rollback_not_supported'].includes(String(metadata.rollback_status || '')) ? metadata.rollback_status as any : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    safety: {
      rawTokenReturned: false,
      rawResponseBodyReturned: false,
      rollbackPayloadReturned: false,
    },
  };
}

export function assertNoTokenLeak(value: unknown): void {
  const serialized = JSON.stringify(value);
  const dangerous = /(Bearer\s+[A-Za-z0-9._-]+|access_token|refresh_token|authorization|client_secret|password)/i.test(serialized);
  if (dangerous) {
    throw new Error('Unsafe result log contains token-like or secret-like text.');
  }
}

export function buildContentPublishResultTrackingSummary() {
  return {
    version: '0.7.0',
    phase: CONTENT_PUBLISH_RESULT_LOGS_PHASE,
    healthMode: CONTENT_PUBLISH_RESULT_LOGS_HEALTH_MODE,
    executorName: CONTENT_PUBLISH_RESULT_LOGS_EXECUTOR_NAME,
    targetTable: 'action_results',
    stores: [
      'platform post ID in action_results.external_id',
      'permalink in action_results.external_url when returned by LinkedIn or safely available',
      'published time in action_results.metadata_json.published_time',
      'safe platform response summary in action_results.metadata_json.platform_response_summary',
      'error message in action_results.error_message when failed or blocked',
    ],
    doesNotStore: [
      'raw OAuth access token',
      'raw OAuth refresh token',
      'Authorization header',
      'raw LinkedIn response body',
      'rollback payload in browser response',
      'raw delete response body',
    ],
    note: 'LinkedIn post creation returns a post ID in x-restli-id on 201 responses. Phase 9.9 keeps publish result logs and adds rollback/unpublish result logs without exposing rollback payloads, raw tokens, or raw LinkedIn response bodies.',
  };
}
