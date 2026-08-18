import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import { getWorkspaceActionForUser, insertActionLifecycleEvent } from '../actions/actions.repository.js';
import type { ActionStatus } from '../actions/actions.types.js';
import { getLinkedInCredentialForServerExecutorOnly } from './content-connector-credentials.service.js';
import {
  findLatestSuccessfulContentPublishResult,
  insertRealPublishActionResult,
  transitionContentPublishActionStatus,
} from './content-real-publish.repository.js';
import { CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME, assertNoTokenLeak } from './content-publish-result-logs.js';
import { LINKEDIN_REQUIRED_WRITE_SCOPE } from './content-real-publish.executor.js';

export const CONTENT_PUBLISH_ROLLBACK_PHASE = 'v0.7.0_phase_9_10' as const;
export const CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE = 'v2-phase-9-10-controlled-live-test' as const;

const deleteBodySchema = z.object({
  reason: z.string().max(500).optional().default('Manual rollback requested.'),
  force: z.boolean().optional().default(false),
}).default({ reason: 'Manual rollback requested.', force: false });

type JsonObject = Record<string, unknown>;

export type LinkedInDeleteRequest = {
  url: string;
  method: 'DELETE';
  headers: Record<string, string>;
};

export type LinkedInDeleteClientResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type LinkedInDeleteClient = (request: LinkedInDeleteRequest) => Promise<LinkedInDeleteClientResponse>;

export type ContentPublishRollbackInput = {
  workspaceId: string;
  userId: string;
  actionId: string;
  reason?: string;
  force?: boolean;
};

export type ContentPublishRollbackResult = {
  version: '0.7.0';
  phase: typeof CONTENT_PUBLISH_ROLLBACK_PHASE;
  healthMode: typeof CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE;
  executorName: typeof CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME;
  workspaceId: string;
  actionId: string;
  status: 'rolled_back' | 'rollback_not_supported' | 'blocked' | 'failed';
  checks: {
    databaseConfigured: boolean;
    featureFlagEnabled: boolean;
    actionFound: boolean;
    actionTypeValid: boolean;
    actionExecuted: boolean;
    rollbackRoleAllowed: boolean;
    successfulPublishResultFound: boolean;
    platformPostIdPresent: boolean;
    platformPostIdDeleteSafe: boolean;
    tokenValid: boolean;
    requiredScopePresent: boolean;
    platformDeleteSupported: boolean;
  };
  linkedin: {
    apiCalled: boolean;
    apiStatus: number | null;
    deleteUrlPreview: string | null;
    externalPostId: string | null;
    rawTokenReturned: false;
  };
  resultLogStored: boolean;
  statusPath: ActionStatus[];
  message: string;
  safety: {
    manualRollbackRequestRequired: true;
    autoRunEnabled: false;
    externalWritesAttempted: boolean;
    externalWritesSucceeded: boolean;
    browserReceivesRawToken: false;
    rollbackPayloadReturnedToBrowser: false;
    batchDeleteSupported: false;
    note: string;
  };
};

type ExecuteRollbackOptions = {
  client?: LinkedInDeleteClient;
  bypassFeatureFlagForTests?: boolean;
};

function normalizeHeaderMap(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error.');
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'CONTENT_PUBLISH_ROLLBACK_FAILED';
}

function baseChecks(overrides: Partial<ContentPublishRollbackResult['checks']> = {}): ContentPublishRollbackResult['checks'] {
  return {
    databaseConfigured: isDatabaseConfigured,
    featureFlagEnabled: false,
    actionFound: false,
    actionTypeValid: false,
    actionExecuted: false,
    rollbackRoleAllowed: false,
    successfulPublishResultFound: false,
    platformPostIdPresent: false,
    platformPostIdDeleteSafe: false,
    tokenValid: false,
    requiredScopePresent: false,
    platformDeleteSupported: true,
    ...overrides,
  };
}

