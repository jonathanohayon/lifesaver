import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertSafeNotificationQaReport,
  buildNotificationQaReport,
  buildNotificationQaStatus,
} from './notification-qa.model.js';

const actionId = '22222222-2222-4222-8222-222222222222';

test('builds a passing Phase 10.10 notification QA report', () => {
  const report = buildNotificationQaReport({ actionId, generatedAt: new Date('2026-07-06T18:00:00.000Z') });
  assert.equal(report.phase, 'phase_10_10_notification_qa');
  assert.equal(report.summary.totalChecks, 5);
  assert.equal(report.summary.passed, 5);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.readyForPhase10Completion, true);
});

test('QA report includes in-app notification check', () => {
  const report = buildNotificationQaReport({ actionId });
  const check = report.checks.find((item) => item.key === 'in_app_notification');
  assert.equal(check?.status, 'pass');
  assert.equal(report.artifacts.inAppNotificationPreview.pendingApprovalCount, 1);
  assert.equal(report.artifacts.inAppNotificationPreview.firstReviewUrl.includes('actions.html'), true);
});

test('QA report includes email notification template check without sending email', () => {
  const report = buildNotificationQaReport({ actionId });
  const check = report.checks.find((item) => item.key === 'email_notification');
  assert.equal(check?.status, 'pass');
  assert.equal(report.artifacts.emailNotificationPreview.includesRequiredFields, true);
  assert.equal(report.artifacts.emailNotificationPreview.sendsEmailInThisPhase, false);
  assert.equal(report.safety.sendsEmailInThisPhase, false);
});

test('QA report includes secure deep link check', () => {
  const report = buildNotificationQaReport({ actionId, appBaseUrl: 'https://lifesaveragent.com' });
  const check = report.checks.find((item) => item.key === 'deep_link');
  assert.equal(check?.status, 'pass');
  assert.equal(report.artifacts.secureDeepLinkPreview.reviewUrl, 'https://lifesaveragent.com/actions.html?actionId=22222222-2222-4222-8222-222222222222&source=email_notification&linkMode=review_only&notificationKey=notification-qa-email-link');
  assert.equal(report.artifacts.secureDeepLinkPreview.canApproveByClickingEmailLink, false);
});

test('QA report verifies auth required for approval links', () => {
  const report = buildNotificationQaReport({ actionId });
  const check = report.checks.find((item) => item.key === 'auth_required');
  assert.equal(check?.status, 'pass');
  assert.equal(report.artifacts.secureDeepLinkPreview.requiresLogin, true);
});

test('QA report includes failed notification log check', () => {
  const report = buildNotificationQaReport({ actionId });
  const check = report.checks.find((item) => item.key === 'failed_notification_logs');
  assert.equal(check?.status, 'pass');
  assert.equal(report.artifacts.failedNotificationLogPreview.eventType, 'notification_failed');
  assert.equal(report.artifacts.failedNotificationLogPreview.status, 'failed');
  assert.equal(report.artifacts.failedNotificationLogPreview.channel, 'email');
  assert.ok(report.artifacts.failedNotificationLogPreview.errorMessage.length > 0);
});

test('QA report is safe and report-only', () => {
  const report = buildNotificationQaReport({ actionId });
  assert.doesNotThrow(() => assertSafeNotificationQaReport(report));
  assert.equal(report.safety.qaReportOnly, true);
  assert.equal(report.safety.callsExternalNotificationProviders, false);
  assert.equal(report.safety.canApproveAction, false);
  assert.equal(report.safety.canExecuteAction, false);
  assert.equal(report.safety.canPublishContent, false);
});

test('QA report does not expose secrets or raw payloads', () => {
  const report = buildNotificationQaReport({ actionId });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'client_secret', 'database_url', 'payload_json', 'rollback_payload', 'encrypted_']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});

test('QA status lists required checks and read-only safety', () => {
  const status = buildNotificationQaStatus();
  assert.equal(status.phase, 'phase_10_10_notification_qa');
  assert.equal(status.requiredChecks.length, 5);
  assert.equal(status.safety.qaReportOnly, true);
  assert.equal(status.safety.sendsEmailInThisPhase, false);
  assert.equal(status.safety.canApproveAction, false);
});
