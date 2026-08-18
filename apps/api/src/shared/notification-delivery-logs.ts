export const NOTIFICATION_DELIVERY_LOGS_PHASE = 'phase_10_8_delivery_logs' as const;
export const NOTIFICATION_DELIVERY_LOG_EVENT_TYPES = [
  'notification_created',
  'notification_sent',
  'notification_failed',
  'notification_opened',
] as const;
export const NOTIFICATION_DELIVERY_CHANNELS = ['in_app', 'email', 'slack'] as const;

export type NotificationDeliveryLogEventType = typeof NOTIFICATION_DELIVERY_LOG_EVENT_TYPES[number];
export type NotificationDeliveryLogChannel = typeof NOTIFICATION_DELIVERY_CHANNELS[number];