function makeResult(params: {
  workspaceId: string;
  actionId: string;
  status: ContentPublishRollbackResult['status'];
  checks: ContentPublishRollbackResult['checks'];
  message: string;
  apiCalled?: boolean;
  apiStatus?: number | null;
  deleteUrlPreview?: string | null;
  externalPostId?: string | null;
  resultLogStored?: boolean;
  statusPath?: ActionStatus[];
  externalWritesAttempted?: boolean;
  externalWritesSucceeded?: boolean;
}): ContentPublishRollbackResult {
  return {
    version: '0.7.0',
    phase: CONTENT_PUBLISH_ROLLBACK_PHASE,
    healthMode: CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE,
    executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    status: params.status,
    checks: params.checks,
    linkedin: {
      apiCalled: Boolean(params.apiCalled),
      apiStatus: params.apiStatus ?? null,
      deleteUrlPreview: params.deleteUrlPreview ?? null,
      externalPostId: params.externalPostId ?? null,
      rawTokenReturned: false,
    },
    resultLogStored: Boolean(params.resultLogStored),
    statusPath: params.statusPath || [],
    message: params.message,
    safety: {
      manualRollbackRequestRequired: true,
      autoRunEnabled: false,
      externalWritesAttempted: Boolean(params.externalWritesAttempted),
      externalWritesSucceeded: Boolean(params.externalWritesSucceeded),
      browserReceivesRawToken: false,
      rollbackPayloadReturnedToBrowser: false,
      batchDeleteSupported: false,
      note: 'Phase 9.9 adds manual content rollback/unpublish behavior for LinkedIn Posts API delete. It is default-off, single-post only, token-safe, and logs rollback_not_supported when a delete-safe LinkedIn post URN is unavailable.',
    },
  };
}

export function parseContentPublishRollbackBody(input: unknown): { reason: string; force: boolean } {
  return deleteBodySchema.parse(input || {});
}

export function isLinkedInPostUrnDeleteSafe(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^urn:li:(share|ugcPost):[A-Za-z0-9_-]+$/.test(trimmed);
}

export function encodeLinkedInPostUrnForPath(postUrn: string): string {
  if (!isLinkedInPostUrnDeleteSafe(postUrn)) {
    throw new AppError(409, 'LINKEDIN_POST_ID_NOT_DELETE_SAFE', 'Rollback requires a safe LinkedIn share/ugcPost URN returned by the successful publish result.');
  }
  return encodeURIComponent(postUrn);
}

export function buildLinkedInDeletePostRequest(params: { accessToken: string; postUrn: string }): LinkedInDeleteRequest {
  const encoded = encodeLinkedInPostUrnForPath(params.postUrn);
  return {
    url: `${env.LINKEDIN_API_BASE_URL.replace(/\/$/, '')}/rest/posts/${encoded}`,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'LinkedIn-Version': env.LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'X-RestLi-Method': 'DELETE',
    },
  };
}

export function buildLinkedInDeleteUrlPreview(postUrn: string): string {
  return `${env.LINKEDIN_API_BASE_URL.replace(/\/$/, '')}/rest/posts/${encodeLinkedInPostUrnForPath(postUrn)}`;
}

function buildRollbackMetadata(params: {
  status: 'rollback_success' | 'rollback_failed' | 'rollback_not_supported' | 'blocked';
  linkedinStatus?: number | null;
  platformPostId?: string | null;
  reason?: string;
  externalWritesAttempted: boolean;
  externalWritesSucceeded: boolean;
  extra?: JsonObject;
}): JsonObject {
  const metadata = {
    phase: CONTENT_PUBLISH_ROLLBACK_PHASE,
    rollback_behavior_version: 'phase_9_9',
    platform: 'linkedin',
    rollback_status: params.status,
    platform_post_id: params.platformPostId || null,
    rollback_reason_preview: String(params.reason || '').slice(0, 220),
    linkedin_status: params.linkedinStatus ?? null,
    external_writes_attempted: params.externalWritesAttempted,
    external_writes_succeeded: params.externalWritesSucceeded,
    raw_token_returned: false,
    raw_response_body_stored: false,
    rollback_payload_returned_to_browser: false,
    batch_delete_supported: false,
    ...safeObject(params.extra),
  };
  assertNoTokenLeak(metadata);
  return metadata;
}

async function defaultLinkedInDeleteClient(request: LinkedInDeleteRequest): Promise<LinkedInDeleteClientResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
  });

  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_error) {
      body = { raw: text.slice(0, 500) };
    }
  }

  return { status: response.status, headers: normalizeHeaderMap(response.headers), body };
}

