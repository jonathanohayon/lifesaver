export const ACTION_DETAIL_API_VERSION = 'action-detail/v0.6.0-phase-3.3' as const;

export const ACTION_DETAIL_SAFETY_RULES = [
  'GET /api/v1/actions/:id is read-only.',
  'The detail endpoint must be workspace-scoped through authenticated workspace membership.',
  'The detail endpoint returns payloadPreview, not full raw payload_json.',
  'The detail endpoint returns result summaries, not full rollback_payload.',
  'The detail endpoint cannot approve, reject, cancel, queue, or execute actions.',
  'The detail endpoint cannot call external platforms.',
] as const;

export interface ActionDetailSafetyShape {
  detailIncludesFullPayloadJson: false;
  canApproveFromThisEndpoint: false;
  canExecuteFromThisEndpoint: false;
  externalWritesEnabled: false;
  note: string;
}

export interface ActionPayloadPreviewShape {
  schemaVersion: string | null;
  actionType: string;
  source: string | null;
  intentSummary: string | null;
  dataKeys: string[];
  preview: Record<string, unknown>;
  redactedFields: string[];
  includesFullPayloadJson: false;
  note: string;
}
