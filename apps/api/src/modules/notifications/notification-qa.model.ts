import type { NotificationCenterPendingActionRow, NotificationCenterRecentEventRow } from './notification-center.types.js';
import { buildNotificationCenterResponse } from './notification-center.model.js';
import { buildApprovalNeededEmailTemplate } from './notification-email-template.model.js';
import { buildSecureApprovalReviewUrl } from './notification-secure-approval-links.model.js';
import { buildNotificationDeliveryLog } from './notification-delivery-logs.model.js';
import type { NotificationQaCheck, NotificationQaReport, NotificationQaStatus } from './notification-qa.types.js';

export const NOTIFICATION_QA_VERSION = '0.7.0' as const;
export const NOTIFICATION_QA_PHASE = 'phase_10_10_notification_qa' as const;

const forbiddenFragments = [
  'access_token',
  'refresh_token',
  'authorization',
  'bearer ',
  'api_key',
  'client_secret',
  'database_url',
  'password=',
  'password:',
  'app_encryption_key',
  'worker_shared_secret',
  'raw_payload',
  'payload_json',
  'rollback_payload',
  'encrypted_',
  'set-cookie',
];

const sampleWorkspaceId = 'workspace_notification_qa';
const sampleActionId = '11111111-1111-4111-8111-111111111111';
const sampleCreatedAt = new Date('2026-07-06T12:00:00.000Z');

function samplePendingAction(): NotificationCenterPendingActionRow {
  return {
    id: sampleActionId,
    workspace_id: sampleWorkspaceId,
    action_type: 'content_publish',
    title: 'Review LinkedIn launch update',
    description: 'Manual-approved LinkedIn content action waiting for founder review.',
    status: 'proposed',
    risk_level: 'high',
    approval_required: true,
    policy_decision: 'ask',
    created_at: sampleCreatedAt,
    updated_at: sampleCreatedAt,
  };
}

function sampleRecentEvent(): NotificationCenterRecentEventRow {
  return {
    id: 'event_notification_qa_001',
    action_id: sampleActionId,
    workspace_id: sampleWorkspaceId,
    action_type: 'content_publish',
    action_title: 'Review LinkedIn launch update',
    action_status: 'proposed',
    risk_level: 'high',
    event_type: 'action_proposed',
    from_status: null,
    to_status: 'proposed',
    message: 'Action proposed and waiting for manual approval.',
    actor_user_id: 'system',
    metadata_json: { safePreview: true, rawPayloadIncluded: false },
    created_at: sampleCreatedAt,
  };
}

function makeCheck(params: Omit<NotificationQaCheck, 'status'> & { passed: boolean }): NotificationQaCheck {
  return {
    key: params.key,
    label: params.label,
    status: params.passed ? 'pass' : 'fail',
    evidence: params.evidence,
    safetyNotes: params.safetyNotes,
  };
}

function assertNoSensitiveFragments(report: NotificationQaReport): void {
  const serialized = JSON.stringify(report).toLowerCase();
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) {
      throw new Error(`Notification QA report contains forbidden fragment: ${fragment}`);
    }
  }
}

