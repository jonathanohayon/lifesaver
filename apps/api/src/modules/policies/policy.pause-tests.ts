import { evaluatePolicyPauseState } from './policy.pause-enforcement.js';

async function main() {
  const decision = await evaluatePolicyPauseState({
    workspaceId: '00000000-0000-0000-0000-000000000001',
    actionType: 'content_publish',
    requestedDecision: 'auto_approve',
    source: 'phase_5_9_offline_test',
  });

  const assertions = [
    { name: 'policy_checked_pause_state', pass: decision.policyCheckedPauseState === true },
    { name: 'unknown_pause_state_never_auto_approves', pass: decision.effectiveDecision !== 'auto_approve' && decision.autoApprovalAllowed === false },
    { name: 'database_unavailable_or_emergency_fails_closed', pass: decision.blocked === true && ['database_not_configured', 'emergency_safe_mode'].includes(decision.blockReason) },
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
    sampleDecision: decision,
    safety: 'This test does not run a policy engine, executor, or external connector. It verifies that an auto_approve request cannot pass when pause state cannot be verified or emergency safe mode is active.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
