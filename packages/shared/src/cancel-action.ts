export const CANCEL_ACTION_ENDPOINT_VERSION = 'cancel-action/v0.6.0-phase-3.7' as const;

export const CANCEL_ACTION_ENDPOINT = 'POST /api/v1/actions/:id/cancel' as const;

export const CANCEL_ACTION_ALLOWED_FROM_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
  'approved',
  'queued',
] as const;

export const CANCEL_ACTION_BLOCKED_STATUSES = [
  'rejected',
  'cancelled',
  'executing',
  'executed',
  'failed',
  'rollback_requested',
  'rolled_back',
] as const;

export const CANCEL_ACTION_ROLE_RULES = {
  owner: {
    canCancel: true,
    note: 'Owner can cancel eligible proposed, approval_required, auto_approved, approved, or queued actions before execution.',
  },
  admin: {
    canCancel: true,
    note: 'Admin can cancel eligible actions because cancellation stops progress and performs no external write.',
  },
  member: {
    canCancel: false,
    note: 'Member can review actions later but cannot cancel by default.',
  },
  viewer: {
    canCancel: false,
    note: 'Viewer is read-only.',
  },
} as const;

export const CANCEL_ACTION_SAFETY_RULES = [
  'Cancelling changes internal action status only.',
  'Cancelling logs a cancelled action_events row.',
  'Cancelling does not queue the action.',
  'Cancelling does not execute the action.',
  'Cancelling does not rollback an already executed action.',
  'Cancelling does not call social, support, ads, Triple Whale, Shopify, Meta, Google, TikTok, Snapchat, or any other external write API.',
  'Already cancelled actions return a safe no-op response for double-click protection.',
  'Executed actions cannot be cancelled through this endpoint. A future rollback flow is required where rollback is supported.',
] as const;
