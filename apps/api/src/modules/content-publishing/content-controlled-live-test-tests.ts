import assert from 'node:assert/strict';
import {
  buildControlledLiveTestStatusSummary,
  CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE,
  CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME,
  CONTENT_CONTROLLED_LIVE_TEST_PHASE,
  DEFAULT_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE,
  evaluateControlledLiveTestReport,
} from './content-controlled-live-test.js';
import { CONTENT_REAL_PUBLISH_EXECUTOR_NAME, LINKEDIN_REQUIRED_WRITE_SCOPE } from './content-real-publish.executor.js';
import type { SafeContentPublishResultLog } from './content-publish-result-logs.js';

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    workspace_id: 'workspace-1',
    action_type: 'content_publish',
    status: 'executed',
    approved_at: new Date('2026-07-06T10:00:00.000Z'),
    executed_at: new Date('2026-07-06T10:02:00.000Z'),
    risk_level: 'low',
    policy_decision: 'ask',
    payload_json: { platform: 'linkedin', caption: 'Test post' },
    ...overrides,
  } as any;
}

function successLog(overrides: Partial<SafeContentPublishResultLog> = {}): SafeContentPublishResultLog {
  return {
    id: 'result-1',
    actionId: 'action-1',
    workspaceId: 'workspace-1',
    executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
    resultStatus: 'success',
    platformPostId: 'urn:li:share:123',
    permalink: 'https://www.linkedin.com/feed/update/urn:li:share:123',
    publishedTime: '2026-07-06T10:02:00.000Z',
    platformResponseSummary: {
      platform: 'linkedin',
      httpStatus: 201,
      success: true,
      postIdSource: 'x-restli-id',
      permalinkSource: 'none',
      platformPostIdPresent: true,
      permalinkPresent: false,
      publishedTimePresent: true,
      responseBodyType: 'object',
      responseBodyKeys: [],
      safeHeaderKeys: ['x-restli-id'],
      rawResponseBodyStored: false,
      rawTokenStored: false,
    },
    resultSummary: 'LinkedIn post published after manual approval.',
    errorIfFailed: null,
    rollbackStatus: null,
    createdAt: '2026-07-06T10:02:00.000Z',
    updatedAt: '2026-07-06T10:02:00.000Z',
    safety: {
      rawTokenReturned: false,
      rawResponseBodyReturned: false,
      rollbackPayloadReturned: false,
    },
    ...overrides,
  };
}

function reportInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'workspace-1',
    actionId: 'action-1',
    input: {
      databaseConfigured: true,
      action: action(),
      manualApprovalEvent: {
        id: 'approval-event-1',
        actor_user_id: 'user-1',
        created_at: new Date('2026-07-06T10:00:00.000Z'),
      },
      resultLogs: [successLog()],
    },
    ...overrides,
  } as any;
}

test('status summary uses Phase 9.10 health mode', () => {
  const summary = buildControlledLiveTestStatusSummary();
  assert.equal(summary.healthMode, CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE);
  assert.equal(summary.phase, CONTENT_CONTROLLED_LIVE_TEST_PHASE);
});

test('status summary names the controlled live test report', () => {
  const summary = buildControlledLiveTestStatusSummary();
  assert.equal(summary.reportName, CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME);
});

test('status summary requires exact founder approval phrase', () => {
  const summary = buildControlledLiveTestStatusSummary();
  assert.equal(summary.requiredApprovalPhrase, DEFAULT_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE);
});

test('status summary confirms report endpoint does not publish', () => {
  const summary = buildControlledLiveTestStatusSummary();
  assert.equal(summary.thisEndpointPublishes, false);
  assert.equal(summary.thisEndpointDeletes, false);
});

test('pass report requires one success log', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.status, 'pass');
  assert.equal(report.liveTest.successfulPublishResultCount, 1);
});

test('pass report stores LinkedIn post ID', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.liveTest.platformPostId, 'urn:li:share:123');
  assert.equal(report.checks.platformPostIdStored, true);
});

test('pass report includes published time', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.liveTest.publishedTime, '2026-07-06T10:02:00.000Z');
  assert.equal(report.checks.publishedTimeStored, true);
});

test('pass report includes manual approval evidence', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.liveTest.manualApprovalActorUserId, 'user-1');
  assert.equal(report.checks.actionManuallyApproved, true);
});

