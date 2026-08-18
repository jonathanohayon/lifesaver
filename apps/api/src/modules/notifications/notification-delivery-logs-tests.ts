import assert from 'node:assert/strict';
import {
  assertSafeNotificationDeliveryLog,
  buildNotificationDeliveryLog,
  buildNotificationDeliveryLogsResponse,
  deliveryLogFromRow,
  redactDeliveryLogText,
  sanitizeDeliveryLogMetadata,
} from './notification-delivery-logs.model.js';
import type { NotificationDeliveryLogInput, NotificationDeliveryLogRow } from './notification-delivery-logs.types.js';

function input(overrides: Partial<NotificationDeliveryLogInput> = {}): NotificationDeliveryLogInput {
  return {
    workspaceId: 'workspace_123',
    actionId: 'action_123',
    userId: 'user_123',
    notificationKey: 'approval_action_123_created',
    channel: 'email',
    eventType: 'notification_created',
    recipientHint: 'm***@example.com',
    deliveryProvider: 'lifesaver_internal',
    message: 'Approval notification was created for review.',
    metadata: { triggerType: 'action_proposed' },
    ...overrides,
  };
}

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`FAILED: ${name}`);
    throw error;
  }
}

test('builds notification_created log', () => {
  const log = buildNotificationDeliveryLog(input(), new Date('2026-07-06T12:00:00.000Z'));
  assert.equal(log.version, '0.7.0');
  assert.equal(log.phase, 'phase_10_8_delivery_logs');
  assert.equal(log.eventType, 'notification_created');
  assert.equal(log.status, 'created');
});

test('builds notification_sent log', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_sent', message: 'Notification sent through future email provider.' }));
  assert.equal(log.status, 'sent');
  assert.equal(log.errorMessage, null);
});

test('builds notification_failed log with error', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_failed', errorMessage: 'Provider returned safe failure.' }));
  assert.equal(log.status, 'failed');
  assert.equal(log.errorMessage, 'Provider returned safe failure.');
});

test('notification_failed gets default error when missing', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_failed' }));
  assert.equal(log.errorMessage, 'Notification delivery failed.');
});

test('builds notification_opened log', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_opened', channel: 'in_app', message: 'Deep link opened.' }));
  assert.equal(log.status, 'opened');
  assert.equal(log.channel, 'in_app');
});

test('non-failed events remove error message', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_sent', errorMessage: 'Should not persist' }));
  assert.equal(log.errorMessage, null);
});

test('supports in-app channel', () => {
  const log = buildNotificationDeliveryLog(input({ channel: 'in_app' }));
  assert.equal(log.channel, 'in_app');
});

test('supports slack channel as future log target only', () => {
  const log = buildNotificationDeliveryLog(input({ channel: 'slack' }));
  assert.equal(log.channel, 'slack');
  assert.equal(log.safety.sendsSlackInThisPhase, false);
});

test('rejects unknown channel', () => {
  assert.throws(() => buildNotificationDeliveryLog(input({ channel: 'sms' as any })), /Invalid/);
});

test('rejects unknown event type', () => {
  assert.throws(() => buildNotificationDeliveryLog(input({ eventType: 'delivered' as any })), /Invalid/);
});

test('redacts access token in message', () => {
  const log = buildNotificationDeliveryLog(input({ message: 'access_token=secret should not show' }));
  assert.equal(log.message, '[redacted unsafe text]');
});

test('redacts authorization header in error', () => {
  const log = buildNotificationDeliveryLog(input({ eventType: 'notification_failed', errorMessage: 'Authorization Bearer abc failed' }));
  assert.equal(log.errorMessage, '[redacted unsafe text]');
});

test('redacts unsafe metadata key', () => {
  const metadata = sanitizeDeliveryLogMetadata({ access_token: 'secret' });
  assert.equal(JSON.stringify(metadata).toLowerCase().includes('access_token'), false);
});

test('redacts unsafe metadata value', () => {
  const metadata = sanitizeDeliveryLogMetadata({ providerResponse: 'Bearer abc123' });
  assert.equal(metadata.providerResponse, '[redacted unsafe text]');
});

test('safe assertion passes normal log', () => {
  const log = buildNotificationDeliveryLog(input());
  assertSafeNotificationDeliveryLog(log);
});

test('safe assertion rejects external service call claim', () => {
  const log = buildNotificationDeliveryLog(input());
  (log.safety as any).callsExternalServices = true;
  assert.throws(() => assertSafeNotificationDeliveryLog(log), /log-only/i);
});

test('safe assertion rejects token injection', () => {
  const log = buildNotificationDeliveryLog(input());
  (log as any).unsafe = 'refresh_token=secret';
  assert.throws(() => assertSafeNotificationDeliveryLog(log), /forbidden/i);
});

test('response counts all event types', () => {
  const response = buildNotificationDeliveryLogsResponse({
    workspaceId: 'workspace_123',
    logs: [
      buildNotificationDeliveryLog(input({ eventType: 'notification_created' })),
      buildNotificationDeliveryLog(input({ eventType: 'notification_sent' })),
      buildNotificationDeliveryLog(input({ eventType: 'notification_failed' })),
      buildNotificationDeliveryLog(input({ eventType: 'notification_opened' })),
    ],
    now: new Date('2026-07-06T12:00:00.000Z'),
  });
  assert.equal(response.counts.total, 4);
  assert.equal(response.counts.created, 1);
  assert.equal(response.counts.sent, 1);
  assert.equal(response.counts.failed, 1);
  assert.equal(response.counts.opened, 1);
});

test('response safety flags remain log-only', () => {
  const response = buildNotificationDeliveryLogsResponse({ workspaceId: 'workspace_123', logs: [buildNotificationDeliveryLog(input())] });
  assert.equal(response.safety.deliveryLogsOnly, true);
  assert.equal(response.safety.sendsEmailInThisPhase, false);
  assert.equal(response.safety.callsExternalServices, false);
});

test('deliveryLogFromRow converts DB row safely', () => {
  const row: NotificationDeliveryLogRow = {
    id: 'log_123',
    workspace_id: 'workspace_123',
    action_id: 'action_123',
    user_id: 'user_123',
    notification_key: 'notification_123',
    channel: 'email',
    event_type: 'notification_sent',
    recipient_hint: 'm***@example.com',
    delivery_provider: 'lifesaver_internal',
    message: 'Sent safely.',
    error_message: null,
    metadata_json: { safe: true },
    created_at: '2026-07-06T12:00:00.000Z',
  };
  const log = deliveryLogFromRow(row);
  assert.equal(log.id, 'log_123');
  assert.equal(log.status, 'sent');
});

test('redactDeliveryLogText handles empty values', () => {
  assert.equal(redactDeliveryLogText('   '), null);
  assert.equal(redactDeliveryLogText(null), null);
});

test('delivery log never approves or executes', () => {
  const log = buildNotificationDeliveryLog(input());
  assert.equal(log.safety.canApproveAction, false);
  assert.equal(log.safety.canExecuteAction, false);
});

test('delivery log never exposes payload or rollback payload', () => {
  const log = buildNotificationDeliveryLog(input());
  assert.equal(log.safety.exposesActionPayloadJson, false);
  assert.equal(log.safety.exposesRollbackPayload, false);
});

test('serialized response has no forbidden fragments', () => {
  const response = buildNotificationDeliveryLogsResponse({ workspaceId: 'workspace_123', logs: [buildNotificationDeliveryLog(input())] });
  const serialized = JSON.stringify(response).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'payload_json', 'rollback_payload']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});

console.log(`notification-delivery-logs:test — ${passed} passed, 0 failed`);
