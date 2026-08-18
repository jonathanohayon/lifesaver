import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/AppError.js';
import { closeDatabasePool, isDatabaseConfigured, query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import {
  approveActionForCurrentWorkspace,
  cancelActionForCurrentWorkspace,
  getActionDetailForCurrentWorkspace,
  listActionsForCurrentWorkspace,
  rejectActionForCurrentWorkspace,
} from './actions.service.js';
import { canApproveActionRisk, canCancelAction, canRejectAction, canViewActionsForWorkspace } from './actions.permission-guard.js';
import { createInvalidStatusTransitionError } from './actions.errors.js';
import { parseActionListFilters, parseCancelActionBody, parseRejectActionBody } from './actions.validation.js';
import type { ActionRiskLevel, ActionStatus, ActionType } from './actions.types.js';

type TestStatus = 'pass' | 'fail' | 'skip';

type TestResult = {
  name: string;
  status: TestStatus;
  message: string;
  details?: Record<string, unknown>;
};

type TestUser = {
  id: string;
  email: string;
};

type TestWorkspace = {
  id: string;
  slug: string;
};

type TestContext = {
  runId: string;
  ownerA: TestUser;
  adminA: TestUser;
  memberA: TestUser;
  viewerA: TestUser;
  ownerB: TestUser;
  workspaceA: TestWorkspace;
  workspaceB: TestWorkspace;
};

const results: TestResult[] = [];
const createdWorkspaceSlugs: string[] = [];
const createdUserEmails: string[] = [];

function record(name: string, status: TestStatus, message: string, details?: Record<string, unknown>) {
  results.push({ name, status, message, ...(details ? { details } : {}) });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code?: unknown }).code || '');
  return '';
}

async function expectErrorCode(name: string, fn: () => Promise<unknown>, allowedCodes: string[]) {
  try {
    await fn();
    throw new Error(`Expected one of [${allowedCodes.join(', ')}], but no error was thrown.`);
  } catch (error) {
    const code = errorCode(error);
    if (!allowedCodes.includes(code)) {
      throw new Error(`Expected one of [${allowedCodes.join(', ')}], received [${code || 'unknown'}].`);
    }
    record(name, 'pass', `Received expected safe error code ${code}.`, { code });
  }
}

function isSafeLocalTestEnvironment(): boolean {
  if (process.env.ACTIONS_BACKEND_TEST_ALLOW_NON_PRODUCTION === 'true') return env.NODE_ENV !== 'production' && env.APP_ENVIRONMENT !== 'production' && env.DATABASE_ENVIRONMENT !== 'production';
  return env.NODE_ENV !== 'production'
    && env.APP_ENVIRONMENT !== 'production'
    && env.DATABASE_ENVIRONMENT !== 'production'
    && env.CUSTOMER_ACCESS_MODE === 'local-testing';
}

async function assertActionTablesExist() {
  const result = await query<{
    actions_table: string | null;
    action_events_table: string | null;
    action_results_table: string | null;
  }>(
    `SELECT
       to_regclass('public.actions')::text AS actions_table,
       to_regclass('public.action_events')::text AS action_events_table,
       to_regclass('public.action_results')::text AS action_results_table;`
  );

  const row = result.rows[0];
  assert(row?.actions_table, 'Missing actions table. Run npm.cmd run db:migrate first.');
  assert(row?.action_events_table, 'Missing action_events table. Run npm.cmd run db:migrate first.');
  assert(row?.action_results_table, 'Missing action_results table. Run npm.cmd run db:migrate first.');
}

async function createTestUser(runId: string, label: string, platformRole = 'customer'): Promise<TestUser> {
  const email = `phase310-${runId}-${label}@example.test`;
  const result = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, full_name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id, email;`,
    [email, `Phase 3.10 ${label}`, 'phase-3-10-test-password-hash-not-real', platformRole]
  );
  createdUserEmails.push(email);
  return result.rows[0];
}

async function createTestWorkspace(runId: string, label: string, ownerUserId: string): Promise<TestWorkspace> {
  const slug = `phase-3-10-test-${runId}-${label}`;
  const result = await query<{ id: string; slug: string }>(
    `INSERT INTO workspaces (name, slug, owner_user_id, status, plan_key)
     VALUES ($1, $2, $3, 'active', 'v2_backend_test')
     RETURNING id, slug;`,
    [`Phase 3.10 Test Workspace ${label}`, slug, ownerUserId]
  );
  createdWorkspaceSlugs.push(slug);
  return result.rows[0];
}

async function addMembership(workspaceId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer') {
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, status = 'active';`,
    [workspaceId, userId, role]
  );
}

