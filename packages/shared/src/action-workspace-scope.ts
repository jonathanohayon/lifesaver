export const ACTION_WORKSPACE_SCOPE_VERSION = 'action-workspace-scope/v0.6.0-phase-3.8' as const;

export const V2_WORKSPACE_ACTION_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type V2WorkspaceActionRole = typeof V2_WORKSPACE_ACTION_ROLES[number];

export const V2_ACTION_APPROVAL_ROLES = ['owner', 'admin'] as const;
export type V2ActionApprovalRole = typeof V2_ACTION_APPROVAL_ROLES[number];

export const V2_ACTION_VIEW_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type V2ActionViewRole = typeof V2_ACTION_VIEW_ROLES[number];

export const V2_ACTION_CREATE_PROPOSED_ROLES = ['owner', 'admin', 'member'] as const;
export type V2ActionCreateProposedRole = typeof V2_ACTION_CREATE_PROPOSED_ROLES[number];

export const V2_ACTION_RISK_APPROVAL_RULES = {
  low: ['owner', 'admin'],
  medium: ['owner', 'admin'],
  high: ['owner', 'admin'],
  critical: ['owner'],
} as const;

export type V2ActionRiskLevel = keyof typeof V2_ACTION_RISK_APPROVAL_RULES;

function normalizeWorkspaceRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

export function canViewWorkspaceActions(role: string | null | undefined): boolean {
  return V2_ACTION_VIEW_ROLES.includes(normalizeWorkspaceRole(role) as V2ActionViewRole);
}

export function canCreateProposedWorkspaceAction(role: string | null | undefined): boolean {
  return V2_ACTION_CREATE_PROPOSED_ROLES.includes(normalizeWorkspaceRole(role) as V2ActionCreateProposedRole);
}

export function canApproveWorkspaceAction(role: string | null | undefined, riskLevel: V2ActionRiskLevel = 'low'): boolean {
  const normalized = normalizeWorkspaceRole(role);
  const allowedRoles = V2_ACTION_RISK_APPROVAL_RULES[riskLevel] || V2_ACTION_RISK_APPROVAL_RULES.low;
  return (allowedRoles as readonly string[]).includes(normalized);
}

export function canMonitorActionsAsInternalAdmin(platformRole: string | null | undefined): boolean {
  return normalizeWorkspaceRole(platformRole) === 'super_admin';
}

export const ACTION_WORKSPACE_SCOPING_RULES = [
  'All customer-facing action queries must filter by workspace_id.',
  'All customer-facing action queries must require an active workspace_members row for the current user.',
  'Owner/admin can approve eligible V2 actions; critical actions require owner approval by default until a later policy explicitly changes it.',
  'Member/viewer roles may view workspace actions but must not approve, reject, cancel, execute, or manage sensitive V2 actions.',
  'Internal super admin monitoring must return redacted summaries only and must never expose raw connector secrets, payload secrets, rollback secrets, or .env values.',
  'No repository query may execute an action; repositories only read/write internal LIFE.SAVER records.',
] as const;

export const ACTION_SCOPE_ERROR_CODES = [
  'WORKSPACE_ACCESS_DENIED',
  'ACTION_NOT_FOUND_IN_WORKSPACE',
  'ACTION_APPROVAL_FORBIDDEN',
  'ACTION_MONITOR_FORBIDDEN',
  'ACTION_SCOPE_REQUIRED',
] as const;

export type ActionScopeErrorCode = typeof ACTION_SCOPE_ERROR_CODES[number];
