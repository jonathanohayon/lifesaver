import type { AutonomyUpdateResponse } from '../autonomy/autonomy.types.js';

export type ContentManualOverrideDecision = 'content_auto_run_disabled' | 'already_disabled' | 'preview_only';

export type ContentManualOverrideSafety = {
  manualOverrideOnly: true;
  disablesContentAutoRunOnly: true;
  doesNotPublish: true;
  doesNotApprove: true;
  doesNotExecute: true;
  externalApiCalled: false;
  tokenNotReturned: true;
  rawPayloadNotReturned: true;
  rollbackPayloadNotReturned: true;
  resumeDoesNotExecuteWaitingActions: true;
};

export type ContentManualOverrideStatus = {
  phase: 'phase_11_9_manual_override';
  healthMode: 'v2-phase-11-9-manual-override';
  deliverable: 'manual_override_control';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  enabled: true;
  purpose: string;
  controls: {
    status: 'GET /api/v1/content-auto-run/manual-override/status';
    preview: 'GET /api/v1/content-auto-run/manual-override/preview';
    disable: 'POST /api/v1/content-auto-run/manual-override/disable';
  };
  permissionRequired: {
    authenticated: true;
    roles: ['owner', 'admin'];
  };
  safety: ContentManualOverrideSafety;
};

export type ContentManualOverridePreviewInput = {
  contentAutoRunEnabled?: boolean;
  pauseContentActions?: boolean;
  pauseAllAutonomy?: boolean;
  emergencySafeModeActive?: boolean;
  reason?: string | null;
};

export type ContentManualOverridePreview = {
  phase: 'phase_11_9_manual_override';
  healthMode: 'v2-phase-11-9-manual-override';
  deliverable: 'manual_override_control';
  decision: ContentManualOverrideDecision;
  wouldDisableContentAutoRun: boolean;
  wouldPauseContentActions: boolean;
  reason: string;
  before: {
    contentAutoRunEnabled: boolean;
    pauseContentActions: boolean;
    pauseAllAutonomy: boolean;
    emergencySafeModeActive: boolean;
  };
  after: {
    contentAutoRunEnabled: false;
    pauseContentActions: true;
    noWaitingActionExecuted: true;
  };
  recommendedNextSteps: string[];
  safety: ContentManualOverrideSafety;
};

export type ContentManualOverrideDisableResult = ContentManualOverridePreview & {
  operation: 'disable';
  workspaceId: string;
  actorUserId: string;
  autonomyPauseStored: true;
  auditEventStored: boolean;
  autonomyUpdate: Pick<AutonomyUpdateResponse, 'operation' | 'scope' | 'reason' | 'changed' | 'execution' | 'safety' | 'audit'>;
};
