import type { ContentPublishPayload } from '@lifesaver/shared';
import { EXECUTOR_INTERFACE_PHASE, type ExecutorActionContext } from './executor.interface.js';
import { buildExecutorRegistrySafetySummary, getRegisteredExecutorEntry, resolveExecutorHandlerKey } from './executor.registry.js';
import {
  SANDBOX_CONTENT_EXECUTOR_NAME,
  buildSandboxContentExecutorSafetySummary,
  sandboxContentExecutor,
  type SandboxContentExecutorPayload,
} from './sandbox-content.executor.js';

function samplePayload(): SandboxContentExecutorPayload {
  return {
    schema_version: 'action-payload/v0.6.0',
    action_type: 'content_publish',
    source: 'system',
    intent_summary: 'Sandbox Instagram post simulation only.',
    created_reason: 'Phase 8.3 sandbox content executor test.',
    risk_notes: ['No external write', 'Fake permalink only'],
    idempotency_hint: 'phase-8-3-sandbox-content-test',
    data: {
      platform: 'instagram',
      caption: 'Certainly, sir. Today’s post is simulated inside the LIFE.SAVER sandbox only.',
      post_type: 'image',
      media_url: 'https://example.test/sandbox-preview.png',
      hashtags: ['lifesaver', 'sandbox'],
      scheduled_time: null,
      account_id_hint: 'sandbox-instagram-account',
      call_to_action_url: null,
      approval_notes: 'Test payload only. Must not publish externally.',
    },
  } as SandboxContentExecutorPayload;
}

function sampleContext(payload = samplePayload()): ExecutorActionContext<SandboxContentExecutorPayload> {
  return {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    workspaceId: '00000000-0000-0000-0000-000000000101',
    actionId: '00000000-0000-0000-0000-000000000202',
    actionType: 'content_publish',
    riskLevel: 'low',
    requestedByUserId: '00000000-0000-0000-0000-000000000303',
    approvedByUserId: null,
    idempotencyKey: 'phase-8-3-sandbox-content-idempotency',
    policyDecision: 'ask',
    payload,
    metadata: { source: 'executor.sandbox-content-tests' },
  };
}

async function main() {
  const safety = buildSandboxContentExecutorSafetySummary();
  const registrySafety = buildExecutorRegistrySafetySummary();
  const contentRegistryEntry = getRegisteredExecutorEntry('content_publish');
  const context = sampleContext();
  const validation = await sandboxContentExecutor.validate(context);
  const execution = await sandboxContentExecutor.execute(context);
  const rollback = await sandboxContentExecutor.rollback(context, execution);
  const executionSummary = sandboxContentExecutor.summarizeResult(execution);
  const rollbackSummary = sandboxContentExecutor.summarizeResult(rollback);

  const invalidPayload = samplePayload();
  invalidPayload.data.caption = '';
  const invalidExecution = await sandboxContentExecutor.execute(sampleContext(invalidPayload));

  const assertions = [
    { name: 'phase_is_8_3_sandbox_content_executor', pass: safety.phase === 'v0.6.0 Phase 8.3 Sandbox Content Executor' },
    { name: 'executor_name_is_sandbox_content_executor', pass: sandboxContentExecutor.name === SANDBOX_CONTENT_EXECUTOR_NAME },
    { name: 'executor_implements_content_publish', pass: sandboxContentExecutor.actionType === 'content_publish' },
    { name: 'registry_still_maps_content_to_sandbox_content_executor', pass: resolveExecutorHandlerKey('content_publish') === SANDBOX_CONTENT_EXECUTOR_NAME },
    { name: 'content_registry_entry_marks_handler_implementation_included', pass: contentRegistryEntry.handlerImplementationIncluded === true },
    { name: 'registry_keeps_auto_run_disabled', pass: registrySafety.executorAutoRunEnabled === false && contentRegistryEntry.executionEnabled === false },
    { name: 'validation_accepts_valid_payload', pass: validation.ok === true && validation.externalWritesAllowed === false },
    { name: 'execute_returns_sandbox_success', pass: execution.ok === true && execution.result.sandbox_success === true },
    { name: 'execute_returns_fake_external_post_id', pass: typeof execution.result.fake_external_post_id === 'string' && execution.result.fake_external_post_id.startsWith('sandbox-post-') },
    { name: 'execute_returns_fake_permalink', pass: typeof execution.result.fake_permalink === 'string' && execution.result.fake_permalink.includes('sandbox.lifesaveragent.com') },
    { name: 'execute_does_not_attempt_external_write', pass: execution.externalWritesAttempted === false && execution.externalWritesSucceeded === false && execution.result.external_platform_called === false },
    { name: 'rollback_is_sandbox_only', pass: rollback.externalWritesAttempted === false && rollback.externalWritesSucceeded === false && rollback.status === 'rolled_back' },
    { name: 'summaries_safe_for_founder_display', pass: executionSummary.safeForFounderDisplay === true && rollbackSummary.safeForFounderDisplay === true },
    { name: 'invalid_payload_fails_without_external_write', pass: invalidExecution.ok === false && invalidExecution.externalWritesAttempted === false },
    { name: 'safety_says_not_wired_to_action_flow', pass: safety.wiredToActionFlow === false && safety.autoRunEnabled === false },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 8.3 Sandbox Content Executor',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety,
    registrySafety,
    samples: {
      validation,
      execution,
      rollback,
      executionSummary,
      rollbackSummary,
      invalidExecution,
    },
    safetyNote: 'Phase 8.3 simulates content publishing only. It returns fake external_post_id, fake permalink, and sandbox_success without touching Instagram, Meta, TikTok, LinkedIn, email, ads, stores, or any external API.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
