import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getGlobalPauseStateForWorkspace } from '../autonomy/autonomy.service.js';
import { getWorkspaceActionForUser, insertActionLifecycleEvent } from '../actions/actions.repository.js';
import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';
import { evaluateActionPolicy } from '../policies/policy.evaluator.js';
import { getLinkedInCredentialForServerExecutorOnly } from './content-connector-credentials.service.js';
import { parseContentPublishPayload, type NormalizedContentPublishPayload } from './content-action-payload.js';
import {
  findLatestManualApprovalEvent,
  insertRealPublishActionResult,
  transitionContentPublishActionStatus,
} from './content-real-publish.repository.js';
import {
  buildContentPublishResultMetadata,
  buildContentPublishResultTracking,
  extractLinkedInPermalink,
  extractLinkedInPlatformPostId,
  type ContentPublishResultTracking,
} from './content-publish-result-logs.js';
import { buildContentPublishCapsStatusSummary, evaluateContentPublishCapsForWorkspace, type ContentPublishCapEvaluation } from './content-publish-caps.js';

export const CONTENT_REAL_PUBLISH_EXECUTOR_PHASE = 'v0.7.0_phase_9_10' as const;
export const CONTENT_REAL_PUBLISH_EXECUTOR_HEALTH_MODE = 'v2-phase-9-10-controlled-live-test' as const;
export const CONTENT_REAL_PUBLISH_EXECUTOR_NAME = 'linkedinManualApprovedContentExecutor' as const;
export const LINKEDIN_REQUIRED_WRITE_SCOPE = 'w_member_social' as const;

type JsonObject = Record<string, unknown>;

type LinkedInPostRequest = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: JsonObject;
};

export type LinkedInPostClientResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export type LinkedInPostClient = (request: LinkedInPostRequest) => Promise<LinkedInPostClientResponse>;

export type RealPublishExecutionInput = {
  workspaceId: string;
  userId: string;
  actionId: string;
  force?: boolean;
};

export type RealPublishExecutionResult = {
  version: '0.7.0';
  phase: typeof CONTENT_REAL_PUBLISH_EXECUTOR_PHASE;
  executorName: typeof CONTENT_REAL_PUBLISH_EXECUTOR_NAME;
  workspaceId: string;
  actionId: string;
  actionType: 'content_publish';
  status: 'executed' | 'blocked' | 'failed';
  checks: {
    databaseConfigured: boolean;
    featureFlagEnabled: boolean;
    actionFound: boolean;
    actionTypeValid: boolean;
    manualApprovalConfirmed: boolean;
    masterPauseOff: boolean;
    contentPauseOff: boolean;
    emergencySafeModeOff: boolean;
    capNotExceeded: boolean;
    contentPublishCapsNotExceeded: boolean;
    tokenValid: boolean;
    requiredScopePresent: boolean;
    payloadValid: boolean;
    mediaSupported: boolean;
    userApproved: boolean;
  };
  linkedin: {
    apiCalled: boolean;
    apiStatus: number | null;
    externalPostId: string | null;
    externalUrl: string | null;
    requestBodyPreview: JsonObject | null;
    rawTokenReturned: false;
  };
  resultTracking: ContentPublishResultTracking | null;
  contentPublishCapEvaluation: ContentPublishCapEvaluation | null;
  resultLogStored: boolean;
  statusPath: ActionStatus[];
  message: string;
  safety: {
    manualApprovalRequired: true;
    autoRunEnabled: false;
    externalWritesAttempted: boolean;
    externalWritesSucceeded: boolean;
    browserReceivesRawToken: false;
    rollbackPayloadExposedToBrowser: false;
    mediaUploadSupportedInThisPhase: false;
    note: string;
  };
};

type ExecuteOptions = {
  client?: LinkedInPostClient;
  bypassFeatureFlagForTests?: boolean;
};

