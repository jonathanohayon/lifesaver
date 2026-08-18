import { z } from 'zod';
import type {
  NotificationDeliveryEventType,
  NotificationDeliveryLogInput,
  NotificationDeliveryLogRow,
  NotificationDeliveryLogsResponse,
  NotificationDeliveryStatus,
  SafeNotificationDeliveryLog,
} from './notification-delivery-logs.types.js';

export const NOTIFICATION_DELIVERY_LOGS_VERSION = '0.7.0' as const;
export const NOTIFICATION_DELIVERY_LOGS_PHASE = 'phase_10_8_delivery_logs' as const;

const forbiddenFragments = [
  'access_token',
  'refresh_token',
  'authorization',
  'bearer ',
  'api_key',
  'client_secret',
  'database_url',
  'password=',
  'password:',
  'app_encryption_key',
  'worker_shared_secret',
  'raw_payload',
  'payload_json',
  'rollback_payload',
  'encrypted_',
  'set-cookie',
];

export const notificationDeliveryLogInputSchema = z.object({
  workspaceId: z.string().trim().min(1).max(120),
  actionId: z.string().trim().min(1).max(120).nullable().optional(),
  userId: z.string().trim().min(1).max(120).nullable().optional(),
  notificationKey: z.string().trim().min(1).max(160).nullable().optional(),
  channel: z.enum(['in_app', 'email', 'slack']),
  eventType: z.enum(['notification_created', 'notification_sent', 'notification_failed', 'notification_opened']),
  recipientHint: z.string().trim().max(180).nullable().optional(),
  deliveryProvider: z.string().trim().min(1).max(80).nullable().optional(),
  message: z.string().trim().max(700).nullable().optional(),
  errorMessage: z.string().trim().max(700).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function containsForbidden(value: string): boolean {
  const lower = value.toLowerCase();
  return forbiddenFragments.some((fragment) => lower.includes(fragment));
}

export function redactDeliveryLogText(value: unknown, max = 240): string | null {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim().replace(/\s+/g, ' ').slice(0, max);
  if (!clean) return null;
  return containsForbidden(clean) ? '[redacted unsafe text]' : clean;
}

function safeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[redacted max depth]';
  if (typeof value === 'string') return redactDeliveryLogText(value, 300);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeMetadataValue(item, depth + 1));
  if (isPlainRecord(value)) return sanitizeDeliveryLogMetadata(value, depth + 1);
  return String(value).slice(0, 120);
}

export function sanitizeDeliveryLogMetadata(metadata: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 50)) {
    const safeKey = redactDeliveryLogText(key, 80) || 'redacted_key';
    if (safeKey === '[redacted unsafe text]') {
      output.redacted_key = '[redacted unsafe value]';
      continue;
    }
    output[safeKey] = safeMetadataValue(value, depth);
  }
  return output;
}

function statusForEvent(eventType: NotificationDeliveryEventType): NotificationDeliveryStatus {
  switch (eventType) {
    case 'notification_created':
      return 'created';
    case 'notification_sent':
      return 'sent';
    case 'notification_failed':
      return 'failed';
    case 'notification_opened':
      return 'opened';
    default:
      return 'created';
  }
}

