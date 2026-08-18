export type QuietHoursPreferencesSnapshot = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  slackEnabled: false;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
};

export type QuietHoursNotificationChannel = 'in_app' | 'email' | 'slack';

export type QuietHoursTriggerType =
  | 'action_proposed'
  | 'action_failed'
  | 'high_risk_action_waiting'
  | 'approval_reminder_needed'
  | 'manual_preview';

export type QuietHoursEnforcementInput = {
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  priority: 'normal' | 'elevated' | 'urgent';
  triggerType: QuietHoursTriggerType;
  channels: {
    inAppCandidate: boolean;
    emailCandidate: boolean;
    slackCandidate: false;
  };
};

export type QuietHoursChannelDecision = {
  channel: QuietHoursNotificationChannel;
  candidate: boolean;
  allowedNow: boolean;
  delayed: boolean;
  delayedUntil: string | null;
  criticalOverride: boolean;
  reason: string;
};

export type QuietHoursEnforcementDecision = {
  version: '0.7.0';
  phase: 'phase_10_7_quiet_hours_enforcement';
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  priority: 'normal' | 'elevated' | 'urgent';
  triggerType: QuietHoursTriggerType;
  generatedAt: string;
  quietHours: {
    enabled: boolean;
    activeNow: boolean;
    timezone: string;
    start: string;
    end: string;
    crossesMidnight: boolean;
    localTime: string;
    nextOpenAt: string | null;
  };
  critical: {
    isCritical: boolean;
    reason: string;
  };
  channels: {
    inApp: QuietHoursChannelDecision;
    email: QuietHoursChannelDecision;
    slack: QuietHoursChannelDecision;
  };
  safety: {
    quietHoursEnforcementOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    createsNotificationRowsInThisPhase: false;
    callsExternalServices: false;
    canApproveAction: false;
    canExecuteAction: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
  };
};

export type QuietHoursPreviewResponse = {
  version: '0.7.0';
  phase: 'phase_10_7_quiet_hours_enforcement';
  workspaceId: string;
  generatedAt: string;
  counts: {
    candidatesEvaluated: number;
    delayedByQuietHours: number;
    criticalOverrides: number;
    allowedNow: number;
  };
  decisions: QuietHoursEnforcementDecision[];
  preferencesSnapshot: QuietHoursPreferencesSnapshot;
  safety: {
    quietHoursEnforcementOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    createsNotificationRowsInThisPhase: false;
    callsExternalServices: false;
    autoApprovalEnabled: false;
    autoExecutionEnabled: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
  };
};
