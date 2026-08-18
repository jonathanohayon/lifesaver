export const CONTENT_ACTION_DIGEST_SHARED_CONTRACT = {
  phase: 'phase_11_7_daily_action_digest',
  healthMode: 'v2-phase-11-7-daily-action-digest',
  deliverable: 'content_action_digest',
  reports: ['what_was_published', 'why_it_was_published', 'what_is_waiting_for_approval', 'what_failed'],
  safety: {
    digestOnly: true,
    doesNotPublish: true,
    doesNotApprove: true,
    doesNotNotify: true,
    externalApiCalled: false,
    rawPayloadNotReturned: true,
    tokenNotReturned: true,
  },
} as const;
