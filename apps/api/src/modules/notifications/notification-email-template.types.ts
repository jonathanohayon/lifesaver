export type NotificationEmailTemplateActionInput = {
  actionId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  reason: string;
  reviewUrl: string;
  createdAt?: Date | string | null;
  workspaceName?: string | null;
};

export type NotificationEmailTemplateOutput = {
  version: '0.7.0';
  phase: 'phase_10_3_email_notification_template';
  templateKey: 'approval_needed_email';
  subject: string;
  preheader: string;
  textBody: string;
  htmlBody: string;
  reviewUrl: string;
  action: {
    actionId: string;
    title: string;
    actionType: string;
    riskLevel: string;
    reason: string;
    createdAt: string | null;
    workspaceName: string | null;
  };
  safety: {
    templateOnly: true;
    sendsEmailInThisPhase: false;
    callsExternalEmailProvider: false;
    includesActionTitle: true;
    includesActionType: true;
    includesRiskLevel: true;
    includesReason: true;
    includesReviewLink: true;
    exposesTokensOrSecrets: false;
    exposesRawPayloadJson: false;
    includesAttachments: false;
    includesTrackingPixel: false;
  };
};
