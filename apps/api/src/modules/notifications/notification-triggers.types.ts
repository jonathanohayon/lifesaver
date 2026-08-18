import type { QuietHoursEnforcementDecision } from './notification-quiet-hours.types.js';
export type NotificationTriggerType =
  | 'action_proposed'
  | 'action_failed'
  | 'high_risk_action_waiting'
  | 'approval_reminder_needed';

export type NotificationTriggerCandidateRow = {
  id: string;
  workspace_id: string;
  action_type: string;
  title: string;
  description: string | null;
  status: string;
  risk_level: string;
  approval_required: boolean;
  policy_decision: string;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  executed_at: Date | null;
  last_event_type: string | null;
  last_event_message: string | null;
  last_event_at: Date | null;
  reminder_count: number;
  last_reminder_at: Date | null;
};

export type NotificationTriggerPreferencesSnapshot = {
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

export type NotificationTriggerInput = {
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  status: string;
  riskLevel: string;
  approvalRequired: boolean;
  policyDecision: string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  lastEventType?: string | null;
  lastEventMessage?: string | null;
  lastEventAt?: Date | string | null;
  reminderCount?: number;
  lastReminderAt?: Date | string | null;
};

export type NotificationTriggerDecision = {
  triggerType: NotificationTriggerType;
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  reason: string;
  reviewUrl: string;
  priority: 'normal' | 'elevated' | 'urgent';
  channels: {
    inAppCandidate: boolean;
    emailCandidate: boolean;
    slackCandidate: false;
  };
  timing: {
    actionAgeMinutes: number;
    reminderDue: boolean;
    reminderCount: number;
    maxEscalations: number;
    quietHoursMayDelayEmail: boolean;
  };
  quietHoursDelivery: Pick<QuietHoursEnforcementDecision, 'quietHours' | 'critical' | 'channels'>;
  safety: {
    triggerOnly: true;
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

export type NotificationTriggerEvaluation = {
  version: '0.7.0';
  phase: 'phase_10_5_notification_event_triggers';
  workspaceId: string;
  generatedAt: string;
  counts: {
    candidatesEvaluated: number;
    triggersCreated: number;
    actionProposed: number;
    actionFailed: number;
    highRiskWaiting: number;
    approvalRemindersNeeded: number;
  };
  triggers: NotificationTriggerDecision[];
  preferencesSnapshot: NotificationTriggerPreferencesSnapshot;
  safety: {
    triggerServiceOnly: true;
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
