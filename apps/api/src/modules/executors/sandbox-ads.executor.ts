import type { AdBudgetAdjustPayload, AdPausePayload } from '../../shared/index.js';
import {
  EXECUTOR_INTERFACE_PHASE,
  type ExecutorActionContext,
  type ExecutorExecuteResult,
  type ExecutorResultSummary,
  type ExecutorRollbackResult,
  type ExecutorValidationResult,
  type LifeSaverExecutor,
} from './executor.interface.js';

export const SANDBOX_ADS_EXECUTOR_PHASE = 'v0.6.0 Phase 8.5 Sandbox Ads Executor' as const;
export const SANDBOX_ADS_BUDGET_EXECUTOR_NAME = 'sandboxAdsBudgetExecutor' as const;
export const SANDBOX_ADS_PAUSE_EXECUTOR_NAME = 'sandboxAdsPauseExecutor' as const;

export type SandboxAdsState = {
  platform: string;
  account_id_hint: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  target_level: string | null;
  target_id: string | null;
  budget: number | null;
  budget_period: string | null;
  currency: string | null;
  status: string | null;
};

export type SandboxAdsExecutorResult = {
  sandbox_success: boolean;
  fake_external_action_id: string;
  fake_audit_permalink: string;
  fake_before_state: SandboxAdsState;
  fake_after_state: SandboxAdsState;
  simulated_action: 'budget_adjust' | 'pause';
  platform: string;
  change_amount: number | null;
  change_percent: number | null;
  simulated_only: true;
  external_ads_api_called: false;
  external_budget_changed: false;
  external_campaign_paused: false;
};

export type SandboxAdsBudgetExecutorPayload = AdBudgetAdjustPayload & Record<string, unknown>;
export type SandboxAdsPauseExecutorPayload = AdPausePayload & Record<string, unknown>;

type BudgetContext = ExecutorActionContext<SandboxAdsBudgetExecutorPayload>;
type PauseContext = ExecutorActionContext<SandboxAdsPauseExecutorPayload>;

type AdsContext = BudgetContext | PauseContext;

function now(): string {
  return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
    .slice(0, 56) || 'sandbox-ads';
}

function buildFakeAdsActionId(context: AdsContext, kind: 'budget' | 'pause'): string {
  const idPart = sanitizeSlug(context.actionId || context.idempotencyKey || 'action');
  return `sandbox-ads-${kind}-${idPart.slice(0, 36)}`;
}

function buildFakeAuditPermalink(context: AdsContext, fakeActionId: string): string {
  const platform = sanitizeSlug(context.payload.data.platform || 'ads');
  return `https://sandbox.lifesaveragent.com/ads/${platform}/${fakeActionId}`;
}

function payloadHasForbiddenSecretShape(payload: Record<string, unknown>): boolean {
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
    'facebook_token',
    'meta_access_token',
    'google_ads_refresh_token',
    'tiktok_access_token',
    'snapchat_access_token',
    'claude_api_key',
    'triple_whale_api_key',
  ].some((needle) => raw.includes(needle));
}

function baseState(platform: string, accountIdHint?: string | null): Pick<SandboxAdsState, 'platform' | 'account_id_hint'> {
  return {
    platform: platform || 'unknown',
    account_id_hint: accountIdHint || null,
  };
}

function buildBudgetBeforeState(payload: SandboxAdsBudgetExecutorPayload): SandboxAdsState {
  return {
    ...baseState(payload.data.platform, payload.data.account_id_hint),
    campaign_id: payload.data.campaign_id || null,
    adset_id: payload.data.adset_id || null,
    ad_id: null,
    target_level: payload.data.adset_id ? 'adset' : 'campaign',
    target_id: payload.data.adset_id || payload.data.campaign_id || null,
    budget: isFiniteNumber(payload.data.current_budget) ? payload.data.current_budget : null,
    budget_period: payload.data.current_budget_period || 'daily',
    currency: payload.data.currency || null,
    status: 'active',
  };
}

