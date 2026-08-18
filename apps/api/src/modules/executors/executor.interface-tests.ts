import {
  EXECUTOR_INTERFACE_PHASE,
  buildExecutorInterfaceSafetySummary,
  type ExecutorActionContext,
  type ExecutorExecuteResult,
  type ExecutorRollbackResult,
  type ExecutorResultSummary,
  type ExecutorValidationResult,
  type LifeSaverExecutor,
} from './executor.interface.js';

function now(): string {
  return new Date().toISOString();
}

const sampleExecutor: LifeSaverExecutor<{ text: string }, { previewOnly: true }> = {
  name: 'phase_8_1_contract_only_executor',
  actionType: 'content_publish',
  mode: 'sandbox',
  realExternalWriteEnabled: false,
  sandboxOnly: true,
  async validate(context: ExecutorActionContext<{ text: string }>): Promise<ExecutorValidationResult> {
    return {
      ok: typeof context.payload.text === 'string' && context.payload.text.length > 0,
      status: typeof context.payload.text === 'string' && context.payload.text.length > 0 ? 'valid' : 'invalid',
      reason: 'Contract-only validation completed without touching any external platform.',
      warnings: [],
      errors: [],
      externalWritesAllowed: false,
      checkedAt: now(),
    };
  },
  async execute(_context: ExecutorActionContext<{ text: string }>): Promise<ExecutorExecuteResult<{ previewOnly: true }>> {
    return {
      ok: true,
      status: 'executed',
      executorName: 'phase_8_1_contract_only_executor',
      mode: 'sandbox',
      result: { previewOnly: true },
      resultSummary: 'Contract-only execute shape returned a sandbox preview result. No external write was attempted.',
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rollbackSupported: false,
      rollbackPayload: null,
      executedAt: now(),
    };
  },
  async rollback(_context: ExecutorActionContext<{ text: string }>, _result: ExecutorExecuteResult<{ previewOnly: true }>): Promise<ExecutorRollbackResult> {
    return {
      ok: true,
      status: 'rollback_not_supported',
      executorName: 'phase_8_1_contract_only_executor',
      mode: 'sandbox',
      resultSummary: 'Rollback contract returned safely. No external rollback was attempted.',
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      rolledBackAt: now(),
    };
  },
  summarizeResult(result: ExecutorExecuteResult<{ previewOnly: true }> | ExecutorRollbackResult): ExecutorResultSummary {
    return {
      title: 'Phase 8.1 executor interface result',
      status: result.status,
      message: result.resultSummary,
      safeForFounderDisplay: true,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
    };
  },
};

async function main() {
  const safety = buildExecutorInterfaceSafetySummary();
  const context: ExecutorActionContext<{ text: string }> = {
    version: '0.6.0',
    phase: EXECUTOR_INTERFACE_PHASE,
    workspaceId: '00000000-0000-0000-0000-000000000001',
    actionId: '00000000-0000-0000-0000-000000000002',
    actionType: 'content_publish',
    riskLevel: 'low',
    requestedByUserId: '00000000-0000-0000-0000-000000000003',
    approvedByUserId: null,
    idempotencyKey: 'phase-8-1-contract-test',
    policyDecision: 'ask',
    payload: { text: 'Proposed Instagram post preview only.' },
    metadata: { source: 'executor.interface-tests' },
  };

  const validation = await sampleExecutor.validate(context);
  const execution = await sampleExecutor.execute(context);
  const rollback = await sampleExecutor.rollback(context, execution);
  const summary = sampleExecutor.summarizeResult(execution);

  const assertions = [
    { name: 'interface_defines_required_methods', pass: safety.requiredMethods.join(',') === 'validate,execute,rollback,summarizeResult' },
    { name: 'phase_is_8_1_executor_interface', pass: safety.phase === 'v0.6.0 Phase 8.1 Executor Interface' },
    { name: 'validate_method_exists', pass: typeof sampleExecutor.validate === 'function' },
    { name: 'execute_method_exists', pass: typeof sampleExecutor.execute === 'function' },
    { name: 'rollback_method_exists', pass: typeof sampleExecutor.rollback === 'function' },
    { name: 'summarize_result_method_exists', pass: typeof sampleExecutor.summarizeResult === 'function' },
    { name: 'validation_external_writes_disallowed', pass: validation.externalWritesAllowed === false },
    { name: 'execute_does_not_attempt_external_write', pass: execution.externalWritesAttempted === false && execution.externalWritesSucceeded === false },
    { name: 'rollback_does_not_attempt_external_write', pass: rollback.externalWritesAttempted === false && rollback.externalWritesSucceeded === false },
    { name: 'summary_safe_for_founder_display', pass: summary.safeForFounderDisplay === true && summary.externalWritesAttempted === false },
    { name: 'no_sandbox_executor_registered_yet', pass: safety.sandboxExecutorImplemented === false },
    { name: 'no_real_executor_registered_yet', pass: safety.realExecutorImplemented === false && safety.externalWritesEnabled === false },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 8.1 Executor Interface',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety,
    sample: {
      validation,
      execution,
      rollback,
      summary,
    },
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
