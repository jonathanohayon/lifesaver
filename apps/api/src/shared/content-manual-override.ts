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