function buildBudgetAfterState(payload: SandboxAdsBudgetExecutorPayload): SandboxAdsState {
  return {
    ...buildBudgetBeforeState(payload),
    budget: isFiniteNumber(payload.data.proposed_budget) ? payload.data.proposed_budget : null,
    budget_period: payload.data.proposed_budget_period || payload.data.current_budget_period || 'daily',
  };
}

function buildPauseBeforeState(payload: SandboxAdsPauseExecutorPayload): SandboxAdsState {
  return {
    ...baseState(payload.data.platform, payload.data.account_id_hint),
    campaign_id: payload.data.campaign_id || null,
    adset_id: payload.data.adset_id || null,
    ad_id: payload.data.ad_id || null,
    target_level: payload.data.target_level || null,
    target_id: payload.data.target_id || null,
    budget: null,
    budget_period: null,
    currency: null,
    status: payload.data.current_status || null,
  };
}

function buildPauseAfterState(payload: SandboxAdsPauseExecutorPayload): SandboxAdsState {
  return {
    ...buildPauseBeforeState(payload),
    status: payload.data.proposed_status || 'paused',
  };
}

export async function validateSandboxAdsBudgetAdjust(
  context: BudgetContext,
): Promise<ExecutorValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.actionType !== 'ad_budget_adjust') errors.push('Executor only supports ad_budget_adjust actions.');
  if (context.payload.action_type !== 'ad_budget_adjust') errors.push('Payload action_type must be ad_budget_adjust.');
  if (!isNonEmptyString(context.payload.data.platform)) errors.push('Platform is required for sandbox ad budget simulation.');
  if (!isNonEmptyString(context.payload.data.campaign_id)) errors.push('Campaign ID is required for sandbox ad budget simulation.');
  if (!isFiniteNumber(context.payload.data.current_budget)) errors.push('Current budget must be a finite number.');
  if (!isFiniteNumber(context.payload.data.proposed_budget)) errors.push('Proposed budget must be a finite number.');
  if (!isFiniteNumber(context.payload.data.change_amount)) errors.push('Change amount must be a finite number.');
  if (!isNonEmptyString(context.payload.data.currency)) errors.push('Currency is required for sandbox ad budget simulation.');
  if (isFiniteNumber(context.payload.data.current_budget) && context.payload.data.current_budget < 0) errors.push('Current budget cannot be negative.');
  if (isFiniteNumber(context.payload.data.proposed_budget) && context.payload.data.proposed_budget < 0) errors.push('Proposed budget cannot be negative.');
  if (!isFiniteNumberOrNull(context.payload.data.change_percent)) errors.push('Change percent must be a finite number when provided.');
  if (payloadHasForbiddenSecretShape(context.payload)) errors.push('Payload appears to contain secret-like fields. Sandbox ads executor refuses to continue.');
  if (context.policyDecision === 'block') warnings.push('Policy decision is block. Phase 8.5 execution remains sandbox-only and must not be wired to real ads APIs.');
  if (context.riskLevel === 'high' || context.riskLevel === 'critical') warnings.push('High/critical risk ad budget changes must remain approval-required in future real flows.');
  if (Math.abs(Number(context.payload.data.change_amount || 0)) > 500) warnings.push('Large budget changes should remain ask/approval-required in future real flows.');

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'valid' : 'invalid',
    reason: errors.length === 0
      ? 'Sandbox ad budget payload is valid for local simulation only. No ad platform API call is allowed or attempted.'
      : 'Sandbox ad budget payload is invalid and cannot be simulated.',
    warnings,
    errors,
    externalWritesAllowed: false,
    checkedAt: now(),
  };
}

