export type ApprovalDeepLinkSource =
  | 'in_app_notification_center'
  | 'email_notification'
  | 'notification_trigger'
  | 'approval_reminder'
  | 'manual_copy';

export type ApprovalDeepLinkInput = {
  actionId: string;
  source?: ApprovalDeepLinkSource;
  appBaseUrl?: string | null;
};

export type ApprovalDeepLinkOutput = {
  version: '0.7.0';
  phase: 'phase_10_4_approval_deep_links';
  actionId: string;
  reviewUrl: string;
  requiresLogin: true;
  targetPage: '/actions.html';
  targetMode: 'action_detail_drawer';
  safety: {
    containsToken: false;
    containsSecret: false;
    exposesPayloadJson: false;
    canApproveByLinkAlone: false;
    canExecuteByLinkAlone: false;
    requiresAuthenticatedSession: true;
  };
};