async function assertRollbackRole(workspaceId: string, userId: string): Promise<string> {
  const membership = await getActiveMembership(workspaceId, userId);
  const role = String(membership?.role || '').toLowerCase();
  if (!['owner', 'admin'].includes(role)) {
    throw new AppError(403, 'CONTENT_ROLLBACK_PERMISSION_DENIED', 'Only workspace owner/admin can request real content rollback/unpublish.');
  }
  return role;
}

async function insertRollbackNotSupportedResult(params: {
  workspaceId: string;
  actionId: string;
  reason: string;
  externalId?: string | null;
  metadata?: JsonObject;
}): Promise<boolean> {
  return insertRealPublishActionResult({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    externalId: params.externalId || null,
    externalUrl: null,
    resultStatus: 'skipped',
    resultSummary: 'rollback_not_supported: LinkedIn rollback/unpublish was not attempted for this action.',
    errorMessage: null,
    rollbackSupported: false,
    rollbackPayload: {},
    metadataJson: buildRollbackMetadata({
      status: 'rollback_not_supported',
      platformPostId: params.externalId || null,
      reason: params.reason,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      extra: params.metadata,
    }),
  });
}

async function insertRollbackBlockedResult(params: {
  workspaceId: string;
  actionId: string;
  reason: string;
  message: string;
  metadata?: JsonObject;
}): Promise<boolean> {
  return insertRealPublishActionResult({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    externalId: null,
    externalUrl: null,
    resultStatus: 'blocked',
    resultSummary: 'LinkedIn content rollback blocked before any external delete call.',
    errorMessage: params.message,
    rollbackSupported: false,
    rollbackPayload: {},
    metadataJson: buildRollbackMetadata({
      status: 'blocked',
      reason: params.reason,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      extra: params.metadata,
    }),
  });
}

