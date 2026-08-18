export const ACTION_ERROR_PHASE = 'v0.6.0 Phase 4.10 UI QA + Accessibility Pass' as const;

export const ACTION_SAFE_ERROR_CODES = [
  'ACTION_NOT_FOUND',
  'ACTION_ALREADY_EXECUTED',
  'ACTION_REJECTED',
  'ACTION_CANCELLED',
  'ACTION_ALREADY_APPROVED',
  'APPROVAL_FORBIDDEN',
  'REJECTION_FORBIDDEN',
  'CANCELLATION_FORBIDDEN',
  'INVALID_STATUS_TRANSITION',
  'ACTION_WORKSPACE_FORBIDDEN',
  'ACTION_VALIDATION_ERROR',
] as const;

export type ActionSafeErrorCode = typeof ACTION_SAFE_ERROR_CODES[number];

export type ActionErrorResponseShape = {
  success: false;
  error: {
    code: ActionSafeErrorCode | string;
    message: string;
    requestId: string | null;
    details?: Record<string, unknown>;
  };
  requestId: string | null;
  timestamp: string;
};

export const ACTION_ERROR_RESPONSE_SAFETY_RULES = [
  'Every error response includes requestId for support/debugging.',
  'Action errors use stable machine-readable codes.',
  'Action errors must not expose payload_json, API keys, OAuth tokens, APP_ENCRYPTION_KEY, WORKER_SHARED_SECRET, DATABASE_URL, or raw .env values.',
  'Invalid state transitions return 409 with a safe reason code.',
  'Workspace isolation failures must not reveal whether an action exists in another workspace.',
  'External writes remain disabled in Phase 4.10.',
] as const;
