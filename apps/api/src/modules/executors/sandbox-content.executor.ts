import type { ContentPublishPayload } from '../../shared/index.js';
import {
  EXECUTOR_INTERFACE_PHASE,
  type ExecutorActionContext,
  type ExecutorExecuteResult,
  type ExecutorResultSummary,
  type ExecutorRollbackResult,
  type ExecutorValidationResult,
  type LifeSaverExecutor,
} from './executor.interface.js';

export const SANDBOX_CONTENT_EXECUTOR_PHASE = 'v0.6.0 Phase 8.3 Sandbox Content Executor' as const;
export const SANDBOX_CONTENT_EXECUTOR_NAME = 'sandboxContentExecutor' as const;

export type SandboxContentExecutorResult = {
  sandbox_success: boolean;
  fake_external_post_id: string;
  fake_permalink: string;
  platform: string;
  post_type: string | null;
  caption_preview: string;
  simulated_only: true;
  external_platform_called: false;
};

export type SandboxContentExecutorPayload = ContentPublishPayload & Record<string, unknown>;

type ContentContext = ExecutorActionContext<SandboxContentExecutorPayload>;

function now(): string {
  return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sandbox-post';
}

function buildFakeId(context: ContentContext): string {
  const idPart = sanitizeSlug(context.actionId || context.idempotencyKey || 'action');
  return `sandbox-post-${idPart.slice(0, 36)}`;
}

function buildFakePermalink(context: ContentContext, fakeId: string): string {
  const platform = sanitizeSlug(context.payload.data.platform || 'content');
  return `https://sandbox.lifesaveragent.com/${platform}/${fakeId}`;
}

function captionPreview(caption: string): string {
  const compact = caption.replace(/\s+/g, ' ').trim();
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function payloadHasForbiddenSecretShape(payload: ContentPublishPayload): boolean {
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
    'claude_api_key',
    'triple_whale_api_key',
  ].some((needle) => raw.includes(needle));
}

export async function validateSandboxContentPublish(
  context: ContentContext,
): Promise<ExecutorValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.actionType !== 'content_publish') errors.push('Executor only supports content_publish actions.');
  if (context.payload.action_type !== 'content_publish') errors.push('Payload action_type must be content_publish.');
  if (!isNonEmptyString(context.payload.data.platform)) errors.push('Platform is required for sandbox content publish simulation.');
  if (!isNonEmptyString(context.payload.data.caption)) errors.push('Caption is required for sandbox content publish simulation.');
  if (payloadHasForbiddenSecretShape(context.payload)) errors.push('Payload appears to contain secret-like fields. Sandbox executor refuses to continue.');
  if (context.policyDecision === 'block') warnings.push('Policy decision is block. Phase 8.3 test execution remains sandbox-only and should not be wired to real action flow.');
  if (context.riskLevel === 'high' || context.riskLevel === 'critical') warnings.push('High/critical risk content should remain approval-required in future real flows.');

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'valid' : 'invalid',
    reason: errors.length === 0
      ? 'Sandbox content publish payload is valid for local simulation only. No external platform call is allowed or attempted.'
      : 'Sandbox content publish payload is invalid and cannot be simulated.',
    warnings,
    errors,
    externalWritesAllowed: false,
    checkedAt: now(),
  };
}

