import type { ActionPolicyDecision, ActionRiskLevel, ActionType } from '../actions/actions.types.js';
import { buildPolicyDecisionSnapshot, summarizePolicyDecisionSnapshot, type PersistedPolicyDecisionSnapshot } from './policy.decision-records.js';
import { evaluateActionPolicy } from './policy.evaluator.js';
import type { EvaluateActionPolicyInput, EvaluateActionPolicyResult } from './policy.types.js';
import type { PolicyEvaluationRuleRow } from './policy.repository.js';
import type { PolicyCapUsageSnapshot } from './policy.cap-validation.js';
import type { CategoryPauseBackendState, GlobalPauseBackendState } from '../autonomy/autonomy.types.js';
import { getCategoryPauseState } from '../autonomy/autonomy.service.js';
import { getEmergencySafeModeState } from '../autonomy/emergency-safe-mode.js';

export const POLICY_DRY_RUN_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export type PolicyDryRunUseCase = 'admin_simulation' | 'qa' | 'policy_ui_preview';

export type PolicyDryRunActionInput = {
  workspaceId: string;
  actionId?: string | null;
  actionType: ActionType;
  riskLevel?: ActionRiskLevel | null;
  payloadJson?: Record<string, unknown>;
  requestedDecision?: ActionPolicyDecision | null;
  source?: string | null;
};

export type PolicyDryRunInput = PolicyDryRunActionInput & {
  useCase?: PolicyDryRunUseCase;
  simulationName?: string | null;
  policyRows?: PolicyEvaluationRuleRow[];
  capUsage?: PolicyCapUsageSnapshot | null;
  knownPauseState?: GlobalPauseBackendState;
  knownCategoryPauseState?: CategoryPauseBackendState;
  actorUserId?: string | null;
};

