import type { SupportReplySendPayload } from '../../shared/index.js';
import {
  EXECUTOR_INTERFACE_PHASE,
  type ExecutorActionContext,
  type ExecutorExecuteResult,
  type ExecutorResultSummary,
  type ExecutorRollbackResult,
  type ExecutorValidationResult,
  type LifeSaverExecutor,
} from './executor.interface.js';

export const SANDBOX_SUPPORT_EXECUTOR_PHASE = 'v0.6.0 Phase 8.4 Sandbox Support Executor' as const;
export const SANDBOX_SUPPORT_EXECUTOR_NAME = 'sandboxSupportExecutor' as const;

export type SandboxSupportExecutorResult = {
  sandbox_success: boolean;
  fake_external_reply_id: string;
  fake_thread_permalink: string;
  support_provider: string;
  ticket_id: string;
  thread_id: string;
  category: string | null;
  confidence_score: number | null;
  reply_preview: string;
  simulated_only: true;
  external_helpdesk_called: false;
  external_email_sent: false;
};

export type SandboxSupportExecutorPayload = SupportReplySendPayload & Record<string, unknown>;

type SupportContext = ExecutorActionContext<SandboxSupportExecutorPayload>;

function now(): string {
  return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumberOrNull(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sandbox-support';
}

function buildFakeReplyId(context: SupportContext): string {
  const ticketPart = sanitizeSlug(context.payload.data.ticket_id || 'ticket');
  const idPart = sanitizeSlug(context.actionId || context.idempotencyKey || 'action');
  return `sandbox-reply-${ticketPart}-${idPart.slice(0, 36)}`;
}

function buildFakeThreadPermalink(context: SupportContext, fakeReplyId: string): string {
  const provider = sanitizeSlug(context.payload.data.support_provider || 'helpdesk');
  const threadId = sanitizeSlug(context.payload.data.thread_id || 'thread');
  return `https://sandbox.lifesaveragent.com/support/${provider}/${threadId}/${fakeReplyId}`;
}

function replyPreview(replyBody: string): string {
  const compact = replyBody.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function payloadHasForbiddenSecretShape(payload: SupportReplySendPayload): boolean {
  const raw = JSON.stringify(payload).toLowerCase();
  return [
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'password',
    'secret=',
    'authorization',
    'bearer ',
    'gmail_token',
    'zendesk_token',
    'helpdesk_api_key',
    'claude_api_key',
    'triple_whale_api_key',
  ].some((needle) => raw.includes(needle));
}

export async function validateSandboxSupportReply(
  context: SupportContext,
): Promise<ExecutorValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.actionType !== 'support_reply_send') errors.push('Executor only supports support_reply_send actions.');
  if (context.payload.action_type !== 'support_reply_send') errors.push('Payload action_type must be support_reply_send.');
  if (!isNonEmptyString(context.payload.data.ticket_id)) errors.push('Ticket ID is required for sandbox support reply simulation.');
  if (!isNonEmptyString(context.payload.data.thread_id)) errors.push('Thread ID is required for sandbox support reply simulation.');
  if (!isNonEmptyString(context.payload.data.reply_body)) errors.push('Reply body is required for sandbox support reply simulation.');
  if (!isFiniteNumberOrNull(context.payload.data.confidence_score)) errors.push('Confidence score must be a finite number when provided.');
  if (payloadHasForbiddenSecretShape(context.payload)) errors.push('Payload appears to contain secret-like fields. Sandbox support executor refuses to continue.');
  if (context.payload.data.sensitive_flag === true) warnings.push('Sensitive support tickets should stay approval-required and escalated in future real flows.');
  if (context.payload.data.escalation_required === true) warnings.push('Escalation-required support tickets should not be auto-replied to in future real flows.');
  if (context.policyDecision === 'block') warnings.push('Policy decision is block. Phase 8.4 execution remains sandbox-only and must not be wired to real email/helpdesk APIs.');
  if (context.riskLevel === 'high' || context.riskLevel === 'critical') warnings.push('High/critical risk support replies must remain approval-required in future real flows.');

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'valid' : 'invalid',
    reason: errors.length === 0
      ? 'Sandbox support reply payload is valid for local simulation only. No email/helpdesk API call is allowed or attempted.'
      : 'Sandbox support reply payload is invalid and cannot be simulated.',
    warnings,
    errors,
    externalWritesAllowed: false,
    checkedAt: now(),
  };
}

