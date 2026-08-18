export const AUTONOMY_PAUSE_AUDIT_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export const AUTONOMY_PAUSE_AUDIT_EVENT_TYPES = [
  'autonomy_pause_enabled',
  'autonomy_pause_disabled',
] as const;

export type AutonomyPauseAuditEventType = (typeof AUTONOMY_PAUSE_AUDIT_EVENT_TYPES)[number];

export const AUTONOMY_PAUSE_AUDIT_SCOPES = [
  'all',
  'content',
  'support',
  'ads',
  'research',
  'dev',
] as const;

export type AutonomyPauseAuditScope = (typeof AUTONOMY_PAUSE_AUDIT_SCOPES)[number];

export type AutonomyPauseAuditMetadata = {
  phase: typeof AUTONOMY_PAUSE_AUDIT_PHASE;
  operation: 'pause' | 'resume';
  eventType: AutonomyPauseAuditEventType;
  scope: AutonomyPauseAuditScope;
  categoryAffected: AutonomyPauseAuditScope;
  actorUserId: string;
  reason: string | null;
  before: Record<string, boolean>;
  after: Record<string, boolean>;
  safety: {
    autoApprovalTriggered: false;
    executorTriggered: false;
    externalWriteTriggered: false;
    resumeDoesNotExecuteWaitingActions: true;
  };
};

export function getAutonomyPauseAuditEventType(operation: 'pause' | 'resume'): AutonomyPauseAuditEventType {
  return operation === 'pause' ? 'autonomy_pause_enabled' : 'autonomy_pause_disabled';
}
