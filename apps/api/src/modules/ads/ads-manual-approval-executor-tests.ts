import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAdsBudgetChangeExamplePayload } from './ads-budget-change-payload.model.js';
import { buildAdsHardCapsExample, buildAdsHardCapsExampleUsage } from './ads-hard-caps.model.js';
import {
  ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE,
  ADS_MANUAL_APPROVAL_EXECUTOR_NAME,
  ADS_MANUAL_APPROVAL_EXECUTOR_PACKAGE,
  ADS_MANUAL_APPROVAL_EXECUTOR_PHASE,
  assertAdsManualApprovalExecutorSafe,
  buildAdsManualApprovalBlockedEvenIfRequested,
  buildAdsManualApprovalExampleInput,
  buildAdsManualApprovalExecutionGates,
  buildAdsManualApprovalExecutorReport,
  buildAdsManualApprovalExecutorSafety,
  buildAdsManualApprovalExecutorStatus,
  buildAdsManualApprovalRequiredEvidence,
  evaluateAdsManualApprovalExecutorGate,
} from './ads-manual-approval-executor.model.js';

test('Phase 14.6 constants are correct', () => {
  assert.equal(ADS_MANUAL_APPROVAL_EXECUTOR_PHASE, 'phase_14_6_manual_approval_only');
  assert.equal(ADS_MANUAL_APPROVAL_EXECUTOR_HEALTH_MODE, 'v2-phase-14-6-manual-approval-only');
  assert.equal(ADS_MANUAL_APPROVAL_EXECUTOR_PACKAGE, 'lifesaver-v0.7.0-phase-14-6-manual-approval-only.zip');
  assert.equal(ADS_MANUAL_APPROVAL_EXECUTOR_NAME, 'manualApprovalOnlyAdsExecutorGate');
});

test('status reports manual approval only and no provider API behavior', () => {
  const status = buildAdsManualApprovalExecutorStatus();
  assert.equal(status.manualApprovalRequiredForEveryAdsAction, true);
  assert.equal(status.autoApprovalAccepted, false);
  assert.equal(status.forceBypassAllowed, false);
  assert.equal(status.providerApiClientAdded, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.equal(status.budgetChanged, false);
  assert.equal(status.adsAutoRunEnabled, false);
});

test('safety object confirms executor shell but no external write capability', () => {
  const safety = buildAdsManualApprovalExecutorSafety();
  assert.equal(safety.executorShellAdded, true);
  assert.equal(safety.manualApprovalOnly, true);
  assert.equal(safety.noMetaAdsApiClientAdded, true);
  assert.equal(safety.noGoogleAdsApiClientAdded, true);
  assert.equal(safety.noExternalAdApiCalled, true);
  assert.equal(safety.noBudgetChanged, true);
  assert.equal(safety.noCampaignPaused, true);
  assert.equal(safety.noCampaignReenabled, true);
  assert.equal(safety.noAdsAutoRunEnabled, true);
});

test('required approval evidence covers actor, timestamp, event, method, and rejects auto approval', () => {
  const evidence = buildAdsManualApprovalRequiredEvidence().join(' ').toLowerCase();
  assert.match(evidence, /status/);
  assert.match(evidence, /actor/);
  assert.match(evidence, /timestamp/);
  assert.match(evidence, /event/);
  assert.match(evidence, /founder_manual/);
  assert.match(evidence, /auto_approved/);
});

test('execution gates include pause, emergency, hard caps, snapshots, logs, idempotency, rollback', () => {
  const gates = buildAdsManualApprovalExecutionGates().join(' ').toLowerCase();
  assert.match(gates, /master pause/);
  assert.match(gates, /ads category pause/);
  assert.match(gates, /emergency safe mode/);
  assert.match(gates, /hard caps/);
  assert.match(gates, /before\/after snapshots/);
  assert.match(gates, /result logs/);
  assert.match(gates, /idempotency/);
  assert.match(gates, /rollback/);
});

test('blocked list explicitly forbids auto approval, force bypass, provider API calls, and raw tokens', () => {
  const blocked = buildAdsManualApprovalBlockedEvenIfRequested().join(' ').toLowerCase();
  assert.match(blocked, /auto-approved/);
  assert.match(blocked, /force=true/);
  assert.match(blocked, /provider api/);
  assert.match(blocked, /raw oauth tokens/);
});

test('approved budget action with manual evidence and caps is ready for executor shell only', () => {
  const result = evaluateAdsManualApprovalExecutorGate(buildAdsManualApprovalExampleInput());
  assert.equal(result.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.readyForFutureProviderClient, true);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
  assert.equal(result.manualApprovalRequired, true);
  assert.equal(result.autoRunAllowed, false);
  assert.equal(result.checks.statusApproved, true);
  assert.equal(result.checks.manualApprovalActorPresent, true);
  assert.equal(result.checks.manualApprovalEventPresent, true);
  assert.equal(result.checks.hardCapsNotExceeded, true);
  assert.equal(result.hardCapsEvaluation?.allowed, true);
  assert.equal(result.safety.noExternalAdApiCalled, true);
  assert.doesNotThrow(() => assertAdsManualApprovalExecutorSafe(result));
});

test('auto approved ads action is blocked in first release', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    status: 'auto_approved',
    approval: { ...input.approval, approval_method: 'policy_auto' },
  });
  assert.equal(result.decision, 'blocked_auto_approval_not_allowed');
  assert.equal(result.readyForFutureProviderClient, false);
});

test('proposed ads action is blocked until approved', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, status: 'proposed' });
  assert.equal(result.decision, 'blocked_invalid_status');
  assert.equal(result.checks.statusApproved, false);
});

