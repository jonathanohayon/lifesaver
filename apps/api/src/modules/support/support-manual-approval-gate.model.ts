import type {
  SupportManualApprovalGateChecks,
  SupportManualApprovalGateDecision,
  SupportManualApprovalGateInput,
  SupportManualApprovalGateResult,
  SupportManualApprovalGateRisk,
  SupportManualApprovalGateStatus,
} from './support-manual-approval-gate.types.js';

export const SUPPORT_MANUAL_APPROVAL_GATE_PHASE = 'phase_13_3_manual_approval_first' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE = 'v2-phase-13-3-manual-approval-first' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_PACKAGE = 'lifesaver-v0.7.0-phase-13-3-manual-approval-first.zip' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID = 'support_send_manual_approval_first_v1' as const;
export const SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE = 'support_reply_send' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'raw_provider_payload',
  'raw_ticket_payload',
  'raw_mime',
  'raw_base64',
];

function present(value: unknown): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function safeText(value: string | null | undefined, fallback: string | null = null): string | null {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || fallback;
}

function buildChecks(input: SupportManualApprovalGateInput): SupportManualApprovalGateChecks {
  return {
    actionTypeIsSupportReplySend: safeText(input.actionType) === SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE,
    actionStatusIsApproved: safeText(input.actionStatus) === 'approved',
    approvedTimestampPresent: present(input.approvedAt),
    approvalEventPresent: present(input.approvalEventId) || present(input.approvalEventActorUserId),
    approvalActorPresent: present(input.approvalEventActorUserId),
    autoSendRequested: input.autoSendRequested === true,
    forceDoesNotBypassApproval: true,
    founderApprovalRequired: true,
  };
}

function decide(checks: SupportManualApprovalGateChecks): {
  decision: SupportManualApprovalGateDecision;
  riskLevel: SupportManualApprovalGateRisk;
  eligibleToSend: boolean;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.actionTypeIsSupportReplySend) blockers.push('Only support_reply_send actions can enter the support send executor.');
  if (!checks.actionStatusIsApproved) blockers.push('Support send action status must be approved before execution.');
  if (!checks.approvedTimestampPresent) blockers.push('Approved timestamp is required before sending a support reply.');
  if (!checks.approvalEventPresent || !checks.approvalActorPresent) blockers.push('Recorded founder/admin approval event with actor is required before sending.');
  if (checks.autoSendRequested) blockers.push('Auto-send is not allowed in the first support send version.');

  if (checks.forceDoesNotBypassApproval) warnings.push('Force requests never bypass the manual founder approval gate.');

  if (!checks.actionTypeIsSupportReplySend) {
    return { decision: 'blocked_unsupported_action_type', riskLevel: 'blocked', eligibleToSend: false, blockers, warnings };
  }
  if (checks.autoSendRequested) {
    return { decision: 'blocked_auto_send_not_allowed', riskLevel: 'blocked', eligibleToSend: false, blockers, warnings };
  }
  if (blockers.length > 0) {
    return { decision: 'blocked_manual_approval_required', riskLevel: 'blocked', eligibleToSend: false, blockers, warnings };
  }
  return { decision: 'approved_to_execute', riskLevel: 'medium', eligibleToSend: true, blockers, warnings };
}

export function evaluateSupportSendManualApprovalGate(input: SupportManualApprovalGateInput = {}): SupportManualApprovalGateResult {
  const checks = buildChecks(input);
  const decision = decide(checks);
  const actionType = safeText(input.actionType);
  const executorName = safeText(input.executorName, 'gmailManualApprovedSupportReplyExecutor');

  const result: SupportManualApprovalGateResult = {
    version: '0.7.0',
    phase: SUPPORT_MANUAL_APPROVAL_GATE_PHASE,
    healthMode: SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE,
    deliverable: 'all_support_sends_approval_gated',
    policyId: SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID,
    selectedConnector: 'gmail',
    actionType,
    executorName,
    eligibleToSend: decision.eligibleToSend,
    decision: decision.decision,
    riskLevel: decision.riskLevel,
    checks,
    blockers: decision.blockers,
    warnings: input.forceRequested === true
      ? [...decision.warnings, 'A force request was present, but it does not bypass approval.']
      : decision.warnings,
    safeSummary: decision.eligibleToSend
      ? 'Support reply send is eligible for the executor because the action is approved and a recorded founder/admin approval event exists.'
      : 'Support reply send is blocked until founder/admin manual approval is confirmed.',
    safety: {
      emailSent: false,
      gmailApiCalled: false,
      autoReplyAllowed: false,
      forceBypassAllowed: false,
      manualFounderApprovalRequired: true,
      rawTicketPayloadReturned: false,
      rawTokenReturned: false,
      note: 'Phase 13.3 centralizes the rule that every support_reply_send action must have founder/admin approval before any Gmail send executor can call Gmail.',
    },
  };

  assertSupportManualApprovalGateOutputSafe(result);
  return result;
}

export function buildSupportManualApprovalGateStatus(): SupportManualApprovalGateStatus {
  return {
    phase: 'V2 Phase 13.3 — Manual Approval First',
    healthMode: SUPPORT_MANUAL_APPROVAL_GATE_HEALTH_MODE,
    deliverable: 'all_support_sends_approval_gated',
    selectedConnector: 'gmail',
    actionType: SUPPORT_MANUAL_APPROVAL_GATE_ACTION_TYPE,
    policyId: SUPPORT_MANUAL_APPROVAL_GATE_POLICY_ID,
    manualApprovalRequiredForEverySupportSend: true,
    autoSendEnabled: false,
    forceBypassAllowed: false,
    executorMustCheckApprovalEvent: true,
    executorMustCheckApprovedStatus: true,
    executorMustCheckApprovedTimestamp: true,
    gmailApiCallAllowedWithoutApproval: false,
    emailSendingAllowedWithoutApproval: false,
    nextStep: 'Phase 13.4 — Thread Association.',
  };
}

export function buildSupportManualApprovalGateExample() {
  return {
    status: buildSupportManualApprovalGateStatus(),
    blockedWithoutApproval: evaluateSupportSendManualApprovalGate({
      actionType: 'support_reply_send',
      actionStatus: 'proposed',
      approvedAt: null,
      approvalEventId: null,
      approvalEventActorUserId: null,
      executorName: 'gmailManualApprovedSupportReplyExecutor',
    }),
    eligibleAfterApproval: evaluateSupportSendManualApprovalGate({
      actionType: 'support_reply_send',
      actionStatus: 'approved',
      approvedAt: '2026-07-08T10:00:00.000Z',
      approvalEventId: 'approval_event_123',
      approvalEventActorUserId: 'founder_user_123',
      executorName: 'gmailManualApprovedSupportReplyExecutor',
    }),
    safety: {
      exampleSendsEmail: false,
      gmailApiCalled: false,
      forceBypassAllowed: false,
      autoReplyAllowed: false,
    },
  };
}

export function previewSupportManualApprovalGate(input: SupportManualApprovalGateInput = {}) {
  const result = evaluateSupportSendManualApprovalGate(input);
  return {
    ...result,
    previewOnly: true,
    safety: {
      ...result.safety,
      emailSent: false,
      gmailApiCalled: false,
    },
  };
}

export function assertSupportManualApprovalGateOutputSafe(output: unknown): void {
  const serialized = JSON.stringify(output).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support manual approval gate output contains forbidden fragment: ${fragment}`);
    }
  }
}
