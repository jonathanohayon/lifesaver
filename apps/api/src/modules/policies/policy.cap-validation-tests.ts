import { policyCapValidationLibraryStatus, unavailablePolicyCapUsage, validatePolicyCaps, type PolicyCapUsageSnapshot } from './policy.cap-validation.js';
import type { EvaluateActionPolicyInput } from './policy.types.js';

type Assertion = { name: string; pass: boolean; details?: Record<string, unknown> };

const workspaceId = '00000000-0000-0000-0000-000000000001';

function usage(overrides: Partial<PolicyCapUsageSnapshot> = {}): PolicyCapUsageSnapshot {
  return {
    workspaceId,
    source: 'provided',
    windowStartedAt: {
      day: '2026-01-01T00:00:00.000Z',
      hour: '2026-01-01T12:00:00.000Z',
    },
    postsToday: 1,
    supportAutoRepliesToday: 2,
    adSpendChangeToday: 50,
    modelCostTodayUsd: 1.25,
    actionsThisHour: 3,
    ...overrides,
  };
}

function action(overrides: Partial<EvaluateActionPolicyInput> = {}): EvaluateActionPolicyInput {
  return {
    workspaceId,
    actionId: '11111111-1111-1111-1111-111111111111',
    actionType: 'content_publish',
    riskLevel: 'low',
    payloadJson: {
      data: {
        platform: 'instagram',
        change_amount: 25,
        estimated_model_cost_usd: 0.5,
      },
    },
    requestedDecision: 'auto_approve',
    source: 'phase_6_6_cap_validation_test',
    ...overrides,
  };
}

function check(name: string, params: Parameters<typeof validatePolicyCaps>[0], expected: { status: string; allowed: boolean }): Assertion {
  const result = validatePolicyCaps(params);
  return {
    name,
    pass: result.status === expected.status && result.allowed === expected.allowed && result.safety.executorRan === false && result.safety.externalWritesAttempted === false && result.safety.autoRunTriggered === false,
    details: {
      status: result.status,
      allowed: result.allowed,
      checkedCount: result.checkedCount,
      exceededCount: result.exceededCount,
      checks: result.checks,
      reason: result.reason,
    },
  };
}

async function main() {
  const assertions: Assertion[] = [
    check('no_caps_defined_allows_policy_to_continue', {
      action: action(),
      capsJson: {},
      usage: usage(),
    }, { status: 'no_caps_defined', allowed: true }),

    check('max_posts_per_day_ok_for_content_publish', {
      action: action({ actionType: 'content_publish' }),
      capsJson: { max_posts_per_day: 3 },
      usage: usage({ postsToday: 1 }),
    }, { status: 'caps_ok', allowed: true }),

    check('max_posts_per_day_blocks_when_projected_above_limit', {
      action: action({ actionType: 'content_publish' }),
      capsJson: { max_posts_per_day: 3 },
      usage: usage({ postsToday: 3 }),
    }, { status: 'cap_exceeded', allowed: false }),

    check('max_support_auto_replies_per_day_ok', {
      action: action({ actionType: 'support_reply_send' }),
      capsJson: { max_support_auto_replies_per_day: 5 },
      usage: usage({ supportAutoRepliesToday: 2 }),
    }, { status: 'caps_ok', allowed: true }),

    check('max_support_auto_replies_per_day_blocks', {
      action: action({ actionType: 'support_reply_send' }),
      capsJson: { max_support_auto_replies_per_day: 2 },
      usage: usage({ supportAutoRepliesToday: 2 }),
    }, { status: 'cap_exceeded', allowed: false }),

    check('max_ad_spend_change_per_day_ok_uses_absolute_change_amount', {
      action: action({ actionType: 'ad_budget_adjust', payloadJson: { data: { change_amount: -25 } } }),
      capsJson: { max_ad_spend_change_per_day: 100 },
      usage: usage({ adSpendChangeToday: 50 }),
    }, { status: 'caps_ok', allowed: true }),

    check('max_ad_spend_change_per_day_blocks', {
      action: action({ actionType: 'ad_budget_adjust', payloadJson: { data: { change_amount: 60 } } }),
      capsJson: { max_ad_spend_change_per_day: 100 },
      usage: usage({ adSpendChangeToday: 50 }),
    }, { status: 'cap_exceeded', allowed: false }),

    check('max_model_cost_per_day_ok', {
      action: action({ payloadJson: { data: { estimated_model_cost_usd: 0.25 } } }),
      capsJson: { max_model_cost_per_day: 2 },
      usage: usage({ modelCostTodayUsd: 1.25 }),
    }, { status: 'caps_ok', allowed: true }),

    check('max_model_cost_per_day_blocks', {
      action: action({ payloadJson: { data: { estimated_model_cost_usd: 0.9 } } }),
      capsJson: { max_model_cost_per_day: 2 },
      usage: usage({ modelCostTodayUsd: 1.25 }),
    }, { status: 'cap_exceeded', allowed: false }),

    check('max_actions_per_hour_ok', {
      action: action(),
      capsJson: { max_actions_per_hour: 5 },
      usage: usage({ actionsThisHour: 3 }),
    }, { status: 'caps_ok', allowed: true }),

    check('max_actions_per_hour_blocks', {
      action: action(),
      capsJson: { max_actions_per_hour: 3 },
      usage: usage({ actionsThisHour: 3 }),
    }, { status: 'cap_exceeded', allowed: false }),

    check('nested_global_caps_shape_supported', {
      action: action({ actionType: 'content_publish' }),
      capsJson: { global: { maxPostsPerDay: 2, maxActionsPerHour: 10 } },
      usage: usage({ postsToday: 1, actionsThisHour: 0 }),
    }, { status: 'caps_ok', allowed: true }),

    check('usage_unavailable_fails_closed_for_caps', {
      action: action(),
      capsJson: { max_posts_per_day: 2 },
      usage: unavailablePolicyCapUsage(workspaceId),
    }, { status: 'cap_usage_unavailable', allowed: false }),
  ];

  const status = policyCapValidationLibraryStatus();
  assertions.push({
    name: 'cap_library_lists_required_phase_6_6_caps',
    pass: ['max_posts_per_day', 'max_support_auto_replies_per_day', 'max_ad_spend_change_per_day', 'max_model_cost_per_day', 'max_actions_per_hour'].every((cap) => status.caps.includes(cap as never)),
    details: { caps: status.caps, statusValues: status.statusValues },
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
      capValidationOnly: true,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.6 validates global caps only. It does not run executors, auto-run actions, or write externally.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