export function buildNotificationQaReport(params: {
  workspaceId?: string;
  actionId?: string;
  appBaseUrl?: string | null;
  generatedAt?: Date;
} = {}): NotificationQaReport {
  const generatedAt = params.generatedAt || new Date();
  const workspaceId = params.workspaceId || sampleWorkspaceId;
  const actionId = params.actionId || sampleActionId;

  const pending = samplePendingAction();
  pending.id = actionId;
  pending.workspace_id = workspaceId;

  const event = sampleRecentEvent();
  event.action_id = actionId;
  event.workspace_id = workspaceId;

  const notificationCenter = buildNotificationCenterResponse({
    workspaceId,
    pendingApprovals: [pending],
    recentEvents: [event],
    generatedAt,
  });

  const secureLink = buildSecureApprovalReviewUrl({
    actionId,
    source: 'email_notification',
    appBaseUrl: params.appBaseUrl || null,
    notificationKey: 'notification-qa-email-link',
  });

  const emailTemplate = buildApprovalNeededEmailTemplate({
    actionId,
    title: pending.title,
    actionType: pending.action_type,
    riskLevel: pending.risk_level,
    reason: 'High-risk content publish action is waiting for founder approval.',
    reviewUrl: secureLink.reviewUrl,
    createdAt: pending.created_at,
    workspaceName: 'LIFE.SAVER QA Workspace',
  });

  const failedLog = buildNotificationDeliveryLog({
    workspaceId,
    actionId,
    userId: 'founder-user-qa',
    notificationKey: 'notification-qa-failed-email',
    channel: 'email',
    eventType: 'notification_failed',
    recipientHint: 'founder@example.com',
    deliveryProvider: 'lifesaver_internal_qa',
    message: 'Approval notification delivery failed during QA simulation.',
    errorMessage: 'Simulated email provider failure for notification QA.',
    metadata: {
      qaOnly: true,
      externalProviderCalled: false,
    },
  }, generatedAt);

  const checks: NotificationQaCheck[] = [
    makeCheck({
      key: 'in_app_notification',
      label: 'In-app notification center shows pending approval',
      passed: notificationCenter.counts.pendingApprovals === 1 && notificationCenter.pendingApprovals[0]?.actionUrl.includes('actions.html'),
      evidence: `Pending approvals: ${notificationCenter.counts.pendingApprovals}; high-risk pending approvals: ${notificationCenter.counts.highRiskPendingApprovals}.`,
      safetyNotes: [
        'Notification center is read-only.',
        'Notification center links open the action review screen only.',
      ],
    }),
    makeCheck({
      key: 'email_notification',
      label: 'Email notification template contains required fields',
      passed: Boolean(
        emailTemplate.safety.templateOnly &&
        emailTemplate.safety.includesActionTitle &&
        emailTemplate.safety.includesActionType &&
        emailTemplate.safety.includesRiskLevel &&
        emailTemplate.safety.includesReason &&
        emailTemplate.safety.includesReviewLink &&
        !emailTemplate.safety.sendsEmailInThisPhase
      ),
      evidence: `Template subject: ${emailTemplate.subject}`,
      safetyNotes: [
        'Template generation does not send email.',
        'Template excludes secrets, raw payload JSON, rollback payloads, and tracking pixels.',
      ],
    }),
    makeCheck({
      key: 'deep_link',
      label: 'Deep link opens exact action detail screen',
      passed: secureLink.behavior.opensApp && secureLink.behavior.opensExactActionDetail && secureLink.queryParams.actionId === actionId && secureLink.queryParams.linkMode === 'review_only',
      evidence: `Review URL: ${secureLink.reviewUrl}`,
      safetyNotes: [
        'Link contains actionId and linkMode=review_only.',
        'Link targets actions.html, not an API mutation route.',
      ],
    }),
    makeCheck({
      key: 'auth_required',
      label: 'Approval links require login and do not approve from email',
      passed: secureLink.behavior.requiresLogin && secureLink.safety.requiresAuthenticatedSession && secureLink.safety.canApproveByClickingEmailLink === false,
      evidence: 'Secure link behavior requires authenticated app session plus a separate in-app approval click.',
      safetyNotes: [
        'Clicking the email link cannot approve, execute, publish, or rollback.',
        'API route is mounted behind authRequired in api-v1.ts.',
      ],
    }),
    makeCheck({
      key: 'failed_notification_logs',
      label: 'Failed notification logs are recorded safely',
      passed: failedLog.eventType === 'notification_failed' && failedLog.status === 'failed' && Boolean(failedLog.errorMessage),
      evidence: `Failed log status: ${failedLog.status}; provider: ${failedLog.deliveryProvider}.`,
      safetyNotes: [
        'Failure log is a safe delivery log only.',
        'Failure log does not call an external provider or expose secrets.',
      ],
    }),
  ];

  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.length - passed;

  const report: NotificationQaReport = {
    version: NOTIFICATION_QA_VERSION,
    phase: NOTIFICATION_QA_PHASE,
    generatedAt: generatedAt.toISOString(),
    workspaceId,
    actionId,
    summary: {
      totalChecks: checks.length,
      passed,
      failed,
      readyForPhase10Completion: failed === 0,
    },
    checks,
    artifacts: {
      inAppNotificationPreview: {
        pendingApprovalCount: notificationCenter.counts.pendingApprovals,
        highRiskPendingApprovalCount: notificationCenter.counts.highRiskPendingApprovals,
        firstReviewUrl: notificationCenter.pendingApprovals[0]?.actionUrl || '',
      },
      emailNotificationPreview: {
        subject: emailTemplate.subject,
        preheader: emailTemplate.preheader,
        reviewUrl: emailTemplate.reviewUrl,
        includesRequiredFields: true,
        sendsEmailInThisPhase: false,
      },
      secureDeepLinkPreview: {
        reviewUrl: secureLink.reviewUrl,
        linkMode: 'review_only',
        opensExactActionDetail: true,
        requiresLogin: true,
        canApproveByClickingEmailLink: false,
      },
      failedNotificationLogPreview: {
        eventType: 'notification_failed',
        status: 'failed',
        channel: 'email',
        errorMessage: failedLog.errorMessage || 'Notification delivery failed.',
      },
    },
    safety: {
      qaReportOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalNotificationProviders: false,
      canApproveAction: false,
      canRejectAction: false,
      canExecuteAction: false,
      canPublishContent: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      exposesRollbackPayload: false,
    },
  };

  assertSafeNotificationQaReport(report);
  return report;
}

