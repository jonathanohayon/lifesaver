import type {
  NotificationCenterPendingActionRow,
  NotificationCenterPendingApprovalItem,
  NotificationCenterRecentEventItem,
  NotificationCenterRecentEventRow,
  NotificationCenterResponse,
} from './notification-center.types.js';
import { buildSecureApprovalReviewUrl } from './notification-secure-approval-links.model.js';

const FORBIDDEN_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'bearer ',
  'linkedin_access_token',
  'claude_api_key',
  'triple_whale',
  'database_url',
  'worker_shared_secret',
  'app_encryption_key',
  'rollback_payload',
  'payload_json',
  'encrypted_',
];

function iso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

function cleanText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, max) : null;
}

function actionUrl(actionId: string): string {
  return buildSecureApprovalReviewUrl({ actionId, source: 'in_app_notification_center' }).reviewUrl;
}

function priorityForRisk(riskLevel: string): 'normal' | 'elevated' | 'urgent' {
  const risk = String(riskLevel || '').toLowerCase();
  if (risk === 'critical') return 'urgent';
  if (risk === 'high') return 'elevated';
  return 'normal';
}

function redactMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const source = value && typeof value === 'object' ? value : {};
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source).slice(0, 12)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
      continue;
    }
    if (entry == null || ['string', 'number', 'boolean'].includes(typeof entry)) {
      const stringValue = String(entry ?? '');
      output[key] = FORBIDDEN_FRAGMENTS.some((fragment) => stringValue.toLowerCase().includes(fragment))
        ? '[redacted]'
        : entry;
    } else if (Array.isArray(entry)) {
      output[key] = `[array:${entry.length}]`;
    } else {
      output[key] = '[object]';
    }
  }
  return output;
}

export function toPendingApprovalItem(row: NotificationCenterPendingActionRow): NotificationCenterPendingApprovalItem {
  return {
    id: row.id,
    actionId: row.id,
    title: cleanText(row.title, 180) || 'Untitled action',
    description: cleanText(row.description, 320),
    actionType: row.action_type,
    status: row.status,
    riskLevel: row.risk_level,
    approvalRequired: Boolean(row.approval_required),
    policyDecision: row.policy_decision,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    actionUrl: actionUrl(row.id),
    priority: priorityForRisk(row.risk_level),
  };
}

export function toRecentEventItem(row: NotificationCenterRecentEventRow): NotificationCenterRecentEventItem {
  return {
    id: row.id,
    actionId: row.action_id,
    actionTitle: cleanText(row.action_title, 180) || 'Untitled action',
    actionType: row.action_type,
    actionStatus: row.action_status,
    riskLevel: row.risk_level,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    message: cleanText(row.message, 360),
    actorUserId: row.actor_user_id,
    createdAt: iso(row.created_at),
    actionUrl: actionUrl(row.action_id),
    metadataPreview: redactMetadata(row.metadata_json),
  };
}

export function buildNotificationCenterResponse(params: {
  workspaceId: string;
  pendingApprovals: NotificationCenterPendingActionRow[];
  recentEvents: NotificationCenterRecentEventRow[];
  generatedAt?: Date;
}): NotificationCenterResponse {
  const pendingApprovals = params.pendingApprovals.map(toPendingApprovalItem);
  const recentEvents = params.recentEvents.map(toRecentEventItem);
  const response: NotificationCenterResponse = {
    version: '0.7.0',
    phase: 'phase_10_2_in_app_notification_center',
    workspaceId: params.workspaceId,
    generatedAt: iso(params.generatedAt || new Date()),
    counts: {
      pendingApprovals: pendingApprovals.length,
      recentEvents: recentEvents.length,
      highRiskPendingApprovals: pendingApprovals.filter((item) => ['high', 'critical'].includes(item.riskLevel)).length,
    },
    pendingApprovals,
    recentEvents,
    preferencesSummary: {
      inAppCenterEnabled: true,
      emailDeliveryImplemented: false,
      slackDeliveryImplemented: false,
      quietHoursEnforcedForUiOnly: false,
    },
    safety: {
      readOnly: true,
      canApproveFromThisEndpoint: false,
      canExecuteFromThisEndpoint: false,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      exposesActionPayloadJson: false,
      exposesTokensOrSecrets: false,
      note: 'Phase 10.2 notification center is read-only. It shows pending approvals and recent action events but does not approve, execute, publish, send email, send Slack messages, or call external services.',
    },
  };
  assertSafeNotificationCenterResponse(response);
  return response;
}

export function assertSafeNotificationCenterResponse(response: NotificationCenterResponse): void {
  const serialized = JSON.stringify(response).toLowerCase();
  const found = FORBIDDEN_FRAGMENTS.find((fragment) => serialized.includes(fragment));
  if (found) {
    throw new Error(`Notification center response contains forbidden fragment: ${found}`);
  }
  if (!response.safety.readOnly || response.safety.canApproveFromThisEndpoint || response.safety.canExecuteFromThisEndpoint) {
    throw new Error('Notification center response must remain read-only.');
  }
  if (response.safety.sendsEmailInThisPhase || response.safety.sendsSlackInThisPhase || response.safety.callsExternalServices) {
    throw new Error('Notification center response must not claim external delivery.');
  }
}
