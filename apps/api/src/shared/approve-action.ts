export const APPROVE_ACTION_ENDPOINT_VERSION = 'approve-action/v0.6.0-phase-3.5' as const;

export const APPROVE_ACTION_ENDPOINT = 'POST /api/v1/actions/:id/approve' as const;

export const APPROVE_ACTION_ALLOWED_FROM_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
] as const;

export const APPROVE_ACTION_BLOCKED_STATUSES = [
  'rejected',
  'cancelled',
  'queued',
  'executing',
  'executed',
  'failed',
  'rollback_requested',
  'rolled_back',
] as const;

export const APPROVE_ACTION_ROLE_RULES = {
  owner: {
    canApproveRiskLevels: ['low', 'medium', 'high', 'critical'],
    note: 'Owner can approve all default V2 action risk levels. Critical actions should still use strong confirmation UI later.',
  },
  admin: {
    canApproveRiskLevels: ['low', 'medium', 'high'],
    note: 'Admin can approve low/medium/high actions by default. Critical remains owner-only unless a future policy explicitly changes it.',
  },
  member: {
    canApproveRiskLevels: [],
    note: 'Member can review actions later but cannot approve by default.',
  },
  viewer: {
    canApproveRiskLevels: [],
    note: 'Viewer is read-only.',
  },
} as const;

export const APPROVE_ACTION_SAFETY_RULES = [
  'Approving changes internal action status only.',
  'Approving logs an approved action_events row.',
  'Approving does not queue the action.',
  'Approving does not execute the action.',
  'Approving does not call social, support, ads, Triple Whale, Shopify, Meta, Google, TikTok, Snapchat, or any other external write API.',
  'Rejected, cancelled, executed, queued, executing, failed, rollback_requested, and rolled_back actions cannot be approved through this endpoint.',
  'Already approved actions return a safe no-op response for double-click protection.',
] as const;
