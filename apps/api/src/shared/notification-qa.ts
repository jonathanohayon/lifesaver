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
