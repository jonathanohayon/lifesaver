export const NOTIFICATION_EMAIL_TEMPLATE_PHASE = 'phase_10_3_email_notification_template' as const;
export const NOTIFICATION_EMAIL_TEMPLATE_VERSION = '0.7.0' as const;

export type NotificationEmailTemplateSafetyContract = {
  templateOnly: true;
  sendsEmailInThisPhase: false;
  callsExternalEmailProvider: false;
  exposesTokensOrSecrets: false;
  exposesRawPayloadJson: false;
};
