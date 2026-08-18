import { EXECUTOR_INTERFACE_PHASE, type ExecutorActionContext } from './executor.interface.js';
import { buildExecutorRegistrySafetySummary, getRegisteredExecutorEntry, resolveExecutorHandlerKey } from './executor.registry.js';
import {
  SANDBOX_SUPPORT_EXECUTOR_NAME,
  buildSandboxSupportExecutorSafetySummary,
  sandboxSupportExecutor,
  type SandboxSupportExecutorPayload,
} from './sandbox-support.executor.js';

function samplePayload(): SandboxSupportExecutorPayload {
  return {
    schema_version: 'action-payload/v0.6.0',
    action_type: 'support_reply_send',
    source: 'system',
    intent_summary: 'Sandbox support reply simulation only.',
    created_reason: 'Phase 8.4 sandbox support executor test.',
    risk_notes: ['No external write', 'Fake support reply only'],
    idempotency_hint: 'phase-8-4-sandbox-support-test',
    data: {
      ticket_id: 'ticket-1024',
      thread_id: 'thread-2048',
      reply_body: 'Certainly, sir. Thank you for contacting us. This reply is simulated inside the LIFE.SAVER sandbox only and has not been emailed or posted to any helpdesk.',
      support_provider: 'zendesk',
      customer_email: 'customer@example.test',
      customer_name: 'Sandbox Customer',
      subject: 'Sandbox support ticket',
      category: 'shipping',
      confidence_score: 0.92,
      sensitive_flag: false,
      escalation_required: false,
      approval_notes: 'Test payload only. Must not send externally.',
    },
  } as SandboxSupportExecutorPayload;
}

function sampleContext(payload = samplePayload()): ExecutorActionContext<SandboxSupportExecutorPayload> {
  return {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    workspaceId: '00000000-0000-0000-0000-000000000101',
    actionId: '00000000-0000-0000-0000-000000000404',
    actionType: 'support_reply_send',
    riskLevel: 'medium',
    requestedByUserId: '00000000-0000-0000-0000-000000000303',
    approvedByUserId: null,
    idempotencyKey: 'phase-8-4-sandbox-support-idempotency',
    policyDecision: 'ask',
    payload,
    metadata: { source: 'executor.sandbox-support-tests' },
  };
}

async function main() {
  const safety = buildSandboxSupportExecutorSafetySummary();
  const registrySafety = buildExecutorRegistrySafetySummary();
  const supportRegistryEntry = getRegisteredExecutorEntry('support_reply_send');
  const context = sampleContext();
  const validation = await sandboxSupportExecutor.validate(context);
  const execution = await sandboxSupportExecutor.execute(context);
  const rollback = await sandboxSupportExecutor.rollback(context, execution);
  const executionSummary = sandboxSupportExecutor.summarizeResult(execution);
  const rollbackSummary = sandboxSupportExecutor.summarizeResult(rollback);

  const invalidPayload = samplePayload();
  invalidPayload.data.reply_body = '';
  const invalidExecution = await sandboxSupportExecutor.execute(sampleContext(invalidPayload));

  const sensitivePayload = samplePayload();
  sensitivePayload.data.sensitive_flag = true;
  sensitivePayload.data.escalation_required = true;
  const sensitiveValidation = await sandboxSupportExecutor.validate(sampleContext(sensitivePayload));

  const assertions = [
    { name: 'phase_is_8_4_sandbox_support_executor', pass: safety.phase === 'v0.6.0 Phase 8.4 Sandbox Support Executor' },
    { name: 'executor_name_is_sandbox_support_executor', pass: sandboxSupportExecutor.name === SANDBOX_SUPPORT_EXECUTOR_NAME },
    { name: 'executor_implements_support_reply_send', pass: sandboxSupportExecutor.actionType === 'support_reply_send' },
    { name: 'registry_maps_support_to_sandbox_support_executor', pass: resolveExecutorHandlerKey('support_reply_send') === SANDBOX_SUPPORT_EXECUTOR_NAME },
    { name: 'support_registry_entry_marks_handler_implementation_included', pass: supportRegistryEntry.handlerImplementationIncluded === true },
    { name: 'registry_keeps_auto_run_disabled', pass: registrySafety.executorAutoRunEnabled === false && supportRegistryEntry.executionEnabled === false },
    { name: 'validation_accepts_valid_payload', pass: validation.ok === true && validation.externalWritesAllowed === false },
    { name: 'execute_returns_sandbox_success', pass: execution.ok === true && execution.result.sandbox_success === true },
    { name: 'execute_returns_fake_external_reply_id', pass: typeof execution.result.fake_external_reply_id === 'string' && execution.result.fake_external_reply_id.startsWith('sandbox-reply-') },
    { name: 'execute_returns_fake_thread_permalink', pass: typeof execution.result.fake_thread_permalink === 'string' && execution.result.fake_thread_permalink.includes('sandbox.lifesaveragent.com') },
    { name: 'execute_does_not_attempt_external_write', pass: execution.externalWritesAttempted === false && execution.externalWritesSucceeded === false && execution.result.external_helpdesk_called === false && execution.result.external_email_sent === false },
    { name: 'rollback_is_sandbox_only', pass: rollback.externalWritesAttempted === false && rollback.externalWritesSucceeded === false && rollback.status === 'rolled_back' },
    { name: 'summaries_safe_for_founder_display', pass: executionSummary.safeForFounderDisplay === true && rollbackSummary.safeForFounderDisplay === true },
    { name: 'invalid_payload_fails_without_external_write', pass: invalidExecution.ok === false && invalidExecution.externalWritesAttempted === false },
    { name: 'sensitive_payload_warns_without_blocking_simulation', pass: sensitiveValidation.ok === true && sensitiveValidation.warnings.length >= 2 },
    { name: 'safety_says_not_wired_to_action_flow', pass: safety.wiredToActionFlow === false && safety.autoRunEnabled === false && safety.emailHelpdeskApiCalled === false },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 8.4 Sandbox Support Executor',
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
      sensitiveValidation,
    },
    safetyNote: 'Phase 8.4 simulates sending a support reply only. It returns fake support reply data and sandbox_success without touching Gmail, Zendesk, Gorgias, Help Scout, email, ads, stores, or any external API.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
