export const NOTIFICATION_QUIET_HOURS_PHASE = 'phase_10_7_quiet_hours_enforcement' as const;
export const NOTIFICATION_QUIET_HOURS_VERSION = '0.7.0' as const;

export type SharedQuietHoursChannel = 'in_app' | 'email' | 'slack';
export type SharedQuietHoursTriggerType = 'action_proposed' | 'action_failed' | 'high_risk_action_waiting' | 'approval_reminder_needed' | 'manual_preview';

export type SharedQuietHoursChannelDecision = {
  channel: SharedQuietHoursChannel;
  candidate: boolean;
  allowedNow: boolean;
  delayed: boolean;
  delayedUntil: string | null;
  criticalOverride: boolean;
  reason: string;
};

export type SharedQuietHoursEnforcementDecision = {
  version: typeof NOTIFICATION_QUIET_HOURS_VERSION;
  phase: typeof NOTIFICATION_QUIET_HOURS_PHASE;
  actionId: string;
  workspaceId: string;
  title: string;
  actionType: string;
  riskLevel: string;
  priority: 'normal' | 'elevated' | 'urgent';
  triggerType: SharedQuietHoursTriggerType;
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
    inApp: SharedQuietHoursChannelDecision;
    email: SharedQuietHoursChannelDecision;
    slack: SharedQuietHoursChannelDecision;
  };
};