const actionBodySchema = z.object({
  force: z.boolean().optional().default(false),
}).default({ force: false });

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function normalizeHeaderMap(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseChecks(overrides: Partial<RealPublishExecutionResult['checks']> = {}): RealPublishExecutionResult['checks'] {
  return {
    databaseConfigured: isDatabaseConfigured,
    featureFlagEnabled: false,
    actionFound: false,
    actionTypeValid: false,
    manualApprovalConfirmed: false,
    masterPauseOff: false,
    contentPauseOff: false,
    emergencySafeModeOff: false,
    capNotExceeded: false,
    contentPublishCapsNotExceeded: false,
    tokenValid: false,
    requiredScopePresent: false,
    payloadValid: false,
    mediaSupported: false,
    userApproved: false,
    ...overrides,
  };
}

function makeResult(params: {
  workspaceId: string;
  actionId: string;
  status: RealPublishExecutionResult['status'];
  checks: RealPublishExecutionResult['checks'];
  message: string;
  statusPath?: ActionStatus[];
  apiCalled?: boolean;
  apiStatus?: number | null;
  externalPostId?: string | null;
  externalUrl?: string | null;
  requestBodyPreview?: JsonObject | null;
  resultLogStored?: boolean;
  externalWritesAttempted?: boolean;
  externalWritesSucceeded?: boolean;
  resultTracking?: ContentPublishResultTracking | null;
  contentPublishCapEvaluation?: ContentPublishCapEvaluation | null;
}): RealPublishExecutionResult {
  return {
    version: '0.7.0',
    phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
    executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    actionType: 'content_publish',
    status: params.status,
    checks: params.checks,
    linkedin: {
      apiCalled: Boolean(params.apiCalled),
      apiStatus: params.apiStatus ?? null,
      externalPostId: params.externalPostId ?? null,
      externalUrl: params.externalUrl ?? null,
      requestBodyPreview: params.requestBodyPreview ?? null,
      rawTokenReturned: false,
    },
    resultTracking: params.resultTracking ?? null,
    contentPublishCapEvaluation: params.contentPublishCapEvaluation ?? null,
    resultLogStored: Boolean(params.resultLogStored),
    statusPath: params.statusPath || [],
    message: params.message,
    safety: {
      manualApprovalRequired: true,
      autoRunEnabled: false,
      externalWritesAttempted: Boolean(params.externalWritesAttempted),
      externalWritesSucceeded: Boolean(params.externalWritesSucceeded),
      browserReceivesRawToken: false,
      rollbackPayloadExposedToBrowser: false,
      mediaUploadSupportedInThisPhase: false,
      note: 'Phase 9.9 preserves content publish cap enforcement and adds rollback/unpublish behavior on top of the manual-approved LinkedIn content executor path. It is not auto-run, never returns raw tokens, blocks on pause/content caps/invalid token, and supports text/link posts only in this phase.',
    },
  };
}

function extractPayloadForParser(actionPayload: JsonObject): JsonObject {
  const data = safeObject(actionPayload.data);
  const source = Object.keys(data).length > 0 ? data : actionPayload;

  return {
    schema_version: typeof actionPayload.schema_version === 'string' ? actionPayload.schema_version : undefined,
    action_type: 'content_publish',
    platform: 'linkedin',
    account_kind: 'member',
    ...source,
    safety: {
      manual_approval_required: true,
      real_publish_allowed_by_payload: false,
      auto_run_allowed_by_payload: false,
      external_api_call_allowed_by_payload: false,
      ...safeObject(source.safety),
    },
  };
}

function hashtagsNotAlreadyInCaption(caption: string, hashtags: string[]): string[] {
  const captionLower = caption.toLowerCase();
  return hashtags.filter((tag) => !captionLower.includes(tag.toLowerCase()));
}

export function buildLinkedInCommentary(payload: NormalizedContentPublishPayload): string {
  const extraTags = hashtagsNotAlreadyInCaption(payload.caption, payload.hashtags);
  const parts = [payload.caption.trim()];
  if (extraTags.length) parts.push(extraTags.join(' '));
  const link = payload.link_url || (payload.media_type === 'link' ? payload.media_url : null);
  if (link) parts.push(link);
  return parts.join('\n\n').trim().slice(0, 3000);
}

export function buildLinkedInPostsApiRequestBody(payload: NormalizedContentPublishPayload): JsonObject {
  return {
    author: payload.account_id,
    commentary: buildLinkedInCommentary(payload),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

function buildRequestBodyPreview(body: JsonObject): JsonObject {
  return {
    author: body.author,
    commentaryPreview: typeof body.commentary === 'string' ? body.commentary.slice(0, 220) : '',
    commentaryLength: typeof body.commentary === 'string' ? body.commentary.length : 0,
    visibility: body.visibility,
    distribution: body.distribution,
    lifecycleState: body.lifecycleState,
    isReshareDisabledByAuthor: body.isReshareDisabledByAuthor,
    containsRawToken: false,
  };
}

function assertMediaSupported(payload: NormalizedContentPublishPayload): void {
  if (!['none', 'link'].includes(payload.media_type)) {
    throw new AppError(409, 'CONTENT_MEDIA_PUBLISH_NOT_IMPLEMENTED', 'Phase 9.7 supports manual-approved LinkedIn text/link posts only. Image/video/document LinkedIn upload/publish must be added in a later media upload phase.', {
      mediaType: payload.media_type,
      phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
    });
  }
}

function assertNotScheduledForFuture(payload: NormalizedContentPublishPayload): void {
  if (!payload.scheduled_time) return;
  const scheduled = new Date(payload.scheduled_time).getTime();
  if (Number.isFinite(scheduled) && scheduled > Date.now() + 60_000) {
    throw new AppError(409, 'SCHEDULED_CONTENT_PUBLISH_NOT_IMPLEMENTED', 'Phase 9.7 executes only immediately after manual approval. Scheduled publishing requires a later scheduler/queue phase.', {
      scheduledTime: payload.scheduled_time,
    });
  }
}


async function defaultLinkedInPostClient(request: LinkedInPostRequest): Promise<LinkedInPostClientResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
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

  return {
    status: response.status,
    headers: normalizeHeaderMap(response.headers),
    body,
  };
}

function buildLinkedInRequest(params: {
  accessToken: string;
  body: JsonObject;
}): LinkedInPostRequest {
  return {
    url: `${env.LINKEDIN_API_BASE_URL.replace(/\/$/, '')}/rest/posts`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': env.LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: params.body,
  };
}

async function insertBlockedResult(params: {
  workspaceId: string;
  actionId: string;
  summary: string;
  errorMessage: string;
  metadata?: JsonObject;
}): Promise<boolean> {
  return insertRealPublishActionResult({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
    externalId: null,
    externalUrl: null,
    resultStatus: 'blocked',
    resultSummary: params.summary,
    errorMessage: params.errorMessage,
    rollbackSupported: false,
    rollbackPayload: {},
    metadataJson: {
      phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
      real_executor: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      raw_token_returned: false,
      ...safeObject(params.metadata),
    },
  });
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error.');
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'CONTENT_REAL_PUBLISH_FAILED';
}

function getActionPayload(action: WorkspaceActionDetailRow): JsonObject {
  return safeObject(action.payload_json);
}

async function failExecutingAction(params: {
  workspaceId: string;
  actionId: string;
  userId: string;
  message: string;
  metadata?: JsonObject;
}): Promise<void> {
  const failed = await transitionContentPublishActionStatus({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    fromStatuses: ['executing'],
    toStatus: 'failed',
  });

  await insertActionLifecycleEvent({
    actionId: params.actionId,
    workspaceId: params.workspaceId,
    actorUserId: params.userId,
    eventType: 'execution_failed',
    fromStatus: failed?.previous_status || 'executing',
    toStatus: 'failed',
    message: params.message,
    metadataJson: {
      phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
      executor_name: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      external_writes_attempted: true,
      external_writes_succeeded: false,
      raw_token_returned: false,
      ...safeObject(params.metadata),
    },
  });
}

export function parseRealPublishExecutionBody(input: unknown): { force: boolean } {
  return actionBodySchema.parse(input || {});
}

export async function executeManualApprovedLinkedInContentPublish(
  input: RealPublishExecutionInput,
  options: ExecuteOptions = {},
): Promise<RealPublishExecutionResult> {
  let checks = baseChecks();
  const client = options.client || defaultLinkedInPostClient;
  const featureFlagEnabled = env.CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED || options.bypassFeatureFlagForTests === true;
  checks = { ...checks, featureFlagEnabled };

  if (!isDatabaseConfigured) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      message: 'Database is required before the real content executor can verify action approval, pause state, caps, and credentials.',
    });
  }

  if (!featureFlagEnabled) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn real publish executor is disabled by environment flag.',
      errorMessage: 'CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED is false.',
      metadata: { block_code: 'REAL_PUBLISH_EXECUTOR_DISABLED' },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      resultLogStored: stored,
      message: 'Real LinkedIn publishing is disabled. Set CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED=true only for an approved controlled test.',
    });
  }

  const action = await getWorkspaceActionForUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionId: input.actionId,
  });

  if (!action) {
    checks = { ...checks, actionFound: false };
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      message: 'Action not found in the current workspace, or current user cannot access it.',
    });
  }

  checks = {
    ...checks,
    actionFound: true,
    actionTypeValid: action.action_type === 'content_publish',
  };

  if (action.action_type !== 'content_publish') {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'Real publish executor blocked a non-content action.',
      errorMessage: 'Only content_publish actions can use the LinkedIn content executor.',
      metadata: { action_type: action.action_type },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      resultLogStored: stored,
      message: 'Only content_publish actions are eligible for the LinkedIn real publish executor.',
    });
  }

  const approvalEvent = await findLatestManualApprovalEvent({ workspaceId: input.workspaceId, actionId: input.actionId });
  const manuallyApproved = action.status === 'approved' && Boolean(action.approved_at) && Boolean(approvalEvent?.actor_user_id);
  checks = { ...checks, manualApprovalConfirmed: manuallyApproved, userApproved: manuallyApproved };

  if (!manuallyApproved) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked because manual approval was not confirmed.',
      errorMessage: 'Action must be in approved status with a recorded user approval event before real publishing.',
      metadata: { current_status: action.status, approved_at_present: Boolean(action.approved_at), approval_event_found: Boolean(approvalEvent) },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: [action.status],
      resultLogStored: stored,
      message: 'Manual approval is required before LinkedIn publishing. Auto-approved/proposed actions are not enough for Phase 9.6.',
    });
  }

  const pauseState = await getGlobalPauseStateForWorkspace(input.workspaceId);
  const masterPauseOff = !pauseState.pauseAllAutonomy;
  const contentPauseOff = !pauseState.pauseContentActions;
  const emergencySafeModeOff = !pauseState.emergencySafeMode.active;
  checks = { ...checks, masterPauseOff, contentPauseOff, emergencySafeModeOff };

  if (!masterPauseOff || !contentPauseOff || !emergencySafeModeOff) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked by pause or emergency safe mode.',
      errorMessage: 'Master pause, content pause, or emergency safe mode is active.',
      metadata: {
        pause_all_autonomy: pauseState.pauseAllAutonomy,
        pause_content_actions: pauseState.pauseContentActions,
        emergency_safe_mode_active: pauseState.emergencySafeMode.active,
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: 'Publishing is blocked because master pause, content pause, or emergency safe mode is active.',
    });
  }

  const policyEvaluation = await evaluateActionPolicy({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    actionType: 'content_publish',
    riskLevel: action.risk_level,
    payloadJson: getActionPayload(action),
    requestedDecision: 'ask',
    source: 'phase_9_8_real_publish_executor_policy_cap_gate',
    knownPauseState: pauseState,
  });
  const capNotExceeded = !['cap_exceeded', 'cap_usage_unavailable', 'database_unavailable', 'blocked_by_pause_or_emergency'].includes(policyEvaluation.capStatus);
  checks = { ...checks, capNotExceeded };

  if (!capNotExceeded) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked by cap validation.',
      errorMessage: policyEvaluation.reason,
      metadata: { cap_status: policyEvaluation.capStatus, policy_decision: policyEvaluation.decision, matched_policy_id: policyEvaluation.matchedPolicyId },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: `Publishing is blocked because cap validation did not pass: ${policyEvaluation.capStatus}.`,
    });
  }

  let payload: NormalizedContentPublishPayload;
  try {
    payload = parseContentPublishPayload(extractPayloadForParser(getActionPayload(action)));
    assertMediaSupported(payload);
    assertNotScheduledForFuture(payload);
    checks = { ...checks, payloadValid: true, mediaSupported: true };
  } catch (error) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked because the content payload is invalid or unsupported.',
      errorMessage: safeErrorMessage(error),
      metadata: { block_code: errorCode(error) },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: safeErrorMessage(error),
    });
  }

  const contentPublishCapEvaluation = await evaluateContentPublishCapsForWorkspace({
    workspaceId: input.workspaceId,
    platform: 'linkedin',
    accountId: payload.account_id,
  });
  checks = { ...checks, contentPublishCapsNotExceeded: contentPublishCapEvaluation.allowed, capNotExceeded: checks.capNotExceeded && contentPublishCapEvaluation.allowed };

  if (!contentPublishCapEvaluation.allowed) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked by Phase 9.8 content post caps.',
      errorMessage: contentPublishCapEvaluation.reason,
      metadata: {
        block_code: contentPublishCapEvaluation.status,
        content_publish_caps: contentPublishCapEvaluation,
      },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      contentPublishCapEvaluation,
      message: contentPublishCapEvaluation.reason,
    });
  }

  let credential: Awaited<ReturnType<typeof getLinkedInCredentialForServerExecutorOnly>>;
  try {
    credential = await getLinkedInCredentialForServerExecutorOnly(input.workspaceId);
    const requiredScopePresent = credential.grantedScopes.includes(LINKEDIN_REQUIRED_WRITE_SCOPE);
    checks = { ...checks, tokenValid: true, requiredScopePresent };
    if (!requiredScopePresent) {
      throw new AppError(409, 'LINKEDIN_WRITE_SCOPE_MISSING', 'Stored LinkedIn credential does not include w_member_social. Reconnect before publishing.');
    }
  } catch (error) {
    const stored = await insertBlockedResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      summary: 'LinkedIn publish blocked because the connector token is not valid for publishing.',
      errorMessage: safeErrorMessage(error),
      metadata: { block_code: errorCode(error) },
    });
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      resultLogStored: stored,
      message: safeErrorMessage(error),
    });
  }

  const executing = await transitionContentPublishActionStatus({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['approved'],
    toStatus: 'executing',
  });

  if (!executing) {
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'blocked',
      checks,
      statusPath: ['approved'],
      contentPublishCapEvaluation,
      message: 'Action could not be moved from approved to executing. It may have already been executed, cancelled, or changed by another request.',
    });
  }

  await insertActionLifecycleEvent({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'execution_started',
    fromStatus: executing.previous_status,
    toStatus: 'executing',
    message: 'Manual-approved LinkedIn content publishing started. External write is about to be attempted.',
    metadataJson: {
      phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
      executor_name: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      platform: 'linkedin',
      manual_approval_required: true,
      approved_event_id: approvalEvent?.id || null,
      content_publish_caps: contentPublishCapEvaluation,
      external_writes_attempted_yet: false,
      raw_token_returned: false,
    },
  });

  const body = buildLinkedInPostsApiRequestBody(payload);
  const requestPreview = buildRequestBodyPreview(body);
  let response: LinkedInPostClientResponse;

  try {
    response = await client(buildLinkedInRequest({ accessToken: credential.accessToken, body }));
  } catch (error) {
    const message = `LinkedIn API request failed before a successful publish confirmation: ${safeErrorMessage(error)}`;
    await failExecutingAction({ workspaceId: input.workspaceId, actionId: input.actionId, userId: input.userId, message, metadata: { error_code: errorCode(error) } });
    const resultTracking = buildContentPublishResultTracking({
      response: null,
      success: false,
      platformPostId: null,
      postIdSource: 'none',
      permalink: null,
      permalinkSource: 'none',
      publishedTime: null,
      errorIfFailed: message,
      storedInActionResults: false,
    });
    const stored = await insertRealPublishActionResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      externalId: null,
      externalUrl: null,
      resultStatus: 'failed',
      resultSummary: 'LinkedIn publish failed before a success response was received.',
      errorMessage: message,
      rollbackSupported: false,
      rollbackPayload: {},
      metadataJson: buildContentPublishResultMetadata({
        publishedTime: null,
        platformPostId: null,
        permalink: null,
        platformResponseSummary: resultTracking.platformResponseSummary,
        errorIfFailed: message,
        requestBodyPreview: requestPreview,
        extra: {
          content_publish_caps: contentPublishCapEvaluation,
          external_writes_attempted: true,
          external_writes_succeeded: false,
          raw_token_returned: false,
        },
      }),
    });
    resultTracking.storedInActionResults = stored;
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'failed',
      checks,
      apiCalled: true,
      requestBodyPreview: requestPreview,
      resultTracking,
      contentPublishCapEvaluation,
      resultLogStored: stored,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      statusPath: ['approved', 'executing', 'failed'],
      message,
    });
  }

  const success = response.status >= 200 && response.status < 300;
  const postIdResult = success ? extractLinkedInPlatformPostId(response) : { id: null, source: 'none' as const };
  const permalinkResult = success ? extractLinkedInPermalink(response) : { permalink: null, source: 'none' as const };
  const externalPostId = postIdResult.id;
  const externalPermalink = permalinkResult.permalink;

  if (!success) {
    const message = `LinkedIn API returned ${response.status}; LIFE.SAVER marked the action failed and did not claim the post executed.`;
    await failExecutingAction({ workspaceId: input.workspaceId, actionId: input.actionId, userId: input.userId, message, metadata: { linkedin_status: response.status } });
    const resultTracking = buildContentPublishResultTracking({
      response,
      success: false,
      platformPostId: null,
      postIdSource: 'none',
      permalink: null,
      permalinkSource: 'none',
      publishedTime: null,
      errorIfFailed: message,
      storedInActionResults: false,
    });
    const stored = await insertRealPublishActionResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      externalId: null,
      externalUrl: null,
      resultStatus: 'failed',
      resultSummary: 'LinkedIn publish failed. No success result was claimed.',
      errorMessage: message,
      rollbackSupported: false,
      rollbackPayload: {},
      metadataJson: buildContentPublishResultMetadata({
        publishedTime: null,
        platformPostId: null,
        permalink: null,
        platformResponseSummary: resultTracking.platformResponseSummary,
        errorIfFailed: message,
        requestBodyPreview: requestPreview,
        extra: {
          content_publish_caps: contentPublishCapEvaluation,
          linkedin_status: response.status,
          external_writes_attempted: true,
          external_writes_succeeded: false,
          raw_token_returned: false,
        },
      }),
    });
    resultTracking.storedInActionResults = stored;
    return makeResult({
      workspaceId: input.workspaceId,
      actionId: input.actionId,
      status: 'failed',
      checks,
      apiCalled: true,
      apiStatus: response.status,
      requestBodyPreview: requestPreview,
      resultTracking,
      contentPublishCapEvaluation,
      resultLogStored: stored,
      externalWritesAttempted: true,
      externalWritesSucceeded: false,
      statusPath: ['approved', 'executing', 'failed'],
      message,
    });
  }


  const executed = await transitionContentPublishActionStatus({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    fromStatuses: ['executing'],
    toStatus: 'executed',
  });

  const publishedTime = nowIso();
  const successResultTracking = buildContentPublishResultTracking({
    response,
    success: true,
    platformPostId: externalPostId,
    postIdSource: postIdResult.source,
    permalink: externalPermalink,
    permalinkSource: permalinkResult.source,
    publishedTime,
    errorIfFailed: null,
    storedInActionResults: false,
  });

  await insertActionLifecycleEvent({
    actionId: input.actionId,
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    eventType: 'execution_finished',
    fromStatus: executed?.previous_status || 'executing',
    toStatus: 'executed',
    message: externalPostId
      ? `LinkedIn content publish completed. External post ID: ${externalPostId}.`
      : 'LinkedIn content publish completed. LinkedIn did not return a post ID in a standard header/body field.',
    metadataJson: {
      phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
      executor_name: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      platform: 'linkedin',
      linkedin_status: response.status,
      external_post_id_present: Boolean(externalPostId),
      external_permalink_present: Boolean(externalPermalink),
      published_time: publishedTime,
      external_writes_attempted: true,
      external_writes_succeeded: true,
      raw_token_returned: false,
    },
  });

  const stored = await insertRealPublishActionResult({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
    externalId: externalPostId,
    externalUrl: externalPermalink,
    resultStatus: 'success',
    resultSummary: externalPostId
      ? `Manual-approved LinkedIn content published successfully. External post ID: ${externalPostId}${externalPermalink ? `, permalink: ${externalPermalink}` : ''}.`
      : 'Manual-approved LinkedIn content published successfully. No standard external post ID was returned.',
    errorMessage: null,
    rollbackSupported: Boolean(externalPostId),
    rollbackPayload: externalPostId ? {
      type: 'linkedin_delete_post',
      platform: 'linkedin',
      external_post_id: externalPostId,
      endpoint: '/rest/posts/{encoded ugcPostUrn|shareUrn}',
      supported: true,
      requires_manual_rollback_request: true,
      raw_token_included: false
    } : {},
    metadataJson: buildContentPublishResultMetadata({
      publishedTime,
      platformPostId: externalPostId,
      permalink: externalPermalink,
      platformResponseSummary: successResultTracking.platformResponseSummary,
      errorIfFailed: null,
      requestBodyPreview: requestPreview,
      extra: {
        linkedin_status: response.status,
        content_publish_caps: contentPublishCapEvaluation,
        manual_approval_required: true,
        approved_event_id: approvalEvent?.id || null,
        media_type: payload.media_type,
        link_in_commentary: Boolean(payload.link_url || (payload.media_type === 'link' && payload.media_url)),
      },
    }),
  });
  successResultTracking.storedInActionResults = stored;


  return makeResult({
    workspaceId: input.workspaceId,
    actionId: input.actionId,
    status: 'executed',
    checks,
    apiCalled: true,
    apiStatus: response.status,
    externalPostId,
    externalUrl: externalPermalink,
    requestBodyPreview: requestPreview,
    resultTracking: successResultTracking,
    contentPublishCapEvaluation,
    resultLogStored: stored,
    externalWritesAttempted: true,
    externalWritesSucceeded: true,
    statusPath: ['approved', 'executing', 'executed'],
    message: externalPostId
      ? `Manual-approved LinkedIn content published successfully. External post ID: ${externalPostId}.`
      : 'Manual-approved LinkedIn content published successfully.',
  });
}