function buildPayload(actionType: ActionType, suffix: string): Record<string, unknown> {
  if (actionType === 'support_reply_send') {
    return {
      schema_version: 'action-payload/v0.6.0',
      action_type: actionType,
      source: 'phase_3_10_backend_test',
      intent_summary: `Backend test support reply ${suffix}`,
      data: {
        ticket_id: `test-ticket-${suffix}`,
        thread_id: `test-thread-${suffix}`,
        reply_body: 'Certainly — this is a local backend test reply only. It is never sent.',
        customer_email: `customer-${suffix}@example.test`,
        category: 'qa_fixture',
      },
    };
  }

  if (actionType === 'ad_budget_adjust') {
    return {
      schema_version: 'action-payload/v0.6.0',
      action_type: actionType,
      source: 'phase_3_10_backend_test',
      intent_summary: `Backend test ad budget change ${suffix}`,
      data: {
        platform: 'meta_ads',
        campaign_id: `test-campaign-${suffix}`,
        current_budget: 100,
        proposed_budget: 90,
        change_amount: -10,
        currency: 'USD',
        reason: 'Local backend test only. No ad platform is called.',
      },
    };
  }

  return {
    schema_version: 'action-payload/v0.6.0',
    action_type: 'content_publish',
    source: 'phase_3_10_backend_test',
    intent_summary: `Backend test content action ${suffix}`,
    data: {
      platform: 'instagram',
      caption: `Local backend test caption ${suffix}. This is never published.`,
      hashtags: ['lifesaver', 'backendtest'],
      media_url: 'https://example.test/phase-3-10-preview.png',
    },
  };
}

async function createAction(params: {
  workspaceId: string;
  userId: string;
  actionType?: ActionType;
  status?: ActionStatus;
  riskLevel?: ActionRiskLevel;
  title: string;
}): Promise<string> {
  const actionType = params.actionType || 'content_publish';
  const status = params.status || 'proposed';
  const riskLevel = params.riskLevel || 'low';
  const suffix = `${params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID().slice(0, 8)}`;
  const payload = buildPayload(actionType, suffix);
  const actionHash = stableHash({ workspaceId: params.workspaceId, title: params.title, payload });
  const idempotencyKey = `phase-3-10-test:${suffix}`;

  const result = await query<{ id: string }>(
    `INSERT INTO actions (
       workspace_id,
       created_by_user_id,
       action_type,
       title,
       description,
       payload_json,
       status,
       risk_level,
       approval_required,
       policy_decision,
       idempotency_key,
       action_hash,
       approved_at,
       executed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, TRUE, 'ask', $9, $10,
       CASE WHEN $7 IN ('approved', 'queued', 'executing', 'executed', 'failed', 'rollback_requested', 'rolled_back') THEN NOW() ELSE NULL END,
       CASE WHEN $7 IN ('executed', 'rollback_requested', 'rolled_back') THEN NOW() ELSE NULL END
     )
     RETURNING id;`,
    [
      params.workspaceId,
      params.userId,
      actionType,
      params.title,
      'Phase 3.10 local backend test action. No external write is possible from this test.',
      JSON.stringify(payload),
      status,
      riskLevel,
      idempotencyKey,
      actionHash,
    ]
  );

  const actionId = result.rows[0].id;
  await query(
    `INSERT INTO action_events (action_id, workspace_id, actor_user_id, event_type, from_status, to_status, message, metadata_json)
     VALUES ($1, $2, $3, 'action_created', NULL, $4, $5, $6::jsonb);`,
    [
      actionId,
      params.workspaceId,
      params.userId,
      status,
      'Phase 3.10 backend test fixture action created locally. No execution or external write was performed.',
      JSON.stringify({ phase: '3.10', test_only: true, external_write_enabled: false, executor_enabled: false }),
    ]
  );

  if (status === 'executed') {
    await query(
      `INSERT INTO action_results (action_id, workspace_id, executor_name, result_status, result_summary, rollback_supported, metadata_json)
       VALUES ($1, $2, 'phase_3_10_test_executor_placeholder', 'success', 'Local placeholder result for invalid-transition testing only.', FALSE, $3::jsonb);`,
      [actionId, params.workspaceId, JSON.stringify({ phase: '3.10', local_only: true })]
    );
  }

  return actionId;
}

