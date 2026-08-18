import { evaluateDefaultAskPolicy, enforceDefaultAskDecision } from './policy.default-ask.js';
import type { ActionPolicyDecision } from '../actions/actions.types.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

const base = {
  workspaceId: '00000000-0000-0000-0000-000000000001',
  actionType: 'content_publish' as const,
};

const noRuleUndefined = evaluateDefaultAskPolicy({ ...base, requestedDecision: undefined });
const noRuleAutoApprove = evaluateDefaultAskPolicy({ ...base, requestedDecision: 'auto_approve' });
const noRuleNotEvaluated = evaluateDefaultAskPolicy({ ...base, requestedDecision: 'not_evaluated' });
const matchedAutoApprove = evaluateDefaultAskPolicy({
  ...base,
  requestedDecision: 'auto_approve',
  matchedPolicyId: 'policy_test_auto_approve',
  matchedPolicyDecision: 'auto_approve',
});
const matchedBlock = evaluateDefaultAskPolicy({
  ...base,
  requestedDecision: 'ask',
  matchedPolicyId: 'policy_test_block',
  matchedPolicyDecision: 'block',
});

const normalized = {
  approvalRequired: false,
  policyDecision: 'auto_approve' as ActionPolicyDecision,
};
const enforcedNoRule = enforceDefaultAskDecision({ normalized, defaultAskDecision: noRuleAutoApprove });
const enforcedMatchedAuto = enforceDefaultAskDecision({ normalized, defaultAskDecision: matchedAutoApprove });

const assertions: Assertion[] = [
  {
    name: 'no_rule_undefined_defaults_to_ask',
    pass: noRuleUndefined.effectiveDecision === 'ask' && noRuleUndefined.approvalRequired === true,
    details: { effectiveDecision: noRuleUndefined.effectiveDecision },
  },
  {
    name: 'no_rule_auto_approve_is_forced_to_ask',
    pass: noRuleAutoApprove.effectiveDecision === 'ask' && noRuleAutoApprove.autoApprovalAllowed === false,
    details: { effectiveDecision: noRuleAutoApprove.effectiveDecision, autoApprovalAllowed: noRuleAutoApprove.autoApprovalAllowed },
  },
  {
    name: 'no_rule_not_evaluated_defaults_to_ask',
    pass: noRuleNotEvaluated.effectiveDecision === 'ask' && noRuleNotEvaluated.defaultAskApplied === true,
    details: { effectiveDecision: noRuleNotEvaluated.effectiveDecision },
  },
  {
    name: 'matched_policy_can_continue_auto_approve_to_later_safety_checks',
    pass: matchedAutoApprove.effectiveDecision === 'auto_approve' && matchedAutoApprove.autoApprovalAllowed === true && matchedAutoApprove.executorExecutionAllowed === false,
    details: { effectiveDecision: matchedAutoApprove.effectiveDecision, executorExecutionAllowed: matchedAutoApprove.executorExecutionAllowed },
  },
  {
    name: 'matched_block_policy_returns_block_without_execution',
    pass: matchedBlock.effectiveDecision === 'block' && matchedBlock.executorExecutionAllowed === false,
    details: { effectiveDecision: matchedBlock.effectiveDecision },
  },
  {
    name: 'enforcement_for_no_rule_sets_approval_required_true',
    pass: enforcedNoRule.policyDecision === 'ask' && enforcedNoRule.approvalRequired === true,
    details: enforcedNoRule,
  },
  {
    name: 'enforcement_for_matched_auto_approve_does_not_execute',
    pass: enforcedMatchedAuto.policyDecision === 'auto_approve' && matchedAutoApprove.executorExecutionAllowed === false,
    details: { policyDecision: enforcedMatchedAuto.policyDecision, executorExecutionAllowed: matchedAutoApprove.executorExecutionAllowed },
  },
  {
    name: 'safety_contract_no_external_writes',
    pass: noRuleAutoApprove.safety.externalWritesAttempted === false && noRuleAutoApprove.safety.executorRan === false,
    details: noRuleAutoApprove.safety,
  },
];

const failed = assertions.filter((item) => !item.pass);
const payload = {
  version: '0.6.0',
  phase: 'V2 Phase 6.2 Default Ask Policy',
  success: failed.length === 0,
  passed: assertions.length - failed.length,
  failed: failed.length,
  assertions,
  safety: {
    noRuleDefaultsToAsk: noRuleUndefined.effectiveDecision === 'ask',
    autoApproveWithoutMatchedRuleBlocked: noRuleAutoApprove.effectiveDecision !== 'auto_approve',
    executorEnabled: false,
    externalWritesEnabled: false,
  },
  note: 'Phase 6.2 validates default ask behavior only. It does not evaluate database policies, auto-run rules, queue actions, execute actions, or write externally.',
};

console.log(JSON.stringify(payload, null, 2));
if (failed.length > 0) process.exit(1);
