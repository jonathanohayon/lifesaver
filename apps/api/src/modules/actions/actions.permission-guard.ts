import { createApprovalForbiddenError, createActionSafeError } from './actions.errors.js';
import type { ActionRiskLevel, WorkspaceActionMembershipRow, WorkspaceActionSummaryRow } from './actions.types.js';

export type WorkspaceActionRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ActionGuardOperation = 'view' | 'approve' | 'reject' | 'cancel' | 'monitor';

export type ActionPermissionDecision = {
  operation: ActionGuardOperation;
  allowed: boolean;
  role: string;
  platformRole: string;
  riskLevel: ActionRiskLevel | null;
  code: string;
  reason: string;
  redactedOnly: boolean;
  externalWritesEnabled: false;
};

const VIEW_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
const APPROVAL_ROLES = ['owner', 'admin'] as const;
const WRITE_DECISION_ROLES = ['owner', 'admin'] as const;

export function normalizeActionRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

export function isInternalSuperAdmin(platformRole: string | null | undefined): boolean {
  return normalizeActionRole(platformRole) === 'super_admin';
}

export function canViewActionsForWorkspace(role: string | null | undefined): boolean {
  return (VIEW_ROLES as readonly string[]).includes(normalizeActionRole(role));
}

export function canApproveActionRisk(role: string | null | undefined, riskLevel: ActionRiskLevel): boolean {
  const normalized = normalizeActionRole(role);
  if (normalized === 'owner') return true;
  if (normalized === 'admin') return riskLevel !== 'critical';
  return false;
}

export function canApproveAnyAction(role: string | null | undefined): boolean {
  return (APPROVAL_ROLES as readonly string[]).includes(normalizeActionRole(role));
}

export function canRejectAction(role: string | null | undefined): boolean {
  return (WRITE_DECISION_ROLES as readonly string[]).includes(normalizeActionRole(role));
}

export function canCancelAction(role: string | null | undefined): boolean {
  return (WRITE_DECISION_ROLES as readonly string[]).includes(normalizeActionRole(role));
}

export function canMonitorActionsRedacted(platformRole: string | null | undefined): boolean {
  return isInternalSuperAdmin(platformRole);
}

function buildDecision(params: {
  operation: ActionGuardOperation;
  membership: WorkspaceActionMembershipRow;
  riskLevel?: ActionRiskLevel | null;
  allowed: boolean;
  code: string;
  reason: string;
  redactedOnly?: boolean;
}): ActionPermissionDecision {
  return {
    operation: params.operation,
    allowed: params.allowed,
    role: normalizeActionRole(params.membership.workspace_role),
    platformRole: normalizeActionRole(params.membership.user_platform_role),
    riskLevel: params.riskLevel ?? null,
    code: params.code,
    reason: params.reason,
    redactedOnly: Boolean(params.redactedOnly),
    externalWritesEnabled: false,
  };
}

export function getActionViewDecision(membership: WorkspaceActionMembershipRow): ActionPermissionDecision {
  const allowed = canViewActionsForWorkspace(membership.workspace_role);
  return buildDecision({
    operation: 'view',
    membership,
    allowed,
    code: allowed ? 'ACTION_VIEW_ALLOWED' : 'ACTION_VIEW_FORBIDDEN',
    reason: allowed
      ? 'Active workspace members may view workspace-scoped actions. Normal customer endpoints still require workspace_id scoping and never expose full secrets.'
      : 'This workspace role is not allowed to view workspace actions.',
  });
}

export function getActionApproveDecision(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const allowed = canApproveActionRisk(membership.workspace_role, action.risk_level);
  const normalized = normalizeActionRole(membership.workspace_role);
  let code = 'ACTION_APPROVAL_ALLOWED';
  let reason = 'This workspace role may approve this action risk level. Approval remains internal only until future executor phases.';

  if (!allowed) {
    if (normalized === 'admin' && action.risk_level === 'critical') {
      code = 'ACTION_CRITICAL_APPROVAL_REQUIRES_OWNER';
      reason = 'Critical actions require owner approval by default. Admin cannot approve critical actions until a later policy explicitly permits it.';
    } else if (normalized === 'member' || normalized === 'viewer') {
      code = 'ACTION_APPROVAL_FORBIDDEN_ROLE';
      reason = 'Member and viewer roles cannot approve sensitive or executable V2 actions.';
    } else {
      code = 'ACTION_APPROVAL_FORBIDDEN';
      reason = 'This workspace role is not allowed to approve actions.';
    }
  }

  return buildDecision({
    operation: 'approve',
    membership,
    riskLevel: action.risk_level,
    allowed,
    code,
    reason,
  });
}