export async function executeSandboxSupportReply(
  context: SupportContext,
): Promise<ExecutorExecuteResult<SandboxSupportExecutorResult>> {
  const validation = await validateSandboxSupportReply(context);

  if (!validation.ok) {
    return {
      ok: false,
      status: 'failed',
      executorName: SANDBOX_SUPPORT_EXECUTOR_NAME,
      mode: 'sandbox',
      result: {
        sandbox_success: false,
        fake_external_reply_id: 'sandbox-support-validation-failed',
        fake_thread_permalink: 'https://sandbox.lifesaveragent.com/support/validation-failed',
        support_provider: String(context.payload.data.support_provider || 'unknown'),
        ticket_id: String(context.payload.data.ticket_id || 'unknown'),
        thread_id: String(context.payload.data.thread_id || 'unknown'),
        category: typeof context.payload.data.category === 'string' ? context.payload.data.category : null,
        confidence_score: typeof context.payload.data.confidence_score === 'number' ? context.payload.data.confidence_score : null,
        reply_preview: '',
        simulated_only: true,
        external_helpdesk_called: false,
        external_email_sent: false,
      },
      resultSummary: `Sandbox support reply validation failed: ${validation.errors.join(' ')}`,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rollbackSupported: false,
      rollbackPayload: null,
      executedAt: now(),
    };
  }

  const fakeReplyId = buildFakeReplyId(context);
  const fakeThreadPermalink = buildFakeThreadPermalink(context, fakeReplyId);

  return {
    ok: true,
    status: 'executed',
    executorName: SANDBOX_SUPPORT_EXECUTOR_NAME,
    mode: 'sandbox',
    result: {
      sandbox_success: true,
      fake_external_reply_id: fakeReplyId,
      fake_thread_permalink: fakeThreadPermalink,
      support_provider: context.payload.data.support_provider || 'sandbox-helpdesk',
      ticket_id: context.payload.data.ticket_id,
      thread_id: context.payload.data.thread_id,
      category: typeof context.payload.data.category === 'string' ? context.payload.data.category : null,
      confidence_score: typeof context.payload.data.confidence_score === 'number' ? context.payload.data.confidence_score : null,
      reply_preview: replyPreview(context.payload.data.reply_body),
      simulated_only: true,
      external_helpdesk_called: false,
      external_email_sent: false,
    },
    resultSummary: `Sandbox simulated support reply successfully. Fake reply ID ${fakeReplyId} was generated. No email or helpdesk API was called.`,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rollbackSupported: true,
    rollbackPayload: {
      sandbox_fake_external_reply_id: fakeReplyId,
      sandbox_fake_thread_permalink: fakeThreadPermalink,
      rollback_type: 'sandbox_noop_delete_reply_simulation',
      external_helpdesk_called: false,
      external_email_sent: false,
    },
    executedAt: now(),
  };
}

export async function rollbackSandboxSupportReply(
  _context: SupportContext,
  result: ExecutorExecuteResult<SandboxSupportExecutorResult>,
): Promise<ExecutorRollbackResult> {
  return {
    ok: true,
    status: result.ok ? 'rolled_back' : 'rollback_not_supported',
    executorName: SANDBOX_SUPPORT_EXECUTOR_NAME,
    mode: 'sandbox',
    resultSummary: result.ok
      ? `Sandbox rollback simulated for fake support reply ${result.result.fake_external_reply_id}. Nothing was deleted from email or helpdesk systems.`
      : 'Sandbox rollback was not needed because the sandbox support execution did not succeed.',
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rolledBackAt: now(),
  };
}

export function summarizeSandboxSupportResult(
  result: ExecutorExecuteResult<SandboxSupportExecutorResult> | ExecutorRollbackResult,
): ExecutorResultSummary {
  return {
    title: result.status === 'rolled_back' ? 'Sandbox support rollback simulated' : 'Sandbox support reply simulated',
    status: result.status,
    message: result.resultSummary,
    safeForFounderDisplay: true,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
  };
}

export const sandboxSupportExecutor: LifeSaverExecutor<SandboxSupportExecutorPayload, SandboxSupportExecutorResult> = {
  name: SANDBOX_SUPPORT_EXECUTOR_NAME,
  actionType: 'support_reply_send',
  mode: 'sandbox',
  realExternalWriteEnabled: false,
  sandboxOnly: true,
  validate: validateSandboxSupportReply,
  execute: executeSandboxSupportReply,
  rollback: rollbackSandboxSupportReply,
  summarizeResult: summarizeSandboxSupportResult,
};

export function buildSandboxSupportExecutorSafetySummary(): {
  version: '0.6.0';
  phase: typeof SANDBOX_SUPPORT_EXECUTOR_PHASE;
  executorName: typeof SANDBOX_SUPPORT_EXECUTOR_NAME;
  actionType: 'support_reply_send';
  interfacePhase: typeof EXECUTOR_INTERFACE_PHASE;
  returnsFakeExternalReplyId: true;
  returnsFakeThreadPermalink: true;
  returnsSandboxSuccess: true;
  sandboxOnly: true;
  realExternalWriteEnabled: false;
  externalWritesEnabled: false;
  externalWritesAttempted: false;
  autoRunEnabled: false;
  wiredToActionFlow: false;
  emailHelpdeskApiCalled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: SANDBOX_SUPPORT_EXECUTOR_PHASE,
    executorName: SANDBOX_SUPPORT_EXECUTOR_NAME,
    actionType: 'support_reply_send',
    interfacePhase: EXECUTOR_INTERFACE_PHASE,
    returnsFakeExternalReplyId: true,
    returnsFakeThreadPermalink: true,
    returnsSandboxSuccess: true,
    sandboxOnly: true,
    realExternalWriteEnabled: false,
    externalWritesEnabled: false,
    externalWritesAttempted: false,
    autoRunEnabled: false,
    wiredToActionFlow: false,
    emailHelpdeskApiCalled: false,
    note: 'Phase 8.4 implements the sandbox support executor as a safe TypeScript handler. It returns fake support reply data only and is not wired into a real action runner, email API, or helpdesk connector.',
  };
}
