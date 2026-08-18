import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_MANUAL_OVERRIDE_HEALTH_MODE,
  CONTENT_MANUAL_OVERRIDE_PHASE,
  assertContentManualOverrideSafe,
  buildContentManualOverrideDisableResult,
  buildContentManualOverridePreview,
  buildContentManualOverrideSafety,
  buildContentManualOverrideStatus,
} from './content-manual-override.model.js';
import type { AutonomyUpdateResponse } from '../autonomy/autonomy.types.js';

function fakeAutonomyUpdate(): AutonomyUpdateResponse {
  return {
    version: '0.6.0',
    phase: 'v0.6.0 Phase 5.9 Emergency Safe Mode',
    workspaceId: 'workspace_123',
    operation: 'pause',
    scope: 'content',
    reason: 'Founder manual override',
    status: {
      workspaceId: 'workspace_123',
      pauseAllAutonomy: false,
      pauseContentActions: true,
      pauseSupportActions: false,
      pauseAdsActions: false,
      pauseResearchActions: false,
      pauseDevActions: false,
      updatedBy: 'user_123',
      updatedAt: '2026-07-06T12:00:00.000Z',
      enforcement: {
        autoApprovalAllowed: true,
        executorExecutionAllowed: true,
        proposedActionCreationAllowed: true,
        manualReviewAllowed: true,
        reason: 'content category pause is active.',
      },
      categories: {
        content: { paused: true, autoApprovalAllowed: false, executorExecutionAllowed: false, reason: 'content category pause is active.' },
        support: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'support category pause is not active.' },
        ads: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ads category pause is not active.' },
        research: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'research category pause is not active.' },
        dev: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'dev category pause is not active.' },
      },
      emergencySafeMode: {
        version: '0.6.0',
        phase: 'v0.6.0 Phase 5.9 Emergency Safe Mode',
        active: false,
        source: 'environment',
        envKey: 'EMERGENCY_SAFE_MODE',
        reason: null,
        adminWarningVisible: false,
        executionBlocked: false,
        autoApprovalAllowed: false,
        executorExecutionAllowed: false,
        proposedActionCreationAllowed: true,
        manualReviewAllowed: true,
        checkedAt: '2026-07-06T12:00:00.000Z',
        safety: {
          externalWritesAttempted: false,
          executorRan: false,
          resumeDoesNotExecuteWaitingActions: true,
          note: 'Emergency safe mode is not active.',
        },
      },
      safety: {
        canAutoApprove: false,
        canExecute: false,
        canWriteExternally: false,
        note: 'Safe test state.',
      },
    },
    changed: {
      pauseAllAutonomy: false,
      pauseContentActions: true,
      pauseSupportActions: false,
      pauseAdsActions: false,
      pauseResearchActions: false,
      pauseDevActions: false,
    },
    execution: {
      queued: false,
      executed: false,
      executorEnabled: false,
      externalWritesEnabled: false,
      note: 'Pause update stored only.',
    },
    safety: {
      noAutoApproval: true,
      noExecutorExecution: true,
      proposedActionsStillReviewable: true,
      newProposedActionsMayStillBeCreatedSafely: true,
    },
    audit: {
      eventLogged: true,
      eventType: 'autonomy_pause_enabled',
      categoryAffected: 'content',
      actorUserId: 'user_123',
      reason: 'Founder manual override',
      storage: 'system_events',
      externalWritesTriggered: false,
    },
  };
}

test('Phase 11.9 constants are correct', () => {
  assert.equal(CONTENT_MANUAL_OVERRIDE_PHASE, 'phase_11_9_manual_override');
  assert.equal(CONTENT_MANUAL_OVERRIDE_HEALTH_MODE, 'v2-phase-11-9-manual-override');
});

test('safety flags disable only content auto-run and do not publish', () => {
  const safety = buildContentManualOverrideSafety();
  assert.equal(safety.manualOverrideOnly, true);
  assert.equal(safety.disablesContentAutoRunOnly, true);
  assert.equal(safety.doesNotPublish, true);
  assert.equal(safety.externalApiCalled, false);
});

