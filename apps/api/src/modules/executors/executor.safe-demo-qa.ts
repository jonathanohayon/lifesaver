import type { ActionRiskLevel, ActionStatus, ActionType } from '../actions/actions.types.js';
import type { PersistSandboxExecutionResultLogResult } from './executor.result-logs.js';
import { persistSandboxExecutionResultLog, summarizeResultLogDecision } from './executor.result-logs.js';
import {
  runApproveToExecuteSandboxLifecycle,
  type SandboxLifecycleInput,
  type SandboxLifecycleResult,
} from './executor.sandbox-lifecycle.js';

export const SAFE_DEMO_QA_PHASE = 'v0.6.0 Phase 8.10 Safe Demo QA' as const;

export type SafeDemoQaStepName =
  | 'draft'
  | 'proposed_action'
  | 'approval'
  | 'sandbox_execution'
  | 'result_log';

export type SafeDemoQaStep = {
  step: number;
  name: SafeDemoQaStepName;
  status: ActionStatus | 'draft_created' | 'result_log_previewed' | 'result_log_stored';
  title: string;
  summary: string;
  passed: boolean;
  evidence: Record<string, unknown>;
};

export type SafeDemoQaInput = {
  workspaceId?: string;
  draftId?: string;
  actionId?: string;
  actionType?: Extract<ActionType, 'content_publish' | 'support_reply_send' | 'ad_budget_adjust' | 'ad_pause'>;
  riskLevel?: ActionRiskLevel;
  createdByUserId?: string;
  approvedByUserId?: string;
  persistResultLog?: boolean;
  sandboxShouldFail?: boolean;
};

export type SafeDemoQaReport = {
  version: '0.6.0';
  phase: typeof SAFE_DEMO_QA_PHASE;
  title: 'Sandbox Executor QA Report';
  liveDomain: 'https://lifesaveragent.com';
  goal: 'Demonstrate complete V2 flow safely.';
  flow: 'Draft -> Proposed Action -> Approval -> Sandbox Execution -> Result Log';
  workspaceId: string;
  draftId: string;
  actionId: string;
  actionType: ActionType;
  qaPassed: boolean;
  steps: SafeDemoQaStep[];
  lifecycle: SandboxLifecycleResult;
  resultLog: PersistSandboxExecutionResultLogResult;
  summary: string;
  safety: {
    sandboxOnly: true;
    externalWritesAttempted: false;
    externalWritesSucceeded: false;
    realExecutorsEnabled: false;
    autoRunEnabled: false;
    resultLogPersistenceRequested: boolean;
    note: string;
  };
};

function defaultPayload(actionType: SafeDemoQaInput['actionType'], sandboxShouldFail = false): Record<string, unknown> {
  const root = {
    schema_version: 'action-payload/v0.6.0',
    action_type: actionType,
    source: 'safe_demo_qa',
    intent_summary: 'Safe Phase 8.10 sandbox demo QA action.',
    sandbox_should_fail: sandboxShouldFail,
  };

  if (actionType === 'support_reply_send') {
    return {
      ...root,
      data: {
        ticket_id: 'sandbox-ticket-demo-1001',
        thread_id: 'sandbox-thread-demo-1001',
        reply_body: 'Certainly, sir. This is a safe sandbox support reply demo. No email will be sent.',
        confidence_score: 0.92,
      },
    };
  }

  if (actionType === 'ad_budget_adjust') {
    return {
      ...root,
      data: {
        platform: 'meta_ads',
        campaign_id: 'sandbox-campaign-demo-1001',
        campaign_name: 'Sandbox Demo Campaign',
        current_budget: 100,
        proposed_budget: 110,
        change_amount: 10,
        currency: 'USD',
      },
    };
  }

  if (actionType === 'ad_pause') {
    return {
      ...root,
      data: {
        platform: 'meta_ads',
        campaign_id: 'sandbox-campaign-demo-1002',
        campaign_name: 'Sandbox Demo Pause Campaign',
        entity_type: 'campaign',
        current_status: 'active',
        proposed_status: 'paused',
      },
    };
  }

  return {
    ...root,
    data: {
      platform: 'instagram',
      caption: 'Certainly, sir. This is a safe Phase 8.10 sandbox demo post. No real platform will be touched.',
      post_type: 'feed',
    },
  };
}

function step(input: SafeDemoQaStep): SafeDemoQaStep {
  return input;
}

function allStepsPassed(steps: SafeDemoQaStep[]): boolean {
  return steps.every((item) => item.passed === true);
}

export function buildSafeDemoQaLifecycleInput(input: SafeDemoQaInput = {}): SandboxLifecycleInput {
  const actionType = input.actionType || 'content_publish';
  return {
    workspaceId: input.workspaceId || 'workspace-safe-demo-qa',
    actionId: input.actionId || 'action-safe-demo-qa-content-1',
    actionType,
    currentStatus: 'proposed',
    riskLevel: input.riskLevel || 'low',
    createdByUserId: input.createdByUserId || 'founder-safe-demo',
    approvedByUserId: input.approvedByUserId || 'owner-safe-demo',
    approvalNote: 'Phase 8.10 safe demo approval. Sandbox execution only.',
    policyDecision: 'ask',
    payloadJson: defaultPayload(actionType, input.sandboxShouldFail === true),
    metadata: {
      phase: SAFE_DEMO_QA_PHASE,
      live_domain: 'https://lifesaveragent.com',
      safe_demo_qa: true,
      sandbox_only: true,
      external_writes_attempted: false,
    },
  };
}

