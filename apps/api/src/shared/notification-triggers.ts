export type SharedNotificationTriggerType =
  | 'action_proposed'
  | 'action_failed'
  | 'high_risk_action_waiting'
  | 'approval_reminder_needed';

export type SharedNotificationTriggerSafety = {
  triggerServiceOnly: true;
  createsNotificationRowsInThisPhase: false;
  sendsEmailInThisPhase: false;
  sendsSlackInThisPhase: false;
  callsExternalServices: false;
  autoApprovalEnabled: false;
  autoExecutionEnabled: false;
};
