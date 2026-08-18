export const APPROVAL_REMINDERS_PHASE = 'phase_10_6_reminder_escalation_logic' as const;
export const APPROVAL_REMINDERS_VERSION = '0.7.0' as const;

export type SharedApprovalReminderSafety = {
  reminderPreviewOnly: true;
  createsNotificationRowsInThisPhase: false;
  sendsEmailInThisPhase: false;
  sendsSlackInThisPhase: false;
  callsExternalServices: false;
  canApproveAction: false;
  canExecuteAction: false;
  exposesTokensOrSecrets: false;
  exposesActionPayloadJson: false;
};
