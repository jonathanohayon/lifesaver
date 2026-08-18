import { env } from '../../config/env.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getWorkspaceActionForUser } from '../actions/actions.repository.js';
import type { WorkspaceActionDetailRow } from '../actions/actions.types.js';
import { findLatestManualApprovalEvent, listSafeContentPublishResultLogs, type RealPublishApprovedEventRow } from './content-real-publish.repository.js';
import type { SafeContentPublishResultLog } from './content-publish-result-logs.js';
import { CONTENT_REAL_PUBLISH_EXECUTOR_NAME, LINKEDIN_REQUIRED_WRITE_SCOPE } from './content-real-publish.executor.js';

export const CONTENT_CONTROLLED_LIVE_TEST_PHASE = 'v0.7.0_phase_9_10' as const;
export const CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE = 'v2-phase-9-10-controlled-live-test' as const;
export const CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME = 'linkedinControlledLiveTestReport' as const;
export const DEFAULT_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE = 'I APPROVE ONE LINKEDIN TEST POST' as const;

type JsonObject = Record<string, unknown>;

type MinimalAction = Pick<
  WorkspaceActionDetailRow,
  'id' | 'workspace_id' | 'action_type' | 'status' | 'approved_at' | 'executed_at' | 'risk_level' | 'policy_decision' | 'payload_json'
>;

export type ControlledLiveTestEvaluationInput = {
  databaseConfigured: boolean;
  action: MinimalAction | null;
  manualApprovalEvent: Pick<RealPublishApprovedEventRow, 'id' | 'actor_user_id' | 'created_at'> | null;
  resultLogs: SafeContentPublishResultLog[];
};