export async function validateSandboxAdsPause(
  context: PauseContext,
): Promise<ExecutorValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.actionType !== 'ad_pause') errors.push('Executor only supports ad_pause actions.');
  if (context.payload.action_type !== 'ad_pause') errors.push('Payload action_type must be ad_pause.');
  if (!isNonEmptyString(context.payload.data.platform)) errors.push('Platform is required for sandbox ad pause simulation.');
  if (!isNonEmptyString(context.payload.data.target_level)) errors.push('Target level is required for sandbox ad pause simulation.');
  if (!isNonEmptyString(context.payload.data.target_id)) errors.push('Target ID is required for sandbox ad pause simulation.');
  if (!isNonEmptyString(context.payload.data.current_status)) errors.push('Current status is required for sandbox ad pause simulation.');
  if (!isNonEmptyString(context.payload.data.proposed_status)) errors.push('Proposed status is required for sandbox ad pause simulation.');
  if (!isNonEmptyString(context.payload.data.reason)) errors.push('Reason is required for sandbox ad pause simulation.');
  if (context.payload.data.proposed_status !== 'paused') warnings.push('Future real ad pause executor should only allow safe, explicit paused status transitions.');
  if (payloadHasForbiddenSecretShape(context.payload)) errors.push('Payload appears to contain secret-like fields. Sandbox ads executor refuses to continue.');
  if (context.policyDecision === 'block') warnings.push('Policy decision is block. Phase 8.5 execution remains sandbox-only and must not be wired to real ads APIs.');
  if (context.riskLevel === 'high' || context.riskLevel === 'critical') warnings.push('High/critical risk ad pause actions must remain approval-required in future real flows.');
  if (String(context.payload.data.current_status).toLowerCase() === 'paused') warnings.push('Target is already paused in the simulated before state.');

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'valid' : 'invalid',
    reason: errors.length === 0
      ? 'Sandbox ad pause payload is valid for local simulation only. No ad platform API call is allowed or attempted.'
      : 'Sandbox ad pause payload is invalid and cannot be simulated.',
    warnings,
    errors,
    externalWritesAllowed: false,
    checkedAt: now(),
  };
}

export async function executeSandboxAdsBudgetAdjust(
  context: BudgetContext,
): Promise<ExecutorExecuteResult<SandboxAdsExecutorResult>> {
  const validation = await validateSandboxAdsBudgetAdjust(context);
  const beforeState = buildBudgetBeforeState(context.payload);
  const afterState = buildBudgetAfterState(context.payload);

  if (!validation.ok) {
    return {
      ok: false,
      status: 'failed',
      executorName: SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
      mode: 'sandbox',
      result: {
        sandbox_success: false,
        fake_external_action_id: 'sandbox-ads-budget-validation-failed',
        fake_audit_permalink: 'https://sandbox.lifesaveragent.com/ads/validation-failed',
        fake_before_state: beforeState,
        fake_after_state: beforeState,
        simulated_action: 'budget_adjust',
        platform: String(context.payload.data.platform || 'unknown'),
        change_amount: isFiniteNumber(context.payload.data.change_amount) ? context.payload.data.change_amount : null,
        change_percent: typeof context.payload.data.change_percent === 'number' ? context.payload.data.change_percent : null,
        simulated_only: true,
        external_ads_api_called: false,
        external_budget_changed: false,
        external_campaign_paused: false,
      },
      resultSummary: `Sandbox ad budget validation failed: ${validation.errors.join(' ')}`,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rollbackSupported: false,
      rollbackPayload: null,
      executedAt: now(),
    };
  }

  const fakeActionId = buildFakeAdsActionId(context, 'budget');
  const fakeAuditPermalink = buildFakeAuditPermalink(context, fakeActionId);

  return {
    ok: true,
    status: 'executed',
    executorName: SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
    mode: 'sandbox',
    result: {
      sandbox_success: true,
      fake_external_action_id: fakeActionId,
      fake_audit_permalink: fakeAuditPermalink,
      fake_before_state: beforeState,
      fake_after_state: afterState,
      simulated_action: 'budget_adjust',
      platform: context.payload.data.platform,
      change_amount: context.payload.data.change_amount,
      change_percent: typeof context.payload.data.change_percent === 'number' ? context.payload.data.change_percent : null,
      simulated_only: true,
      external_ads_api_called: false,
      external_budget_changed: false,
      external_campaign_paused: false,
    },
    resultSummary: `Sandbox simulated ad budget change from ${beforeState.budget} to ${afterState.budget} ${afterState.currency || ''}. No ad platform API was called.`,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rollbackSupported: true,
    rollbackPayload: {
      sandbox_fake_external_action_id: fakeActionId,
      rollback_type: 'sandbox_noop_restore_budget_simulation',
      fake_restore_state: beforeState,
      external_ads_api_called: false,
      external_budget_changed: false,
    },
    executedAt: now(),
  };
}

