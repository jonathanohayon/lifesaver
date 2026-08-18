import { resolvePolicyConflicts, type PolicyConflictCandidate } from './policy.conflict-resolution.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

function candidate(params: Partial<PolicyConflictCandidate> & Pick<PolicyConflictCandidate, 'policyId' | 'decision'>): PolicyConflictCandidate {
  return {
    policyId: params.policyId,
    policyName: params.policyName || params.policyId,
    decision: params.decision,
    priority: params.priority ?? 100,
    order: params.order ?? 0,
    capStatus: params.capStatus || 'no_caps_defined',
    capAllowed: params.capAllowed ?? true,
    reason: params.reason || 'test candidate',
  };
}

async function main() {
  const noMatch = resolvePolicyConflicts({ candidates: [] });
  const pauseOverride = resolvePolicyConflicts({
    candidates: [candidate({ policyId: 'auto_policy', decision: 'auto_approve' })],
    pauseBlocked: true,
    pauseReason: 'Global pause active in test.',
  });
  const blockWins = resolvePolicyConflicts({
    candidates: [
      candidate({ policyId: 'auto_high_priority', decision: 'auto_approve', priority: 1, order: 0 }),
      candidate({ policyId: 'block_low_priority', decision: 'block', priority: 999, order: 1 }),
    ],
  });
  const capExceededWins = resolvePolicyConflicts({
    candidates: [
      candidate({ policyId: 'ask_rule', decision: 'ask', priority: 1, order: 0 }),
      candidate({ policyId: 'auto_cap_exceeded', decision: 'auto_approve', priority: 100, order: 1, capStatus: 'cap_exceeded', capAllowed: false }),
    ],
  });
  const askWins = resolvePolicyConflicts({
    candidates: [
      candidate({ policyId: 'auto_rule', decision: 'auto_approve', priority: 1, order: 0 }),
      candidate({ policyId: 'ask_rule', decision: 'ask', priority: 999, order: 1 }),
    ],
  });
  const unavailableCapsAsk = resolvePolicyConflicts({
    candidates: [
      candidate({ policyId: 'auto_caps_unknown', decision: 'auto_approve', capStatus: 'cap_usage_unavailable', capAllowed: false }),
    ],
  });
  const autoWins = resolvePolicyConflicts({
    candidates: [candidate({ policyId: 'safe_auto', decision: 'auto_approve', capStatus: 'caps_ok' })],
  });

  const assertions: Assertion[] = [
    {
      name: 'no_match_defaults_to_ask',
      pass: noMatch.decision === 'ask' && noMatch.reasonCode === 'no_matched_policy_default_ask' && noMatch.matchedPolicyId === null,
      details: { decision: noMatch.decision, reasonCode: noMatch.reasonCode, matchedPolicyId: noMatch.matchedPolicyId },
    },
    {
      name: 'master_pause_overrides_everything',
      pass: pauseOverride.decision === 'ask' && pauseOverride.reasonCode === 'master_pause_or_emergency_override' && pauseOverride.capStatus === 'blocked_by_pause_or_emergency',
      details: { decision: pauseOverride.decision, reasonCode: pauseOverride.reasonCode, capStatus: pauseOverride.capStatus },
    },
    {
      name: 'block_rule_wins_over_auto_even_with_lower_priority',
      pass: blockWins.decision === 'block' && blockWins.matchedPolicyId === 'block_low_priority' && blockWins.reasonCode === 'block_rule_wins',
      details: { decision: blockWins.decision, matchedPolicyId: blockWins.matchedPolicyId, reasonCode: blockWins.reasonCode },
    },
    {
      name: 'hard_cap_exceeded_wins_over_ask',
      pass: capExceededWins.decision === 'block' && capExceededWins.matchedPolicyId === 'auto_cap_exceeded' && capExceededWins.reasonCode === 'hard_cap_exceeded_wins',
      details: { decision: capExceededWins.decision, matchedPolicyId: capExceededWins.matchedPolicyId, reasonCode: capExceededWins.reasonCode },
    },
    {
      name: 'ask_rule_wins_over_auto',
      pass: askWins.decision === 'ask' && askWins.matchedPolicyId === 'ask_rule' && askWins.reasonCode === 'ask_rule_wins',
      details: { decision: askWins.decision, matchedPolicyId: askWins.matchedPolicyId, reasonCode: askWins.reasonCode },
    },
    {
      name: 'cap_usage_unavailable_downgrades_auto_to_ask',
      pass: unavailableCapsAsk.decision === 'ask' && unavailableCapsAsk.reasonCode === 'cap_usage_unavailable_asks' && unavailableCapsAsk.capStatus === 'cap_usage_unavailable',
      details: { decision: unavailableCapsAsk.decision, reasonCode: unavailableCapsAsk.reasonCode, capStatus: unavailableCapsAsk.capStatus },
    },
    {
      name: 'auto_approve_only_when_no_more_restrictive_match',
      pass: autoWins.decision === 'auto_approve' && autoWins.matchedPolicyId === 'safe_auto' && autoWins.reasonCode === 'auto_approve_rule_wins',
      details: { decision: autoWins.decision, matchedPolicyId: autoWins.matchedPolicyId, reasonCode: autoWins.reasonCode },
    },
    {
      name: 'safety_contract_no_execution_or_external_writes',
      pass: [noMatch, pauseOverride, blockWins, capExceededWins, askWins, unavailableCapsAsk, autoWins].every((result) => result.safety.executorRan === false && result.safety.externalWritesAttempted === false && result.safety.autoRunTriggered === false),
      details: { checkedResults: 7 },
    },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 6.10 Policy Tests',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    sampleResults: {
      noMatch,
      pauseOverride,
      blockWins,
      capExceededWins,
      askWins,
      unavailableCapsAsk,
      autoWins,
    },
    safety: {
      conflictResolutionOnly: true,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.7 validates most-restrictive-wins policy conflict resolution. It does not run executors or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