export function getActionRejectDecision(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const allowed = canRejectAction(membership.workspace_role);
  return buildDecision({
    operation: 'reject',
    membership,
    riskLevel: action.risk_level,
    allowed,
    code: allowed ? 'ACTION_REJECTION_ALLOWED' : 'ACTION_REJECTION_FORBIDDEN_ROLE',
    reason: allowed
      ? 'Owner/admin may reject eligible proposed actions. Rejection remains internal and does not execute anything.'
      : 'Member and viewer roles cannot reject proposed V2 actions.',
  });
}

export function getActionCancelDecision(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const allowed = canCancelAction(membership.workspace_role);
  return buildDecision({
    operation: 'cancel',
    membership,
    riskLevel: action.risk_level,
    allowed,
    code: allowed ? 'ACTION_CANCELLATION_ALLOWED' : 'ACTION_CANCELLATION_FORBIDDEN_ROLE',
    reason: allowed
      ? 'Owner/admin may cancel eligible pre-execution actions. Executed actions still require a future rollback flow.'
      : 'Member and viewer roles cannot cancel V2 actions.',
  });
}

export function getActionMonitorDecision(membership: WorkspaceActionMembershipRow): ActionPermissionDecision {
  const allowed = canMonitorActionsRedacted(membership.user_platform_role);
  return buildDecision({
    operation: 'monitor',
    membership,
    allowed,
    code: allowed ? 'ACTION_MONITOR_ALLOWED_REDACTED' : 'ACTION_MONITOR_FORBIDDEN',
    reason: allowed
      ? 'Internal super admin may monitor redacted action summaries only. Customer secrets, full payloads, rollback payloads, connector tokens, and external write controls must remain hidden.'
      : 'Only an internal super_admin platform role may use redacted action monitoring.',
    redactedOnly: true,
  });
}

export function assertCanViewWorkspaceActions(membership: WorkspaceActionMembershipRow): ActionPermissionDecision {
  const decision = getActionViewDecision(membership);
  if (!decision.allowed) {
    throw createActionSafeError(403, decision.code, decision.reason, { operation: 'view', role: decision.role, guardCode: decision.code });
  }
  return decision;
}

export function assertCanApproveWorkspaceAction(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const decision = getActionApproveDecision(membership, action);
  if (!decision.allowed) {
    throw createApprovalForbiddenError(decision.reason, { operation: 'approve', role: decision.role, riskLevel: decision.riskLevel, guardCode: decision.code });
  }
  return decision;
}

export function assertCanRejectWorkspaceAction(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const decision = getActionRejectDecision(membership, action);
  if (!decision.allowed) {
    throw createActionSafeError(403, 'REJECTION_FORBIDDEN', decision.reason, { operation: 'reject', role: decision.role, riskLevel: decision.riskLevel, guardCode: decision.code });
  }
  return decision;
}

export function assertCanCancelWorkspaceAction(membership: WorkspaceActionMembershipRow, action: WorkspaceActionSummaryRow): ActionPermissionDecision {
  const decision = getActionCancelDecision(membership, action);
  if (!decision.allowed) {
    throw createActionSafeError(403, 'CANCELLATION_FORBIDDEN', decision.reason, { operation: 'cancel', role: decision.role, riskLevel: decision.riskLevel, guardCode: decision.code });
  }
  return decision;
}

export function assertCanMonitorActionsRedacted(membership: WorkspaceActionMembershipRow): ActionPermissionDecision {
  const decision = getActionMonitorDecision(membership);
  if (!decision.allowed) {
    throw createActionSafeError(403, decision.code, decision.reason, { operation: 'detail', role: decision.role, guardCode: decision.code });
  }
  return decision;
}
