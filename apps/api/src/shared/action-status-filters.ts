export const ACTION_STATUS_FILTERS_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_QUEUE_PRIMARY_STATUS_FILTERS = [
  { value: '', label: 'All', description: 'Show all workspace-scoped actions.' },
  { value: 'proposed', label: 'Proposed', description: 'New actions waiting for review.' },
  { value: 'approved', label: 'Approved', description: 'Internally approved actions. Execution remains disabled until later phases.' },
  { value: 'rejected', label: 'Rejected', description: 'Actions rejected by an owner/admin.' },
  { value: 'executed', label: 'Executed', description: 'Future executed actions after executor phases. No executor is enabled now.' },
  { value: 'failed', label: 'Failed', description: 'Future failed executor/action results.' },
  { value: 'cancelled', label: 'Cancelled', description: 'Actions cancelled before execution.' },
  { value: 'rolled_back', label: 'Rolled Back', description: 'Future actions with confirmed rollback completion.' },
] as const;

export type ActionQueuePrimaryStatusFilter = (typeof ACTION_QUEUE_PRIMARY_STATUS_FILTERS)[number]['value'];

export const ACTION_STATUS_FILTER_SAFETY_RULES = [
  'Status filters are read-only UI controls.',
  'Changing a filter must only call GET /api/v1/actions with workspace-scoped query parameters.',
  'Status filters must not approve, reject, cancel, queue, execute, publish, send, spend, pause, refund, or rollback anything.',
  'The list view remains summary-only and must not expose raw payload_json or secrets.',
] as const;