test('not ready when database is unavailable', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: false, action: null, manualApprovalEvent: null, resultLogs: [] },
  }));
  assert.equal(report.status, 'not_ready');
  assert.equal(report.checks.databaseConfigured, false);
});

test('not ready when action is missing', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: null, manualApprovalEvent: null, resultLogs: [successLog()] },
  }));
  assert.equal(report.status, 'not_ready');
  assert.equal(report.checks.actionFound, false);
});

test('fails when action type is not content_publish', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action({ action_type: 'support_reply_send' }), manualApprovalEvent: null, resultLogs: [successLog()] },
  }));
  assert.equal(report.checks.actionTypeValid, false);
  assert.notEqual(report.status, 'pass');
});

test('fails when action was not manually approved', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action({ approved_at: null }), manualApprovalEvent: null, resultLogs: [successLog()] },
  }));
  assert.equal(report.checks.actionManuallyApproved, false);
  assert.notEqual(report.status, 'pass');
});

test('fails when action status is not executed or rolled_back', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action({ status: 'approved' }), manualApprovalEvent: null, resultLogs: [successLog()] },
  }));
  assert.equal(report.checks.actionExecutedOrRolledBackAfterPublish, false);
  assert.notEqual(report.status, 'pass');
});

test('fails when more than one success log exists', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action(), manualApprovalEvent: null, resultLogs: [successLog({ id: 'a' }), successLog({ id: 'b' })] },
  }));
  assert.equal(report.checks.exactlyOneSuccessfulPublishResult, false);
  assert.equal(report.liveTest.successfulPublishResultCount, 2);
});

test('fails when a failed publish result exists', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: {
      databaseConfigured: true,
      action: action(),
      manualApprovalEvent: null,
      resultLogs: [successLog(), successLog({ id: 'failed-1', resultStatus: 'failed', errorIfFailed: '429' })],
    },
  }));
  assert.equal(report.checks.noFailedPublishResult, false);
  assert.equal(report.liveTest.failedPublishResultCount, 1);
});

test('fails when platform post ID is missing', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action(), manualApprovalEvent: null, resultLogs: [successLog({ platformPostId: null })] },
  }));
  assert.equal(report.checks.platformPostIdStored, false);
});

test('fails when published time is missing', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action(), manualApprovalEvent: null, resultLogs: [successLog({ publishedTime: null })] },
  }));
  assert.equal(report.checks.publishedTimeStored, false);
});

test('fails when platform summary is missing', () => {
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action(), manualApprovalEvent: null, resultLogs: [successLog({ platformResponseSummary: null })] },
  }));
  assert.equal(report.checks.platformResponseSummaryStored, false);
});

test('fails if any token is marked returned', () => {
  const unsafe = successLog();
  (unsafe.safety as any).rawTokenReturned = true;
  const report = evaluateControlledLiveTestReport(reportInput({
    input: { databaseConfigured: true, action: action(), manualApprovalEvent: null, resultLogs: [unsafe] },
  }));
  assert.equal(report.checks.tokenNotReturned, false);
});

test('report safety never claims it published', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.safety.thisEndpointPublishes, false);
  assert.equal(report.safety.externalWritesAttemptedByThisEndpoint, false);
});

test('report contains selected LinkedIn executor and scope', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  assert.equal(report.liveTest.executorName, CONTENT_REAL_PUBLISH_EXECUTOR_NAME);
  assert.equal(report.liveTest.requiredScope, LINKEDIN_REQUIRED_WRITE_SCOPE);
});

test('report does not include token-like text', () => {
  const report = evaluateControlledLiveTestReport(reportInput());
  const serialized = JSON.stringify(report);
  assert.equal(/Bearer\s+[A-Za-z0-9._-]+/i.test(serialized), false);
  assert.equal(serialized.includes('access_token'), false);
  assert.equal(serialized.includes('refresh_token'), false);
});

async function main() {
  let passed = 0;
  const failures: Array<{ name: string; error: unknown }> = [];

  for (const item of tests) {
    try {
      await item.run();
      passed += 1;
    } catch (error) {
      failures.push({ name: item.name, error });
    }
  }

  for (const failure of failures) {
    console.error(`FAIL ${failure.name}`);
    console.error(failure.error);
  }

  console.log(`phase9:controlled-live-test — ${passed} passed, ${failures.length} failed`);

  if (failures.length > 0) process.exit(1);
}

void main();
