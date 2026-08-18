import assert from 'node:assert/strict';
import {
  assertDailyActionDigestSafe,
  buildDailyActionDigestExample,
  buildDailyActionDigestReport,
  buildDailyActionDigestStatus,
  DAILY_ACTION_DIGEST_HEALTH_MODE,
  previewDailyActionDigest,
} from './daily-action-digest.model.js';

function testStatus() {
  const status = buildDailyActionDigestStatus();
  assert.equal(DAILY_ACTION_DIGEST_HEALTH_MODE, 'v2-phase-15-8-daily-action-digest');
  assert.equal(status.healthMode, 'v2-phase-15-8-daily-action-digest');
  assert.equal(status.actionsExecutedReported, true);
  assert.equal(status.actionsFailedReported, true);
  assert.equal(status.waitingForApprovalReported, true);
  assert.equal(status.blockedByPolicyReported, true);
  assert.equal(status.recommendationsReported, true);
  assert.equal(status.scheduledJobEnabled, false);
  assert.equal(status.actionCreationEnabled, false);
  assert.equal(status.executorEnabled, false);
  assert.equal(status.autoRunEnabled, false);
}

function testBuckets() {
  const digest = buildDailyActionDigestExample();
  assert.equal(digest.counts.executed, 1);
  assert.equal(digest.counts.failed, 1);
  assert.equal(digest.counts.waitingForApproval, 1);
  assert.equal(digest.counts.blockedByPolicy, 1);
  assert.ok(digest.briefText.includes('1 action(s) executed'));
  assert.ok(digest.recommendations.some((item) => item.toLowerCase().includes('failed actions')));
  assert.equal(digest.wouldCreateActionThisPhase, false);
  assert.equal(digest.wouldExecuteActionThisPhase, false);
  assert.equal(digest.wouldCallExternalConnectorThisPhase, false);
}

function testPendingAndBlockedPriority() {
  const digest = previewDailyActionDigest({
    business_day_label: 'Friday',
    actions: [
      { id: 'a1', title: 'Approve support reply', action_type: 'support_reply_send', category: 'support', status: 'proposed', risk_level: 'medium' },
      { id: 'a2', title: 'Large ad change', action_type: 'adjust_budget', category: 'ads', status: 'blocked', risk_level: 'critical', blocked_reason: 'Policy blocked: hard cap exceeded.' },
    ],
  });
  assert.equal(digest.counts.waitingForApproval, 1);
  assert.equal(digest.counts.blockedByPolicy, 1);
  assert.ok(digest.recommendations.some((item) => item.toLowerCase().includes('pending approvals')));
  assert.ok(digest.recommendations.some((item) => item.toLowerCase().includes('blocked actions')));
}

function testSafetyGatesAndForceIgnored() {
  const digest = previewDailyActionDigest({
    emergency_safe_mode: true,
    master_pause_active: true,
    force: true,
    actions: [{ id: 'a1', status: 'executed', title: 'Already executed action' }],
  });
  assert.equal(digest.decision, 'blocked_by_safety_gate');
  assert.ok(digest.warnings.some((warning) => warning.toLowerCase().includes('master pause')));
  assert.ok(digest.warnings.some((warning) => warning.toLowerCase().includes('force=true')));
  assert.equal(digest.wouldExecuteActionThisPhase, false);
}

function testSecretBlockingAndOutputSafety() {
  const digest = previewDailyActionDigest({
    api_key: 'secret',
    actions: [{ id: 'a1', title: 'Contains access token abc', status: 'failed', failure_reason: 'access_token leaked in source input' }],
  });
  assert.equal(digest.decision, 'blocked_by_safety_gate');
  assert.ok(digest.issues.some((issue) => issue.includes('api_key')));
  assert.ok(digest.sections.actionsFailed[0].reason.includes('[redacted'));
  assertDailyActionDigestSafe(digest);
}

function testReport() {
  const report = buildDailyActionDigestReport();
  assert.equal(report.healthMode, 'v2-phase-15-8-daily-action-digest');
  assert.ok(report.dailyBriefSections.includes('Actions executed'));
  assert.ok(report.dailyBriefSections.includes('What LIFE.SAVER recommends next'));
  assert.equal(report.safety.noActionCreation, true);
  assert.equal(report.safety.noExecutorCall, true);
  assert.equal(report.nextStep, 'Phase 15.9 — Cost Caps + Anomaly Alerts');
  assertDailyActionDigestSafe(report);
}

testStatus();
testBuckets();
testPendingAndBlockedPriority();
testSafetyGatesAndForceIgnored();
testSecretBlockingAndOutputSafety();
testReport();

console.log('Phase 15.8 Daily Action Digest tests passed.');
