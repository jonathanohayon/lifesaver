import { isDatabaseConfigured, query } from '../../db/pool.js';
import type { NotificationDeliveryChannel, NotificationDeliveryEventType, NotificationDeliveryLogRow } from './notification-delivery-logs.types.js';

function clampLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function insertNotificationDeliveryLogRow(params: {
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
  metadataJson?: Record<string, unknown>;
}): Promise<NotificationDeliveryLogRow> {
  if (!isDatabaseConfigured) throw new Error('DATABASE_URL is not configured.');
  const result = await query<NotificationDeliveryLogRow>(
    `INSERT INTO notification_delivery_logs (
       workspace_id,
       action_id,
       user_id,
       notification_key,
       channel,
       event_type,
       recipient_hint,
       delivery_provider,
       message,
       error_message,
       metadata_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     RETURNING *;`,
    [
      params.workspaceId,
      params.actionId || null,
      params.userId || null,
      params.notificationKey || null,
      params.channel,
      params.eventType,
      params.recipientHint || null,
      params.deliveryProvider || 'lifesaver_internal',
      params.message || null,
      params.eventType === 'notification_failed' ? (params.errorMessage || 'Notification delivery failed.') : null,
      JSON.stringify(params.metadataJson || {}),
    ]
  );
  return result.rows[0];
}

export async function listNotificationDeliveryLogRows(params: {
  workspaceId: string;
  userId: string;
  limit?: unknown;
  eventType?: unknown;
  channel?: unknown;
}): Promise<NotificationDeliveryLogRow[]> {
  if (!isDatabaseConfigured) return [];
  const limit = clampLimit(params.limit, 50, 100);
  const eventType = typeof params.eventType === 'string' && params.eventType.trim() ? params.eventType.trim() : null;
  const channel = typeof params.channel === 'string' && params.channel.trim() ? params.channel.trim() : null;
  const result = await query<NotificationDeliveryLogRow>(
    `SELECT ndl.*
     FROM notification_delivery_logs ndl
     WHERE ndl.workspace_id = $1
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.workspace_id = ndl.workspace_id
           AND wm.user_id = $2
           AND COALESCE(wm.status, 'active') = 'active'
       )
       AND ($3::text IS NULL OR ndl.event_type = $3)
       AND ($4::text IS NULL OR ndl.channel = $4)
     ORDER BY ndl.created_at DESC, ndl.id DESC
     LIMIT $5;`,
    [params.workspaceId, params.userId, eventType, channel, limit]
  );
  return result.rows;
}

export async function actionBelongsToWorkspace(params: { workspaceId: string; actionId: string }): Promise<boolean> {
  if (!isDatabaseConfigured) return false;
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM actions WHERE id = $1 AND workspace_id = $2
     ) AS exists;`,
    [params.actionId, params.workspaceId]
  );
  return Boolean(result.rows[0]?.exists);
}
