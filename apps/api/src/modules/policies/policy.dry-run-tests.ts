import { dryRunActionPolicy, POLICY_DRY_RUN_PHASE } from './policy.dry-run.js';
import type { PolicyEvaluationRuleRow } from './policy.repository.js';
import type { PolicyCapUsageSnapshot } from './policy.cap-validation.js';

type TestStatus = 'pass' | 'fail';
const results: Array<{ name: string; status: TestStatus; message: string }> = [];

function record(name: string, status: TestStatus, message: string) {
  results.push({ name, status, message });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function policy(overrides: Partial<PolicyEvaluationRuleRow> = {}): PolicyEvaluationRuleRow {
  return {
    id: 'policy-auto-content-low',
    workspace_id: 'workspace-dry-run',
    name: 'Auto approve low-risk Instagram content preview',
    action_type: 'content_publish',
    conditions_json: {
      scope: {
        action_type: 'content_publish',
        platform: 'instagram',
        risk_level: 'low',
      },
      all: [
        { field: 'confidence_score', operator: 'confidence_above', value: 0.8 },
      ],
    },
    decision: 'auto_approve',
    caps_json: {
      max_posts_per_day: 3,
      max_actions_per_hour: 10,
    },
    priority: 20,
    enabled: true,
    created_by: null,
    updated_by: null,
    created_at: new Date('2026-07-05T00:00:00.000Z'),
    updated_at: new Date('2026-07-05T00:00:00.000Z'),
    ...overrides,
  };
}

function capUsage(overrides: Partial<PolicyCapUsageSnapshot> = {}): PolicyCapUsageSnapshot {
  return {
    workspaceId: 'workspace-dry-run',
    source: 'provided',
    windowStartedAt: {
      day: '2026-07-05T00:00:00.000Z',
      hour: '2026-07-05T12:00:00.000Z',
    },
    postsToday: 1,
    supportAutoRepliesToday: 0,
    adSpendChangeToday: 0,
    modelCostTodayUsd: 0,
    actionsThisHour: 1,
    ...overrides,
  };
}

async function testDefaultAskDryRunNoWrites() {
  const result = await dryRunActionPolicy({
    workspaceId: 'workspace-dry-run',
    actionType: 'support_reply_send',
    riskLevel: 'medium',
    payloadJson: { platform: 'gmail', reply_body: 'Thank you for reaching out.' },
    useCase: 'qa',
    simulationName: 'No rules default ask preview',
    policyRows: [],
  });

  assert(result.phase === POLICY_DRY_RUN_PHASE, 'Dry-run phase should be Phase 6.10.');
  assert(result.dryRun === true, 'Result must be marked as dry-run.');
  assert(result.evaluation.decision === 'ask', 'No matching policy should default to ask.');
  assert(result.outcomePreview.wouldPersistAction === false, 'Dry run must not create an action.');
  assert(result.outcomePreview.wouldRunExecutor === false, 'Dry run must not run executor.');
  assert(result.safety.databaseWritesPerformed === false, 'Dry run must not write to DB.');
  assert(result.safety.externalWritesAttempted === false, 'Dry run must not write externally.');
}

async function testPolicyUiPreviewAutoApproveButNoExecution() {
  const result = await dryRunActionPolicy({
    workspaceId: 'workspace-dry-run',
    actionType: 'content_publish',
    riskLevel: 'low',
    requestedDecision: 'auto_approve',
    payloadJson: {
      platform: 'instagram',
      channel: 'instagram',
      caption: 'A polished approved-style post.',
      confidence_score: 0.92,
    },
    useCase: 'policy_ui_preview',
    simulationName: 'Instagram approved-style preview',
    policyRows: [policy()],
    capUsage: capUsage(),
  });

  assert(result.evaluation.decision === 'auto_approve', 'Matching dry-run policy should preview auto_approve.');
  assert(result.evaluation.matched_policy_id === 'policy-auto-content-low', 'Matched policy id should be surfaced.');
  assert(result.outcomePreview.autoApprovalAllowed === true, 'Preview should show auto approval eligibility.');
  assert(result.outcomePreview.executorExecutionAllowed === false, 'Phase 6.10 must not permit executor execution.');
  assert(result.outcomePreview.wouldQueueExecution === false, 'Dry run must not queue execution.');
  assert(result.snapshotSummary.present === true, 'Dry run should include a safe snapshot preview.');
  assert(result.snapshotPreview.dataPolicy.rawPayloadStored === false, 'Snapshot preview must not store raw payload.');
}

async function testCapsExceededPreviewBlocks() {
  const result = await dryRunActionPolicy({
    workspaceId: 'workspace-dry-run',
    actionType: 'content_publish',
    riskLevel: 'low',
    requestedDecision: 'auto_approve',
    payloadJson: {
      platform: 'instagram',
      channel: 'instagram',
      caption: 'Another approved-style post.',
      confidence_score: 0.95,
    },
    useCase: 'admin_simulation',
    policyRows: [policy()],
    capUsage: capUsage({ postsToday: 3 }),
  });

  assert(result.evaluation.decision === 'block', 'Cap exceeded should block in dry run.');
  assert(result.evaluation.cap_status === 'cap_exceeded', 'Cap status should explain cap_exceeded.');
  assert(result.checked.conflictReasonCode === 'hard_cap_exceeded_wins', 'Conflict reason should show hard cap priority.');
}

async function testUnsupportedUseCaseDefaultsToQa() {
  const result = await dryRunActionPolicy({
    workspaceId: 'workspace-dry-run',
    actionType: 'research_task',
    riskLevel: 'low',
    payloadJson: { question: 'What changed today?' },
    useCase: 'something_else' as any,
    policyRows: [],
  });

  assert(result.useCase === 'qa', 'Unsupported use case should normalize to qa.');
  assert(result.evaluation.decision === 'ask', 'Unsupported use case should not change policy safety.');
}

async function run() {
  const tests = [
    ['default ask dry-run performs no writes', testDefaultAskDryRunNoWrites],
    ['policy UI preview can show auto_approve without execution', testPolicyUiPreviewAutoApproveButNoExecution],
    ['caps exceeded preview blocks', testCapsExceededPreviewBlocks],
    ['unsupported use case defaults safely to QA', testUnsupportedUseCaseDefaultsToQa],
  ] as const;

  for (const [name, fn] of tests) {
    try {
      await fn();
      record(name, 'pass', 'Passed.');
    } catch (error) {
      record(name, 'fail', error instanceof Error ? error.message : String(error));
    }
  }

  console.table(results);
  const failed = results.filter((result) => result.status === 'fail');
  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    version: '0.6.0',
    phase: 'V2 Phase 6.10 Policy Tests',
    success: true,
    passed: results.length,
    failed: 0,
    safety: {
      databaseWritesPerformed: false,
      actionCreated: false,
      executorEnabled: false,
      externalWritesEnabled: false,
      autoRunTriggered: false,
    },
    note: 'Phase 6.10 validates policy dry-run service for admin simulation, QA, and future policy UI preview. It does not create actions, persist snapshots, approve, queue, execute, or write externally.',
  }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