test('status describes manual override control and endpoints', () => {
  const status = buildContentManualOverrideStatus();
  assert.equal(status.deliverable, 'manual_override_control');
  assert.equal(status.controls.disable, 'POST /api/v1/content-auto-run/manual-override/disable');
  assert.equal(status.permissionRequired.roles.includes('owner'), true);
  assert.equal(status.permissionRequired.roles.includes('admin'), true);
  assert.doesNotThrow(() => assertContentManualOverrideSafe(status));
});

test('preview recommends disabling active content auto-run', () => {
  const result = buildContentManualOverridePreview({ contentAutoRunEnabled: true, pauseContentActions: false });
  assert.equal(result.decision, 'preview_only');
  assert.equal(result.wouldDisableContentAutoRun, true);
  assert.equal(result.after.contentAutoRunEnabled, false);
  assert.equal(result.after.pauseContentActions, true);
  assert.doesNotThrow(() => assertContentManualOverrideSafe(result));
});

test('preview reports already disabled when content pause is active', () => {
  const result = buildContentManualOverridePreview({ pauseContentActions: true });
  assert.equal(result.decision, 'already_disabled');
  assert.equal(result.wouldDisableContentAutoRun, false);
});

test('preview reports already disabled when master pause is active', () => {
  const result = buildContentManualOverridePreview({ pauseAllAutonomy: true });
  assert.equal(result.decision, 'already_disabled');
});

test('preview reports already disabled when emergency safe mode is active', () => {
  const result = buildContentManualOverridePreview({ emergencySafeModeActive: true });
  assert.equal(result.decision, 'already_disabled');
});

test('disable result wraps autonomy content pause safely', () => {
  const result = buildContentManualOverrideDisableResult({
    workspaceId: 'workspace_123',
    actorUserId: 'user_123',
    reason: 'Founder manual override',
    autonomyUpdate: fakeAutonomyUpdate(),
  });
  assert.equal(result.operation, 'disable');
  assert.equal(result.decision, 'content_auto_run_disabled');
  assert.equal(result.autonomyPauseStored, true);
  assert.equal(result.auditEventStored, true);
  assert.equal(result.autonomyUpdate.scope, 'content');
  assert.equal(result.autonomyUpdate.execution.executed, false);
  assert.equal(result.autonomyUpdate.execution.externalWritesEnabled, false);
  assert.doesNotThrow(() => assertContentManualOverrideSafe(result));
});

test('disable result preserves no waiting action execution safety', () => {
  const result = buildContentManualOverrideDisableResult({
    workspaceId: 'workspace_123',
    actorUserId: 'user_123',
    reason: 'Stop now',
    autonomyUpdate: fakeAutonomyUpdate(),
  });
  assert.equal(result.after.noWaitingActionExecuted, true);
  assert.equal(result.safety.resumeDoesNotExecuteWaitingActions, true);
});

test('reason is normalized and bounded', () => {
  const longReason = `Line\n${'x'.repeat(900)}`;
  const result = buildContentManualOverrideDisableResult({
    workspaceId: 'workspace_123',
    actorUserId: 'user_123',
    reason: longReason,
    autonomyUpdate: fakeAutonomyUpdate(),
  });
  assert.equal(result.reason.includes('\n'), false);
  assert.equal(result.reason.length <= 700, true);
});

test('safe assertion rejects secret-like content', () => {
  const result = buildContentManualOverridePreview({ contentAutoRunEnabled: true });
  result.reason = 'contains access_token accidentally';
  assert.throws(() => assertContentManualOverrideSafe(result), /forbidden fragment/);
});

test('manual override does not expose raw action payload fields', () => {
  const result = buildContentManualOverridePreview({ contentAutoRunEnabled: true });
  const text = JSON.stringify(result).toLowerCase();
  assert.equal(text.includes('payload_json'), false);
  assert.equal(text.includes('rollback_payload'), false);
  assert.equal(text.includes('encrypted_'), false);
});
