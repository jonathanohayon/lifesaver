import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import {
  ensureAutonomySettingsForWorkspace,
  getActiveAutonomyWorkspaceMembership,
  getAutonomySettingsByWorkspaceId,
  recordAutonomyPauseAuditEvent,
  updateAutonomyPauseScope,
} from './autonomy.repository.js';
import type {
  AutonomyActionCategory,
  AutonomyMembershipRow,
  AutonomySettingsRow,
  AutonomyStatusResponse,
  AutonomyUpdateInput,
  AutonomyUpdateResponse,
  CategoryPauseBackendState,
  GlobalPauseBackendState,
} from './autonomy.types.js';
import type { AutonomyPauseScope } from './autonomy.validation.js';
import { getEmergencySafeModeState } from './emergency-safe-mode.js';

export const AUTONOMY_API_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;
export const AUTONOMY_CATEGORY_PAUSE_PHASE = AUTONOMY_API_PHASE;
export const AUTONOMY_GLOBAL_PAUSE_PHASE = AUTONOMY_API_PHASE;

export type PauseAwareActionType =
  | 'content_publish'
  | 'support_reply_send'
  | 'ad_budget_adjust'
  | 'ad_pause'
  | 'research_task'
  | 'dev_task'
  | 'notification_send'
  | 'rollback_action'
  | string;

const UPDATE_ROLES = new Set(['owner', 'admin']);
const VIEW_ROLES = new Set(['owner', 'admin', 'member', 'viewer']);

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to read or update autonomy pause state.');
  }
}

async function requireActiveAutonomyMembership(workspaceId: string, userId: string): Promise<AutonomyMembershipRow> {
  const membership = await getActiveAutonomyWorkspaceMembership({ workspaceId, userId });
  if (!membership) {
    throw new AppError(403, 'AUTONOMY_WORKSPACE_FORBIDDEN', 'This user is not an active member of the requested workspace.');
  }
  return membership;
}

function assertCanViewAutonomy(membership: AutonomyMembershipRow) {
  const role = normalizeRole(membership.workspace_role);
  if (!VIEW_ROLES.has(role)) {
    throw new AppError(403, 'AUTONOMY_VIEW_FORBIDDEN', 'This workspace role cannot view autonomy pause status.', { role });
  }
}

function assertCanUpdateAutonomy(membership: AutonomyMembershipRow) {
  const role = normalizeRole(membership.workspace_role);
  if (!UPDATE_ROLES.has(role)) {
    throw new AppError(403, 'AUTONOMY_UPDATE_FORBIDDEN', 'Only workspace owners/admins can pause or resume autonomy settings.', { role });
  }
}

function permissionsFor(membership: AutonomyMembershipRow) {
  const role = normalizeRole(membership.workspace_role);
  const canUpdate = UPDATE_ROLES.has(role);
  return {
    currentUserRole: role,
    canViewAutonomyStatus: VIEW_ROLES.has(role),
    canPauseAutonomy: canUpdate,
    canResumeAutonomy: canUpdate,
    updateRoles: ['owner', 'admin'],
  };
}

export function getAutonomyCategoryForActionType(actionType: PauseAwareActionType): AutonomyActionCategory {
  switch (actionType) {
    case 'content_publish':
      return 'content';
    case 'support_reply_send':
      return 'support';
    case 'ad_budget_adjust':
    case 'ad_pause':
      return 'ads';
    case 'research_task':
      return 'research';
    case 'dev_task':
      return 'dev';
    default:
      return 'system';
  }
}

function categoryReason(category: Exclude<AutonomyActionCategory, 'system'>, paused: boolean, globalPaused: boolean): string {
  if (globalPaused) {
    return `pause_all_autonomy is active, so ${category} auto-approval and future executor execution must remain blocked.`;
  }

  if (paused) {
    return `${category} category pause is active. Future policy layers must not auto-approve ${category} actions and future executor layers must not execute them. Proposed actions remain reviewable.`;
  }

  return `${category} category pause is not active. Future policy/executor layers must still apply approvals, caps, audit logs, and master pause checks before execution.`;
}

function makeCategoryState(params: {
  category: Exclude<AutonomyActionCategory, 'system'>;
  categoryPaused: boolean;
  globalPaused: boolean;
}): { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string } {
  const effectivePaused = params.globalPaused || params.categoryPaused;
  return {
    paused: params.categoryPaused,
    autoApprovalAllowed: !effectivePaused,
    executorExecutionAllowed: !effectivePaused,
    reason: categoryReason(params.category, params.categoryPaused, params.globalPaused),
  };
}