export async function executeSandboxContentPublish(
  context: ContentContext,
): Promise<ExecutorExecuteResult<SandboxContentExecutorResult>> {
  const validation = await validateSandboxContentPublish(context);

  if (!validation.ok) {
    return {
      ok: false,
      status: 'failed',
      executorName: SANDBOX_CONTENT_EXECUTOR_NAME,
      mode: 'sandbox',
      result: {
        sandbox_success: false,
        fake_external_post_id: 'sandbox-validation-failed',
        fake_permalink: 'https://sandbox.lifesaveragent.com/content/validation-failed',
        platform: String(context.payload.data.platform || 'unknown'),
        post_type: typeof context.payload.data.post_type === 'string' ? context.payload.data.post_type : null,
        caption_preview: '',
        simulated_only: true,
        external_platform_called: false,
      },
      resultSummary: `Sandbox content publish validation failed: ${validation.errors.join(' ')}`,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rollbackSupported: false,
      rollbackPayload: null,
      executedAt: now(),
    };
  }

  const fakeId = buildFakeId(context);
  const fakePermalink = buildFakePermalink(context, fakeId);

  return {
    ok: true,
    status: 'executed',
    executorName: SANDBOX_CONTENT_EXECUTOR_NAME,
    mode: 'sandbox',
    result: {
      sandbox_success: true,
      fake_external_post_id: fakeId,
      fake_permalink: fakePermalink,
      platform: context.payload.data.platform,
      post_type: typeof context.payload.data.post_type === 'string' ? context.payload.data.post_type : null,
      caption_preview: captionPreview(context.payload.data.caption),
      simulated_only: true,
      external_platform_called: false,
    },
    resultSummary: `Sandbox simulated content publishing successfully. Fake post ID ${fakeId} was generated. No external platform was called.`,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rollbackSupported: true,
    rollbackPayload: {
      sandbox_fake_external_post_id: fakeId,
      sandbox_fake_permalink: fakePermalink,
      rollback_type: 'sandbox_noop_delete_simulation',
      external_platform_called: false,
    },
    executedAt: now(),
  };
}

export async function rollbackSandboxContentPublish(
  _context: ContentContext,
  result: ExecutorExecuteResult<SandboxContentExecutorResult>,
): Promise<ExecutorRollbackResult> {
  return {
    ok: true,
    status: result.ok ? 'rolled_back' : 'rollback_not_supported',
    executorName: SANDBOX_CONTENT_EXECUTOR_NAME,
    mode: 'sandbox',
    resultSummary: result.ok
      ? `Sandbox rollback simulated for fake post ${result.result.fake_external_post_id}. Nothing was deleted from an external platform.`
      : 'Sandbox rollback was not needed because the sandbox content execution did not succeed.',
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rolledBackAt: now(),
  };
}

export function summarizeSandboxContentResult(
  result: ExecutorExecuteResult<SandboxContentExecutorResult> | ExecutorRollbackResult,
): ExecutorResultSummary {
  return {
    title: result.status === 'rolled_back' ? 'Sandbox content rollback simulated' : 'Sandbox content publish simulated',
    status: result.status,
    message: result.resultSummary,
    safeForFounderDisplay: true,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
  };
}

export const sandboxContentExecutor: LifeSaverExecutor<SandboxContentExecutorPayload, SandboxContentExecutorResult> = {
  name: SANDBOX_CONTENT_EXECUTOR_NAME,
  actionType: 'content_publish',
  mode: 'sandbox',
  realExternalWriteEnabled: false,
  sandboxOnly: true,
  validate: validateSandboxContentPublish,
  execute: executeSandboxContentPublish,
  rollback: rollbackSandboxContentPublish,
  summarizeResult: summarizeSandboxContentResult,
};

export function buildSandboxContentExecutorSafetySummary(): {
  version: '0.6.0';
  phase: typeof SANDBOX_CONTENT_EXECUTOR_PHASE;
  executorName: typeof SANDBOX_CONTENT_EXECUTOR_NAME;
  actionType: 'content_publish';
  interfacePhase: typeof EXECUTOR_INTERFACE_PHASE;
  returnsFakeExternalPostId: true;
  returnsFakePermalink: true;
  returnsSandboxSuccess: true;
  sandboxOnly: true;
  realExternalWriteEnabled: false;
  externalWritesEnabled: false;
  externalWritesAttempted: false;
  autoRunEnabled: false;
  wiredToActionFlow: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: SANDBOX_CONTENT_EXECUTOR_PHASE,
    executorName: SANDBOX_CONTENT_EXECUTOR_NAME,
    actionType: 'content_publish',
    interfacePhase: EXECUTOR_INTERFACE_PHASE,
    returnsFakeExternalPostId: true,
    returnsFakePermalink: true,
    returnsSandboxSuccess: true,
    sandboxOnly: true,
    realExternalWriteEnabled: false,
    externalWritesEnabled: false,
    externalWritesAttempted: false,
    autoRunEnabled: false,
    wiredToActionFlow: false,
    note: 'Phase 8.3 implements the sandbox content executor as a safe TypeScript handler. It returns fake post data only and is not wired into a real action runner or external platform connector.',
  };
}
