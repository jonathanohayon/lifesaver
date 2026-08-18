import { z } from 'zod';
import type { ApprovalDeepLinkInput, ApprovalDeepLinkOutput, ApprovalDeepLinkSource } from './notification-deep-links.types.js';

export const APPROVAL_DEEP_LINKS_VERSION = '0.7.0' as const;
export const APPROVAL_DEEP_LINKS_PHASE = 'phase_10_4_approval_deep_links' as const;

const safeActionIdPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const sourceValues: ApprovalDeepLinkSource[] = [
  'in_app_notification_center',
  'email_notification',
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
  'password',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'raw_payload',
  'payload_json',
  'rollback_payload',
  'encrypted_',
];

export const approvalDeepLinkInputSchema = z.object({
  actionId: z.string().trim().min(1).max(120),
  source: z.enum(sourceValues as [ApprovalDeepLinkSource, ...ApprovalDeepLinkSource[]]).optional(),
  appBaseUrl: z.string().trim().max(240).nullable().optional(),
}).strict();

function assertSafeSerialized(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  const found = forbiddenFragments.find((fragment) => serialized.includes(fragment));
  if (found) {
    throw new Error(`Approval deep link contains forbidden fragment: ${found}`);
  }
}

export function normalizeActionIdForDeepLink(actionId: string): string {
  const clean = String(actionId || '').trim();
  if (!safeActionIdPattern.test(clean)) {
    throw new Error('Approval deep link requires a safe action identifier.');
  }
  return clean;
}

export function normalizeAppBaseUrl(appBaseUrl?: string | null): string | null {
  const clean = String(appBaseUrl || '').trim();
  if (!clean) return null;
  if (clean.includes('@') || clean.includes('access_token') || clean.includes('refresh_token')) {
    throw new Error('Approval deep link base URL must not contain credentials or tokens.');
  }
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error('Approval deep link base URL must be a valid URL when provided.');
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !isLocal) {
    throw new Error('Approval deep link absolute URLs must use HTTPS outside local development.');
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function buildSecureApprovalDeepLink(input: ApprovalDeepLinkInput): ApprovalDeepLinkOutput {
  const parsed = approvalDeepLinkInputSchema.parse(input);
  const actionId = normalizeActionIdForDeepLink(parsed.actionId);
  const source = parsed.source || 'manual_copy';
  const query = `actionId=${encodeURIComponent(actionId)}&source=${encodeURIComponent(source)}`;
  const base = normalizeAppBaseUrl(parsed.appBaseUrl);
  const reviewUrl = base ? `${base}/actions.html?${query}` : `./actions.html?${query}`;
  const output: ApprovalDeepLinkOutput = {
    version: APPROVAL_DEEP_LINKS_VERSION,
    phase: APPROVAL_DEEP_LINKS_PHASE,
    actionId,
    reviewUrl,
    requiresLogin: true,
    targetPage: '/actions.html',
    targetMode: 'action_detail_drawer',
    safety: {
      containsToken: false,
      containsSecret: false,
      exposesPayloadJson: false,
      canApproveByLinkAlone: false,
      canExecuteByLinkAlone: false,
      requiresAuthenticatedSession: true,
    },
  };
  assertSafeApprovalDeepLink(output);
  return output;
}

export function assertSafeApprovalDeepLink(output: ApprovalDeepLinkOutput): void {
  if (!output.requiresLogin || !output.safety.requiresAuthenticatedSession) {
    throw new Error('Approval deep links must require login.');
  }
  if (output.safety.canApproveByLinkAlone || output.safety.canExecuteByLinkAlone) {
    throw new Error('Approval deep links must not approve or execute by link alone.');
  }
  if (output.safety.containsToken || output.safety.containsSecret || output.safety.exposesPayloadJson) {
    throw new Error('Approval deep links must not contain secrets or payload JSON.');
  }
  assertSafeSerialized(output);
}
