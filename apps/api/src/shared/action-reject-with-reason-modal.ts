export const ACTION_REJECT_WITH_REASON_MODAL_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_REJECTION_REASON_CODES = [
  'not_on_brand',
  'too_risky',
  'wrong_timing',
  'incorrect_data',
  'needs_edits',
  'other'
] as const;

export type ActionRejectionReasonCode = typeof ACTION_REJECTION_REASON_CODES[number];

export const ACTION_REJECTION_REASON_LABELS: Record<ActionRejectionReasonCode, string> = {
  not_on_brand: 'Not on brand',
  too_risky: 'Too risky',
  wrong_timing: 'Wrong timing',
  incorrect_data: 'Incorrect data',
  needs_edits: 'Needs edits',
  other: 'Other'
};

export const ACTION_REJECT_WITH_REASON_MODAL_FIELDS = [
  'what_will_happen',
  'current_status',
  'platform_affected',
  'risk_level',
  'rejection_reason',
  'optional_reason_note',
  'final_reject_button'
] as const;

export const ACTION_REJECT_WITH_REASON_SAFETY_RULES = [
  'The reject modal must call POST /api/v1/actions/:id/reject only after explicit founder confirmation.',
  'The reject modal must send a clear rejection_reason.',
  'Rejecting an action records internal status and an action_events row only.',
  'Rejecting an action must not queue, execute, publish, send, spend, pause, refund, edit, rollback, or write externally.',
  'Rejected actions should be visible in the Rejected status filter after refresh.'
] as const;