async function setupContext(): Promise<TestContext> {
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const ownerA = await createTestUser(runId, 'owner-a');
  const adminA = await createTestUser(runId, 'admin-a');
  const memberA = await createTestUser(runId, 'member-a');
  const viewerA = await createTestUser(runId, 'viewer-a');
  const ownerB = await createTestUser(runId, 'owner-b');

  const workspaceA = await createTestWorkspace(runId, 'a', ownerA.id);
  const workspaceB = await createTestWorkspace(runId, 'b', ownerB.id);

  await addMembership(workspaceA.id, ownerA.id, 'owner');
  await addMembership(workspaceA.id, adminA.id, 'admin');
  await addMembership(workspaceA.id, memberA.id, 'member');
  await addMembership(workspaceA.id, viewerA.id, 'viewer');
  await addMembership(workspaceB.id, ownerB.id, 'owner');

  return { runId, ownerA, adminA, memberA, viewerA, ownerB, workspaceA, workspaceB };
}

async function cleanupTestData() {
  if (!isDatabaseConfigured) return;
  for (const slug of createdWorkspaceSlugs) {
    await query('DELETE FROM workspaces WHERE slug = $1;', [slug]);
  }
  for (const email of createdUserEmails) {
    await query('DELETE FROM users WHERE email = $1;', [email]);
  }
}

async function runOfflineTests() {
  try {
    const filters = parseActionListFilters({ status: 'proposed', action_type: 'content_publish', risk_level: 'low', limit: '2', offset: '0' });
    assert(filters.status === 'proposed', 'Expected proposed status filter.');
    assert(filters.actionType === 'content_publish', 'Expected content_publish action type filter.');
    assert(filters.riskLevel === 'low', 'Expected low risk filter.');
    assert(filters.limit === 2 && filters.offset === 0, 'Expected parsed pagination.');
    record('offline: action list filter parsing', 'pass', 'Filter and pagination parsing passed.');
  } catch (error) {
    record('offline: action list filter parsing', 'fail', error instanceof Error ? error.message : 'Unknown failure.');
  }

  try {
    assert(canViewActionsForWorkspace('owner'), 'Owner should view actions.');
    assert(canViewActionsForWorkspace('admin'), 'Admin should view actions.');
    assert(canViewActionsForWorkspace('member'), 'Member should view actions.');
    assert(canViewActionsForWorkspace('viewer'), 'Viewer should view actions.');
    assert(canApproveActionRisk('owner', 'critical'), 'Owner should approve critical actions.');
    assert(canApproveActionRisk('admin', 'high'), 'Admin should approve high actions.');
    assert(!canApproveActionRisk('admin', 'critical'), 'Admin should not approve critical actions by default.');
    assert(!canApproveActionRisk('member', 'medium'), 'Member should not approve actions.');
    assert(!canApproveActionRisk('viewer', 'low'), 'Viewer should not approve actions.');
    assert(canRejectAction('owner') && canRejectAction('admin'), 'Owner/admin should reject eligible actions.');
    assert(!canRejectAction('member') && !canCancelAction('viewer'), 'Member/viewer should not reject/cancel actions.');
    record('offline: role permission guard matrix', 'pass', 'Owner/admin/member/viewer guard rules passed.');
  } catch (error) {
    record('offline: role permission guard matrix', 'fail', error instanceof Error ? error.message : 'Unknown failure.');
  }

  try {
    const reason = parseRejectActionBody({ reason: 'Not on brand.' });
    const cancel = parseCancelActionBody({ note: 'No longer needed.' });
    assert(reason.rejectionReason === 'Not on brand.', 'Expected rejection reason alias parsing.');
    assert(cancel.cancelReason === 'No longer needed.', 'Expected cancel note alias parsing.');
    record('offline: reject/cancel body parsing', 'pass', 'Reason/note aliases parse safely.');
  } catch (error) {
    record('offline: reject/cancel body parsing', 'fail', error instanceof Error ? error.message : 'Unknown failure.');
  }

  try {
    const error = createInvalidStatusTransitionError({
      code: 'ACTION_ALREADY_EXECUTED',
      message: 'Executed actions cannot be approved again.',
      operation: 'approve',
      actionId: randomUUID(),
      workspaceId: randomUUID(),
      currentStatus: 'executed',
      attemptedStatus: 'approved',
      allowedStatuses: ['proposed', 'approval_required', 'auto_approved'],
    });
    assert(error instanceof AppError, 'Expected AppError.');
    assert(error.code === 'ACTION_ALREADY_EXECUTED', 'Expected ACTION_ALREADY_EXECUTED code.');
    assert(error.statusCode === 409, 'Expected 409 status code.');
    record('offline: safe action error construction', 'pass', 'Safe AppError code/status construction passed.', { code: error.code, statusCode: error.statusCode });
  } catch (error) {
    record('offline: safe action error construction', 'fail', error instanceof Error ? error.message : 'Unknown failure.');
  }
}

