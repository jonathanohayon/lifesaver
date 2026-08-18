import assert from 'node:assert/strict';
import { assertSafeNotificationCenterResponse, buildNotificationCenterResponse, toPendingApprovalItem, toRecentEventItem } from './notification-center.model.js';
import type { NotificationCenterPendingActionRow, NotificationCenterRecentEventRow } from './notification-center.types.js';

function pending(overrides: Partial<NotificationCenterPendingActionRow> = {}): NotificationCenterPendingActionRow {
  const now = new Date('2026-07-06T12:00:00.000Z');
  return {
    id: '11111111-1111-1111-1111-111111111111',
    workspace_id: 'workspace-1',
    action_type: 'content_publish',
    title: 'Approve LinkedIn test post',
    description: 'Manual approval required before a controlled publish test.',
    status: 'approval_required',
    risk_level: 'high',
    approval_required: true,
    policy_decision: 'ask',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function event(overrides: Partial<NotificationCenterRecentEventRow> = {}): NotificationCenterRecentEventRow {
  const now = new Date('2026-07-06T12:05:00.000Z');
  return {
    id: '22222222-2222-2222-2222-222222222222',
    action_id: '11111111-1111-1111-1111-111111111111',
    workspace_id: 'workspace-1',
    action_type: 'content_publish',
    action_title: 'Approve LinkedIn test post',
    action_status: 'approval_required',
    risk_level: 'high',
    event_type: 'action_created',
    from_status: null,
    to_status: 'approval_required',
    message: 'Action needs founder approval.',
    actor_user_id: '33333333-3333-3333-3333-333333333333',
    metadata_json: { safe: true, payload_json: { forbidden: true }, access_token: 'secret' },
    created_at: now,
    ...overrides,
  };
}

function expectThrows(fn: () => unknown, fragment: string) {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.match(String((error as Error).message), new RegExp(fragment));
  }
  assert.equal(thrown, true, `Expected error containing ${fragment}`);
}

const tests: Array<[string, () => void]> = [
  ['pending approval item maps safe fields', () => {
    const item = toPendingApprovalItem(pending());
    assert.equal(item.actionId, '11111111-1111-1111-1111-111111111111');
    assert.equal(item.priority, 'elevated');
    assert.equal(item.actionUrl.includes('actions.html'), true);
  }],
  ['critical risk becomes urgent', () => {
    const item = toPendingApprovalItem(pending({ risk_level: 'critical' }));
    assert.equal(item.priority, 'urgent');
  }],
  ['low risk becomes normal', () => {
    const item = toPendingApprovalItem(pending({ risk_level: 'low' }));
    assert.equal(item.priority, 'normal');
  }],
  ['recent event maps action event fields', () => {
    const item = toRecentEventItem(event());
    assert.equal(item.eventType, 'action_created');
    assert.equal(item.toStatus, 'approval_required');
    assert.equal(item.actionUrl.includes('actions.html'), true);
  }],
  ['recent event metadata redacts secret-like keys', () => {
    const item = toRecentEventItem(event());
    assert.equal(Object.prototype.hasOwnProperty.call(item.metadataPreview, 'payload_json'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(item.metadataPreview, 'access_token'), false);
  }],
  ['response counts pending approvals', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [pending()], recentEvents: [] });
    assert.equal(response.counts.pendingApprovals, 1);
    assert.equal(response.counts.highRiskPendingApprovals, 1);
  }],
  ['response counts recent events', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [event(), event({ id: '44444444-4444-4444-4444-444444444444' })] });
    assert.equal(response.counts.recentEvents, 2);
  }],
  ['response remains read-only', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [pending()], recentEvents: [event()] });
    assert.equal(response.safety.readOnly, true);
    assert.equal(response.safety.canApproveFromThisEndpoint, false);
    assert.equal(response.safety.canExecuteFromThisEndpoint, false);
  }],
  ['response does not claim external sends', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    assert.equal(response.safety.sendsEmailInThisPhase, false);
    assert.equal(response.safety.sendsSlackInThisPhase, false);
    assert.equal(response.safety.callsExternalServices, false);
  }],
  ['preferences summary marks email and Slack as not implemented', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    assert.equal(response.preferencesSummary.inAppCenterEnabled, true);
    assert.equal(response.preferencesSummary.emailDeliveryImplemented, false);
    assert.equal(response.preferencesSummary.slackDeliveryImplemented, false);
  }],
  ['safe response blocks forbidden fragments if injected', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    (response.recentEvents as any).push({ id: 'x', metadataPreview: { authorization: 'Bearer secret' } });
    expectThrows(() => assertSafeNotificationCenterResponse(response), 'forbidden fragment');
  }],
  ['safe response blocks approval capability', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    (response.safety as any).canApproveFromThisEndpoint = true;
    expectThrows(() => assertSafeNotificationCenterResponse(response), 'read-only');
  }],
  ['long titles are trimmed', () => {
    const item = toPendingApprovalItem(pending({ title: 'x'.repeat(300) }));
    assert.equal(item.title.length, 180);
  }],
  ['blank titles become fallback', () => {
    const item = toPendingApprovalItem(pending({ title: '   ' }));
    assert.equal(item.title, 'Untitled action');
  }],
  ['message text is cleaned and trimmed', () => {
    const item = toRecentEventItem(event({ message: ` hello\n ${'x'.repeat(500)}` }));
    assert.equal(item.message?.startsWith('hello'), true);
    assert.ok((item.message || '').length <= 360);
  }],
  ['generatedAt is ISO string', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [], generatedAt: new Date('2026-07-06T12:10:00.000Z') });
    assert.equal(response.generatedAt, '2026-07-06T12:10:00.000Z');
  }],
  ['phase identifier is Phase 10.2', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    assert.equal(response.phase, 'phase_10_2_in_app_notification_center');
  }],
  ['version is 0.7.0', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    assert.equal(response.version, '0.7.0');
  }],
  ['array metadata is summarized', () => {
    const item = toRecentEventItem(event({ metadata_json: { items: [1, 2, 3] } }));
    assert.equal(item.metadataPreview.items, '[array:3]');
  }],
  ['object metadata is summarized', () => {
    const item = toRecentEventItem(event({ metadata_json: { nested: { a: 1 } } }));
    assert.equal(item.metadataPreview.nested, '[object]');
  }],
  ['pending approval URL uses secure deep link', () => {
    const item = toPendingApprovalItem(pending({ id: 'action_id_with_safe_chars' }));
    assert.equal(item.actionUrl, './actions.html?actionId=action_id_with_safe_chars&source=in_app_notification_center&linkMode=review_only');
  }],
  ['recent event URL uses secure deep link', () => {
    const item = toRecentEventItem(event({ action_id: 'action_id_with_safe_chars' }));
    assert.equal(item.actionUrl, './actions.html?actionId=action_id_with_safe_chars&source=in_app_notification_center&linkMode=review_only');
  }],
  ['empty center is valid', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [], recentEvents: [] });
    assertSafeNotificationCenterResponse(response);
    assert.equal(response.counts.pendingApprovals, 0);
    assert.equal(response.counts.recentEvents, 0);
  }],
  ['response never exposes action payload json', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [pending()], recentEvents: [event()] });
    assert.equal(response.safety.exposesActionPayloadJson, false);
  }],
  ['response never exposes token or secret material', () => {
    const response = buildNotificationCenterResponse({ workspaceId: 'workspace-1', pendingApprovals: [pending()], recentEvents: [event()] });
    assert.equal(response.safety.exposesTokensOrSecrets, false);
  }],
];

let failed = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS notification-center:test — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL notification-center:test — ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`notification-center:test — ${tests.length - failed} passed, ${failed} failed`);
  process.exit(1);
}

console.log(`notification-center:test — ${tests.length} passed, 0 failed`);
