import { evaluatePolicyConditions, conditionOperatorLibraryStatus } from './policy.condition-operators.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

const baseAction: EvaluateActionPolicyInput = {
  workspaceId: '00000000-0000-0000-0000-000000000001',
  actionId: '11111111-1111-1111-1111-111111111111',
  actionType: 'content_publish',
  riskLevel: 'low',
  payloadJson: {
    platform: 'instagram',
    channel: 'instagram',
    caption: 'New drop is ready for loyal customers.',
    amount: 42,
    confidence: 0.94,
    tags: ['new-drop', 'loyal-customers'],
    nested: {
      score: 12,
    },
  },
  requestedDecision: 'ask',
  source: 'phase_6_5_condition_operator_test',
};

function check(name: string, conditionsJson: Record<string, unknown>, expectedMatched: boolean): Assertion {
  const result = evaluatePolicyConditions({ action: baseAction, conditionsJson });
  return {
    name,
    pass: result.matched === expectedMatched && result.supported === true && result.safety.externalWritesAttempted === false && result.safety.executorRan === false,
    details: {
      matched: result.matched,
      supported: result.supported,
      matchMode: result.matchMode,
      checked: result.checked,
    },
  };
}

async function main() {
  const assertions: Assertion[] = [
    check('empty_conditions_match', {}, true),
    check('always_true_matches', { always: true }, true),
    check('equals_matches_top_level_payload_field', { equals: { field: 'platform', value: 'instagram' } }, true),
    check('equals_fails_when_value_is_different', { equals: { field: 'platform', value: 'tiktok' } }, false),
    check('contains_matches_text', { contains: { field: 'caption', value: 'loyal customers' } }, true),
    check('contains_matches_array_item', { contains: { field: 'tags', value: 'new-drop' } }, true),
    check('less_than_matches_numeric_field', { less_than: { field: 'amount', value: 50 } }, true),
    check('greater_than_matches_nested_numeric_field', { greater_than: { field: 'nested.score', value: 10 } }, true),
    check('channel_is_matches_platform_or_channel', { channel_is: 'instagram' }, true),
    check('risk_below_matches_low_below_high', { risk_below: 'high' }, true),
    check('confidence_above_matches_payload_confidence', { confidence_above: 0.9 }, true),
    check('amount_below_matches_absolute_amount', { amount_below: 50 }, true),
    check('all_requires_every_condition', { all: [{ channel_is: 'instagram' }, { risk_below: 'medium' }, { confidence_above: 0.9 }] }, true),
    check('all_fails_when_one_condition_fails', { all: [{ channel_is: 'instagram' }, { amount_below: 10 }] }, false),
    check('any_matches_when_one_condition_matches', { any: [{ channel_is: 'tiktok' }, { channel_is: 'instagram' }] }, true),
    check('not_matches_when_nested_condition_does_not_match', { not: { channel_is: 'tiktok' } }, true),
  ];

  const unsupported = evaluatePolicyConditions({ action: baseAction, conditionsJson: { unknown_operator: true } });
  assertions.push({
    name: 'unknown_operator_is_unsupported_and_does_not_match',
    pass: unsupported.matched === false && unsupported.supported === false,
    details: { matched: unsupported.matched, supported: unsupported.supported, checked: unsupported.checked },
  });

  const status = conditionOperatorLibraryStatus();
  assertions.push({
    name: 'operator_library_lists_all_phase_6_4_operators_under_phase_6_5_scope_package',
    pass: ['equals', 'contains', 'less_than', 'greater_than', 'channel_is', 'risk_below', 'confidence_above', 'amount_below'].every((operator) => status.operators.includes(operator as never)),
    details: { operators: status.operators },
  });

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 6.6 Global Caps Foundation / Phase 6.4 Condition Operators Regression',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety: {
      conditionMatchingOnly: true,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.5 keeps the Phase 6.4 condition operator library working after action-scope matching. It does not run executors or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
