export type NotificationQaCheckKey =
  | 'in_app_notification'
  | 'email_notification'
  | 'deep_link'
  | 'auth_required'
  | 'failed_notification_logs';

export type NotificationQaCheckStatus = 'pass' | 'fail';

export type NotificationQaCheck = {
  key: NotificationQaCheckKey;
  label: string;
  status: NotificationQaCheckStatus;
  evidence: string;
  safetyNotes: string[];
};

export type NotificationQaReport = {
  version: '0.7.0';
  phase: 'phase_10_10_notification_qa';
  generatedAt: string;
  workspaceId: string;
  actionId: string;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    readyForPhase10Completion: boolean;
  };
  checks: NotificationQaCheck[];
  artifacts: {
    inAppNotificationPreview: {
      pendingApprovalCount: number;
      highRiskPendingApprovalCount: number;
      firstReviewUrl: string;
    };
    emailNotificationPreview: {
      subject: string;
      preheader: string;
      reviewUrl: string;
      includesRequiredFields: boolean;
      sendsEmailInThisPhase: false;
    };
    secureDeepLinkPreview: {
      reviewUrl: string;
      linkMode: 'review_only';
      opensExactActionDetail: true;
      requiresLogin: true;
      canApproveByClickingEmailLink: false;
    };
    failedNotificationLogPreview: {
      eventType: 'notification_failed';
      status: 'failed';
      channel: 'email';
      errorMessage: string;
    };
  };
  safety: {
    qaReportOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    callsExternalNotificationProviders: false;
    canApproveAction: false;
    canRejectAction: false;
    canExecuteAction: false;
    canPublishContent: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
    exposesRollbackPayload: false;
  };
};

export type NotificationQaStatus = {
  version: '0.7.0';
  phase: 'phase_10_10_notification_qa';
  status: 'available';
  deliverable: 'Notification QA report';
  endpoints: {
    status: 'GET /api/v1/notifications/qa/status';
    report: 'GET /api/v1/notifications/qa/report';
  };
  requiredChecks: NotificationQaCheckKey[];
  safety: NotificationQaReport['safety'];
};
