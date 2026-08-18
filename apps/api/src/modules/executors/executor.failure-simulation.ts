import type { ActionType } from '../actions/actions.types.js';
import type { ExecutorActionContext, ExecutorExecuteResult } from './executor.interface.js';

export const FAILURE_SIMULATION_PHASE = 'v0.6.0 Phase 8.8 Failure Simulation' as const;

export type SandboxFailureSimulationDetection = {
  sandboxShouldFail: boolean;
  source: 'payload_root' | 'payload_data' | 'metadata' | 'none';
  reason: string;
};

export type SandboxForcedFailureResult = {
  sandbox_success: false;
  sandbox_should_fail: true;
  forced_fake_failure: true;
  fake_failure_id: string;
  failure_reason: string;
  action_type: ActionType;
  simulated_only: true;
  external_writes_attempted: false;
  external_writes_succeeded: false;
  external_platform_called: false;
  external_helpdesk_called: false;
  external_email_sent: false;
  external_ads_api_called: false;
};

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function valueIsExplicitTrue(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function getFailureReason(source: Record<string, unknown> | null): string | null {
  if (!source) return null;
  const candidates = [
    source.sandbox_failure_reason,
    source.failure_reason,
    source.sandbox_fail_reason,
  ];
  const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof match === 'string' ? match.trim().slice(0, 500) : null;
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'sandbox-failure';
}

export function detectSandboxShouldFail(
  payload: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): SandboxFailureSimulationDetection {
  const data = isRecord(payload.data) ? payload.data : {};

  if (valueIsExplicitTrue(payload.sandbox_should_fail) || valueIsExplicitTrue(payload.sandboxShouldFail)) {
    return {
      sandboxShouldFail: true,
      source: 'payload_root',
      reason: getFailureReason(payload) || 'Forced fake failure requested by payload root sandbox_should_fail flag.',
    };
  }

  if (valueIsExplicitTrue(data.sandbox_should_fail) || valueIsExplicitTrue(data.sandboxShouldFail)) {
    return {
      sandboxShouldFail: true,
      source: 'payload_data',
      reason: getFailureReason(data) || 'Forced fake failure requested by payload data sandbox_should_fail flag.',
    };
  }

  if (valueIsExplicitTrue(metadata.sandbox_should_fail) || valueIsExplicitTrue(metadata.sandboxShouldFail)) {
    return {
      sandboxShouldFail: true,
      source: 'metadata',
      reason: getFailureReason(metadata) || 'Forced fake failure requested by metadata sandbox_should_fail flag.',
    };
  }

  return {
    sandboxShouldFail: false,
    source: 'none',
    reason: 'No forced sandbox failure flag detected.',
  };
}

export function buildForcedSandboxFailureExecuteResult(
  context: ExecutorActionContext<Record<string, unknown>>,
  executorName: string,
  detection: SandboxFailureSimulationDetection,
): ExecutorExecuteResult<SandboxForcedFailureResult> {
  const fakeFailureId = `sandbox-failure-${sanitizeSlug(context.actionId || context.idempotencyKey || context.actionType)}`;

  return {
    ok: false,
    status: 'failed',
    executorName,
    mode: 'sandbox',
    result: {
      sandbox_success: false,
      sandbox_should_fail: true,
      forced_fake_failure: true,
      fake_failure_id: fakeFailureId,
      failure_reason: detection.reason,
      action_type: context.actionType,
      simulated_only: true,
      external_writes_attempted: false,
      external_writes_succeeded: false,
      external_platform_called: false,
      external_helpdesk_called: false,
      external_email_sent: false,
      external_ads_api_called: false,
    },
    resultSummary: `Sandbox forced fake failure triggered: ${detection.reason}`,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rollbackSupported: false,
    rollbackPayload: null,
    executedAt: now(),
  };
}

export function buildFailureSimulationSafetySummary(): {
  version: '0.6.0';
  phase: typeof FAILURE_SIMULATION_PHASE;
  supportsSandboxShouldFailFlag: true;
  acceptedFlagLocations: ['payload_root', 'payload_data', 'metadata'];
  failedActionStatusTested: true;
  sandboxOnly: true;
  externalWritesEnabled: false;
  realExecutorsEnabled: false;
  autoRunEnabled: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: FAILURE_SIMULATION_PHASE,
    supportsSandboxShouldFailFlag: true,
    acceptedFlagLocations: ['payload_root', 'payload_data', 'metadata'],
    failedActionStatusTested: true,
    sandboxOnly: true,
    externalWritesEnabled: false,
    realExecutorsEnabled: false,
    autoRunEnabled: false,
    note: 'Phase 8.8 allows QA to force a fake sandbox failure with sandbox_should_fail=true. The action reaches failed status in the sandbox lifecycle without any external write attempt.',
  };
}