export type ControlledLiveTestReport = {
  version: '0.7.0';
  phase: typeof CONTENT_CONTROLLED_LIVE_TEST_PHASE;
  healthMode: typeof CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE;
  reportName: typeof CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME;
  workspaceId: string;
  actionId: string;
  platform: 'linkedin';
  status: 'pass' | 'partial' | 'fail' | 'not_ready';
  checks: {
    databaseConfigured: boolean;
    actionFound: boolean;
    actionTypeValid: boolean;
    actionManuallyApproved: boolean;
    actionExecutedOrRolledBackAfterPublish: boolean;
    exactlyOneSuccessfulPublishResult: boolean;
    noFailedPublishResult: boolean;
    platformPostIdStored: boolean;
    publishedTimeStored: boolean;
    platformResponseSummaryStored: boolean;
    tokenNotReturned: boolean;
    rawPlatformResponseNotReturned: boolean;
    rollbackPayloadNotReturned: boolean;
  };
  liveTest: {
    explicitFounderApprovalRequired: true;
    requiredApprovalPhrase: string;
    selectedPlatform: 'linkedin';
    executorName: typeof CONTENT_REAL_PUBLISH_EXECUTOR_NAME;
    requiredScope: typeof LINKEDIN_REQUIRED_WRITE_SCOPE;
    maxSuccessfulPublishResultsAllowedForTest: 1;
    successfulPublishResultCount: number;
    failedPublishResultCount: number;
    platformPostId: string | null;
    permalink: string | null;
    publishedTime: string | null;
    manualApprovalActorUserId: string | null;
    manualApprovalEventId: string | null;
  };
  evidence: {
    actionStatus: string | null;
    riskLevel: string | null;
    policyDecision: string | null;
    resultLogIds: string[];
    safePlatformResponseSummary: JsonObject | null;
  };
  safety: {
    thisEndpointPublishes: false;
    thisEndpointDeletes: false;
    autoRunEnabled: false;
    externalWritesAttemptedByThisEndpoint: false;
    browserReceivesRawToken: false;
    browserReceivesRawPlatformResponse: false;
    browserReceivesRollbackPayload: false;
    note: string;
  };
  message: string;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function safeObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function approvalPhrase(): string {
  return (env.CONTENT_PUBLISH_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE || DEFAULT_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE).trim() || DEFAULT_CONTROLLED_LIVE_TEST_APPROVAL_PHRASE;
}

export function buildControlledLiveTestStatusSummary() {
  return {
    version: '0.7.0',
    phase: CONTENT_CONTROLLED_LIVE_TEST_PHASE,
    healthMode: CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE,
    reportName: CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME,
    selectedPlatform: 'linkedin',
    goal: 'Publish one approved LinkedIn test post only after explicit founder/client approval, then produce a token-safe report.',
    requiredApprovalPhrase: approvalPhrase(),
    defaultOffGates: {
      realPublishExecutorEnabled: env.CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED,
      rollbackExecutorEnabled: env.CONTENT_PUBLISH_ROLLBACK_EXECUTOR_ENABLED,
      workerEnabled: env.WORKER_ENABLED,
    },
    controlledLiveTestProtocol: [
      'Confirm client/founder approval in writing before enabling the real publish executor.',
      `Use the exact approval phrase: ${approvalPhrase()}`,
      'Create one content_publish action with a safe LinkedIn text/link payload only.',
      'Approve the action manually through the approval queue.',
      'Temporarily enable CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED=true only for this test window.',
      'Execute POST /api/v1/actions/:id/execute-content-publish once.',
      'Immediately return CONTENT_REAL_PUBLISH_EXECUTOR_ENABLED=false after the test.',
      'Review GET /api/v1/actions/:id/content-live-test-report and save the report.',
    ],
    thisEndpointPublishes: false,
    thisEndpointDeletes: false,
    autoRunEnabled: false,
    safety: {
      browserReceivesRawToken: false,
      rawPlatformResponseReturned: false,
      rollbackPayloadReturned: false,
      note: 'Phase 9.10 adds the controlled live test reporting and go/no-go checklist. It does not auto-publish and does not call LinkedIn from the report endpoint.',
    },
  };
}

export function evaluateControlledLiveTestReport(params: {
  workspaceId: string;
  actionId: string;
  input: ControlledLiveTestEvaluationInput;
}): ControlledLiveTestReport {
  const action = params.input.action;
  const logs = params.input.resultLogs || [];
  const publishLogs = logs.filter((log) => log.executorName === CONTENT_REAL_PUBLISH_EXECUTOR_NAME);
  const successfulPublishLogs = publishLogs.filter((log) => log.resultStatus === 'success');
  const failedPublishLogs = publishLogs.filter((log) => log.resultStatus === 'failed');
  const latestSuccess = successfulPublishLogs[0] || null;
  const platformSummary = latestSuccess?.platformResponseSummary ? safeObject(latestSuccess.platformResponseSummary) : null;

  const checks: ControlledLiveTestReport['checks'] = {
    databaseConfigured: params.input.databaseConfigured,
    actionFound: Boolean(action),
    actionTypeValid: action?.action_type === 'content_publish',
    actionManuallyApproved: Boolean(action?.approved_at || params.input.manualApprovalEvent),
    actionExecutedOrRolledBackAfterPublish: ['executed', 'rolled_back'].includes(String(action?.status || '')),
    exactlyOneSuccessfulPublishResult: successfulPublishLogs.length === 1,
    noFailedPublishResult: failedPublishLogs.length === 0,
    platformPostIdStored: Boolean(latestSuccess?.platformPostId),
    publishedTimeStored: Boolean(latestSuccess?.publishedTime),
    platformResponseSummaryStored: Boolean(platformSummary),
    tokenNotReturned: logs.every((log) => log.safety.rawTokenReturned === false),
    rawPlatformResponseNotReturned: logs.every((log) => log.safety.rawResponseBodyReturned === false),
    rollbackPayloadNotReturned: logs.every((log) => log.safety.rollbackPayloadReturned === false),
  };

  const requiredPassChecks = [
    checks.databaseConfigured,
    checks.actionFound,
    checks.actionTypeValid,
    checks.actionManuallyApproved,
    checks.actionExecutedOrRolledBackAfterPublish,
    checks.exactlyOneSuccessfulPublishResult,
    checks.noFailedPublishResult,
    checks.platformPostIdStored,
    checks.publishedTimeStored,
    checks.platformResponseSummaryStored,
    checks.tokenNotReturned,
    checks.rawPlatformResponseNotReturned,
    checks.rollbackPayloadNotReturned,
  ];

  const passCount = requiredPassChecks.filter(Boolean).length;
  const status: ControlledLiveTestReport['status'] = requiredPassChecks.every(Boolean)
    ? 'pass'
    : !checks.databaseConfigured || !checks.actionFound
      ? 'not_ready'
      : passCount >= 8
        ? 'partial'
        : 'fail';

  return {
    version: '0.7.0',
    phase: CONTENT_CONTROLLED_LIVE_TEST_PHASE,
    healthMode: CONTENT_CONTROLLED_LIVE_TEST_HEALTH_MODE,
    reportName: CONTENT_CONTROLLED_LIVE_TEST_REPORT_NAME,
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    platform: 'linkedin',
    status,
    checks,
    liveTest: {
      explicitFounderApprovalRequired: true,
      requiredApprovalPhrase: approvalPhrase(),
      selectedPlatform: 'linkedin',
      executorName: CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
      requiredScope: LINKEDIN_REQUIRED_WRITE_SCOPE,
      maxSuccessfulPublishResultsAllowedForTest: 1,
      successfulPublishResultCount: successfulPublishLogs.length,
      failedPublishResultCount: failedPublishLogs.length,
      platformPostId: latestSuccess?.platformPostId || null,
      permalink: latestSuccess?.permalink || null,
      publishedTime: latestSuccess?.publishedTime || null,
      manualApprovalActorUserId: params.input.manualApprovalEvent?.actor_user_id || null,
      manualApprovalEventId: params.input.manualApprovalEvent?.id || null,
    },
    evidence: {
      actionStatus: action?.status || null,
      riskLevel: action?.risk_level || null,
      policyDecision: action?.policy_decision || null,
      resultLogIds: logs.map((log) => log.id).slice(0, 20),
      safePlatformResponseSummary: platformSummary,
    },
    safety: {
      thisEndpointPublishes: false,
      thisEndpointDeletes: false,
      autoRunEnabled: false,
      externalWritesAttemptedByThisEndpoint: false,
      browserReceivesRawToken: false,
      browserReceivesRawPlatformResponse: false,
      browserReceivesRollbackPayload: false,
      note: 'This report endpoint only reads safe action/result data after a manually approved test. It cannot publish, unpublish, schedule, or auto-run content.',
    },
    message: status === 'pass'
      ? 'Controlled live test passed: one manually approved LinkedIn content_publish action has one successful safe result log.'
      : status === 'partial'
        ? 'Controlled live test is partially complete. Review failed checks before treating it as accepted.'
        : status === 'not_ready'
          ? 'Controlled live test report is not ready because required database/action evidence is missing.'
          : 'Controlled live test failed. Do not proceed to wider real publishing until issues are resolved.',
  };
}

export async function buildControlledLiveTestReport(params: {
  workspaceId: string;
  userId: string;
  actionId: string;
}): Promise<ControlledLiveTestReport> {
  if (!isDatabaseConfigured) {
    return evaluateControlledLiveTestReport({
      workspaceId: params.workspaceId,
      actionId: params.actionId,
      input: {
        databaseConfigured: false,
        action: null,
        manualApprovalEvent: null,
        resultLogs: [],
      },
    });
  }

  const [action, manualApprovalEvent, resultLogs] = await Promise.all([
    getWorkspaceActionForUser(params),
    findLatestManualApprovalEvent({ actionId: params.actionId, workspaceId: params.workspaceId }),
    listSafeContentPublishResultLogs({
      actionId: params.actionId,
      workspaceId: params.workspaceId,
      userId: params.userId,
      limit: 20,
    }),
  ]);

  return evaluateControlledLiveTestReport({
    workspaceId: params.workspaceId,
    actionId: params.actionId,
    input: {
      databaseConfigured: true,
      action,
      manualApprovalEvent,
      resultLogs,
    },
  });
}
