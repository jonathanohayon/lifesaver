export const SUPPORT_ACTION_UI_PHASE = 'phase_12_9_ticket_to_action_ui';
export const SUPPORT_ACTION_UI_HEALTH_MODE = 'v2-phase-12-9-ticket-to-action-ui';
export const SUPPORT_ACTION_UI_DELIVERABLE = 'support_action_ui';

export type SupportActionUiActionStatus = 'proposed' | 'approved' | 'rejected' | 'cancelled' | 'executed' | 'failed' | 'unknown';
export type SupportActionUiActionType = 'support_reply_send';

export type SupportActionUiPublicContract = {
  actionType: SupportActionUiActionType;
  approvalRequired: true;
  policyDecision: 'ask';
  reviewControls: {
    actionId: string | null;
    actionStatus: SupportActionUiActionStatus;
    approveEnabled: boolean;
    rejectEnabled: boolean;
    approveRequiresConfirmation: true;
    rejectRequiresReason: true;
    canSendEmail: false;
    canExecuteSupportSend: false;
  };
  safety: {
    browserSafeOnly: true;
    usesExistingInternalApprovalEndpoints: true;
    approveRejectCanExecuteAction: false;
    emailSent: false;
    gmailApiCalled: false;
    supportSendExecutorAdded: false;
    supportAutoReplyAdded: false;
    rawProviderPayloadReturned: false;
    rawTicketPayloadReturned: false;
  };
};
