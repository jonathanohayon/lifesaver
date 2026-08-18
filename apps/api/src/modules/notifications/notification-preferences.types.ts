export type NotificationPreferenceRow = {
  workspace_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  slack_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  approval_escalation_minutes: number;
  repeat_escalation_minutes: number;
  max_escalations: number;
  updated_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

export type NotificationPreferencePatch = {
  channels?: {
    inApp?: boolean;
    email?: boolean;
    slack?: boolean;
  };
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  escalation?: {
    approvalEscalationMinutes?: number;
    repeatEscalationMinutes?: number;
    maxEscalations?: number;
  };
};

export type SafeNotificationPreferences = {
  version: '0.7.0';
  phase: 'phase_10_1_notification_preferences_model';
  workspaceId: string;
  channels: {
    inApp: {
      enabled: boolean;
      status: 'stored_preference_only';
    };
    email: {
      enabled: boolean;
      status: 'stored_preference_only';
      deliveryImplemented: false;
    };
    slack: {
      enabled: false;
      status: 'planned_later';
      deliveryImplemented: false;
    };
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    crossesMidnight: boolean;
  };
  escalation: {
    approvalEscalationMinutes: number;
    repeatEscalationMinutes: number;
    maxEscalations: number;
    schedulingImplemented: false;
  };
  triggers: {
    actionNeedsApproval: true;
    actionFailed: true;
    rollbackNeedsReview: true;
  };
  safety: {
    modelOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    createsInAppRowsInThisPhase: false;
    externalServicesCalled: false;
    browserReceivesSecrets: false;
    autoRunEnabled: false;
  };
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};