export async function rollbackManualApprovedLinkedInContentPublish(
  input: ContentPublishRollbackInput,
  options: ExecuteRollbackOptions = {},
): Promise<ContentPublishRollbackResult> {
  let checks = baseChecks();
  const client = options.client || defaultLinkedInDeleteClient;
  const featureFlagEnabled = env.CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED || options.bypassFeatureFlagForTests === true;
  const reason = input.reason || 'Manual rollback requested.';
  checks = { ...checks, featureFlagEnabled };

  if (!isDatabaseConfigured) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      message: 'Database is required before rollback can verify action, result log, permissions, and connector token.',
    });
  }

  if (!featureFlagEnabled) {
    const stored = await insertRollbackBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      message: 'CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED is false.',
      metadata: { block_code: 'CONTENT_ROLLBACK_EXECUTOR_DISABLED' },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      resultLogStored: stored,
      message: 'Real LinkedIn rollback/unpublish is disabled. Turn it on only for an explicit manual rollback test.',
    });
  }

  try {
    await assertRollbackRole(input.workspaceId, input.userId);
    checks = { ...checks, rollbackRoleAllowed: true };
  } catch (error) {
    const stored = await insertRollbackBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      message: safeErrorMessage(error),
      metadata: { block_code: errorCode(error) },
    });
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'blocked', checks, resultLogStored: stored, message: safeErrorMessage(error) });
  }

  const action = await getWorkspaceActionForUser({ workspaceId: input.workspaceId, userId: input.userId, actionId: input.actionId });
  if (!action) {
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'blocked', checks, message: 'Action not found in the current workspace, or current user cannot access it.' });
  }

  checks = {
    ...checks,
    actionFound: true,
    actionTypeValid: action.action_type === 'content_publish',
    actionExecuted: action.status === 'executed',
  };

  if (action.action_type !== 'content_publish') {
    const stored = await insertRollbackNotSupportedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      metadata: { unsupported_reason: 'action_type_not_content_publish', action_type: action.action_type },
    });
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'rollback_not_supported', checks, resultLogStored: stored, statusPath: [action.status], message: 'rollback_not_supported: only content_publish actions can use content rollback.' });
  }

  if (action.status !== 'executed') {
    const stored = await insertRollbackNotSupportedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      metadata: { unsupported_reason: 'action_not_executed', current_status: action.status },
    });
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'rollback_not_supported', checks, resultLogStored: stored, statusPath: [action.status], message: 'rollback_not_supported: content rollback requires an executed action with a successful publish result.' });
  }

  const publishResult = await findLatestSuccessfulContentPublishResult({ workspaceId: input.workspaceId, actionId: input.actionId });
  const externalPostId = publishResult?.external_id || null;
  const safeDeleteId = isLinkedInPostUrnDeleteSafe(externalPostId);
  checks = {
    ...checks,
    successfulPublishResultFound: Boolean(publishResult),
    platformPostIdPresent: Boolean(externalPostId),
    platformPostIdDeleteSafe: safeDeleteId,
  };

  if (!publishResult || !externalPostId || !safeDeleteId) {
    const stored = await insertRollbackNotSupportedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      externalId: externalPostId,
      metadata: {
        unsupported_reason: !publishResult ? 'successful_publish_result_missing' : (!externalPostId ? 'external_post_id_missing' : 'external_post_id_not_safe_linkedin_urn'),
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'rollback_not_supported',
      checks,
      resultLogStored: stored,
      statusPath: ['executed'],
      externalPostId,
      message: 'rollback_not_supported: no safe LinkedIn share/ugcPost URN is available to delete.',
    });
  }

  let credential;
  try {
    credential = await getLinkedInCredentialForServerExecutorOnly(input.workspaceId);
    checks = { ...checks, tokenValid: true, requiredScopePresent: credential.grantedScopes.includes(LINKEDIN_REQUIRED_WRITE_SCOPE) };
    if (!checks.requiredScopePresent) {
      throw new AppError(409, 'LINKEDIN_WRITE_SCOPE_MISSING', 'Stored LinkedIn credential does not include w_member_social. Reconnect before rollback/unpublish.');
    }
  } catch (error) {
    const stored = await insertRollbackBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      reason,
      message: safeErrorMessage(error),
      metadata: { block_code: errorCode(error), platform_post_id: externalPostId },
    });
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'blocked', checks, externalPostId, resultLogStored: stored, statusPath: ['executed'], message: safeErrorMessage(error) });
  }

  const rollbackRequested = await transitionContentPublishActionStatus({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['executed'],
    toStatus: 'rollback_requested',
  });

  if (!rollbackRequested) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      externalPostId,
      statusPath: ['executed'],
      message: 'Action could not be moved from executed to rollback_requested. It may have already been rolled back or changed by another request.',
    });
  }

  await insertActionLifecycleEvent({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'rollback_requested',
    fromStatus: rollbackRequested.previous_status,
    toStatus: 'rollback_requested',
    message: 'Manual LinkedIn content rollback requested.',
    metadataJson: buildRollbackMetadata({
      status: 'blocked',
      platformPostId: externalPostId,
      reason,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      extra: { rollback_requested: true },
    }),
  });

  const executing = await transitionContentPublishActionStatus({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['rollback_requested'],
    toStatus: 'executing',
  });

  await insertActionLifecycleEvent({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'rollback_started',
    fromStatus: executing?.previous_status || 'rollback_requested',
    toStatus: 'executing',
    message: 'LinkedIn content rollback started. External delete is about to be attempted.',
    metadataJson: buildRollbackMetadata({
      status: 'blocked',
      platformPostId: externalPostId,
      reason,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      extra: { rollback_started: true },
    }),
  });

  const request = buildLinkedInDeletePostRequest({ accessToken: credential.accessToken, postUrn: externalPostId });
  const deleteUrlPreview = buildLinkedInDeleteUrlPreview(externalPostId);

  let response: LinkedInDeleteClientResponse;
  try {
    response = await client(request);
  } catch (error) {
    const message = `LinkedIn delete request failed before rollback confirmation: ${safeErrorMessage(error)}`;
    await transitionContentPublishActionStatus({ workspaceId: input.workspaceId, actionId: input.actionId, fromStatuses: ['executing'], toStatus: 'failed' });
    await insertActionLifecycleEvent({
      actionId: input.actionId,
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      eventType: 'rollback_failed',
      fromStatus: 'executing',
      toStatus: 'failed',
      message,
      metadataJson: buildRollbackMetadata({ status: 'rollback_failed', platformPostId: externalPostId, reason, externalWritesAttempted: true, externalWritesSucceeded: false, extra: { error_code: errorCode(error) } }),
    });
    const stored = await insertRealPublishActionResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
      externalId: externalPostId,
      externalUrl: publishResult.external_url,
      resultStatus: 'rollback_failed',
      resultSummary: 'LinkedIn content rollback failed before confirmation.',
      errorMessage: message,
      rollbackSupported: true,
      rollbackPayload: {},
      metadataJson: buildRollbackMetadata({ status: 'rollback_failed', platformPostId: externalPostId, reason, externalWritesAttempted: true, externalWritesSucceeded: false, extra: { error_code: errorCode(error) } }),
    });
    return makeResult({ workspaceId: input.workspaceId, actionId: input.actionId, status: 'failed', checks, apiCalled: true, externalPostId, deleteUrlPreview, resultLogStored: stored, statusPath: ['executed', 'rollback_requested', 'executing', 'failed'], externalWritesAttempted: true, externalWritesSucceeded: false, message });
  }

  const success = response.status === 204;
  const finalStatus: ActionStatus = success ? 'rolled_back' : 'failed';
  await transitionContentPublishActionStatus({ workspaceId: input.workspaceId, actionId: input.actionId, fromStatuses: ['executing'], toStatus: finalStatus });

  const message = success
    ? `LinkedIn content rollback completed. Post ${externalPostId} was deleted/unpublished through the Posts API.`
    : `LinkedIn delete returned ${response.status}; LIFE.SAVER logged rollback_failed and did not claim rollback success.`;

  await insertActionLifecycleEvent({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: success ? 'rollback_finished' : 'rollback_failed',
    fromStatus: 'executing',
    toStatus: finalStatus,
    message,
    metadataJson: buildRollbackMetadata({
      status: success ? 'rollback_success' : 'rollback_failed',
      linkedinStatus: response.status,
      platformPostId: externalPostId,
      reason,
      externalWritesAttempted: true,
      externalWritesSucceeded: success,
    }),
  });

  const stored = await insertRealPublishActionResult({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    externalId: externalPostId,
    externalUrl: publishResult.external_url,
    resultStatus: success ? 'rollback_success' : 'rollback_failed',
    resultSummary: success
      ? `LinkedIn content rollback succeeded. Deleted/unpublished post ID: ${externalPostId}.`
      : 'LinkedIn content rollback failed. The post may still be live on LinkedIn.',
    errorMessage: success ? null : message,
    rollbackSupported: true,
    rollbackPayload: {},
    metadataJson: buildRollbackMetadata({
      status: success ? 'rollback_success' : 'rollback_failed',
      linkedinStatus: response.status,
      platformPostId: externalPostId,
      reason,
      externalWritesAttempted: true,
      externalWritesSucceeded: success,
    }),
  });

  return makeResult({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    status: success ? 'rolled_back' : 'failed',
    checks,
    apiCalled: true,
    apiStatus: response.status,
    deleteUrlPreview,
    externalPostId,
    resultLogStored: stored,
    statusPath: ['executed', 'rollback_requested', 'executing', finalStatus],
    externalWritesAttempted: true,
    externalWritesSucceeded: success,
    message,
  });
}

