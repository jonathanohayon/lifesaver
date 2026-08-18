import { z } from 'zod';
import type { ActionRiskLevel, ActionStatus, ActionType, WorkspaceActionListFilters } from './actions.types.js';

export const ACTION_TYPE_VALUES = [
  'content_publish',
  'support_reply_send',
  'ad_budget_adjust',
  'ad_pause',
  'research_task',
  'dev_task',
  'notification_send',
  'rollback_action',
] as const satisfies readonly ActionType[];

export const ACTION_STATUS_VALUES = [
  'proposed',
  'approval_required',
  'auto_approved',
  'approved',
  'rejected',
  'cancelled',
  'queued',
  'executing',
  'executed',
  'failed',
  'rollback_requested',
  'rolled_back',
] as const satisfies readonly ActionStatus[];

export const ACTION_RISK_LEVEL_VALUES = [
  'low',
  'medium',
  'high',
  'critical',
] as const satisfies readonly ActionRiskLevel[];

export const ACTION_POLICY_DECISION_VALUES = [
  'not_evaluated',
  'ask',
  'auto_approve',
  'block',
] as const;

export const ACTION_MODULE_PHASE = 'v0.6.0 Phase 8.10 Safe Demo QA' as const;

const optionalIntegerString = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform((value) => Number.parseInt(value, 10));

export const actionListQuerySchema = z.object({
  status: z.enum(ACTION_STATUS_VALUES).optional(),
  action_type: z.enum(ACTION_TYPE_VALUES).optional(),
  risk_level: z.enum(ACTION_RISK_LEVEL_VALUES).optional(),
  limit: optionalIntegerString.optional(),
  offset: optionalIntegerString.optional(),
});

export type ActionListQueryInput = z.input<typeof actionListQuerySchema>;

export function parseActionListFilters(query: unknown): WorkspaceActionListFilters {
  const parsed = actionListQuerySchema.parse(query);

  return {
    status: parsed.status,
    actionType: parsed.action_type,
    riskLevel: parsed.risk_level,
    limit: parsed.limit,
    offset: parsed.offset,
  };
}

export function isSupportedActionType(value: string): value is ActionType {
  return ACTION_TYPE_VALUES.includes(value as ActionType);
}

export function isSupportedActionStatus(value: string): value is ActionStatus {
  return ACTION_STATUS_VALUES.includes(value as ActionStatus);
}

export function isSupportedRiskLevel(value: string): value is ActionRiskLevel {
  return ACTION_RISK_LEVEL_VALUES.includes(value as ActionRiskLevel);
}

export function isApprovalCapableRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canRoleApproveRisk(role: string | null | undefined, riskLevel: ActionRiskLevel): boolean {
  if (role === 'owner') return true;
  if (role === 'admin') return riskLevel !== 'critical';
  return false;
}


export function normalizeActionListPagination(filters: WorkspaceActionListFilters): { limit: number; offset: number } {
  const rawLimit = Number.isFinite(filters.limit || 0) ? Math.floor(Number(filters.limit)) : 50;
  const rawOffset = Number.isFinite(filters.offset || 0) ? Math.floor(Number(filters.offset)) : 0;

  const limit = rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
  const offset = rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}


export const actionIdParamSchema = z.object({
  id: z.string().uuid('Action id must be a valid UUID.'),
});

export function parseActionIdParam(params: unknown): string {
  return actionIdParamSchema.parse(params).id;
}


export const approveActionBodySchema = z.object({
  approval_note: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(1000).optional(),
}).passthrough().optional();

export function parseApproveActionBody(body: unknown): { approvalNote: string | null } {
  const parsed = approveActionBodySchema.parse(body || {});
  const approvalNote = parsed?.approval_note || parsed?.note || parsed?.reason || null;
  return { approvalNote };
}


export const rejectActionBodySchema = z.object({
  rejection_reason: z.string().trim().max(1000).optional(),
  rejection_note: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
}).passthrough().optional();

export function parseRejectActionBody(body: unknown): { rejectionReason: string | null } {
  const parsed = rejectActionBodySchema.parse(body || {});
  const rejectionReason = parsed?.rejection_reason || parsed?.rejection_note || parsed?.reason || parsed?.note || null;
  return { rejectionReason };
}


export const cancelActionBodySchema = z.object({
  cancel_reason: z.string().trim().max(1000).optional(),
  cancellation_reason: z.string().trim().max(1000).optional(),
  reason: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
}).passthrough().optional();

export function parseCancelActionBody(body: unknown): { cancelReason: string | null } {
  const parsed = cancelActionBodySchema.parse(body || {});
  const cancelReason = parsed?.cancel_reason || parsed?.cancellation_reason || parsed?.reason || parsed?.note || null;
  return { cancelReason };
}
