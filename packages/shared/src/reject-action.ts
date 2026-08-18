export const REJECT_ACTION_ENDPOINT_VERSION = 'reject-action/v0.6.0-phase-3.6' as const;

export const REJECT_ACTION_ENDPOINT = 'POST /api/v1/actions/:id/reject' as const;

export const REJECT_ACTION_ALLOWED_FROM_STATUSES = [
  'proposed',
  'approval_required',
] as const;

export const REJECT_ACTION_BLOCKED_STATUSES = [
  'auto_approved',
  'approved',
  'cancelled',
  'queued',
  'executing',
  'executed',
  'failed',
  'rollback_requested',
  'rolled_back',
] as const;

export const REJECT_ACTION_ROLE_RULES = {
  owner: {
    canReject: true,
    note: 'Owner can reject eligible proposed/approval_required actions. Rejection is internal only and cannot execute anything.',
  },
  admin: {
    canReject: true,
    note: 'Admin can reject eligible proposed/approval_required actions because rejection blocks progress and performs no external write.',
  },
  member: {
    canReject: false,
    note: 'Member can review actions later but cannot reject by default.',
  },
  viewer: {
    canReject: false,
    note: 'Viewer is read-only.',
  },
} as const;

export const REJECT_ACTION_SAFETY_RULES = [
  'Rejecting changes internal action status only.',
  'Rejecting logs a rejected action_events row.',
  'Rejecting does not queue the action.',
  'Rejecting does not execute the action.',
  'Rejecting does not call social, support, ads, Triple Whale, Shopify, Meta, Google, TikTok, Snapchat, or any other external write API.',
  'Already rejected actions return a safe no-op response for double-click protection.',
  'Approved/auto_approved actions should use cancel flow later, not reject flow, because they have already passed a decision gate.',
] as const;
