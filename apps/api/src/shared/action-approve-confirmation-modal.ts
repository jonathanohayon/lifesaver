export const ACTION_APPROVE_CONFIRMATION_MODAL_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_APPROVE_CONFIRMATION_MODAL_REQUIRED_FIELDS = [
  'what_will_happen',
  'executes_immediately',
  'platform_affected',
  'risk_level',
  'final_approve_button',
] as const;

export const ACTION_APPROVE_CONFIRMATION_ALLOWED_STATUSES = [
  'proposed',
  'approval_required',
  'auto_approved',
] as const;

export const ACTION_APPROVE_CONFIRMATION_SAFETY_RULES = [
  'Opening the modal must not approve the action.',
  'Final approve must call POST /api/v1/actions/:id/approve only after explicit founder confirmation.',
  'The approve endpoint records internal status and logs an approval event only in this phase.',
  'Final approve must not queue or execute an action.',
  'Final approve must not publish content, send support replies, change ad spend, pause campaigns, refund orders, edit products, or write to external platforms.',
  'The modal must clearly show that execution does not happen immediately while executors are disabled.',
  'The modal must show platform/context and risk level before the final approval button.',
] as const;

export const ACTION_APPROVE_CONFIRMATION_FILES = [
  'apps/web/src/actions.html',
  'apps/web/src/assets/css/actions.css',
  'apps/web/src/assets/js/actions.js',
  'apps/web/src/assets/js/action-card.js',
] as const;
