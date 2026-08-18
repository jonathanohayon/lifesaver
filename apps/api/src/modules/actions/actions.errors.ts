import { AppError } from '../../common/errors/AppError.js';
import type { ActionStatus } from './actions.types.js';

export const ACTION_SAFE_ERROR_PHASE = 'v0.6.0 Phase 7.4 Support Rules UI' as const;

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

export type ActionSafeErrorDetails = {
  module?: 'actions';
  phase?: typeof ACTION_SAFE_ERROR_PHASE;
  actionId?: string;
  workspaceId?: string;
  userId?: string;
  operation?: 'view' | 'list' | 'detail' | 'approve' | 'reject' | 'cancel' | 'create_proposed_action';
  currentStatus?: ActionStatus | string | null;
  attemptedStatus?: ActionStatus | string | null;
  allowedStatuses?: readonly string[];
  role?: string | null;
  riskLevel?: string | null;
  guardCode?: string | null;
  reasonCode?: string | null;
  externalWritesEnabled?: false;
  executorEnabled?: false;
  safeForClient?: true;
};

export function createActionSafeError(
  statusCode: number,
  code: ActionSafeErrorCode | string,
  message: string,
  details: ActionSafeErrorDetails = {}
): AppError {
  return new AppError(statusCode, code, message, {
    module: 'actions',
    phase: ACTION_SAFE_ERROR_PHASE,
    externalWritesEnabled: false,
    executorEnabled: false,
    safeForClient: true,
    ...details,
  });
}

export function createActionNotFoundError(details: ActionSafeErrorDetails = {}): AppError {
  return createActionSafeError(404, 'ACTION_NOT_FOUND', 'Action was not found in your current workspace.', details);
}

export function createWorkspaceForbiddenError(details: ActionSafeErrorDetails = {}): AppError {
  return createActionSafeError(403, 'ACTION_WORKSPACE_FORBIDDEN', 'You do not have access to actions for this workspace.', details);
}

export function createApprovalForbiddenError(message: string, details: ActionSafeErrorDetails = {}): AppError {
  return createActionSafeError(403, 'APPROVAL_FORBIDDEN', message, details);
}

export function createInvalidStatusTransitionError(params: {
  code?: ActionSafeErrorCode | string;
  message: string;
  actionId?: string;
  workspaceId?: string;
  operation: ActionSafeErrorDetails['operation'];
  currentStatus?: ActionStatus | string | null;
  attemptedStatus?: ActionStatus | string | null;
  allowedStatuses?: readonly string[];
  reasonCode?: string | null;
}): AppError {
  return createActionSafeError(409, params.code || 'INVALID_STATUS_TRANSITION', params.message, {
    actionId: params.actionId,
    workspaceId: params.workspaceId,
    operation: params.operation,
    currentStatus: params.currentStatus ?? null,
    attemptedStatus: params.attemptedStatus ?? null,
    allowedStatuses: params.allowedStatuses,
    reasonCode: params.reasonCode || params.code || 'INVALID_STATUS_TRANSITION',
  });
}
