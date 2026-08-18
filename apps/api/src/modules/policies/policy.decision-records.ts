import type { EvaluateActionPolicyResult } from './policy.types.js';

export const POLICY_DECISION_RECORDS_PHASE = 'v0.6.0 Phase 6.10 Policy Tests' as const;

export type PersistedPolicyDecisionSnapshot = {
  version: '0.6.0';
  phase: typeof POLICY_DECISION_RECORDS_PHASE;
  evaluatorPhase: string;
  actionId: string | null;
  workspaceId: string;
  actionType: string;
  riskLevel: string | null;
  decision: EvaluateActionPolicyResult['decision'];
  reason: string;
  matched_policy_id: string | null;
  matchedPolicyId: string | null;
  cap_status: EvaluateActionPolicyResult['cap_status'];
  capStatus: EvaluateActionPolicyResult['capStatus'];
  checkedPolicyCount: number;
  matchState: EvaluateActionPolicyResult['matchState'];
  defaultAskApplied: boolean;
  approvalRequired: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: false;
  policyCheckedPauseState: boolean;
  pause: EvaluateActionPolicyResult['pause'];
  capSummary?: EvaluateActionPolicyResult['capSummary'];
  scopeSummary?: EvaluateActionPolicyResult['scopeSummary'];
  conditionSummary?: EvaluateActionPolicyResult['conditionSummary'];
  conflictSummary?: EvaluateActionPolicyResult['conflictSummary'];
  evaluatedAt: string;
  recordedAt: string;
  dataPolicy: {
    rawPayloadStored: false;
    rawSecretsStored: false;
    safeForAdminAudit: true;
    note: string;
  };
  safety: {
    externalWritesAttempted: false;
    executorRan: false;
    autoRunTriggered: false;
    note: string;
  };
};

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function truncateReason(value: string, maxLength = 2400): string {
  const clean = String(value || '').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}…`;
}

export function buildPolicyDecisionSnapshot(params: {
  evaluation: EvaluateActionPolicyResult;
  actionId?: string | null;
  recordedAt?: string;
}): PersistedPolicyDecisionSnapshot {
  const evaluation = params.evaluation;
  return {
    version: '0.6.0',
    phase: POLICY_DECISION_RECORDS_PHASE,
    evaluatorPhase: evaluation.phase,
    actionId: params.actionId || evaluation.actionId || null,
    workspaceId: evaluation.workspaceId,
    actionType: evaluation.actionType,
    riskLevel: evaluation.riskLevel || null,
    decision: evaluation.decision,
    reason: truncateReason(evaluation.reason),
    matched_policy_id: evaluation.matched_policy_id,
    matchedPolicyId: evaluation.matchedPolicyId,
    cap_status: evaluation.cap_status,
    capStatus: evaluation.capStatus,
    checkedPolicyCount: evaluation.checkedPolicyCount,
    matchState: evaluation.matchState,
    defaultAskApplied: evaluation.defaultAskApplied,
    approvalRequired: evaluation.approvalRequired,
    autoApprovalAllowed: evaluation.autoApprovalAllowed,
    executorExecutionAllowed: false,
    policyCheckedPauseState: evaluation.policyCheckedPauseState,
    pause: cloneJson(evaluation.pause),
    ...(evaluation.capSummary ? { capSummary: cloneJson(evaluation.capSummary) } : {}),
    ...(evaluation.scopeSummary ? { scopeSummary: cloneJson(evaluation.scopeSummary) } : {}),
    ...(evaluation.conditionSummary ? { conditionSummary: cloneJson(evaluation.conditionSummary) } : {}),
    ...(evaluation.conflictSummary ? { conflictSummary: cloneJson(evaluation.conflictSummary) } : {}),
    evaluatedAt: evaluation.evaluatedAt,
    recordedAt: params.recordedAt || new Date().toISOString(),
    dataPolicy: {
      rawPayloadStored: false,
      rawSecretsStored: false,
      safeForAdminAudit: true,
      note: 'This snapshot stores the policy explanation only. It intentionally does not store raw action payloads, API keys, OAuth tokens, passwords, .env values, or external platform secrets.',
    },
    safety: {
      externalWritesAttempted: false,
      executorRan: false,
      autoRunTriggered: false,
      note: 'Phase 6.10 persists the policy decision explanation on the action for later audit. It does not queue, execute, publish, send, spend, pause campaigns, refund, edit products, rollback, or write to external platforms.',
    },
  };
}

export function summarizePolicyDecisionSnapshot(snapshot: unknown): {
  present: boolean;
  decision: string | null;
  reason: string | null;
  matched_policy_id: string | null;
  cap_status: string | null;
  evaluatedAt: string | null;
  recordedAt: string | null;
} {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return {
      present: false,
      decision: null,
      reason: null,
      matched_policy_id: null,
      cap_status: null,
      evaluatedAt: null,
      recordedAt: null,
    };
  }

  const value = snapshot as Record<string, unknown>;
  return {
    present: true,
    decision: typeof value.decision === 'string' ? value.decision : null,
    reason: typeof value.reason === 'string' ? truncateReason(value.reason, 500) : null,
    matched_policy_id: typeof value.matched_policy_id === 'string' ? value.matched_policy_id : null,
    cap_status: typeof value.cap_status === 'string' ? value.cap_status : null,
    evaluatedAt: typeof value.evaluatedAt === 'string' ? value.evaluatedAt : null,
    recordedAt: typeof value.recordedAt === 'string' ? value.recordedAt : null,
  };
}