function serializeGlobalPauseState(row: AutonomySettingsRow): GlobalPauseBackendState {
  const emergencySafeMode = getEmergencySafeModeState();
  const globalPaused = row.pause_all_autonomy === true;
  const contentPaused = row.pause_content_actions === true;
  const supportPaused = row.pause_support_actions === true;
  const adsPaused = row.pause_ads_actions === true;
  const researchPaused = row.pause_research_actions === true;
  const devPaused = row.pause_dev_actions === true;

  return {
    workspaceId: row.workspace_id,
    pauseAllAutonomy: globalPaused,
    pauseContentActions: contentPaused,
    pauseSupportActions: supportPaused,
    pauseAdsActions: adsPaused,
    pauseResearchActions: researchPaused,
    pauseDevActions: devPaused,
    updatedBy: row.updated_by,
    updatedAt: iso(row.updated_at),
    enforcement: {
      autoApprovalAllowed: !globalPaused && !emergencySafeMode.active,
      executorExecutionAllowed: !globalPaused && !emergencySafeMode.active,
      proposedActionCreationAllowed: true,
      manualReviewAllowed: true,
      reason: emergencySafeMode.active
        ? 'EMERGENCY_SAFE_MODE is active. All future executor execution is blocked and policy must never auto-approve. Existing proposed actions remain reviewable, and safe proposed actions may still be created for founder review.'
        : globalPaused
          ? 'pause_all_autonomy is active. Future policy layers must not auto-approve actions and future executor layers must not execute actions. Existing proposed actions remain reviewable, and safe proposed actions may still be created for founder review.'
          : 'pause_all_autonomy is not active. Future policy/executor layers must still apply category pauses, action-specific policies, role checks, caps, audit logs, and approval rules before any execution.',
    },
    categories: {
      content: makeCategoryState({ category: 'content', categoryPaused: contentPaused, globalPaused }),
      support: makeCategoryState({ category: 'support', categoryPaused: supportPaused, globalPaused }),
      ads: makeCategoryState({ category: 'ads', categoryPaused: adsPaused, globalPaused }),
      research: makeCategoryState({ category: 'research', categoryPaused: researchPaused, globalPaused }),
      dev: makeCategoryState({ category: 'dev', categoryPaused: devPaused, globalPaused }),
    },
    emergencySafeMode,
    safety: {
      canAutoApprove: false,
      canExecute: false,
      canWriteExternally: false,
      note: 'Phase 5.9 adds environment-level emergency safe mode on top of pause audit events, policy pause enforcement, and executor pause enforcement. It does not register executors, add auto-run rules, queue actions, run rollback execution, or perform external writes.',
    },
  };
}

function buildStatusResponse(params: { state: GlobalPauseBackendState; membership: AutonomyMembershipRow }): AutonomyStatusResponse {
  return {
    ...params.state,
    version: '0.6.0',
    phase: AUTONOMY_API_PHASE,
    permissions: permissionsFor(params.membership),
    endpoints: {
      status: 'GET /api/v1/autonomy/status',
      pause: 'POST /api/v1/autonomy/pause',
      resume: 'POST /api/v1/autonomy/resume',
    },
  };
}

export async function getGlobalPauseStateForWorkspace(workspaceId: string): Promise<GlobalPauseBackendState> {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to read autonomy pause state.');
  }

  const row = await ensureAutonomySettingsForWorkspace(workspaceId);
  return serializeGlobalPauseState(row);
}

export async function readGlobalPauseStateForWorkspace(workspaceId: string): Promise<GlobalPauseBackendState | null> {
  if (!isDatabaseConfigured) return null;
  const row = await getAutonomySettingsByWorkspaceId(workspaceId);
  return row ? serializeGlobalPauseState(row) : null;
}

export async function getAutonomyStatusForCurrentWorkspace(params: {
  workspaceId: string;
  userId: string;
}): Promise<AutonomyStatusResponse> {
  assertDatabaseReady();
  const membership = await requireActiveAutonomyMembership(params.workspaceId, params.userId);
  assertCanViewAutonomy(membership);
  const row = await ensureAutonomySettingsForWorkspace(params.workspaceId);
  return buildStatusResponse({ state: serializeGlobalPauseState(row), membership });
}

function updateChangedFlags(state: GlobalPauseBackendState) {
  return {
    pauseAllAutonomy: state.pauseAllAutonomy,
    pauseContentActions: state.pauseContentActions,
    pauseSupportActions: state.pauseSupportActions,
    pauseAdsActions: state.pauseAdsActions,
    pauseResearchActions: state.pauseResearchActions,
    pauseDevActions: state.pauseDevActions,
  };
}

function pauseEventTypeFor(operation: 'pause' | 'resume'): 'autonomy_pause_enabled' | 'autonomy_pause_disabled' {
  return operation === 'pause' ? 'autonomy_pause_enabled' : 'autonomy_pause_disabled';
}

