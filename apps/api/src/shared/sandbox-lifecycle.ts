export const SHARED_SANDBOX_LIFECYCLE_PHASE = 'v0.6.0 Phase 8.6 Approve-to-Execute Flow' as const;

export type SharedSandboxLifecycleStatusPath = ['proposed', 'approved', 'executing', 'executed'];

export type SharedSandboxLifecycleSafetySummary = {
  version: '0.6.0';
  phase: typeof SHARED_SANDBOX_LIFECYCLE_PHASE;
  deliverable: 'full_sandbox_lifecycle';
  supportedSandboxActionTypes: ['content_publish', 'support_reply_send', 'ad_budget_adjust', 'ad_pause'];
  statusPath: SharedSandboxLifecycleStatusPath;
  resultStoragePreviewIncluded: true;
  realExternalWritesEnabled: false;
  autoRunEnabled: false;
  note: string;
};

export function buildSharedSandboxLifecycleSafetySummary(): SharedSandboxLifecycleSafetySummary {
  return {
    version: '0.6.0',
    phase: SHARED_SANDBOX_LIFECYCLE_PHASE,
    deliverable: 'full_sandbox_lifecycle',
    supportedSandboxActionTypes: ['content_publish', 'support_reply_send', 'ad_budget_adjust', 'ad_pause'],
    statusPath: ['proposed', 'approved', 'executing', 'executed'],
    resultStoragePreviewIncluded: true,
    realExternalWritesEnabled: false,
    autoRunEnabled: false,
    note: 'Shared Phase 8.6 contract: approve-to-execute lifecycle is sandbox-only, returns fake sandbox results, and must not call external platforms.',
  };
}