export async function executeSandboxAdsPause(
  context: PauseContext,
): Promise<ExecutorExecuteResult<SandboxAdsExecutorResult>> {
  const validation = await validateSandboxAdsPause(context);
  const beforeState = buildPauseBeforeState(context.payload);
  const afterState = buildPauseAfterState(context.payload);

  if (!validation.ok) {
    return {
      ok: false,
      status: 'failed',
      executorName: SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
      mode: 'sandbox',
      result: {
        sandbox_success: false,
        fake_external_action_id: 'sandbox-ads-pause-validation-failed',
        fake_audit_permalink: 'https://sandbox.lifesaveragent.com/ads/validation-failed',
        fake_before_state: beforeState,
        fake_after_state: beforeState,
        simulated_action: 'pause',
        platform: String(context.payload.data.platform || 'unknown'),
        change_amount: null,
        change_percent: null,
        simulated_only: true,
        external_ads_api_called: false,
        external_budget_changed: false,
        external_campaign_paused: false,
      },
      resultSummary: `Sandbox ad pause validation failed: ${validation.errors.join(' ')}`,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rollbackSupported: false,
      rollbackPayload: null,
      executedAt: now(),
    };
  }

  const fakeActionId = buildFakeAdsActionId(context, 'pause');
  const fakeAuditPermalink = buildFakeAuditPermalink(context, fakeActionId);

  return {
    ok: true,
    status: 'executed',
    executorName: SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
    mode: 'sandbox',
    result: {
      sandbox_success: true,
      fake_external_action_id: fakeActionId,
      fake_audit_permalink: fakeAuditPermalink,
      fake_before_state: beforeState,
      fake_after_state: afterState,
      simulated_action: 'pause',
      platform: context.payload.data.platform,
      change_amount: null,
      change_percent: null,
      simulated_only: true,
      external_ads_api_called: false,
      external_budget_changed: false,
      external_campaign_paused: false,
    },
    resultSummary: `Sandbox simulated ad pause from ${beforeState.status} to ${afterState.status}. No ad platform API was called.`,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rollbackSupported: true,
    rollbackPayload: {
      sandbox_fake_external_action_id: fakeActionId,
      rollback_type: 'sandbox_noop_restore_ad_status_simulation',
      fake_restore_state: beforeState,
      external_ads_api_called: false,
      external_campaign_paused: false,
    },
    executedAt: now(),
  };
}

export async function rollbackSandboxAdsBudgetAdjust(
  _context: BudgetContext,
  result: ExecutorExecuteResult<SandboxAdsExecutorResult>,
): Promise<ExecutorRollbackResult> {
  return {
    ok: true,
    status: result.ok ? 'rolled_back' : 'rollback_not_supported',
    executorName: SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
    mode: 'sandbox',
    resultSummary: result.ok
      ? `Sandbox rollback simulated for fake ads budget action ${result.result.fake_external_action_id}. No budget was restored in any ad platform.`
      : 'Sandbox rollback was not needed because the sandbox ad budget execution did not succeed.',
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rolledBackAt: now(),
  };
}

