import { EXECUTOR_INTERFACE_PHASE, type ExecutorActionContext } from './executor.interface.js';
import { buildExecutorRegistrySafetySummary, getRegisteredExecutorEntry, resolveExecutorHandlerKey } from './executor.registry.js';
import {
  SANDBOX_ADS_BUDGET_EXECUTOR_NAME,
  SANDBOX_ADS_PAUSE_EXECUTOR_NAME,
  buildSandboxAdsExecutorSafetySummary,
  sandboxAdsBudgetExecutor,
  sandboxAdsPauseExecutor,
  type SandboxAdsBudgetExecutorPayload,
  type SandboxAdsPauseExecutorPayload,
} from './sandbox-ads.executor.js';

function sampleBudgetPayload(): SandboxAdsBudgetExecutorPayload {
  return {
    schema_version: 'action-payload/v0.6.0',
    action_type: 'ad_budget_adjust',
    source: 'system',
    intent_summary: 'Sandbox ad budget adjustment simulation only.',
    created_reason: 'Phase 8.5 sandbox ads executor test.',
    risk_notes: ['No external write', 'Fake before/after budget state only'],
    idempotency_hint: 'phase-8-5-sandbox-ads-budget-test',
    data: {
      platform: 'meta_ads',
      campaign_id: 'campaign-123',
      current_budget: 100,
      proposed_budget: 125,
      change_amount: 25,
      currency: 'USD',
      account_id_hint: 'sandbox-meta-account',
      adset_id: 'adset-456',
      current_budget_period: 'daily',
      proposed_budget_period: 'daily',
      change_percent: 25,
      reason: 'Sandbox ROAS improvement test only.',
      metric_window: 'last_24_hours',
      performance_snapshot: { roas: 2.4, spend: 100 },
      rollback_budget: 100,
      approval_notes: 'Test payload only. Must not change ad spend externally.',
    },
  } as SandboxAdsBudgetExecutorPayload;
}

function samplePausePayload(): SandboxAdsPauseExecutorPayload {
  return {
    schema_version: 'action-payload/v0.6.0',
    action_type: 'ad_pause',
    source: 'system',
    intent_summary: 'Sandbox ad pause simulation only.',
    created_reason: 'Phase 8.5 sandbox ads pause executor test.',
    risk_notes: ['No external write', 'Fake before/after pause state only'],
    idempotency_hint: 'phase-8-5-sandbox-ads-pause-test',
    data: {
      platform: 'google_ads',
      target_level: 'campaign',
      target_id: 'campaign-999',
      current_status: 'active',
      proposed_status: 'paused',
      reason: 'Sandbox test pause because spend exceeded threshold.',
      account_id_hint: 'sandbox-google-account',
      campaign_id: 'campaign-999',
      metric_window: 'last_24_hours',
      performance_snapshot: { roas: 0.7, spend: 250 },
      rollback_status: 'active',
      approval_notes: 'Test payload only. Must not pause a real campaign.',
    },
  } as SandboxAdsPauseExecutorPayload;
}

function budgetContext(payload = sampleBudgetPayload()): ExecutorActionContext<SandboxAdsBudgetExecutorPayload> {
  return {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    workspaceId: '00000000-0000-0000-0000-000000000101',
    actionId: '00000000-0000-0000-0000-000000000505',
    actionType: 'ad_budget_adjust',
    riskLevel: 'high',
    requestedByUserId: '00000000-0000-0000-0000-000000000303',
    approvedByUserId: null,
    idempotencyKey: 'phase-8-5-sandbox-ads-budget-idempotency',
    policyDecision: 'ask',
    payload,
    metadata: { source: 'executor.sandbox-ads-tests' },
  };
}

function pauseContext(payload = samplePausePayload()): ExecutorActionContext<SandboxAdsPauseExecutorPayload> {
  return {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    workspaceId: '00000000-0000-0000-0000-000000000101',
    actionId: '00000000-0000-0000-0000-000000000606',
    actionType: 'ad_pause',
    riskLevel: 'high',
    requestedByUserId: '00000000-0000-0000-0000-000000000303',
    approvedByUserId: null,
    idempotencyKey: 'phase-8-5-sandbox-ads-pause-idempotency',
    policyDecision: 'ask',
    payload,
    metadata: { source: 'executor.sandbox-ads-tests' },
  };
}

