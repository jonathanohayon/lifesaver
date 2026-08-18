import { z } from 'zod';
import type {
  SecureApprovalLinkInput,
  SecureApprovalLinkOutput,
  SecureApprovalLinkSource,
  SecureApprovalLinkStatus,
} from './notification-secure-approval-links.types.js';
import { normalizeActionIdForDeepLink, normalizeAppBaseUrl } from './notification-deep-links.model.js';

export const SECURE_APPROVAL_LINKS_VERSION = '0.7.0' as const;
export const SECURE_APPROVAL_LINKS_PHASE = 'phase_10_9_secure_approval_links' as const;

const sourceValues: SecureApprovalLinkSource[] = [
  'email_notification',
  'in_app_notification_center',
  'notification_trigger',
  'approval_reminder',
  'manual_copy',
];

const forbiddenFragments = [
  'access_token',
  'refresh_token',
  'authorization',
  'bearer ',
  'api_key',
  'client_secret',
  'database_url',
  'password=',
  'password:',
  'app_encryption_key',
  'worker_shared_secret',
  'raw_payload',
  'payload_json',
  'rollback_payload',
  'encrypted_',
  'set-cookie',
];

const mutatingQueryKeys = [
  'approve',
  'approved',
  'reject',
  'rejected',
  'execute',
  'executed',
  'publish',
  'send',
  'run',
  'rollback',
  'delete',
  'confirm',
  'autoapprove',
  'auto_approve',
  'decision',
  'status',
  'action_status',
  'mutation',
  'method',
];

const mutatingPathFragments = [
  '/approve',
  '/reject',
  '/cancel',
  '/execute',
  '/execute-content-publish',
  '/rollback',
  '/rollback-content-publish',
  '/connect/linkedin',
  '/api/v1/actions/',
];

export const secureApprovalLinkInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  source: z.enum(sourceValues as [SecureApprovalLinkSource, ...SecureApprovalLinkSource[]]).optional(),
  appBaseUrl: z.string().trim().max(240).nullable().optional(),
  notificationKey: z.string().trim().max(160).nullable().optional(),
}).strict();

function safeNotificationKey(value?: string | null): string | null {
  const clean = String(value || '').trim();
  if (!clean) return null;
  if (!/^[a-zA-Z0-9_:-]{1,160}$/.test(clean)) {
    throw new Error('Secure approval link notification key contains unsafe characters.');
  }
  return clean;
}

function assertNoForbiddenFragments(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  const found = forbiddenFragments.find((fragment) => serialized.includes(fragment));
  if (found) throw new Error(`Secure approval link contains forbidden fragment: ${found}`);
}

function parseReviewUrl(reviewUrl: string): URL {
  const clean = String(reviewUrl || '').trim();
  if (!clean) throw new Error('Secure approval link reviewUrl is required.');
  if (/^(javascript|data|vbscript):/i.test(clean)) {
    throw new Error('Secure approval link must not use unsafe URL schemes.');
  }
  try {
    return new URL(clean, 'https://lifesaveragent.com');
  } catch {
    throw new Error('Secure approval link reviewUrl must be a valid app URL.');
  }
}

export function assertReviewUrlIsOpenOnly(reviewUrl: string): void {
  const parsed = parseReviewUrl(reviewUrl);
  const lowerPath = parsed.pathname.toLowerCase();
  const lowerUrl = reviewUrl.toLowerCase();

  assertNoForbiddenFragments({ reviewUrl });

  if (parsed.username || parsed.password) {
    throw new Error('Secure approval link must not contain embedded credentials.');
  }
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Secure approval link must use HTTPS outside local development.');
  }
  if (!lowerPath.endsWith('/actions.html')) {
    throw new Error('Secure approval link must open the app action review screen only.');
  }
  for (const fragment of mutatingPathFragments) {
    if (lowerPath.includes(fragment)) {
      throw new Error(`Secure approval link must not target mutation route: ${fragment}`);
    }
  }
  for (const key of mutatingQueryKeys) {
    if (parsed.searchParams.has(key)) {
      throw new Error(`Secure approval link must not include mutating query parameter: ${key}`);
    }
  }
  if (lowerUrl.includes('/api/v1/actions/') || lowerUrl.includes('/api/v1/connect/')) {
    throw new Error('Secure approval link must open the browser app, not an API mutation route.');
  }
}

