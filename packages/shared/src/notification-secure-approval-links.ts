export const SECURE_APPROVAL_LINKS_PHASE = 'phase_10_9_secure_approval_links' as const;
export const SECURE_APPROVAL_LINKS_VERSION = '0.7.0' as const;

export type SecureApprovalLinkSource =
  | 'email_notification'
  | 'in_app_notification_center'
  | 'notification_trigger'
  | 'approval_reminder'
  | 'manual_copy';

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
  behavior: {
    opensApp: true;
    opensExactActionDetail: true;
    requiresLogin: true;
    unauthenticatedRedirect: './login.html?returnTo=<encoded secure path>';
    allowedScreen: '/actions.html';
    allowedMode: 'review_only_action_detail';
    automaticApprovalFromLink: false;
    automaticExecutionFromLink: false;
  };
  safety: {
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
};