async function main() {
  const safety = buildSandboxAdsExecutorSafetySummary();
  const registrySafety = buildExecutorRegistrySafetySummary();
  const budgetRegistryEntry = getRegisteredExecutorEntry('ad_budget_adjust');
  const pauseRegistryEntry = getRegisteredExecutorEntry('ad_pause');

  const budgetValidation = await sandboxAdsBudgetExecutor.validate(budgetContext());
  const budgetExecution = await sandboxAdsBudgetExecutor.execute(budgetContext());
  const budgetRollback = await sandboxAdsBudgetExecutor.rollback(budgetContext(), budgetExecution);
  const budgetSummary = sandboxAdsBudgetExecutor.summarizeResult(budgetExecution);

  const pauseValidation = await sandboxAdsPauseExecutor.validate(pauseContext());
  const pauseExecution = await sandboxAdsPauseExecutor.execute(pauseContext());
  const pauseRollback = await sandboxAdsPauseExecutor.rollback(pauseContext(), pauseExecution);
  const pauseSummary = sandboxAdsPauseExecutor.summarizeResult(pauseExecution);

  const invalidBudgetPayload = sampleBudgetPayload();
  invalidBudgetPayload.data.proposed_budget = -1;
  const invalidBudgetExecution = await sandboxAdsBudgetExecutor.execute(budgetContext(invalidBudgetPayload));

  const invalidPausePayload = samplePausePayload();
  invalidPausePayload.data.reason = '';
  const invalidPauseExecution = await sandboxAdsPauseExecutor.execute(pauseContext(invalidPausePayload));

  const assertions = [
    { name: 'phase_is_8_5_sandbox_ads_executor', pass: safety.phase === 'v0.6.0 Phase 8.5 Sandbox Ads Executor' },
    { name: 'budget_executor_name_is_sandbox_ads_budget_executor', pass: sandboxAdsBudgetExecutor.name === SANDBOX_ADS_BUDGET_EXECUTOR_NAME },
    { name: 'pause_executor_name_is_sandbox_ads_pause_executor', pass: sandboxAdsPauseExecutor.name === SANDBOX_ADS_PAUSE_EXECUTOR_NAME },
    { name: 'budget_executor_implements_ad_budget_adjust', pass: sandboxAdsBudgetExecutor.actionType === 'ad_budget_adjust' },
    { name: 'pause_executor_implements_ad_pause', pass: sandboxAdsPauseExecutor.actionType === 'ad_pause' },
    { name: 'registry_maps_ad_budget_to_sandbox_ads_budget_executor', pass: resolveExecutorHandlerKey('ad_budget_adjust') === SANDBOX_ADS_BUDGET_EXECUTOR_NAME },
    { name: 'registry_maps_ad_pause_to_sandbox_ads_pause_executor', pass: resolveExecutorHandlerKey('ad_pause') === SANDBOX_ADS_PAUSE_EXECUTOR_NAME },
    { name: 'ads_registry_entries_mark_handler_implementations_included', pass: budgetRegistryEntry.handlerImplementationIncluded === true && pauseRegistryEntry.handlerImplementationIncluded === true },
    { name: 'registry_keeps_auto_run_disabled', pass: registrySafety.executorAutoRunEnabled === false && budgetRegistryEntry.executionEnabled === false && pauseRegistryEntry.executionEnabled === false },
    { name: 'budget_validation_accepts_valid_payload', pass: budgetValidation.ok === true && budgetValidation.externalWritesAllowed === false },
    { name: 'budget_execute_returns_sandbox_success', pass: budgetExecution.ok === true && budgetExecution.result.sandbox_success === true },
    { name: 'budget_execute_returns_fake_before_after_state', pass: budgetExecution.result.fake_before_state.budget === 100 && budgetExecution.result.fake_after_state.budget === 125 },
    { name: 'budget_execute_does_not_attempt_external_write', pass: budgetExecution.externalWritesAttempted === false && budgetExecution.result.external_ads_api_called === false && budgetExecution.result.external_budget_changed === false },
    { name: 'budget_rollback_is_sandbox_only', pass: budgetRollback.status === 'rolled_back' && budgetRollback.externalWritesAttempted === false },
    { name: 'pause_validation_accepts_valid_payload', pass: pauseValidation.ok === true && pauseValidation.externalWritesAllowed === false },
    { name: 'pause_execute_returns_sandbox_success', pass: pauseExecution.ok === true && pauseExecution.result.sandbox_success === true },
    { name: 'pause_execute_returns_fake_before_after_state', pass: pauseExecution.result.fake_before_state.status === 'active' && pauseExecution.result.fake_after_state.status === 'paused' },
    { name: 'pause_execute_does_not_attempt_external_write', pass: pauseExecution.externalWritesAttempted === false && pauseExecution.result.external_ads_api_called === false && pauseExecution.result.external_campaign_paused === false },
    { name: 'pause_rollback_is_sandbox_only', pass: pauseRollback.status === 'rolled_back' && pauseRollback.externalWritesAttempted === false },
    { name: 'summaries_safe_for_founder_display', pass: budgetSummary.safeForFounderDisplay === true && pauseSummary.safeForFounderDisplay === true },
    { name: 'invalid_budget_payload_fails_without_external_write', pass: invalidBudgetExecution.ok === false && invalidBudgetExecution.externalWritesAttempted === false },
    { name: 'invalid_pause_payload_fails_without_external_write', pass: invalidPauseExecution.ok === false && invalidPauseExecution.externalWritesAttempted === false },
    { name: 'safety_says_not_wired_to_action_flow', pass: safety.wiredToActionFlow === false && safety.autoRunEnabled === false && safety.adsApiCalled === false },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 8.5 Sandbox Ads Executor',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety,
    registrySafety,
    samples: {
      budgetValidation,
      budgetExecution,
      budgetRollback,
      budgetSummary,
      pauseValidation,
      pauseExecution,
      pauseRollback,
      pauseSummary,
      invalidBudgetExecution,
      invalidPauseExecution,
    },
    safetyNote: 'Phase 8.5 simulates ad budget and ad pause actions only. It returns fake before state, fake after state, and sandbox_success without touching Meta Ads, Google Ads, TikTok Ads, Snapchat Ads, stores, email, or any external API.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