export function assertSafeNotificationQaReport(report: NotificationQaReport): void {
  if (!report.safety.qaReportOnly || report.safety.sendsEmailInThisPhase || report.safety.callsExternalNotificationProviders) {
    throw new Error('Notification QA must remain report-only and must not send or call providers.');
  }
  if (report.safety.canApproveAction || report.safety.canRejectAction || report.safety.canExecuteAction || report.safety.canPublishContent) {
    throw new Error('Notification QA must not mutate actions or content publishing state.');
  }
  if (report.safety.exposesTokensOrSecrets || report.safety.exposesActionPayloadJson || report.safety.exposesRollbackPayload) {
    throw new Error('Notification QA must not expose secrets, raw payload JSON, or rollback payloads.');
  }
  if (report.summary.failed !== 0 || !report.summary.readyForPhase10Completion) {
    throw new Error('Notification QA report is not passing.');
  }
  const required = new Set(['in_app_notification', 'email_notification', 'deep_link', 'auth_required', 'failed_notification_logs']);
  for (const check of report.checks) {
    required.delete(check.key);
    if (check.status !== 'pass') throw new Error(`Notification QA check failed: ${check.key}`);
  }
  if (required.size) throw new Error(`Notification QA report missing checks: ${Array.from(required).join(', ')}`);
  assertNoSensitiveFragments(report);
}

export function buildNotificationQaStatus(): NotificationQaStatus {
  return {
    version: NOTIFICATION_QA_VERSION,
    phase: NOTIFICATION_QA_PHASE,
    status: 'available',
    deliverable: 'Notification QA report',
    endpoints: {
      status: 'GET /api/v1/notifications/qa/status',
      report: 'GET /api/v1/notifications/qa/report',
    },
    requiredChecks: [
      'in_app_notification',
      'email_notification',
      'deep_link',
      'auth_required',
      'failed_notification_logs',
    ],
    safety: {
      qaReportOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalNotificationProviders: false,
      canApproveAction: false,
      canRejectAction: false,
      canExecuteAction: false,
      canPublishContent: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      exposesRollbackPayload: false,
    },
  };
}
