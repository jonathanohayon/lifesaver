import { env } from '../../config/env.js';
import { isDatabaseConfigured, query } from '../../db/pool.js';

export const CONTENT_PUBLISH_CAPS_PHASE = 'v0.7.0_phase_9_8' as const;
export const CONTENT_PUBLISH_CAPS_HEALTH_MODE = 'v2-phase-9-8-rate-post-caps' as const;
export const CONTENT_PUBLISH_CAPS_EXECUTOR_NAME = 'linkedinManualApprovedContentExecutor' as const;
export const CONTENT_PUBLISH_CAP_WINDOW_HOUR_MS = 60 * 60 * 1000;
export const CONTENT_PUBLISH_CAP_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

type JsonObject = Record<string, unknown>;

export type ContentPublishPlatform = 'linkedin';

export type ContentPublishCapStatus =
  | 'allowed'
  | 'blocked_by_workspace_hourly_cap'
  | 'blocked_by_platform_hourly_cap'
  | 'blocked_by_account_hourly_cap'
  | 'blocked_by_workspace_daily_cap'
  | 'blocked_by_platform_daily_cap'
  | 'blocked_by_account_daily_cap'
  | 'cap_usage_unavailable';

export type ContentPublishCapConfig = {
  workspaceMaxPostsPerDay: number;
  workspaceMaxPostsPerHour: number;
  linkedinMaxPostsPerDay: number;
  linkedinMaxPostsPerHour: number;
  accountMaxPostsPerDay: number;
  accountMaxPostsPerHour: number;
  countOnlySuccessfulPublishes: true;
  source: 'environment';
};

export type ContentPublishUsageCounts = {
  workspacePostsLastDay: number;
  workspacePostsLastHour: number;
  platformPostsLastDay: number;
  platformPostsLastHour: number;
  accountPostsLastDay: number;
  accountPostsLastHour: number;
  databaseConfigured: boolean;
};

export type ContentPublishCapEvaluation = {
  phase: typeof CONTENT_PUBLISH_CAPS_PHASE;
  healthMode: typeof CONTENT_PUBLISH_CAPS_HEALTH_MODE;
  platform: ContentPublishPlatform;
  accountIdHint: string | null;
  allowed: boolean;
  status: ContentPublishCapStatus;
  reason: string;
  limits: ContentPublishCapConfig;
  usage: ContentPublishUsageCounts;
  windows: {
    hourWindowStartedAt: string;
    dayWindowStartedAt: string;
    evaluatedAt: string;
  };
  platformSpecific: {
    linkedinOfficialNumericLimitPublished: false;
    linkedinLimitSource: 'LinkedIn Developer Portal Analytics for the connected app/endpoints';
    handlesPlatform429AsFailure: true;
    note: string;
  };
  safety: {
    preventsTooManyPosts: true;
    autoRunEnabled: false;
    manualApprovalStillRequired: true;
    externalApiCalledDuringCapCheck: false;
    rawTokenReturned: false;
  };
};

function clampLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function asInt(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(date: Date): string {
  return date.toISOString();
}

function safeAccountHint(accountId: string | null | undefined): string | null {
  if (!accountId) return null;
  const trimmed = String(accountId).trim();
  if (!trimmed) return null;
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export function getContentPublishCapConfigFromEnv(): ContentPublishCapConfig {
  return {
    workspaceMaxPostsPerDay: clampLimit(env.CONTENT_PUBLISH_MAX_POSTS_PER_DAY, 3),
    workspaceMaxPostsPerHour: clampLimit(env.CONTENT_PUBLISH_MAX_POSTS_PER_HOUR, 1),
    linkedinMaxPostsPerDay: clampLimit(env.LINKEDIN_PUBLISH_MAX_POSTS_PER_DAY, 3),
    linkedinMaxPostsPerHour: clampLimit(env.LINKEDIN_PUBLISH_MAX_POSTS_PER_HOUR, 1),
    accountMaxPostsPerDay: clampLimit(env.CONTENT_PUBLISH_ACCOUNT_MAX_POSTS_PER_DAY, 3),
    accountMaxPostsPerHour: clampLimit(env.CONTENT_PUBLISH_ACCOUNT_MAX_POSTS_PER_HOUR, 1),
    countOnlySuccessfulPublishes: true,
    source: 'environment',
  };
}

export function buildContentPublishCapWindows(now: Date = new Date()): ContentPublishCapEvaluation['windows'] {
  return {
    evaluatedAt: iso(now),
    hourWindowStartedAt: iso(new Date(now.getTime() - CONTENT_PUBLISH_CAP_WINDOW_HOUR_MS)),
    dayWindowStartedAt: iso(new Date(now.getTime() - CONTENT_PUBLISH_CAP_WINDOW_DAY_MS)),
  };
}

export function zeroContentPublishUsage(databaseConfigured = isDatabaseConfigured): ContentPublishUsageCounts {
  return {
    workspacePostsLastDay: 0,
    workspacePostsLastHour: 0,
    platformPostsLastDay: 0,
    platformPostsLastHour: 0,
    accountPostsLastDay: 0,
    accountPostsLastHour: 0,
    databaseConfigured,
  };
}

export async function getContentPublishUsageCounts(params: {
  workspaceId: string;
  platform: ContentPublishPlatform;
  accountId: string;
  now?: Date;
}): Promise<ContentPublishUsageCounts> {
  if (!isDatabaseConfigured) return zeroContentPublishUsage(false);

  const now = params.now || new Date();
  const hourStart = new Date(now.getTime() - CONTENT_PUBLISH_CAP_WINDOW_HOUR_MS).toISOString();
  const dayStart = new Date(now.getTime() - CONTENT_PUBLISH_CAP_WINDOW_DAY_MS).toISOString();

  const result = await query<{
    workspace_posts_last_day: string;
    workspace_posts_last_hour: string;
    platform_posts_last_day: string;
    platform_posts_last_hour: string;
    account_posts_last_day: string;
    account_posts_last_hour: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE ar.created_at >= $3::timestamptz) AS workspace_posts_last_hour,
       COUNT(*) FILTER (WHERE ar.created_at >= $4::timestamptz) AS workspace_posts_last_day,
       COUNT(*) FILTER (
         WHERE ar.created_at >= $3::timestamptz
           AND LOWER(COALESCE(a.payload_json->>'platform', a.payload_json->'data'->>'platform', ar.metadata_json->>'platform', 'linkedin')) = LOWER($5)
       ) AS platform_posts_last_hour,
       COUNT(*) FILTER (
         WHERE ar.created_at >= $4::timestamptz
           AND LOWER(COALESCE(a.payload_json->>'platform', a.payload_json->'data'->>'platform', ar.metadata_json->>'platform', 'linkedin')) = LOWER($5)
       ) AS platform_posts_last_day,
       COUNT(*) FILTER (
         WHERE ar.created_at >= $3::timestamptz
           AND COALESCE(a.payload_json->>'account_id', a.payload_json->'data'->>'account_id', ar.metadata_json->>'account_id', ar.metadata_json->>'linkedin_account_id') = $6
       ) AS account_posts_last_hour,
       COUNT(*) FILTER (
         WHERE ar.created_at >= $4::timestamptz
           AND COALESCE(a.payload_json->>'account_id', a.payload_json->'data'->>'account_id', ar.metadata_json->>'account_id', ar.metadata_json->>'linkedin_account_id') = $6
       ) AS account_posts_last_day
     FROM action_results ar
     INNER JOIN actions a ON a.id = ar.action_id AND a.workspace_id = ar.workspace_id
     WHERE ar.workspace_id = $1
       AND ar.executor_name = $2
       AND ar.result_status = 'success';`,
    [params.workspaceId, CONTENT_PUBLISH_CAPS_EXECUTOR_NAME, hourStart, dayStart, params.platform, params.accountId]
  );

  const row = result.rows[0];
  if (!row) return zeroContentPublishUsage(true);

  return {
    workspacePostsLastDay: asInt(row.workspace_posts_last_day),
    workspacePostsLastHour: asInt(row.workspace_posts_last_hour),
    platformPostsLastDay: asInt(row.platform_posts_last_day),
    platformPostsLastHour: asInt(row.platform_posts_last_hour),
    accountPostsLastDay: asInt(row.account_posts_last_day),
    accountPostsLastHour: asInt(row.account_posts_last_hour),
    databaseConfigured: true,
  };
}

function platformSpecificInfo(): ContentPublishCapEvaluation['platformSpecific'] {
  return {
    linkedinOfficialNumericLimitPublished: false,
    linkedinLimitSource: 'LinkedIn Developer Portal Analytics for the connected app/endpoints',
    handlesPlatform429AsFailure: true,
    note: 'LinkedIn says standard rate limits are not published in documentation and should be checked in the Developer Portal Analytics tab. LIFE.SAVER therefore enforces conservative internal hourly/daily caps before calling LinkedIn and still treats any LinkedIn 429 response as a failed/blocked platform-rate-limit outcome.',
  };
}

function safetyInfo(): ContentPublishCapEvaluation['safety'] {
  return {
    preventsTooManyPosts: true,
    autoRunEnabled: false,
    manualApprovalStillRequired: true,
    externalApiCalledDuringCapCheck: false,
    rawTokenReturned: false,
  };
}

function makeEvaluation(params: {
  platform: ContentPublishPlatform;
  accountId: string;
  status: ContentPublishCapStatus;
  reason: string;
  limits: ContentPublishCapConfig;
  usage: ContentPublishUsageCounts;
  windows: ContentPublishCapEvaluation['windows'];
}): ContentPublishCapEvaluation {
  return {
    phase: CONTENT_PUBLISH_CAPS_PHASE,
    healthMode: CONTENT_PUBLISH_CAPS_HEALTH_MODE,
    platform: params.platform,
    accountIdHint: safeAccountHint(params.accountId),
    allowed: params.status === 'allowed',
    status: params.status,
    reason: params.reason,
    limits: params.limits,
    usage: params.usage,
    windows: params.windows,
    platformSpecific: platformSpecificInfo(),
    safety: safetyInfo(),
  };
}

export function evaluateContentPublishCapGate(params: {
  platform: ContentPublishPlatform;
  accountId: string;
  usage: ContentPublishUsageCounts;
  limits?: Partial<ContentPublishCapConfig>;
  now?: Date;
}): ContentPublishCapEvaluation {
  const baseLimits = getContentPublishCapConfigFromEnv();
  const limits: ContentPublishCapConfig = {
    ...baseLimits,
    ...params.limits,
    workspaceMaxPostsPerDay: clampLimit(params.limits?.workspaceMaxPostsPerDay ?? baseLimits.workspaceMaxPostsPerDay, baseLimits.workspaceMaxPostsPerDay),
    workspaceMaxPostsPerHour: clampLimit(params.limits?.workspaceMaxPostsPerHour ?? baseLimits.workspaceMaxPostsPerHour, baseLimits.workspaceMaxPostsPerHour),
    linkedinMaxPostsPerDay: clampLimit(params.limits?.linkedinMaxPostsPerDay ?? baseLimits.linkedinMaxPostsPerDay, baseLimits.linkedinMaxPostsPerDay),
    linkedinMaxPostsPerHour: clampLimit(params.limits?.linkedinMaxPostsPerHour ?? baseLimits.linkedinMaxPostsPerHour, baseLimits.linkedinMaxPostsPerHour),
    accountMaxPostsPerDay: clampLimit(params.limits?.accountMaxPostsPerDay ?? baseLimits.accountMaxPostsPerDay, baseLimits.accountMaxPostsPerDay),
    accountMaxPostsPerHour: clampLimit(params.limits?.accountMaxPostsPerHour ?? baseLimits.accountMaxPostsPerHour, baseLimits.accountMaxPostsPerHour),
    countOnlySuccessfulPublishes: true,
    source: 'environment',
  };
  const windows = buildContentPublishCapWindows(params.now || new Date());
  const usage = params.usage;

  if (!usage.databaseConfigured) {
    return makeEvaluation({
      platform: params.platform,
      accountId: params.accountId,
      status: 'cap_usage_unavailable',
      reason: 'Content publish caps cannot be verified because DATABASE_URL is not configured. Real publishing must stay blocked until usage can be counted.',
      limits,
      usage,
      windows,
    });
  }

  const checks: Array<{ blocked: boolean; status: ContentPublishCapStatus; reason: string }> = [
    {
      blocked: usage.workspacePostsLastHour >= limits.workspaceMaxPostsPerHour,
      status: 'blocked_by_workspace_hourly_cap',
      reason: `Workspace hourly content publish cap reached: ${usage.workspacePostsLastHour}/${limits.workspaceMaxPostsPerHour}.`,
    },
    {
      blocked: usage.platformPostsLastHour >= limits.linkedinMaxPostsPerHour,
      status: 'blocked_by_platform_hourly_cap',
      reason: `LinkedIn hourly content publish cap reached: ${usage.platformPostsLastHour}/${limits.linkedinMaxPostsPerHour}.`,
    },
    {
      blocked: usage.accountPostsLastHour >= limits.accountMaxPostsPerHour,
      status: 'blocked_by_account_hourly_cap',
      reason: `LinkedIn account hourly content publish cap reached: ${usage.accountPostsLastHour}/${limits.accountMaxPostsPerHour}.`,
    },
    {
      blocked: usage.workspacePostsLastDay >= limits.workspaceMaxPostsPerDay,
      status: 'blocked_by_workspace_daily_cap',
      reason: `Workspace daily content publish cap reached: ${usage.workspacePostsLastDay}/${limits.workspaceMaxPostsPerDay}.`,
    },
    {
      blocked: usage.platformPostsLastDay >= limits.linkedinMaxPostsPerDay,
      status: 'blocked_by_platform_daily_cap',
      reason: `LinkedIn daily content publish cap reached: ${usage.platformPostsLastDay}/${limits.linkedinMaxPostsPerDay}.`,
    },
    {
      blocked: usage.accountPostsLastDay >= limits.accountMaxPostsPerDay,
      status: 'blocked_by_account_daily_cap',
      reason: `LinkedIn account daily content publish cap reached: ${usage.accountPostsLastDay}/${limits.accountMaxPostsPerDay}.`,
    },
  ];

  const blocked = checks.find((item) => item.blocked);
  if (blocked) {
    return makeEvaluation({
      platform: params.platform,
      accountId: params.accountId,
      status: blocked.status,
      reason: blocked.reason,
      limits,
      usage,
      windows,
    });
  }

  return makeEvaluation({
    platform: params.platform,
    accountId: params.accountId,
    status: 'allowed',
    reason: `Content publish caps passed. Current usage: workspace ${usage.workspacePostsLastDay}/${limits.workspaceMaxPostsPerDay} per day and ${usage.workspacePostsLastHour}/${limits.workspaceMaxPostsPerHour} per hour; LinkedIn ${usage.platformPostsLastDay}/${limits.linkedinMaxPostsPerDay} per day and ${usage.platformPostsLastHour}/${limits.linkedinMaxPostsPerHour} per hour.`,
    limits,
    usage,
    windows,
  });
}

export async function evaluateContentPublishCapsForWorkspace(params: {
  workspaceId: string;
  platform: ContentPublishPlatform;
  accountId: string;
  now?: Date;
}): Promise<ContentPublishCapEvaluation> {
  const usage = await getContentPublishUsageCounts({
    workspaceId: params.workspaceId,
    platform: params.platform,
    accountId: params.accountId,
    now: params.now,
  });

  return evaluateContentPublishCapGate({
    platform: params.platform,
    accountId: params.accountId,
    usage,
    now: params.now,
  });
}

export function buildContentPublishCapsStatusSummary(): JsonObject {
  const limits = getContentPublishCapConfigFromEnv();
  return {
    version: '0.7.0',
    phase: CONTENT_PUBLISH_CAPS_PHASE,
    healthMode: CONTENT_PUBLISH_CAPS_HEALTH_MODE,
    selectedPlatform: 'linkedin',
    caps: limits,
    windows: {
      hourly: 'rolling 60 minutes',
      daily: 'rolling 24 hours',
    },
    platformSpecificLimits: platformSpecificInfo(),
    enforcementOrder: [
      'workspace hourly cap',
      'LinkedIn platform hourly cap',
      'LinkedIn account hourly cap',
      'workspace daily cap',
      'LinkedIn platform daily cap',
      'LinkedIn account daily cap',
      'LinkedIn 429 response still fails safely if platform limit is hit after internal caps pass',
    ],
    storage: {
      countedTable: 'action_results',
      countedStatus: 'success',
      countedExecutorName: CONTENT_PUBLISH_CAPS_EXECUTOR_NAME,
      countsOnlyConfirmedPublishes: true,
    },
    safety: safetyInfo(),
  };
}
