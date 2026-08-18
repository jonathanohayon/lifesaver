export const ACTION_CARD_LAYOUT_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_CARD_REQUIRED_FIELDS = [
  'title',
  'action_type',
  'status',
  'risk_level',
  'platform_hint',
  'created_at',
  'short_reason',
  'approve_button',
  'reject_button',
] as const;

export const ACTION_CARD_UI_SAFETY_RULES = [
  'Cards may show safe action summaries only.',
  'Cards must not expose full payload_json.',
  'Cards must not expose secrets, raw connector tokens, API keys, or rollback payloads.',
  'Risk badges guide review; Approve opens the confirmation modal; Reject opens the reject-with-reason modal.',
  'No UI control in Phase 4.10 may execute, publish, send, spend, pause, refund, or rollback anything. Mobile approval controls are confirmation-only; approve/reject record internal status only.',
] as const;

export const ACTION_CARD_COMPONENT_FILES = [
  'apps/web/src/actions.html',
  'apps/web/src/assets/css/actions.css',
  'apps/web/src/assets/js/action-card.js',
  'apps/web/src/assets/js/actions.js',
] as const;
