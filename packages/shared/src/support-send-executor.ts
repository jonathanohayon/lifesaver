export const SUPPORT_SEND_EXECUTOR_HEALTH_MODE = 'v2-phase-13-2-send-reply-executor' as const;
export const SUPPORT_SEND_EXECUTOR_NAME = 'gmailManualApprovedSupportReplyExecutor' as const;
export const SUPPORT_SEND_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/gmail.send' as const;

export type SupportSendExecutorSharedStatus = {
  healthMode: typeof SUPPORT_SEND_EXECUTOR_HEALTH_MODE;
  executorName: typeof SUPPORT_SEND_EXECUTOR_NAME;
  actionType: 'support_reply_send';
  requiredScope: typeof SUPPORT_SEND_REQUIRED_SCOPE;
  manualApprovalRequired: true;
  autoReplyEnabled: false;
  rawMimeReturnedToBrowser: false;
  rawTokenReturnedToBrowser: false;
};