test('missing approval actor blocks execution gate', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    approval: { ...input.approval, approved_by_user_id: '', approval_event_actor_id: '' },
  });
  assert.equal(result.decision, 'blocked_manual_approval_required');
  assert.equal(result.checks.manualApprovalActorPresent, false);
});

test('missing approval event blocks execution gate', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    approval: { ...input.approval, approval_event_exists: false },
  });
  assert.equal(result.decision, 'blocked_manual_approval_required');
  assert.equal(result.checks.manualApprovalEventPresent, false);
});

test('system approval method is not accepted for ads executor first release', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    approval: { ...input.approval, approval_method: 'system' },
  });
  assert.equal(result.decision, 'blocked_manual_approval_required');
  assert.equal(result.checks.manualApprovalMethodValid, false);
});

test('force flag is ignored and does not bypass approval gate', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    force: true,
  });
  assert.equal(result.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.checks.forceIgnored, true);
  assert.match(result.warnings.join(' '), /force=true/);
});

test('force flag cannot bypass missing approval evidence', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    force: true,
    approval: { approved_by_user_id: '', approved_at: '', approval_event_exists: false, approval_method: 'system' },
  });
  assert.equal(result.decision, 'blocked_manual_approval_required');
  assert.equal(result.checks.forceIgnored, true);
});

test('master pause blocks ads action', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, pause: { ...input.pause, master_pause_active: true } });
  assert.equal(result.decision, 'blocked_master_pause_active');
  assert.equal(result.checks.masterPauseOff, false);
});

test('ads category pause blocks ads action', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, pause: { ...input.pause, ads_pause_active: true } });
  assert.equal(result.decision, 'blocked_ads_pause_active');
  assert.equal(result.checks.adsPauseOff, false);
});

test('emergency safe mode blocks ads action', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, pause: { ...input.pause, emergency_safe_mode_active: true } });
  assert.equal(result.decision, 'blocked_emergency_safe_mode');
  assert.equal(result.checks.emergencySafeModeOff, false);
});

test('budget action requires hard caps and usage', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, hard_caps: undefined, hard_caps_usage: undefined });
  assert.equal(result.decision, 'blocked_hard_caps_required');
  assert.equal(result.checks.hardCapsPresentForBudgetAction, false);
});

test('budget action blocks invalid payload', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, budget_payload: { platform: 'triple_whale' } });
  assert.equal(result.decision, 'blocked_invalid_budget_payload');
  assert.equal(result.checks.budgetPayloadValidWhenRequired, false);
});

test('budget action blocks when hard caps are exceeded', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    hard_caps_usage: { daily_budget_change_used: 95, changes_today: 1 },
  });
  assert.equal(result.decision, 'blocked_by_hard_cap');
  assert.equal(result.checks.hardCapsNotExceeded, false);
});

test('pause_campaign can pass manual gate without budget payload but still cannot call provider API', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    action_type: 'pause_campaign',
    budget_payload: undefined,
    hard_caps: undefined,
    hard_caps_usage: undefined,
  });
  assert.equal(result.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.normalizedBudgetPayload, null);
  assert.equal(result.allowedToCallProviderApiThisPhase, false);
  assert.equal(result.safety.noCampaignPaused, true);
});

test('pause_adset can pass manual gate without budget payload but still cannot pause ad set', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    action_type: 'pause_adset',
    budget_payload: undefined,
    hard_caps: undefined,
    hard_caps_usage: undefined,
  });
  assert.equal(result.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.safety.noAdsetPaused, true);
});

test('reenable_campaign can pass manual gate but still cannot re-enable campaign', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({
    ...input,
    action_type: 'reenable_campaign',
    budget_payload: undefined,
    hard_caps: undefined,
    hard_caps_usage: undefined,
  });
  assert.equal(result.decision, 'ready_for_manual_executor_shell');
  assert.equal(result.safety.noCampaignReenabled, true);
});

test('unsupported action type is blocked', () => {
  const input = buildAdsManualApprovalExampleInput();
  const result = evaluateAdsManualApprovalExecutorGate({ ...input, action_type: 'refund_order' });
  assert.equal(result.decision, 'blocked_invalid_action_type');
  assert.equal(result.checks.actionTypeSupported, false);
});

test('report includes all roadmap ads action types', () => {
  const report = buildAdsManualApprovalExecutorReport();
  for (const actionType of ['pause_campaign', 'pause_adset', 'adjust_budget', 'restore_budget', 'reenable_campaign']) {
    assert.ok(report.supportedActionTypes.includes(actionType as never));
  }
  assert.equal(report.nextStep, 'Phase 14.7 — Before/After Snapshot');
});

test('report is safe and contains no secret/provider payload fragments', () => {
  const report = buildAdsManualApprovalExecutorReport();
  assert.doesNotThrow(() => assertAdsManualApprovalExecutorSafe(report.exampleEvaluation));
  assert.equal(JSON.stringify(report).toLowerCase().includes('refresh_token'), false);
  assert.equal(JSON.stringify(report).toLowerCase().includes('authorization: bearer'), false);
});

test('safe assertion rejects secret-like output', () => {
  assert.throws(() => assertAdsManualApprovalExecutorSafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
});

test('example budget payload remains valid under manual approval gate', () => {
  const result = evaluateAdsManualApprovalExecutorGate({
    ...buildAdsManualApprovalExampleInput(),
    budget_payload: buildAdsBudgetChangeExamplePayload(),
    hard_caps: buildAdsHardCapsExample(),
    hard_caps_usage: buildAdsHardCapsExampleUsage(),
  });
  assert.equal(result.normalizedBudgetPayload?.action_type, 'adjust_budget');
  assert.equal(result.normalizedBudgetPayload?.manual_approval_required, true);
});
