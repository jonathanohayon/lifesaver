export type NotificationDeliveryChannel = 'in_app' | 'email' | 'slack';

export type NotificationDeliveryEventType =
  | 'notification_created'
  | 'notification_sent'
  | 'notification_failed'
  | 'notification_opened';

export type NotificationDeliveryStatus = 'created' | 'sent' | 'failed' | 'opened';

export type NotificationDeliveryLogInput = {
  workspaceId: string;
  actionId?: string | null;
  userId?: string | null;
  notificationKey?: string | null;
  channel: NotificationDeliveryChannel;
  eventType: NotificationDeliveryEventType;
  recipientHint?: string | null;
  deliveryProvider?: string | null;
  message?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type SafeNotificationDeliveryLog = {
  version: '0.7.0';
  phase: 'phase_10_8_delivery_logs';
  id?: string;
  workspaceId: string;
  actionId: string | null;
  userId: string | null;
  notificationKey: string | null;
  channel: NotificationDeliveryChannel;
  eventType: NotificationDeliveryEventType;
  status: NotificationDeliveryStatus;
  recipientHint: string | null;
  deliveryProvider: string;
  message: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  safety: {
    deliveryLogOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    callsExternalServices: false;
    canApproveAction: false;
    canExecuteAction: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
    exposesRollbackPayload: false;
  };
};

export type NotificationDeliveryLogRow = {
  id: string;
  workspace_id: string;
  action_id: string | null;
  user_id: string | null;
  notification_key: string | null;
  channel: NotificationDeliveryChannel;
  event_type: NotificationDeliveryEventType;
  recipient_hint: string | null;
  delivery_provider: string;
  message: string | null;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: Date | string;
};

export type NotificationDeliveryLogsResponse = {
  version: '0.7.0';
  phase: 'phase_10_8_delivery_logs';
  workspaceId: string;
  generatedAt: string;
  counts: {
    total: number;
    created: number;
    sent: number;
    failed: number;
    opened: number;
  };
  logs: SafeNotificationDeliveryLog[];
  safety: {
    deliveryLogsOnly: true;
    sendsEmailInThisPhase: false;
    sendsSlackInThisPhase: false;
    callsExternalServices: false;
    canApproveAction: false;
    canExecuteAction: false;
    exposesTokensOrSecrets: false;
    exposesActionPayloadJson: false;
    exposesRollbackPayload: false;
  };
};