async function runDatabaseIntegrationTests() {
  if (!isDatabaseConfigured) {
    record('database: integration tests', 'skip', 'DATABASE_URL is not configured. Copy your working .env and rerun npm.cmd run actions:test:backend.');
    return;
  }

  if (!isSafeLocalTestEnvironment()) {
    throw new Error('Refusing Phase 3.10 backend integration tests outside local/non-production mode. Use CUSTOMER_ACCESS_MODE=local-testing or ACTIONS_BACKEND_TEST_ALLOW_NON_PRODUCTION=true only on an intentional non-production database.');
  }

  await assertActionTablesExist();
  const ctx = await setupContext();

  const listActionLow = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'content_publish', riskLevel: 'low', title: 'List low proposed content action' });
  const listActionMedium = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'support_reply_send', riskLevel: 'medium', title: 'List medium support action' });
  const listActionHigh = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'ad_budget_adjust', riskLevel: 'high', title: 'List high ads action' });

  const listResponse = await listActionsForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    filters: { status: 'proposed', limit: 10, offset: 0 },
  });
  assert(listResponse.items.length >= 3, 'Expected at least three proposed actions in list response.');
  assert(listResponse.items.every((item) => item.hasPayload === false), 'List response must not include payload_json.');
  assert(listResponse.safety.externalWritesEnabled === false, 'List endpoint must not enable external writes.');
  record('database: list actions', 'pass', 'Workspace-scoped list endpoint returned summary-only proposed actions.', { returned: listResponse.items.length });

  const filteredHigh = await listActionsForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    filters: { actionType: 'ad_budget_adjust', riskLevel: 'high', limit: 10, offset: 0 },
  });
  assert(filteredHigh.items.some((item) => item.id === listActionHigh), 'Expected high-risk ad budget action in filtered response.');
  record('database: list filters', 'pass', 'Action type and risk-level filters returned the expected action.', { actionId: listActionHigh });

  const detail = await getActionDetailForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: listActionLow,
  });
  assert(detail.action.id === listActionLow, 'Expected detail action id to match.');
  assert(detail.payloadPreview.includesFullPayloadJson === false, 'Detail response must use payload preview only.');
  assert(detail.statusHistory.length >= 1, 'Detail response should include status history.');
  assert(detail.safety.externalWritesEnabled === false, 'Detail endpoint must not enable external writes.');
  record('database: get action detail', 'pass', 'Detail endpoint returned safe payload preview and status history.', { actionId: listActionLow });

  const approveId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'content_publish', riskLevel: 'low', title: 'Approve endpoint test action' });
  const approveResponse = await approveActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: approveId,
    approvalNote: 'Phase 3.10 backend test approval only.',
  });
  assert(approveResponse.approved === true, 'Expected approve response approved=true.');
  assert(approveResponse.action.status === 'approved', 'Expected action status approved.');
  assert(approveResponse.execution.executed === false && approveResponse.execution.queued === false, 'Approval must not execute or queue.');
  record('database: approve action', 'pass', 'Approve endpoint service changed internal status only and did not execute.', { actionId: approveId });

  const doubleApproveResponse = await approveActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: approveId,
    approvalNote: 'Double-click safety check.',
  });
  assert(doubleApproveResponse.alreadyApproved === true, 'Expected alreadyApproved safe no-op on second approval.');
  record('database: double-click approve protection', 'pass', 'Second approval returned safe no-op.', { actionId: approveId });

  const rejectId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'support_reply_send', riskLevel: 'medium', title: 'Reject endpoint test action' });
  const rejectResponse = await rejectActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.adminA.id,
    actionId: rejectId,
    rejectionReason: 'Phase 3.10 backend test rejection only.',
  });
  assert(rejectResponse.rejected === true, 'Expected reject response rejected=true.');
  assert(rejectResponse.action.status === 'rejected', 'Expected action status rejected.');
  assert(rejectResponse.execution.executed === false, 'Reject must not execute.');
  record('database: reject action', 'pass', 'Reject endpoint service changed internal status only and did not execute.', { actionId: rejectId });

  const cancelId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'content_publish', riskLevel: 'low', title: 'Cancel endpoint test action' });
  const cancelResponse = await cancelActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.adminA.id,
    actionId: cancelId,
    cancelReason: 'Phase 3.10 backend test cancellation only.',
  });
  assert(cancelResponse.cancelled === true, 'Expected cancel response cancelled=true.');
  assert(cancelResponse.action.status === 'cancelled', 'Expected action status cancelled.');
  assert(cancelResponse.execution.executed === false && cancelResponse.execution.rollbackRequired === false, 'Cancel must not execute or rollback.');
  record('database: cancel action', 'pass', 'Cancel endpoint service changed internal status only and did not execute.', { actionId: cancelId });

  const alreadyRejectedId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'content_publish', status: 'rejected', riskLevel: 'low', title: 'Invalid transition rejected action' });
  await expectErrorCode('database: invalid transition rejected -> approved', () => approveActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: alreadyRejectedId,
    approvalNote: 'Should fail.',
  }), ['ACTION_REJECTED']);

  const executedId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'content_publish', status: 'executed', riskLevel: 'low', title: 'Invalid transition executed action' });
  await expectErrorCode('database: invalid transition executed -> cancel', () => cancelActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: executedId,
    cancelReason: 'Should fail because rollback is required later.',
  }), ['ACTION_ALREADY_EXECUTED']);

  const memberDeniedId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'ad_budget_adjust', riskLevel: 'high', title: 'Permission denial high risk action' });
  await expectErrorCode('database: permission denial member approve', () => approveActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.memberA.id,
    actionId: memberDeniedId,
    approvalNote: 'Should fail for member.',
  }), ['APPROVAL_FORBIDDEN']);

  const criticalDeniedId = await createAction({ workspaceId: ctx.workspaceA.id, userId: ctx.ownerA.id, actionType: 'ad_budget_adjust', riskLevel: 'critical', title: 'Permission denial critical action' });
  await expectErrorCode('database: permission denial admin critical approve', () => approveActionForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.adminA.id,
    actionId: criticalDeniedId,
    approvalNote: 'Should fail for admin critical.',
  }), ['APPROVAL_FORBIDDEN']);

  const workspaceBActionId = await createAction({ workspaceId: ctx.workspaceB.id, userId: ctx.ownerB.id, actionType: 'content_publish', riskLevel: 'low', title: 'Workspace isolation other workspace action' });
  await expectErrorCode('database: workspace isolation action id hidden across workspace', () => getActionDetailForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerA.id,
    actionId: workspaceBActionId,
  }), ['ACTION_NOT_FOUND']);

  await expectErrorCode('database: workspace isolation user membership required', () => listActionsForCurrentWorkspace({
    workspaceId: ctx.workspaceA.id,
    userId: ctx.ownerB.id,
    filters: { limit: 10, offset: 0 },
  }), ['ACTION_WORKSPACE_FORBIDDEN']);

  record('database: fixture setup sanity', 'pass', 'Created isolated Phase 3.10 workspaces/users/actions for integration tests.', {
    runId: ctx.runId,
    workspaceA: ctx.workspaceA.id,
    workspaceB: ctx.workspaceB.id,
    sampleActionIds: [listActionLow, listActionMedium, listActionHigh],
  });
}

