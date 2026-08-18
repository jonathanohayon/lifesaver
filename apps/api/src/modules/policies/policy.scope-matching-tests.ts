import { evaluatePolicyScopeMatch, policyScopeMatchingLibraryStatus } from './policy.scope-matching.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

const workspaceId = '00000000-0000-0000-0000-000000000001';

const baseAction: EvaluateActionPolicyInput = {
  workspaceId,
  actionId: '11111111-1111-1111-1111-111111111111',
  actionType: 'support_reply_send',
  riskLevel: 'medium',
  payloadJson: {
    data: {
      platform: 'gorgias',
      channel: 'email',
      category: 'shipping',
      confidence_score: 0.93,
      change_amount: 24,
    },
  },
  requestedDecision: 'ask',
  source: 'phase_6_5_scope_matching_test',
};

function check(name: string, conditionsJson: Record<string, unknown>, expectedMatched: boolean): Assertion {
  const result = evaluatePolicyScopeMatch({ action: baseAction, conditionsJson });
  return {
    name,
    pass: result.matched === expectedMatched && result.supported === true && result.safety.externalWritesAttempted === false && result.safety.executorRan === false,
    details: {
      matched: result.matched,
      supported: result.supported,
      emptyScope: result.emptyScope,
      checked: result.checked,
      actionScope: result.actionScope,
    },
  };
}

async function main() {
  const assertions: Assertion[] = [
    check('empty_scope_passes_to_condition_operators', {}, true),
    check('scope_matches_action_type', { scope: { action_type: 'support_reply_send' } }, true),
    check('scope_rejects_wrong_action_type', { scope: { action_type: 'content_publish' } }, false),
    check('scope_matches_platform_from_payload_data', { scope: { platform: 'gorgias' } }, true),
    check('scope_matches_channel_from_payload_data', { scope: { channel: 'email' } }, true),
    check('scope_matches_workspace_id', { scope: { workspace_id: workspaceId } }, true),
    check('scope_matches_exact_risk_level', { scope: { risk_level: 'medium' } }, true),
    check('scope_matches_risk_below', { scope: { risk_below: 'high' } }, true),
    check('scope_matches_amount_below_absolute_value', { scope: { amount_below: 50 } }, true),
    check('scope_matches_category_from_payload_data', { scope: { category: 'shipping' } }, true),
    check('scope_matches_confidence_above_from_payload_data', { scope: { confidence_above: 0.9 } }, true),
    check('top_level_scope_keys_are_supported', { platform: 'gorgias', channel: 'email', category: 'shipping' }, true),
    check('scope_supports_list_values', { scope: { platform: ['zendesk', 'gorgias'], category: ['faq', 'shipping'] } }, true),
    check('scope_fails_when_amount_exceeds_threshold', { scope: { amount_below: 10 } }, false),
    check('scope_fails_when_confidence_under_threshold', { scope: { confidence_above: 0.99 } }, false),
  ];

  const unsupported = evaluatePolicyScopeMatch({
    action: { ...baseAction, payloadJson: { data: { platform: 'gorgias' } } },
    conditionsJson: { scope: { amount_below: 50 } },
  });
  assertions.push({
    name: 'missing_amount_scope_is_unsupported_and_does_not_match',
    pass: unsupported.matched === false && unsupported.supported === false,
    details: { matched: unsupported.matched, supported: unsupported.supported, checked: unsupported.checked },
  });

  const status = policyScopeMatchingLibraryStatus();
  assertions.push({
    name: 'scope_library_lists_required_phase_6_5_fields',
    pass: ['action_type', 'platform', 'channel', 'workspace', 'risk_level', 'amount', 'category', 'confidence_score'].every((field) => status.fields.includes(field as never)),
    details: { fields: status.fields },
  });

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 6.6 Global Caps Foundation',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety: {
      scopeMatchingOnly: true,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.6 validates action scope matching only. It does not run executors, auto-run rules, or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