export function buildSecureApprovalReviewUrl(input: SecureApprovalLinkInput): SecureApprovalLinkOutput {
  const parsed = secureApprovalLinkInputSchema.parse(input);
  const actionId = normalizeActionIdForDeepLink(parsed.actionId);
  const source = parsed.source || 'manual_copy';
  const notificationKey = safeNotificationKey(parsed.notificationKey);
  const base = normalizeAppBaseUrl(parsed.appBaseUrl);
  const search = new URLSearchParams({
    actionId,
    source,
    linkMode: 'review_only',
  });
  if (notificationKey) search.set('notificationKey', notificationKey);

  const reviewUrl = base ? `${base}/actions.html?${search.toString()}` : `./actions.html?${search.toString()}`;
  const output: SecureApprovalLinkOutput = {
    version: SECURE_APPROVAL_LINKS_VERSION,
    phase: SECURE_APPROVAL_LINKS_PHASE,
    actionId,
    reviewUrl,
    source,
    notificationKey,
    queryParams: {
      actionId,
      source,
      linkMode: 'review_only',
      ...(notificationKey ? { notificationKey } : {}),
    },
    behavior: {
      opensApp: true,
      opensExactActionDetail: true,
      requiresLogin: true,
      unauthenticatedRedirect: './login.html?returnTo=<encoded secure path>',
      allowedScreen: '/actions.html',
      allowedMode: 'review_only_action_detail',
      automaticApprovalFromLink: false,
      automaticExecutionFromLink: false,
    },
    safety: {
      canApproveByClickingEmailLink: false,
      canRejectByClickingEmailLink: false,
      canExecuteByClickingEmailLink: false,
      canPublishByClickingEmailLink: false,
      canRollbackByClickingEmailLink: false,
      requiresAuthenticatedSession: true,
      requiresSeparateButtonClickInsideApp: true,
      exposesTokensOrSecrets: false,
      exposesPayloadJson: false,
      exposesRollbackPayload: false,
      allowsApiMutationRoute: false,
    },
  };
  assertSafeSecureApprovalLink(output);
  return output;
}

export function assertSafeSecureApprovalLink(output: SecureApprovalLinkOutput): void {
  assertReviewUrlIsOpenOnly(output.reviewUrl);
  if (!output.behavior.opensApp || !output.behavior.opensExactActionDetail || !output.behavior.requiresLogin) {
    throw new Error('Secure approval links must open the authenticated app action detail screen.');
  }
  if (output.behavior.automaticApprovalFromLink || output.behavior.automaticExecutionFromLink) {
    throw new Error('Secure approval links must not approve or execute automatically.');
  }
  if (
    output.safety.canApproveByClickingEmailLink ||
    output.safety.canRejectByClickingEmailLink ||
    output.safety.canExecuteByClickingEmailLink ||
    output.safety.canPublishByClickingEmailLink ||
    output.safety.canRollbackByClickingEmailLink ||
    output.safety.allowsApiMutationRoute
  ) {
    throw new Error('Secure approval link safety flags must remain non-mutating.');
  }
  if (!output.safety.requiresAuthenticatedSession || !output.safety.requiresSeparateButtonClickInsideApp) {
    throw new Error('Secure approval links must require login plus a separate in-app decision click.');
  }
  if (output.safety.exposesTokensOrSecrets || output.safety.exposesPayloadJson || output.safety.exposesRollbackPayload) {
    throw new Error('Secure approval links must not expose secrets, payload JSON, or rollback payloads.');
  }
  assertNoForbiddenFragments(output);
}

export function buildSecureApprovalLinksStatus(): SecureApprovalLinkStatus {
  return {
    version: SECURE_APPROVAL_LINKS_VERSION,
    phase: SECURE_APPROVAL_LINKS_PHASE,
    status: 'available',
    rule: 'email_and_in_app_links_open_app_only_never_auto_approve',
    endpoints: {
      status: 'GET /api/v1/notifications/secure-approval-links/status',
      preview: 'GET /api/v1/notifications/secure-approval-links/preview?actionId=<ACTION_ID>',
    },
    behavior: {
      opensApp: true,
      opensExactActionDetail: true,
      requiresLogin: true,
      unauthenticatedRedirect: './login.html?returnTo=<encoded secure path>',
      allowedScreen: '/actions.html',
      allowedMode: 'review_only_action_detail',
      automaticApprovalFromLink: false,
      automaticExecutionFromLink: false,
    },
    safety: {
      canApproveByClickingEmailLink: false,
      canRejectByClickingEmailLink: false,
      canExecuteByClickingEmailLink: false,
      canPublishByClickingEmailLink: false,
      canRollbackByClickingEmailLink: false,
      requiresAuthenticatedSession: true,
      requiresSeparateButtonClickInsideApp: true,
      exposesTokensOrSecrets: false,
      exposesPayloadJson: false,
      exposesRollbackPayload: false,
      allowsApiMutationRoute: false,
    },
  };
}