async function run() {
  await runOfflineTests();

  let dbIntegrationAttempted = false;
  try {
    dbIntegrationAttempted = true;
    await runDatabaseIntegrationTests();
  } catch (error) {
    record('database: integration test runner', 'fail', error instanceof Error ? error.message : 'Unknown database integration failure.');
  } finally {
    if (dbIntegrationAttempted && process.env.ACTIONS_BACKEND_TEST_KEEP_DATA !== 'true') {
      try {
        await cleanupTestData();
      } catch (cleanupError) {
        record('database: cleanup', 'fail', cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup failure.');
      }
    }
    await closeDatabasePool();
  }

  const passed = results.filter((item) => item.status === 'pass').length;
  const failed = results.filter((item) => item.status === 'fail').length;
  const skipped = results.filter((item) => item.status === 'skip').length;
  const success = failed === 0;

  const payload = {
    success,
    version: '0.6.0',
    phase: '3.10',
    title: 'Phase 3.10 Backend Tests',
    databaseConfigured: isDatabaseConfigured,
    safeLocalMode: isDatabaseConfigured ? isSafeLocalTestEnvironment() : null,
    summary: {
      passed,
      failed,
      skipped,
      total: results.length,
    },
    tests: results,
    safety: {
      externalWritesEnabled: false,
      executorEnabled: false,
      noPublishing: true,
      noSupportSending: true,
      noAdSpendChanges: true,
      noCampaignPause: true,
      cleanupDefault: process.env.ACTIONS_BACKEND_TEST_KEEP_DATA !== 'true',
      note: 'These tests verify backend action list/detail/approve/reject/cancel behaviour and guards. They do not call external platforms and do not enable executors.',
    },
  };

  console.log(JSON.stringify(payload, null, 2));

  if (!success) {
    process.exitCode = 1;
  }
}

await run();
