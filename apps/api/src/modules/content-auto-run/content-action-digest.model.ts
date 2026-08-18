import type {
  ContentActionDigestBucketEntry,
  ContentActionDigestEntryInput,
  ContentActionDigestInput,
  ContentActionDigestResult,
  ContentActionDigestStatus,
} from './content-action-digest.types.js';

export const CONTENT_ACTION_DIGEST_PHASE = 'phase_11_7_daily_action_digest' as const;
export const CONTENT_ACTION_DIGEST_HEALTH_MODE = 'v2-phase-11-7-daily-action-digest' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'payload_json',
  'raw_payload',
  'rollback_payload',
  'encrypted_',
  'bearer ',
];

const WAITING_STATUSES = new Set(['proposed', 'approved', 'pending_approval']);
const PUBLISHED_STATUSES = new Set(['executed', 'published']);
const FAILED_STATUSES = new Set(['failed', 'blocked']);

function cleanText(value: unknown, fallback: string, maxLength = 180): string {
  const normalized = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, maxLength);
}

function lower(value: unknown, fallback: string): string {
  return cleanText(value, fallback, 80).toLowerCase();
}

function safeTimestamp(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function isSafePermalink(value: unknown): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (!/^https:\/\/(www\.)?linkedin\.com\//i.test(raw)) return undefined;
  return raw.slice(0, 300);
}

function isContentPublish(action: ContentActionDigestEntryInput): boolean {
  return lower(action.actionType, 'content_publish') === 'content_publish';
}

function toDigestEntry(action: ContentActionDigestEntryInput, bucket: 'published' | 'waiting' | 'failed'): ContentActionDigestBucketEntry {
  const platform = lower(action.platform, 'linkedin');
  const channel = lower(action.channel, 'linkedin_member_feed');
  const permalink = isSafePermalink(action.permalink);
  const reasonFallback = bucket === 'published'
    ? 'Published because the action completed after approval or a safe decision path.'
    : bucket === 'waiting'
      ? 'Waiting for founder review before any real-world action occurs.'
      : 'Marked failed or blocked; review the safe result logs before retrying.';
  const reason = cleanText(
    action.publishReason || action.approvalReason || action.failureReason || action.reason,
    reasonFallback,
    260,
  );

  return {
    actionId: cleanText(action.actionId, 'unknown_action', 80),
    title: cleanText(action.title, 'Untitled content action', 140),
    actionType: lower(action.actionType, 'content_publish'),
    platform,
    channel,
    riskLevel: lower(action.riskLevel, 'unknown'),
    status: action.status,
    timestamp: bucket === 'published'
      ? safeTimestamp(action.publishedAt, action.approvedAt, action.createdAt)
      : bucket === 'failed'
        ? safeTimestamp(action.failedAt, action.createdAt)
        : safeTimestamp(action.createdAt, action.approvedAt),
    reason,
    safeLinkAvailable: Boolean(permalink),
    ...(permalink ? { permalink } : {}),
  };
}

function buildSummary(result: Pick<ContentActionDigestResult, 'counts'>): string {
  const pieces = [
    `${result.counts.published} published`,
    `${result.counts.waitingForApproval} waiting for approval`,
    `${result.counts.failed} failed or blocked`,
  ];
  return `Content action digest: ${pieces.join(', ')}.`;
}

function buildBulletLines(published: ContentActionDigestBucketEntry[], waiting: ContentActionDigestBucketEntry[], failed: ContentActionDigestBucketEntry[]): string[] {
  const lines: string[] = [];
  if (published.length === 0) lines.push('Published: Nothing was published in this digest window.');
  for (const item of published.slice(0, 6)) {
    lines.push(`Published: ${item.title} — ${item.reason}`);
  }

  if (waiting.length === 0) lines.push('Waiting for approval: No content actions are currently waiting in this digest preview.');
  for (const item of waiting.slice(0, 6)) {
    lines.push(`Waiting for approval: ${item.title} — ${item.reason}`);
  }

  if (failed.length === 0) lines.push('Failed: No failed content actions were found in this digest preview.');
  for (const item of failed.slice(0, 6)) {
    lines.push(`Failed: ${item.title} — ${item.reason}`);
  }

  return lines;
}

export function buildContentActionDigestSafety(): ContentActionDigestResult['safety'] {
  return {
    digestOnly: true,
    doesNotPublish: true,
    doesNotApprove: true,
    doesNotNotify: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    rawPayloadNotReturned: true,
    tokenNotReturned: true,
    secretsNotReturned: true,
  };
}

export function buildContentActionDigest(input: ContentActionDigestInput): ContentActionDigestResult {
  const actions = Array.isArray(input.actions) ? input.actions : [];
  const contentActions = actions.filter(isContentPublish);
  const ignoredNonContentActions = actions.length - contentActions.length;

  const published = contentActions
    .filter((action) => PUBLISHED_STATUSES.has(lower(action.status, '')))
    .map((action) => toDigestEntry(action, 'published'));
  const waitingForApproval = contentActions
    .filter((action) => WAITING_STATUSES.has(lower(action.status, '')))
    .map((action) => toDigestEntry(action, 'waiting'));
  const failed = contentActions
    .filter((action) => FAILED_STATUSES.has(lower(action.status, '')))
    .map((action) => toDigestEntry(action, 'failed'));

  const counts = {
    totalInputActions: actions.length,
    published: published.length,
    waitingForApproval: waitingForApproval.length,
    failed: failed.length,
    ignoredNonContentActions,
  };

  const result: ContentActionDigestResult = {
    phase: CONTENT_ACTION_DIGEST_PHASE,
    healthMode: CONTENT_ACTION_DIGEST_HEALTH_MODE,
    deliverable: 'content_action_digest',
    digestDate: safeTimestamp(input.digestDate) || new Date().toISOString(),
    timezone: cleanText(input.timezone, 'UTC', 80),
    scope: {
      workspaceScoped: true,
      contentOnly: true,
      supportedPlatform: 'linkedin',
      supportedChannel: 'linkedin_member_feed',
    },
    counts,
    published,
    waitingForApproval,
    failed,
    dailyBriefSection: {
      heading: 'Content Actions',
      summary: buildSummary({ counts }),
      bulletLines: buildBulletLines(published, waitingForApproval, failed),
    },
    safety: buildContentActionDigestSafety(),
  };

  return result;
}

export function buildContentActionDigestStatus(): ContentActionDigestStatus {
  return {
    phase: CONTENT_ACTION_DIGEST_PHASE,
    healthMode: CONTENT_ACTION_DIGEST_HEALTH_MODE,
    enabled: true,
    deliverable: 'content_action_digest',
    purpose: 'daily_brief_content_action_digest',
    reports: ['what_was_published', 'why_it_was_published', 'what_is_waiting_for_approval', 'what_failed'],
    safety: buildContentActionDigestSafety(),
  };
}

export function assertContentActionDigestSafe(result: ContentActionDigestResult): void {
  if (!result.safety.digestOnly || !result.safety.doesNotPublish || !result.safety.noDatabaseWrites) {
    throw new Error('Content action digest safety flags are invalid.');
  }
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content action digest output contains forbidden fragment: ${forbidden}`);
    }
  }
}
