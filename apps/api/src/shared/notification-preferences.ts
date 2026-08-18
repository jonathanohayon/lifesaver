export type NotificationPreferenceChannelSettings = {
  inApp: boolean;
  email: boolean;
  slack: false;
};

export type NotificationQuietHoursSettings = {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
};

export type NotificationEscalationSettings = {
  approvalEscalationMinutes: number;
  repeatEscalationMinutes: number;
  maxEscalations: number;
};

export const DEFAULT_NOTIFICATION_PREFERENCE_CHANNELS: NotificationPreferenceChannelSettings = {
  inApp: true,
  email: false,
  slack: false,
};

export const DEFAULT_NOTIFICATION_QUIET_HOURS: NotificationQuietHoursSettings = {
  enabled: false,
  start: '22:00',
  end: '08:00',
  timezone: 'America/New_York',
};

export const DEFAULT_NOTIFICATION_ESCALATION: NotificationEscalationSettings = {
  approvalEscalationMinutes: 60,
  repeatEscalationMinutes: 120,
  maxEscalations: 3,
};

export const NOTIFICATION_PREFERENCES_SAFETY_NOTE = 'Phase 10.1 stores notification settings only. It does not send email, Slack, or in-app notifications.';
