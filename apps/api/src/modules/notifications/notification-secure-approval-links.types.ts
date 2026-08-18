export type SecureApprovalLinkSource =
  | 'email_notification'
  | 'in_app_notification_center'
  | 'notification_trigger'
  | 'approval_reminder'
  | 'manual_copy';

export type SecureApprovalLinkInput = {
  actionId: string;
  source?: SecureApprovalLinkSource;
  appBaseUrl?: string | null;
  notificationKey?: string | null;
};

export type SecureApprovalLinkBehavior = {
  opensApp: true;
  opensExactActionDetail: true;
  requiresLogin: true;
  unauthenticatedRedirect: './login.html?returnTo=<encoded secure path>';
  allowedScreen: '/actions.html';
  allowedMode: 'review_only_action_detail';
  automaticApprovalFromLink: false;
  automaticExecutionFromLink: false;
};

export type SecureApprovalLinkSafety = {
  canApproveByClickingEmailLink: false;
  canRejectByClickingEmailLink: false;
  canExecuteByClickingEmailLink: false;
  canPublishByClickingEmailLink: false;
  canRollbackByClickingEmailLink: false;
  requiresAuthenticatedSession: true;
  requiresSeparateButtonClickInsideApp: true;
  exposesTokensOrSecrets: false;
  exposesPayloadJson: false;
  exposesRollbackPayload: false;
  allowsApiMutationRoute: false;
};

export type SecureApprovalLinkOutput = {
  version: '0.7.0';
  phase: 'phase_10_9_secure_approval_links';
  actionId: string;
  reviewUrl: string;
  source: SecureApprovalLinkSource;
  notificationKey: string | null;
  queryParams: {
    actionId: string;
    source: SecureApprovalLinkSource;
    linkMode: 'review_only';
    notificationKey?: string;
  };
  behavior: SecureApprovalLinkBehavior;
  safety: SecureApprovalLinkSafety;
};

export type SecureApprovalLinkStatus = {
  version: '0.7.0';
  phase: 'phase_10_9_secure_approval_links';
  status: 'available';
  rule: 'email_and_in_app_links_open_app_only_never_auto_approve';
  endpoints: {
    status: 'GET /api/v1/notifications/secure-approval-links/status';
    preview: 'GET /api/v1/notifications/secure-approval-links/preview?actionId=<ACTION_ID>';
  };
  behavior: SecureApprovalLinkBehavior;
  safety: SecureApprovalLinkSafety;
};