export function buildContentPublishRollbackSafetySummary() {
  return {
    version: '0.7.0' as const,
    phase: CONTENT_PUBLISH_ROLLBACK_PHASE,
    healthMode: CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE,
    executorName: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    selectedPlatform: 'linkedin' as const,
    deleteSupportedBySelectedPlatform: true,
    supportedExternalDelete: 'DELETE /rest/posts/{encoded ugcPostUrn|shareUrn}',
    expectedSuccessStatus: 204,
    batchDeleteSupported: false,
    featureFlagDefaultOff: env.CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED === false,
    manualRollbackRequestRequired: true,
    autoRunEnabled: false,
    requiredScope: LINKEDIN_REQUIRED_WRITE_SCOPE,
    checksBeforeRollback: [
      'CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED=true',
      'current user is workspace owner/admin',
      'action exists in workspace',
      'action_type is content_publish',
      'action status is executed',
      'successful LinkedIn publish result exists',
      'platform post ID is a safe LinkedIn share/ugcPost URN',
      'LinkedIn connector token exists and is not expired',
      'w_member_social scope present',
      'single-post delete only; no batch delete',
    ],
    ifNotSupportedBehavior: 'Store action_results row with result_status=skipped and metadata_json.rollback_status=rollback_not_supported. Do not call LinkedIn.',
    browserReceivesRawToken: false,
    rollbackPayloadReturnedToBrowser: false,
  };
}
