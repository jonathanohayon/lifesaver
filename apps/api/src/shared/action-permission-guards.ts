export const ACTION_PERMISSION_GUARD_VERSION = 'action-permission-guards/v0.6.0-phase-3.8' as const;

export const ACTION_PERMISSION_ROLES = ['owner', 'admin', 'member', 'viewer', 'super_admin'] as const;
export const ACTION_PERMISSION_OPERATIONS = ['view', 'approve', 'reject', 'cancel', 'monitor'] as const;
export const ACTION_PERMISSION_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export type ActionPermissionRole = typeof ACTION_PERMISSION_ROLES[number];
export type ActionPermissionOperation = typeof ACTION_PERMISSION_OPERATIONS[number];
export type ActionPermissionRiskLevel = typeof ACTION_PERMISSION_RISK_LEVELS[number];

export const ACTION_PERMISSION_MATRIX = {
  owner: {
    view: true,
    approve: ['low', 'medium', 'high', 'critical'],
    reject: true,
    cancel: true,
    monitor: false,
    notes: 'Owner can approve all current V2 risk levels, including critical. Execution still remains disabled until later executor phases.',
  },
  admin: {
    view: true,
    approve: ['low', 'medium', 'high'],
    reject: true,
    cancel: true,
    monitor: false,
    notes: 'Admin can approve low/medium/high but not critical actions by default.',
  },
  member: {
    view: true,
    approve: [],
    reject: false,
    cancel: false,
    monitor: false,
    notes: 'Member can view workspace actions but cannot approve, reject, cancel, execute, or manage sensitive actions.',
  },
  viewer: {
    view: true,
    approve: [],
    reject: false,
    cancel: false,
    monitor: false,
    notes: 'Viewer is read-only and cannot change action state.',
  },
  super_admin: {
    view: false,
    approve: [],
    reject: false,
    cancel: false,
    monitor: true,
    notes: 'Internal super admin may monitor redacted summaries only; no customer payload secrets or external write controls.',
  },
} as const;

export const ACTION_PERMISSION_GUARD_RULES = [
  'Normal customer endpoints must require an active workspace_members row and filter by workspace_id.',
  'Owner/admin can approve eligible actions; admin cannot approve critical actions by default.',
  'Member/viewer roles cannot approve, reject, cancel, execute, or manage sensitive V2 actions.',
  'Super admin monitoring must be redacted and must not expose payload_json, connector keys, OAuth tokens, rollback payloads, Claude API key, Triple Whale API key, APP_ENCRYPTION_KEY, WORKER_SHARED_SECRET, or raw .env values.',
  'A platform-level super_admin role does not bypass workspace-scoped customer endpoints by itself; workspace customer actions still require workspace scoping.',
  'Role guards do not execute anything. They only allow or deny internal LIFE.SAVER state transitions.',
] as const;

function normalizeRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

export function sharedCanViewAction(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'owner' || normalized === 'admin' || normalized === 'member' || normalized === 'viewer';
}

export function sharedCanApproveActionRisk(role: string | null | undefined, riskLevel: ActionPermissionRiskLevel): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'owner') return true;
  if (normalized === 'admin') return riskLevel !== 'critical';
  return false;
}

export function sharedCanChangeActionDecision(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'owner' || normalized === 'admin';
}

export function sharedCanMonitorActionsRedacted(platformRole: string | null | undefined): boolean {
  return normalizeRole(platformRole) === 'super_admin';
}