function normalizeDate(value: Date | string | null | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

export function buildNotificationDeliveryLog(input: NotificationDeliveryLogInput, now: Date = new Date()): SafeNotificationDeliveryLog {
  const parsed = notificationDeliveryLogInputSchema.parse(input);
  const log: SafeNotificationDeliveryLog = {
    version: NOTIFICATION_DELIVERY_LOGS_VERSION,
    phase: NOTIFICATION_DELIVERY_LOGS_PHASE,
    workspaceId: redactDeliveryLogText(parsed.workspaceId, 120) || '[unknown_workspace]',
    actionId: redactDeliveryLogText(parsed.actionId, 120),
    userId: redactDeliveryLogText(parsed.userId, 120),
    notificationKey: redactDeliveryLogText(parsed.notificationKey, 160),
    channel: parsed.channel,
    eventType: parsed.eventType,
    status: statusForEvent(parsed.eventType),
    recipientHint: redactDeliveryLogText(parsed.recipientHint, 180),
    deliveryProvider: redactDeliveryLogText(parsed.deliveryProvider || 'lifesaver_internal', 80) || 'lifesaver_internal',
    message: redactDeliveryLogText(parsed.message, 700),
    errorMessage: parsed.eventType === 'notification_failed'
      ? (redactDeliveryLogText(parsed.errorMessage, 700) || 'Notification delivery failed.')
      : null,
    metadata: sanitizeDeliveryLogMetadata({
      ...(parsed.metadata || {}),
      phase: NOTIFICATION_DELIVERY_LOGS_PHASE,
      externalServicesCalled: false,
    }),
    createdAt: now.toISOString(),
    safety: {
      deliveryLogOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      exposesRollbackPayload: false,
    },
  };
  assertSafeNotificationDeliveryLog(log);
  return log;
}

export function deliveryLogFromRow(row: NotificationDeliveryLogRow): SafeNotificationDeliveryLog {
  const log = buildNotificationDeliveryLog({
    workspaceId: row.workspace_id,
    actionId: row.action_id,
    userId: row.user_id,
    notificationKey: row.notification_key,
    channel: row.channel,
    eventType: row.event_type,
    recipientHint: row.recipient_hint,
    deliveryProvider: row.delivery_provider,
    message: row.message,
    errorMessage: row.error_message,
    metadata: row.metadata_json || {},
  }, new Date(row.created_at));
  log.id = row.id;
  assertSafeNotificationDeliveryLog(log);
  return log;
}

export function buildNotificationDeliveryLogsResponse(params: {
  workspaceId: string;
  logs: SafeNotificationDeliveryLog[];
  now?: Date;
}): NotificationDeliveryLogsResponse {
  const logs = params.logs.map((log) => {
    assertSafeNotificationDeliveryLog(log);
    return log;
  });
  const response: NotificationDeliveryLogsResponse = {
    version: NOTIFICATION_DELIVERY_LOGS_VERSION,
    phase: NOTIFICATION_DELIVERY_LOGS_PHASE,
    workspaceId: redactDeliveryLogText(params.workspaceId, 120) || '[unknown_workspace]',
    generatedAt: (params.now || new Date()).toISOString(),
    counts: {
      total: logs.length,
      created: logs.filter((log) => log.eventType === 'notification_created').length,
      sent: logs.filter((log) => log.eventType === 'notification_sent').length,
      failed: logs.filter((log) => log.eventType === 'notification_failed').length,
      opened: logs.filter((log) => log.eventType === 'notification_opened').length,
    },
    logs,
    safety: {
      deliveryLogsOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      exposesRollbackPayload: false,
    },
  };
  assertSafeNotificationDeliveryLogsResponse(response);
  return response;
}

export function assertSafeNotificationDeliveryLog(log: SafeNotificationDeliveryLog): void {
  const serialized = JSON.stringify(log).toLowerCase();
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) throw new Error(`Notification delivery log contains forbidden fragment: ${fragment}`);
  }
  if (!log.safety.deliveryLogOnly || log.safety.sendsEmailInThisPhase || log.safety.callsExternalServices || log.safety.canApproveAction || log.safety.canExecuteAction) {
    throw new Error('Notification delivery log must remain log-only and non-executing.');
  }
  if (log.eventType !== 'notification_failed' && log.errorMessage) {
    throw new Error('Only notification_failed logs may include an error message.');
  }
}

export function assertSafeNotificationDeliveryLogsResponse(response: NotificationDeliveryLogsResponse): void {
  response.logs.forEach(assertSafeNotificationDeliveryLog);
  if (!response.safety.deliveryLogsOnly || response.safety.sendsEmailInThisPhase || response.safety.sendsSlackInThisPhase || response.safety.callsExternalServices || response.safety.canApproveAction || response.safety.canExecuteAction) {
    throw new Error('Notification delivery logs response must remain log-only and non-executing.');
  }
}