export function buildRealPublishExecutorSafetySummary(): {
  version: '0.7.0';
  phase: typeof CONTENT_REAL_PUBLISH_EXECUTOR_PHASE;
  healthMode: typeof CONTENT_REAL_PUBLISH_EXECUTOR_HEALTH_MODE;
  executorName: typeof CONTENT_REAL_PUBLISH_EXECUTOR_NAME;
  selectedPlatform: 'linkedin';
  requiredScope: typeof LINKEDIN_REQUIRED_WRITE_SCOPE;
  manualApprovalRequired: true;
  autoRunEnabled: false;
  featureFlagDefaultOff: boolean;
  checksBeforePublish: string[];
  mediaUploadSupportedInThisPhase: false;
  browserReceivesRawToken: false;
  storesContentPublishResultLogs: true;
  enforcesContentPublishCaps: true;
  contentPublishCaps: JsonObject;
  contentRollbackBehaviorAdded: true;
} {
  return {
    version: '0.7.0',
    phase: CONTENT_REAL_PUBLISH_EXECUTOR_PHASE,
    healthMode: CONTENT_REAL_PUBLISH_EXECUTOR_HEALTH_MODE,
    executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
    selectedPlatform: 'linkedin',
    requiredScope: LINKEDIN_REQUIRED_WRITE_SCOPE,
    manualApprovalRequired: true,
    autoRunEnabled: false,
    featureFlagDefaultOff: env.CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED === false,
    checksBeforePublish: [
      'CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED=true',
      'action exists in workspace',
      'action_type is content_publish',
      'status is approved',
      'manual approved event exists',
      'master pause off',
      'content pause off',
      'emergency safe mode off',
      'policy/global cap validation not exceeded/unavailable',
      'Phase 9.8 content publish post caps not exceeded',
      'workspace max posts/day not exceeded',
      'workspace max posts/hour not exceeded',
      'LinkedIn platform max posts/day not exceeded',
      'LinkedIn platform max posts/hour not exceeded',
      'LinkedIn account max posts/day not exceeded',
      'LinkedIn account max posts/hour not exceeded',
      'LinkedIn connector token exists and is not expired',
      'w_member_social scope present',
      'payload validates',
      'media_type is none or link only in this phase',
    ],
    mediaUploadSupportedInThisPhase: false,
    browserReceivesRawToken: false,
    storesContentPublishResultLogs: true,
    enforcesContentPublishCaps: true,
    contentPublishCaps: buildContentPublishCapsStatusSummary(),
    contentRollbackBehaviorAdded: true,
  };
}
