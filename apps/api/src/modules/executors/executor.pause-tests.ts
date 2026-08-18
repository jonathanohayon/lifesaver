import { evaluateExecutorPauseState } from './executor.pause-guard.js';
import { listExecutorRegistrySafetyState } from './executor.registry.js';

async function main() {
  const registry = listExecutorRegistrySafetyState();
  const decision = await evaluateExecutorPauseState({
    workspaceId: '00000000-0000-0000-0000-000000000001',
    actionId: '00000000-0000-0000-0000-000000000002',
    actionType: 'content_publish',
    executorName: 'phase_5_6_test_executor_placeholder',
    requestedByUserId: '00000000-0000-0000-0000-000000000003',
  });

  const assertions = [
    { name: 'registry_has_no_enabled_executors', pass: registry.executorsEnabled === false && registry.realExternalWritesEnabled === false },
    { name: 'pause_guard_checks_immediately_before_execution', pass: decision.checkedImmediatelyBeforeExecution === true },
    { name: 'sandbox_without_database_fails_closed', pass: decision.blocked === true && ['database_not_configured', 'emergency_safe_mode'].includes(decision.blockReason) },
    { name: 'no_external_write_attempted', pass: decision.safety.externalWritesAttempted === false && decision.safety.executorRan === false },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 5.9 Emergency Safe Mode',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    registry,
    sampleDecision: decision,
    safety: 'This test does not run any executor and does not call external platforms. It verifies fail-closed pause guard behavior when DATABASE_URL is absent or EMERGENCY_SAFE_MODE is active.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
