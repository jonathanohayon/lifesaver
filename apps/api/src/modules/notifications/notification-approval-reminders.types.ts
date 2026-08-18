import type { QuietHoursEnforcementDecision } from './notification-quiet-hours.types.js';
export type ApprovalReminderInput = {
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  status: string;
  riskLevel: string;
  approvalRequired: boolean;
  createdAt: Date | string;
  lastReminderAt?: Date | string | null;
  reminderCount?: number;
};

export type ApprovalReminderPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  slackEnabled: false;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  approvalEscalationMinutes: number;
  repeatEscalationMinutes: number;
  maxEscalations: number;
};

export type ApprovalReminderDecision = {
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  status: string;
  reminderDue: boolean;
  reason: string;
  reviewUrl: string;
  priority: 'normal' | 'elevated' | 'urgent';
  timing: {
    actionAgeMinutes: number;
    firstReminderAfterMinutes: number;
    repeatReminderAfterMinutes: number;
    reminderCount: number;
    maxEscalations: number;
    lastReminderAt: string | null;
    nextReminderAt: string | null;
  };
  channels: {
    inAppCandidate: boolean;
    emailCandidate: boolean;
    slackCandidate: false;
    quietHoursMayDelayEmail: boolean;
  };
  quietHoursDelivery: Pick<QuietHoursEnforcementDecision, 'quietHours' | 'critical' | 'channels'>;
  safety: {
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
};

export type ApprovalReminderPreviewResponse = {
  version: '0.7.0';
  phase: 'phase_10_6_reminder_escalation_logic';
  workspaceId: string;
  generatedAt: string;
  counts: {
    candidatesEvaluated: number;
    remindersDue: number;
    urgent: number;
    elevated: number;
  };
  reminders: ApprovalReminderDecision[];
  preferencesSnapshot: ApprovalReminderPreferences;
  safety: {
    reminderSystemOnly: true;
    createsNotificationRowsInThisPhase: false;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    callsExternalServices: false;
    autoApprovalEnabled: false;
    autoExecutionEnabled: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
  };
};