export async function rollbackSandboxAdsPause(
  _context: PauseContext,
  result: ExecutorExecuteResult<SandboxAdsExecutorResult>,
): Promise<ExecutorRollbackResult> {
  return {
    ok: true,
    status: result.ok ? 'rolled_back' : 'rollback_not_supported',
    executorName: SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
    mode: 'sandbox',
    resultSummary: result.ok
      ? `Sandbox rollback simulated for fake ads pause action ${result.result.fake_external_action_id}. No campaign/adset/ad status was restored in any ad platform.`
      : 'Sandbox rollback was not needed because the sandbox ad pause execution did not succeed.',
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
    rolledBackAt: now(),
  };
}

export function summarizeSandboxAdsResult(
  result: ExecutorExecuteResult<SandboxAdsExecutorResult> | ExecutorRollbackResult,
): ExecutorResultSummary {
  return {
    title: result.status === 'rolled_back' ? 'Sandbox ads rollback simulated' : 'Sandbox ads action simulated',
    status: result.status,
    message: result.resultSummary,
    safeForFounderDisplay: true,
    externalWritesAttempted: false,
    externalWritesSucceeded: false,
  };
}

export const sandboxAdsBudgetExecutor: LifeSaverExecutor<SandboxAdsBudgetExecutorPayload, SandboxAdsExecutorResult> = {
  name: SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
  actionType: 'ad_budget_adjust',
  mode: 'sandbox',
  realExternalWriteEnabled: false,
  sandboxOnly: true,
  validate: validateSandboxAdsBudgetAdjust,
  execute: executeSandboxAdsBudgetAdjust,
  rollback: rollbackSandboxAdsBudgetAdjust,
  summarizeResult: summarizeSandboxAdsResult,
};

export const sandboxAdsPauseExecutor: LifeSaverExecutor<SandboxAdsPauseExecutorPayload, SandboxAdsExecutorResult> = {
  name: SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
  actionType: 'ad_pause',
  mode: 'sandbox',
  realExternalWriteEnabled: false,
  sandboxOnly: true,
  validate: validateSandboxAdsPause,
  execute: executeSandboxAdsPause,
  rollback: rollbackSandboxAdsPause,
  summarizeResult: summarizeSandboxAdsResult,
};

export function buildSandboxAdsExecutorSafetySummary(): {
  version: '0.6.0';
  phase: typeof SANDBOX_ADS_EXECUTOR_PHASE;
  budgetExecutorName: typeof SANDBOX_ADS_BUDGET_EXECUTOR_NAME;
  pauseExecutorName: typeof SANDBOX_ADS_PAUSE_EXECUTOR_NAME;
  actionTypes: ['ad_budget_adjust', 'ad_pause'];
  interfacePhase: typeof EXECUTOR_INTERFACE_PHASE;
  returnsFakeBeforeState: true;
  returnsFakeAfterState: true;
  returnsSandboxSuccess: true;
  sandboxOnly: true;
  realExternalWriteEnabled: false;
  externalWritesEnabled: false;
  externalWritesAttempted: false;
  autoRunEnabled: false;
  wiredToActionFlow: false;
  adsApiCalled: false;
  realBudgetChanged: false;
  realCampaignPaused: false;
  note: string;
} {
  return {
    version: '0.6.0',
    phase: SANDBOX_ADS_EXECUTOR_PHASE,
    budgetExecutorName: SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
    pauseExecutorName: SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
    actionTypes: ['ad_budget_adjust', 'ad_pause'],
    interfacePhase: EXECUTOR_INTERFACE_PHASE,
    returnsFakeBeforeState: true,
    returnsFakeAfterState: true,
    returnsSandboxSuccess: true,
    sandboxOnly: true,
    realExternalWriteEnabled: false,
    externalWritesEnabled: false,
    externalWritesAttempted: false,
    autoRunEnabled: false,
    wiredToActionFlow: false,
    adsApiCalled: false,
    realBudgetChanged: false,
    realCampaignPaused: false,
    note: 'Phase 8.5 implements sandbox ads executors for budget adjustment and pause simulations only. They return fake before/after state and sandbox_success without touching Meta, Google, TikTok, Snapchat, or any ad platform API.',
  };
}