function buildUpdateResponse(params: {
  operation: 'pause' | 'resume';
  scope: AutonomyPauseScope;
  reason: string | null;
  actorUserId: string;
  state: GlobalPauseBackendState;
}): AutonomyUpdateResponse {
  const paused = params.operation === 'pause';
  return {
    version: '0.6.0',
    phase: AUTONOMY_API_PHASE,
    workspaceId: params.state.workspaceId,
    operation: params.operation,
    scope: params.scope,
    reason: params.reason,
    status: params.state,
    changed: updateChangedFlags(params.state),
    execution: {
      queued: false,
      executed: false,
      executorEnabled: false,
      externalWritesEnabled: false,
      note: paused
        ? 'Pause update stored only. No existing action was queued, executed, published, sent, spent, paused, rolled back, or written to an external platform.'
        : 'Resume update stored only. Resuming pause state does not execute waiting actions and does not auto-approve anything.',
    },
    safety: {
      noAutoApproval: params.state.pauseAllAutonomy || params.scope !== 'all' ? true : false,
      noExecutorExecution: true,
      proposedActionsStillReviewable: true,
      newProposedActionsMayStillBeCreatedSafely: true,
    },
    audit: {
      eventLogged: true,
      eventType: pauseEventTypeFor(params.operation),
      categoryAffected: params.scope,
      actorUserId: params.actorUserId,
      reason: params.reason,
      storage: 'system_events',
      externalWritesTriggered: false,
    },
  };
}

async function updatePauseForCurrentWorkspace(params: AutonomyUpdateInput & { operation: 'pause' | 'resume' }): Promise<AutonomyUpdateResponse> {
  assertDatabaseReady();
  const membership = await requireActiveAutonomyMembership(params.workspaceId, params.userId);
  assertCanUpdateAutonomy(membership);

  const beforeRow = await ensureAutonomySettingsForWorkspace(params.workspaceId);
  const beforeState = serializeGlobalPauseState(beforeRow);

  const row = await updateAutonomyPauseScope({
    workspaceId: params.workspaceId,
    userId: params.userId,
    scope: params.scope,
    paused: params.operation === 'pause',
  });
  const state = serializeGlobalPauseState(row);

  await recordAutonomyPauseAuditEvent({
    workspaceId: params.workspaceId,
    eventType: pauseEventTypeFor(params.operation),
    scope: params.scope,
    actorUserId: params.userId,
    reason: params.reason,
    before: updateChangedFlags(beforeState),
    after: updateChangedFlags(state),
  });

  return buildUpdateResponse({ operation: params.operation, scope: params.scope, reason: params.reason, actorUserId: params.userId, state });
}

export async function pauseAutonomyForCurrentWorkspace(params: AutonomyUpdateInput): Promise<AutonomyUpdateResponse> {
  return updatePauseForCurrentWorkspace({ ...params, operation: 'pause' });
}

export async function resumeAutonomyForCurrentWorkspace(params: AutonomyUpdateInput): Promise<AutonomyUpdateResponse> {
  return updatePauseForCurrentWorkspace({ ...params, operation: 'resume' });
}

export function getCategoryPauseState(params: {
  pauseState: GlobalPauseBackendState;
  actionType: PauseAwareActionType;
}): CategoryPauseBackendState {
  const category = getAutonomyCategoryForActionType(params.actionType);
  const categoryState = category === 'system'
    ? {
        paused: false,
        autoApprovalAllowed: !params.pauseState.pauseAllAutonomy,
        executorExecutionAllowed: !params.pauseState.pauseAllAutonomy,
        reason: params.pauseState.pauseAllAutonomy
          ? 'pause_all_autonomy is active. System-type actions must not auto-approve or execute while global pause is active.'
          : 'This action type is not controlled by a category pause flag yet. Future policy/executor layers must still require explicit safety checks.',
      }
    : params.pauseState.categories[category];

  const effectiveBlocked = params.pauseState.pauseAllAutonomy || categoryState.paused;

  return {
    workspaceId: params.pauseState.workspaceId,
    category,
    categoryPaused: categoryState.paused,
    pauseAllAutonomy: params.pauseState.pauseAllAutonomy,
    pauseContentActions: params.pauseState.pauseContentActions,
    pauseSupportActions: params.pauseState.pauseSupportActions,
    pauseAdsActions: params.pauseState.pauseAdsActions,
    pauseResearchActions: params.pauseState.pauseResearchActions,
    pauseDevActions: params.pauseState.pauseDevActions,
    autoApprovalAllowed: !effectiveBlocked,
    executorExecutionAllowed: !effectiveBlocked,
    proposedActionCreationAllowed: true,
    manualReviewAllowed: true,
    reason: categoryState.reason,
  };
}

export function forceAskWhenGlobalPauseIsActive<T extends { approvalRequired: boolean; policyDecision: string }>(params: {
  normalized: T;
  pauseState: GlobalPauseBackendState | null;
}): T {
  if (!params.pauseState?.pauseAllAutonomy) return params.normalized;

  return {
    ...params.normalized,
    approvalRequired: true,
    policyDecision: 'ask',
  };
}

export function forceAskWhenAnyAutonomyPauseIsActive<T extends { approvalRequired: boolean; policyDecision: string }>(params: {
  normalized: T;
  categoryPauseState: CategoryPauseBackendState | null;
}): T {
  if (!params.categoryPauseState) return params.normalized;
  if (!params.categoryPauseState.pauseAllAutonomy && !params.categoryPauseState.categoryPaused) return params.normalized;

  return {
    ...params.normalized,
    approvalRequired: true,
    policyDecision: 'ask',
  };
}