export type PolicyDryRunResult = {
  version: '0.6.0';
  phase: typeof POLICY_DRY_RUN_PHASE;
  dryRun: true;
  dryRunId: string;
  useCase: PolicyDryRunUseCase;
  simulationName: string | null;
  workspaceId: string;
  actorUserId: string | null;
  action: {
    actionId: string | null;
    actionType: ActionType;
    riskLevel: ActionRiskLevel | null;
    requestedDecision: ActionPolicyDecision | null;
    payloadPreviewKeys: string[];
  };
  evaluation: EvaluateActionPolicyResult;
  snapshotPreview: PersistedPolicyDecisionSnapshot;
  snapshotSummary: ReturnType<typeof summarizePolicyDecisionSnapshot>;
  outcomePreview: {
    decision: Exclude<ActionPolicyDecision, 'not_evaluated'>;
    reason: string;
    matched_policy_id: string | null;
    cap_status: string;
    approvalRequired: boolean;
    autoApprovalAllowed: boolean;
    executorExecutionAllowed: false;
    wouldPersistAction: false;
    wouldPersistPolicyDecisionSnapshot: false;
    wouldQueueExecution: false;
    wouldRunExecutor: false;
    wouldWriteExternally: false;
  };
  checked: {
    checkedPolicyCount: number;
    matchState: string;
    conflictReasonCode: string | null;
    defaultAskApplied: boolean;
    pauseChecked: boolean;
    capStatus: string;
  };
  generatedAt: string;
  safety: {
    databaseWritesPerformed: false;
    actionCreated: false;
    policySnapshotPersisted: false;
    approvalStateChanged: false;
    executorRan: false;
    externalWritesAttempted: false;
    autoRunTriggered: false;
    note: string;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function buildDryRunId(input: PolicyDryRunInput, generatedAt: string): string {
  const source = [
    input.workspaceId || 'missing-workspace',
    input.actionType || 'missing-action-type',
    input.riskLevel || 'no-risk',
    input.simulationName || input.useCase || 'dry-run',
    generatedAt,
  ].join(':');

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `dryrun_${Math.abs(hash).toString(36)}_${generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

function safePayloadKeys(payloadJson: Record<string, unknown> | undefined): string[] {
  if (!payloadJson || typeof payloadJson !== 'object' || Array.isArray(payloadJson)) return [];
  return Object.keys(payloadJson).slice(0, 50);
}

function normalizeUseCase(value: unknown): PolicyDryRunUseCase {
  if (value === 'admin_simulation' || value === 'qa' || value === 'policy_ui_preview') return value;
  return 'qa';
}

function buildDefaultDryRunPauseState(workspaceId: string, generatedAt: string): GlobalPauseBackendState {
  const category = (name: 'content' | 'support' | 'ads' | 'research' | 'dev') => ({
    paused: false,
    autoApprovalAllowed: true,
    executorExecutionAllowed: false,
    reason: `${name} category is not paused for this dry-run preview. Executor execution remains disabled by Phase 6.10.`,
  });

  return {
    workspaceId,
    pauseAllAutonomy: false,
    pauseContentActions: false,
    pauseSupportActions: false,
    pauseAdsActions: false,
    pauseResearchActions: false,
    pauseDevActions: false,
    updatedBy: null,
    updatedAt: generatedAt,
    enforcement: {
      autoApprovalAllowed: true,
      executorExecutionAllowed: false,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: 'Dry-run default pause state is unpaused for policy preview only. It does not permit execution.',
    },
    categories: {
      content: category('content'),
      support: category('support'),
      ads: category('ads'),
      research: category('research'),
      dev: category('dev'),
    },
    emergencySafeMode: getEmergencySafeModeState(),
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'Dry-run pause state is only a simulation aid. It cannot enable executors or external writes.',
    },
  };
}

function buildEvaluationInput(input: PolicyDryRunInput, generatedAt: string): EvaluateActionPolicyInput {
  const knownPauseState = input.knownPauseState || buildDefaultDryRunPauseState(input.workspaceId, generatedAt);
  const knownCategoryPauseState = input.knownCategoryPauseState || getCategoryPauseState({
    pauseState: knownPauseState,
    actionType: input.actionType,
  });

  return {
    workspaceId: input.workspaceId,
    actionId: input.actionId || null,
    actionType: input.actionType,
    riskLevel: input.riskLevel || null,
    payloadJson: input.payloadJson || {},
    requestedDecision: input.requestedDecision || 'ask',
    source: input.source || `policy_dry_run:${normalizeUseCase(input.useCase)}`,
    // Passing [] is intentional: dry-run mode must be usable for QA/default-ask previews
    // without requiring a live database. If the caller wants live enabled policies, they
    // can omit policyRows and run in a configured backend environment.
    policyRows: input.policyRows || [],
    capUsage: input.capUsage || null,
    knownPauseState,
    knownCategoryPauseState,
  };
}

export async function dryRunActionPolicy(input: PolicyDryRunInput): Promise<PolicyDryRunResult> {
  const generatedAt = nowIso();
  const useCase = normalizeUseCase(input.useCase);
  const evaluation = await evaluateActionPolicy(buildEvaluationInput(input, generatedAt));
  const snapshotPreview = buildPolicyDecisionSnapshot({
    evaluation,
    actionId: input.actionId || null,
    recordedAt: generatedAt,
  });

  return {
    version: '0.6.0',
    phase: POLICY_DRY_RUN_PHASE,
    dryRun: true,
    dryRunId: buildDryRunId(input, generatedAt),
    useCase,
    simulationName: typeof input.simulationName === 'string' && input.simulationName.trim() ? input.simulationName.trim().slice(0, 160) : null,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: {
      actionId: input.actionId || null,
      actionType: input.actionType,
      riskLevel: input.riskLevel || null,
      requestedDecision: input.requestedDecision || null,
      payloadPreviewKeys: safePayloadKeys(input.payloadJson),
    },
    evaluation,
    snapshotPreview,
    snapshotSummary: summarizePolicyDecisionSnapshot(snapshotPreview),
    outcomePreview: {
      decision: evaluation.decision,
      reason: evaluation.reason,
      matched_policy_id: evaluation.matched_policy_id,
      cap_status: evaluation.cap_status,
      approvalRequired: evaluation.approvalRequired,
      autoApprovalAllowed: evaluation.autoApprovalAllowed,
      executorExecutionAllowed: false,
      wouldPersistAction: false,
      wouldPersistPolicyDecisionSnapshot: false,
      wouldQueueExecution: false,
      wouldRunExecutor: false,
      wouldWriteExternally: false,
    },
    checked: {
      checkedPolicyCount: evaluation.checkedPolicyCount,
      matchState: evaluation.matchState,
      conflictReasonCode: evaluation.conflictSummary?.reasonCode || null,
      defaultAskApplied: evaluation.defaultAskApplied,
      pauseChecked: evaluation.policyCheckedPauseState,
      capStatus: evaluation.cap_status,
    },
    generatedAt,
    safety: {
      databaseWritesPerformed: false,
      actionCreated: false,
      policySnapshotPersisted: false,
      approvalStateChanged: false,
      executorRan: false,
      externalWritesAttempted: false,
      autoRunTriggered: false,
      note: 'Phase 6.10 dry-run mode evaluates policies for admin simulation, QA, and future policy UI preview only. It does not create actions, persist snapshots, approve, reject, queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write to external platforms.',
    },
  };
}
