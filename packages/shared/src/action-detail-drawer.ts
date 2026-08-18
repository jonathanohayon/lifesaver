export const ACTION_DETAIL_DRAWER_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_DETAIL_DRAWER_REQUIRED_SECTIONS = [
  'full proposed content from safe detail API preview',
  'payload preview without full raw payload_json',
  'expected result explanation',
  'policy decision',
  'risk explanation',
  'related metric/ticket/campaign context',
  'status timeline',
  'result summary',
] as const;

export const ACTION_DETAIL_DRAWER_SAFETY_RULES = [
  'Detail drawer may call GET /api/v1/actions/:id only.',
  'Detail drawer must not expose raw payload_json, rollback_payload, API keys, OAuth tokens, or secrets.',
  'Risk badges guide review. Approve opens the confirmation modal. Reject opens the reject-with-reason modal.',
  'Detail drawer cannot queue, execute, publish, send, spend, pause, refund, rollback, or write externally.',
  'Executed actions must not be cancelled from the drawer until a future rollback flow exists.',
] as const;

export const ACTION_DETAIL_DRAWER_FILES = [
  'apps/web/src/actions.html',
  'apps/web/src/assets/css/actions.css',
  'apps/web/src/assets/js/actions.js',
  'apps/web/src/assets/js/action-card.js',
] as const;