export async function runSafeDemoQaReport(input: SafeDemoQaInput = {}): Promise<SafeDemoQaReport> {
  const lifecycleInput = buildSafeDemoQaLifecycleInput(input);
  const draftId = input.draftId || `draft-${lifecycleInput.actionId}`;
  const lifecycle = await runApproveToExecuteSandboxLifecycle(lifecycleInput);
  const resultLog = await persistSandboxExecutionResultLog(lifecycle, { persist: input.persistResultLog === true });

  const steps: SafeDemoQaStep[] = [
    step({
      step: 1,
      name: 'draft',
      status: 'draft_created',
      title: 'Draft created',
      summary: 'A safe demo draft exists as the source idea for the proposed action.',
      passed: Boolean(draftId),
      evidence: {
        draft_id: draftId,
        source: 'safe_demo_qa',
        external_writes_attempted: false,
      },
    }),
    step({
      step: 2,
      name: 'proposed_action',
      status: 'proposed',
      title: 'Proposed action created',
      summary: 'The draft is represented as a proposed V2 action before any execution is possible.',
      passed: lifecycle.lifecycle.statusPath[0] === 'proposed',
      evidence: {
        action_id: lifecycle.actionId,
        action_type: lifecycle.actionType,
        from_status: lifecycle.lifecycle.fromStatus,
      },
    }),
    step({
      step: 3,
      name: 'approval',
      status: 'approved',
      title: 'Action approved',
      summary: 'The action is approved by a safe demo owner/admin identity before sandbox execution.',
      passed: lifecycle.lifecycle.approved && lifecycle.lifecycle.statusPath.includes('approved'),
      evidence: {
        approved_by_user_id: lifecycleInput.approvedByUserId,
        approval_required_before_execution: true,
        auto_run_enabled: false,
      },
    }),
    step({
      step: 4,
      name: 'sandbox_execution',
      status: lifecycle.lifecycle.finalStatus,
      title: lifecycle.lifecycle.executed ? 'Sandbox execution completed' : 'Sandbox execution did not complete successfully',
      summary: lifecycle.executor.executionResult?.resultSummary || lifecycle.executor.validationReason,
      passed: lifecycle.lifecycle.executed && lifecycle.lifecycle.finalStatus === 'executed',
      evidence: {
        executor_name: lifecycle.executor.name,
        mode: lifecycle.executor.mode,
        status_path: lifecycle.lifecycle.statusPath,
        external_writes_attempted: false,
        external_writes_succeeded: false,
      },
    }),
    step({
      step: 5,
      name: 'result_log',
      status: resultLog.stored ? 'result_log_stored' : 'result_log_previewed',
      title: resultLog.stored ? 'Result log stored' : 'Result log preview generated',
      summary: summarizeResultLogDecision(resultLog.recordPreview),
      passed: resultLog.recordPreview.result_status === 'success' && resultLog.recordPreview.action_id === lifecycle.actionId,
      evidence: {
        target_table: resultLog.targetTable,
        stored: resultLog.stored,
        skipped_reason: resultLog.skippedReason,
        result_status: resultLog.recordPreview.result_status,
        external_id: resultLog.recordPreview.external_id,
        external_url: resultLog.recordPreview.external_url,
        rollback_payload_included_in_browser: false,
      },
    }),
  ];

  const qaPassed = allStepsPassed(steps);

  return {
    version: '0.6.0',
    phase: SAFE_DEMO_QA_PHASE,
    title: 'Sandbox Executor QA Report',
    liveDomain: 'https://lifesaveragent.com',
    goal: 'Demonstrate complete V2 flow safely.',
    flow: 'Draft -> Proposed Action -> Approval -> Sandbox Execution -> Result Log',
    workspaceId: lifecycle.workspaceId,
    draftId,
    actionId: lifecycle.actionId,
    actionType: lifecycle.actionType,
    qaPassed,
    steps,
    lifecycle,
    resultLog,
    summary: qaPassed
      ? 'Safe demo QA passed: draft, proposed action, approval, sandbox execution, and result log preview completed without external writes.'
      : 'Safe demo QA did not pass all steps. Review lifecycle and result log evidence before proceeding.',
    safety: {
      sandboxOnly: true,
      externalWritesAttempted: false,
      externalWritesSucceeded: false,
      realExecutorsEnabled: false,
      autoRunEnabled: false,
      resultLogPersistenceRequested: input.persistResultLog === true,
      note: 'Phase 8.10 demonstrates the complete V2 flow safely with sandbox executors only. It does not call social, support, ads, or ecommerce platforms.',
    },
  };
}

export function buildSafeDemoQaSafetySummary(): {
  version: '0.6.0';
  phase: typeof SAFE_DEMO_QA_PHASE;
  flow: ['draft', 'proposed_action', 'approval', 'sandbox_execution', 'result_log'];
  sandboxExecutorQaReport: true;
  demonstratesCompleteV2FlowSafely: true;
  externalWritesEnabled: false;
  realExecutorsEnabled: false;
  autoRunEnabled: false;
  liveDomain: 'https://lifesaveragent.com';
  note: string;
} {
  return {
    version: '0.6.0',
    phase: SAFE_DEMO_QA_PHASE,
    flow: ['draft', 'proposed_action', 'approval', 'sandbox_execution', 'result_log'],
    sandboxExecutorQaReport: true,
    demonstratesCompleteV2FlowSafely: true,
    externalWritesEnabled: false,
    realExecutorsEnabled: false,
    autoRunEnabled: false,
    liveDomain: 'https://lifesaveragent.com',
    note: 'Phase 8.10 is a safe demo QA report for the full V2 sandbox flow. It is not a production executor release and does not enable external writes.',
  };
}
