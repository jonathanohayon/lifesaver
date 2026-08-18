import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActionStatus, WorkspaceActionDetailRow } from '../actions/actions.types.js';
import type { GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import {
  SUPPORT_SEND_EXECUTOR_HEALTH_MODE,
  SUPPORT_SEND_EXECUTOR_NAME,
  SUPPORT_SEND_EXECUTOR_PACKAGE,
  SUPPORT_SEND_EXECUTOR_PHASE,
  SUPPORT_SEND_REQUIRED_SCOPE,
  buildGmailSupportReplyMime,
  buildGmailSupportSendRequest,
  buildSupportSendExecutorExample,
  buildSupportSendExecutorStatus,
  buildSupportSendPreview,
  buildSupportSendRequestPreview,
  decodeGmailRawForTests,
  executeManualApprovedGmailSupportReplySend,
  parseSupportReplySendPayload,
  parseSupportSendExecutionBody,
} from './support-send-executor.model.js';

const approvedAt = new Date();

const basePayload = {
  action_type: 'support_reply_send',
  schema_version: 'support_reply_send.v1',
  source: 'support_draft_to_action',
  intent_summary: 'Review and approve a drafted shipping support reply.',
  idempotency_hint: 'support-reply:ticket_123:abc',
  data: {
    support_provider: 'gmail',
    ticket_id: 'ticket_123',
    thread_id: 'gmail_thread_123',
    customer_email: 'customer@example.com',
    subject: 'Where is my order?',
    reply_body: 'Hello, thank you for reaching out. Your tracking is moving normally.',
    category: 'shipping',
    confidence_score: 0.88,
    sensitive_flag: false,
    escalation_required: false,
    send_email_enabled: false,
    external_api_called: false,
    auto_reply_enabled: false,
  },
} as const;

function mockAction(overrides: Partial<WorkspaceActionDetailRow> = {}): WorkspaceActionDetailRow {
  return {
    id: 'action_123',
    workspace_id: 'workspace_123',
    created_by_user_id: 'user_creator',
    action_type: 'support_reply_send',
    title: 'Approve support reply',
    description: 'Drafted support reply.',
    status: 'approved',
    risk_level: 'medium',
    approval_required: true,
    policy_decision: 'ask',
    policy_decision_snapshot_json: {},
    policy_evaluated_at: null,
    idempotency_key: 'support-reply:ticket_123:abc',
    action_hash: 'hash_123',
    payload_json: basePayload as unknown as Record<string, unknown>,
    created_at: new Date(),
    updated_at: new Date(),
    approved_at: approvedAt,
    executed_at: null,
    ...overrides,
  };
}

function mockPause(overrides: Partial<GlobalPauseBackendState> = {}): GlobalPauseBackendState {
  return {
    workspaceId: 'workspace_123',
    pauseAllAutonomy: false,
    pauseContentActions: false,
    pauseSupportActions: false,
    pauseAdsActions: false,
    pauseResearchActions: false,
    pauseDevActions: false,
    updatedBy: null,
    updatedAt: null,
    enforcement: {
      autoApprovalAllowed: true,
      executorExecutionAllowed: true,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'ok',
    },
    categories: {
      content: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      support: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      ads: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      research: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
      dev: { paused: false, autoApprovalAllowed: true, executorExecutionAllowed: true, reason: 'ok' },
    },
    emergencySafeMode: {
      version: '0.6.0',
      phase: 'v0.6.0 Phase 5.9 Emergency Safe Mode',
      active: false,
      source: 'environment',
      envKey: 'EMERGENCY_SAFE_MODE',
      reason: null,
      adminWarningVisible: false,
      executionBlocked: false,
      autoApprovalAllowed: false,
      executorExecutionAllowed: false,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      checkedAt: new Date().toISOString(),
      safety: { externalWritesAttempted: false, executorRan: false, resumeDoesNotExecuteWaitingActions: true, note: 'safe' },
    },
    safety: { canAutoApprove: false, canExecute: false, canWriteExternally: false, note: 'safe' },
    ...overrides,
  };
}

function executionOptions(overrides: Parameters<typeof executeManualApprovedGmailSupportReplySend>[1] = {}) {
  const events: unknown[] = [];
  const results: unknown[] = [];
  return {
    options: {
      bypassDatabaseForTests: true,
      bypassFeatureFlagForTests: true,
      actionProvider: async () => mockAction(),
      approvalEventProvider: async () => ({ id: 'approval_event_123', actor_user_id: 'user_123', created_at: new Date() }),
      pauseStateProvider: async () => mockPause(),
      threadAssociationTicketProvider: async () => ({
        id: 'support_ticket_123',
        workspaceId: 'workspace_123',
        provider: 'gmail',
        externalMessageId: 'gmail_message_123',
        externalThreadId: 'gmail_thread_123',
        customerEmail: 'customer@example.com',
        fromEmailHint: 'customer@example.com',
        subject: 'Where is my order?',
        status: 'open',
        updatedAt: new Date().toISOString(),
      }),
      credentialProvider: async () => ({
        accessToken: 'test-access-token-value-long-enough',
        grantedScopes: [SUPPORT_SEND_REQUIRED_SCOPE],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
      transitionStatus: async (input: { toStatus: ActionStatus }) => ({ previous_status: (input.toStatus === 'executing' ? 'approved' : 'executing') as ActionStatus }),
      insertEvent: async (event: any) => { events.push(event); return true; },
      insertResult: async (result: any) => { results.push(result); return true; },
      client: async () => ({ status: 200, headers: {}, body: { id: 'gmail_msg_123', threadId: 'gmail_thread_123' } }),
      ...overrides,
    },
    events,
    results,
  };
}

test('Phase 13.2 constants are correct', () => {
  assert.equal(SUPPORT_SEND_EXECUTOR_PHASE, 'phase_13_2_send_reply_executor');
  assert.equal(SUPPORT_SEND_EXECUTOR_HEALTH_MODE, 'v2-phase-13-2-send-reply-executor');
  assert.equal(SUPPORT_SEND_EXECUTOR_PACKAGE, 'lifesaver-v0.7.0-phase-13-2-send-reply-executor.zip');
  assert.equal(SUPPORT_SEND_EXECUTOR_NAME, 'gmailManualApprovedSupportReplyExecutor');
  assert.equal(SUPPORT_SEND_REQUIRED_SCOPE, 'https://www.googleapis.com/auth/gmail.send');
});

test('status describes manual-approved support executor and default-off safety', () => {
  const status = buildSupportSendExecutorStatus();
  assert.equal(status.deliverable, 'manual_approved_support_executor');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.actionType, 'support_reply_send');
  assert.equal(status.manualApprovalRequired, true);
  assert.equal(status.autoReplyEnabled, false);
  assert.equal(status.emailSendExecutorAdded, true);
  assert.equal(status.rawMimeReturnedToBrowser, false);
  assert.equal(status.rawTokenReturnedToBrowser, false);
  assert.equal(status.sensitiveTicketGuardRequired, true);
  assert.equal(status.sensitiveTicketsRequireManualApproval, true);
});

test('parse execution body defaults force to false', () => {
  assert.deepEqual(parseSupportSendExecutionBody({}), { force: false });
  assert.deepEqual(parseSupportSendExecutionBody({ force: true }), { force: true });
  assert.throws(() => parseSupportSendExecutionBody({ force: 'yes' }));
});

test('parses a valid support_reply_send payload', () => {
  const payload = parseSupportReplySendPayload(basePayload);
  assert.equal(payload.action_type, 'support_reply_send');
  assert.equal(payload.data.support_provider, 'gmail');
  assert.equal(payload.data.thread_id, 'gmail_thread_123');
  assert.equal(payload.data.customer_email, 'customer@example.com');
});

test('payload rejects missing customer email', () => {
  assert.throws(() => parseSupportReplySendPayload({ ...basePayload, data: { ...basePayload.data, customer_email: '' } }));
});

test('payload rejects auto reply enabled', () => {
  assert.throws(() => parseSupportReplySendPayload({ ...basePayload, data: { ...basePayload.data, auto_reply_enabled: true } }), /Auto-replies|auto-replies|cannot send auto/i);
});

test('payload rejects raw token-like fields', () => {
  assert.throws(() => parseSupportReplySendPayload({ ...basePayload, access_token: 'secret' }), /unsafe fragment/);
});

test('payload rejects CC/BCC fragments for first executor lane', () => {
  assert.throws(() => parseSupportReplySendPayload({ ...basePayload, data: { ...basePayload.data, reply_body: 'bcc: hidden@example.com' } }), /unsafe fragment/);
});

test('payload rejects bulk recipient shapes before Gmail request building', () => {
  assert.throws(() => parseSupportReplySendPayload({
    ...basePayload,
    data: {
      ...basePayload.data,
      recipients: ['a@example.com', 'b@example.com'],
      thread_ids: ['thread_1', 'thread_2'],
      ticket_ids: ['ticket_1', 'ticket_2'],
      bulk_mode: true,
    },
  }), /SUPPORT_BULK_SEND_BLOCKED|bulk send guard/i);
});

test('builds plain-text MIME with threaded reply subject', () => {
  const payload = parseSupportReplySendPayload(basePayload);
  const mime = buildGmailSupportReplyMime(payload);
  assert.match(mime, /To: customer@example.com/);
  assert.match(mime, /Subject: Re: Where is my order\?/);
  assert.match(mime, /Content-Type: text\/plain/);
  assert.match(mime, /Your tracking is moving normally/);
});

test('Gmail request uses users.messages.send and includes threadId', () => {
  const payload = parseSupportReplySendPayload(basePayload);
  const request = buildGmailSupportSendRequest({ accessToken: 'test-token', payload });
  assert.equal(request.method, 'POST');
  assert.match(request.url, /gmail\/v1\/users\/me\/messages\/send$/);
  assert.equal(request.body.threadId, 'gmail_thread_123');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
});

test('encoded raw MIME can be decoded in tests and is not exposed by preview', () => {
  const payload = parseSupportReplySendPayload(basePayload);
  const request = buildGmailSupportSendRequest({ accessToken: 'test-token', payload });
  const decoded = decodeGmailRawForTests(request.body.raw);
  const preview = buildSupportSendRequestPreview(payload);
  assert.match(decoded, /To: customer@example.com/);
  assert.equal(preview.rawMimeReturned, false);
  assert.equal(preview.rawBase64Returned, false);
  assert.equal(preview.rawTokenReturned, false);
  assert.equal(JSON.stringify(preview).includes(request.body.raw), false);
});

test('preview masks recipient email and redacts private body fragments', () => {
  const payload = parseSupportReplySendPayload({
    ...basePayload,
    data: { ...basePayload.data, reply_body: 'Your card 4242 4242 4242 4242 is not shown here.' },
  });
  const preview = buildSupportSendRequestPreview(payload);
  assert.equal(preview.toHint, 'cu***@example.com');
  assert.equal(preview.replyBodyPreview.includes('4242 4242'), false);
  assert.equal(preview.replyBodyPreview.includes('[REDACTED_CARD]'), true);
});

test('example is safe and does not send', () => {
  const example = buildSupportSendExecutorExample();
  assert.equal(example.safety.exampleSendsEmail, false);
  assert.equal(example.safety.rawMimeReturned, false);
  assert.equal(example.safety.rawTokenReturned, false);
});

test('send preview never calls Gmail', () => {
  const preview = buildSupportSendPreview(basePayload);
  assert.equal(preview.valid, true);
  assert.equal(preview.safety.previewOnly, true);
  assert.equal(preview.safety.gmailApiCalled, false);
  assert.equal(preview.safety.emailSent, false);
});

test('execution blocks when database is not configured', async () => {
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.databaseConfigured, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when feature flag is disabled', async () => {
  const { options } = executionOptions({ bypassFeatureFlagForTests: false });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.featureFlagEnabled, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when action is not manually approved', async () => {
  const { options } = executionOptions({
    actionProvider: async () => mockAction({ status: 'proposed', approved_at: null }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.manualApprovalConfirmed, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when support pause is active', async () => {
  const { options } = executionOptions({
    pauseStateProvider: async () => mockPause({ pauseSupportActions: true }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.supportPauseOff, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when send scope is missing', async () => {
  const { options } = executionOptions({
    credentialProvider: async () => ({ accessToken: 'test-token-long-enough', grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'] }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.requiredScopePresent, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when Phase 13.4 imported ticket is missing', async () => {
  const { options } = executionOptions({
    threadAssociationTicketProvider: async () => null,
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.importedTicketFound, false);
  assert.equal(result.checks.threadAssociationVerified, false);
  assert.equal(result.gmail.apiCalled, false);
});

test('execution blocks when Phase 13.4 imported ticket thread does not match payload thread', async () => {
  const { options } = executionOptions({
    threadAssociationTicketProvider: async () => ({
      id: 'support_ticket_123',
      workspaceId: 'workspace_123',
      provider: 'gmail',
      externalMessageId: 'gmail_message_123',
      externalThreadId: 'gmail_thread_wrong',
      customerEmail: 'customer@example.com',
      status: 'open',
    }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.threadAssociationVerified, false);
  assert.equal(result.checks.threadMatchesImportedTicket, false);
  assert.equal(result.gmail.apiCalled, false);
});


test('execution allows sensitive refund only after manual approval and records sensitive guard checks', async () => {
  const refundPayload = {
    ...basePayload,
    data: {
      ...basePayload.data,
      subject: 'Refund request',
      category: 'refund',
      confidence_score: 0.91,
      reply_body: 'Hello, thank you for reaching out. I will review the refund policy and help you with next steps.',
    },
  } as const;
  const { options } = executionOptions({
    actionProvider: async () => mockAction({ payload_json: refundPayload as unknown as Record<string, unknown> }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'executed');
  assert.equal(result.checks.sensitiveTicketDetected, true);
  assert.equal(result.checks.sensitiveManualApprovalRequired, true);
  assert.equal(result.checks.sensitiveTicketGuardPassed, true);
  assert.equal(result.gmail.apiCalled, true);
});

test('execution sends one approved Gmail reply with safe result metadata when all gates pass', async () => {
  let calledRequest: unknown = null;
  const { options, events, results } = executionOptions({
    client: async (request) => {
      calledRequest = request;
      return { status: 200, headers: {}, body: { id: 'gmail_msg_123', threadId: 'gmail_thread_123' } };
    },
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'executed');
  assert.equal(result.gmail.apiCalled, true);
  assert.equal(result.gmail.externalMessageId, 'gmail_msg_123');
  assert.equal(result.gmail.externalThreadId, 'gmail_thread_123');
  assert.equal(result.checks.threadAssociationVerified, true);
  assert.equal(result.checks.threadMatchesImportedTicket, true);
  assert.equal(result.checks.sensitiveTicketGuardPassed, true);
  assert.deepEqual(result.statusPath, ['approved', 'executing', 'executed']);
  assert.equal(events.length >= 2, true);
  assert.equal(results.length >= 1, true);
  const storedResult = results[0] as any;
  assert.equal(storedResult.metadataJson.support_send_result_log_health_mode, 'v2-phase-13-8-send-result-logs');
  assert.equal(storedResult.metadataJson.external_message_id, 'gmail_msg_123');
  assert.equal(storedResult.metadataJson.external_thread_id, 'gmail_thread_123');
  assert.equal(typeof storedResult.metadataJson.sent_at, 'string');
  assert.match(storedResult.metadataJson.api_response_summary, /http_status=200/);
  assert.equal(storedResult.metadataJson.failure_reason, null);
  assert.equal(JSON.stringify(result).includes('test-access-token-value-long-enough'), false);
  assert.equal(JSON.stringify(result).includes('raw:'), false);
  assert.ok(calledRequest);
});

test('execution marks failed when Gmail returns non-success', async () => {
  const { options, results } = executionOptions({
    client: async () => ({ status: 403, headers: {}, body: { error: 'forbidden' } }),
  });
  const result = await executeManualApprovedGmailSupportReplySend({ workspaceId: 'w', userId: 'u', actionId: 'a' }, options);
  assert.equal(result.status, 'failed');
  assert.equal(result.gmail.apiCalled, true);
  assert.equal(result.gmail.apiStatus, 403);
  assert.deepEqual(result.statusPath, ['approved', 'executing', 'failed']);
  const storedResult = results[0] as any;
  assert.equal(storedResult.metadataJson.support_send_result_log_health_mode, 'v2-phase-13-8-send-result-logs');
  assert.equal(storedResult.metadataJson.external_thread_id, 'gmail_thread_123');
  assert.match(storedResult.metadataJson.api_response_summary, /http_status=403/);
  assert.match(storedResult.metadataJson.failure_reason, /Gmail API returned 403/);
});
