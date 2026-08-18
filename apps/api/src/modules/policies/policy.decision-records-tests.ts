import { buildPolicyDecisionSnapshot, POLICY_DECISION_RECORDS_PHASE, summarizePolicyDecisionSnapshot } from './policy.decision-records.js';
import type { EvaluateActionPolicyResult } from './policy.types.js';

type TestStatus = 'pass' | 'fail';
const results: Array<{ name: string; status: TestStatus; message: string }> = [];

function record(name: string, status: TestStatus, message: string) {
  results.push({ name, status, message });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sampleEvaluation(overrides: Partial<EvaluateActionPolicyResult> = {}): EvaluateActionPolicyResult {
  return {
    version: '0.6.0',
    phase: 'v0.6.0 Phase 6.10 Policy Tests' as EvaluateActionPolicyResult['phase'],
    workspaceId: 'workspace-test-1',
    actionId: null,
    actionType: 'content_publish',
    riskLevel: 'low',
    decision: 'ask',
    reason: 'No matching enabled policy rule exists, so default ask applies.',
    matched_policy_id: null,
    matchedPolicyId: null,
    cap_status: 'not_applicable_no_policy_match',
    capStatus: 'not_applicable_no_policy_match',
    checkedPolicyCount: 0,
    matchState: 'no_enabled_policy',
    defaultAskApplied: true,
    approvalRequired: true,
    autoApprovalAllowed: false,
    executorExecutionAllowed: false,
    policyCheckedPauseState: true,
    pause: {
      paused: false,
      blockReason: 'none',
      emergencySafeModeActive: false,
      pauseAllAutonomy: false,
      categoryPaused: false,
    },
    conflictSummary: {
      reasonCode: 'no_matched_policy_default_ask',
      priorityOrder: ['master_pause', 'block_rule', 'hard_cap_exceeded', 'ask_rule', 'auto_approve_rule'],
      matchedCandidateCount: 0,
      winningCandidate: null,
      candidates: [],
    },
    evaluatedAt: '2026-07-05T00:00:00.000Z',
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      note: 'Unit test sample only.',
    },
    ...overrides,
  };
}

function testBuildsSafeSnapshot() {
  const snapshot = buildPolicyDecisionSnapshot({
    evaluation: sampleEvaluation(),
    actionId: 'action-123',
    recordedAt: '2026-07-05T00:01:00.000Z',
  });

  assert(snapshot.phase === POLICY_DECISION_RECORDS_PHASE, 'Snapshot phase should be Phase 6.10.');
  assert(snapshot.actionId === 'action-123', 'Snapshot should store the action id.');
  assert(snapshot.decision === 'ask', 'Snapshot should store the evaluator decision.');
  assert(snapshot.dataPolicy.rawPayloadStored === false, 'Snapshot must not store raw payloads.');
  assert(snapshot.dataPolicy.rawSecretsStored === false, 'Snapshot must not store raw secrets.');
  assert(snapshot.safety.externalWritesAttempted === false, 'Snapshot must not perform external writes.');
  assert(snapshot.safety.executorRan === false, 'Snapshot must not run executors.');
}

function testSummary() {
  const snapshot = buildPolicyDecisionSnapshot({
    evaluation: sampleEvaluation({
      decision: 'block',
      reason: 'Hard cap exceeded.',
      matched_policy_id: 'policy-1',
      matchedPolicyId: 'policy-1',
      cap_status: 'cap_exceeded',
      capStatus: 'cap_exceeded',
    }),
    actionId: 'action-456',
    recordedAt: '2026-07-05T00:02:00.000Z',
  });

  const summary = summarizePolicyDecisionSnapshot(snapshot);
  assert(summary.present === true, 'Summary should report snapshot present.');
  assert(summary.decision === 'block', 'Summary should expose safe decision.');
  assert(summary.matched_policy_id === 'policy-1', 'Summary should expose safe matched policy id.');
  assert(summary.cap_status === 'cap_exceeded', 'Summary should expose safe cap status.');
}

function testEmptySummary() {
  const summary = summarizePolicyDecisionSnapshot({});
  assert(summary.present === true, 'Empty object is still a stored snapshot object.');
  assert(summary.decision === null, 'Missing decision should summarize as null.');
}

async function run() {
  const tests = [
    ['builds safe persisted snapshot', testBuildsSafeSnapshot],
    ['summarizes safe policy decision snapshot', testSummary],
    ['handles empty snapshot safely', testEmptySummary],
  ] as const;

  for (const [name, fn] of tests) {
    try {
      fn();
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

  console.log('Policy decision records tests passed. Phase 6.10 persists safe policy decision snapshots only and performs no external writes.');
}

run();
