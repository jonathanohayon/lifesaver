import type { EmergencySafeModeState } from './emergency-safe-mode.js';
import type { AutonomyPauseScope } from './autonomy.validation.js';

export type AutonomySettingsRow = {
  workspace_id: string;
  pause_all_autonomy: boolean;
  pause_content_actions: boolean;
  pause_support_actions: boolean;
  pause_ads_actions: boolean;
  pause_research_actions: boolean;
  pause_dev_actions: boolean;
  updated_by: string | null;
  updated_at: Date;
};

export type AutonomyActionCategory = 'content' | 'support' | 'ads' | 'research' | 'dev' | 'system';

export type AutonomyMembershipRow = {
  workspace_id: string;
  user_id: string;
  workspace_role: string;
  membership_status: string;
  user_platform_role: string;
};

export type CategoryPauseBackendState = {
  workspaceId: string;
  category: AutonomyActionCategory;
  categoryPaused: boolean;
  pauseAllAutonomy: boolean;
  pauseContentActions: boolean;
  pauseSupportActions: boolean;
  pauseAdsActions: boolean;
  pauseResearchActions: boolean;
  pauseDevActions: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: boolean;
  proposedActionCreationAllowed: true;
  manualReviewAllowed: true;
  reason: string;
};

export type GlobalPauseBackendState = {
  workspaceId: string;
  pauseAllAutonomy: boolean;
  pauseContentActions: boolean;
  pauseSupportActions: boolean;
  pauseAdsActions: boolean;
  pauseResearchActions: boolean;
  pauseDevActions: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  enforcement: {
    autoApprovalAllowed: boolean;
    executorExecutionAllowed: boolean;
    proposedActionCreationAllowed: boolean;
    manualReviewAllowed: boolean;
    reason: string;
  };
  categories: {
    content: { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string };
    support: { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string };
    ads: { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string };
    research: { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string };
    dev: { paused: boolean; autoApprovalAllowed: boolean; executorExecutionAllowed: boolean; reason: string };
  };
  emergencySafeMode: EmergencySafeModeState;
  safety: {
    canAutoApprove: false;
    canExecute: false;
    canWriteExternally: false;
    note: string;
  };
};

export type AutonomyStatusResponse = GlobalPauseBackendState & {
  version: '0.6.0';
  phase: string;
  permissions: {
    currentUserRole: string;
    canViewAutonomyStatus: boolean;
    canPauseAutonomy: boolean;
    canResumeAutonomy: boolean;
    updateRoles: string[];
  };
  endpoints: {
    status: 'GET /api/v1/autonomy/status';
    pause: 'POST /api/v1/autonomy/pause';
    resume: 'POST /api/v1/autonomy/resume';
  };
};

export type AutonomyUpdateInput = {
  workspaceId: string;
  userId: string;
  scope: AutonomyPauseScope;
  reason: string | null;
};

export type AutonomyUpdateResponse = {
  version: '0.6.0';
  phase: string;
  workspaceId: string;
  operation: 'pause' | 'resume';
  scope: AutonomyPauseScope;
  reason: string | null;
  status: GlobalPauseBackendState;
  changed: {
    pauseAllAutonomy: boolean;
    pauseContentActions: boolean;
    pauseSupportActions: boolean;
    pauseAdsActions: boolean;
    pauseResearchActions: boolean;
    pauseDevActions: boolean;
  };
  execution: {
    queued: false;
    executed: false;
    executorEnabled: false;
    externalWritesEnabled: false;
    note: string;
  };
  safety: {
    noAutoApproval: boolean;
    noExecutorExecution: boolean;
    proposedActionsStillReviewable: boolean;
    newProposedActionsMayStillBeCreatedSafely: boolean;
  };
  audit: {
    eventLogged: boolean;
    eventType: 'autonomy_pause_enabled' | 'autonomy_pause_disabled';
    categoryAffected: AutonomyPauseScope;
    actorUserId: string;
    reason: string | null;
    storage: 'system_events';
    externalWritesTriggered: false;
  };
};
