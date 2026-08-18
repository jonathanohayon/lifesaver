export const ACTION_MOBILE_APPROVAL_UX_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_MOBILE_APPROVAL_UX_REQUIREMENTS = [
  'Action card buttons must be large enough for phone tapping.',
  'Approve and reject modals must be readable on small screens.',
  'Actions page must avoid horizontal overflow on common phone widths.',
  'Final approval must remain visible in the modal footer after review.',
  'Rejection reason selection and optional note entry must be easy to use on mobile.',
  'Mobile controls still require explicit confirmation and must not execute external actions.',
] as const;

export const ACTION_MOBILE_APPROVAL_UX_SAFETY = {
  externalWritesEnabled: false,
  executorEnabled: false,
  queueingEnabled: false,
  approvalEffect: 'internal_status_only',
  rejectionEffect: 'internal_status_only',
  pollingEffect: 'read_only',
} as const;

export const ACTION_MOBILE_APPROVAL_UX_BREAKPOINTS = {
  tablet: 900,
  phone: 520,
  narrowPhone: 380,
} as const;
