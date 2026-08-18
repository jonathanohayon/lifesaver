import type { AutonomyUpdateResponse } from '../autonomy/autonomy.types.js';
import type {
  ContentManualOverrideDisableResult,
  ContentManualOverridePreview,
  ContentManualOverridePreviewInput,
  ContentManualOverrideSafety,
  ContentManualOverrideStatus,
} from './content-manual-override.types.js';

export const CONTENT_MANUAL_OVERRIDE_PHASE = 'phase_11_9_manual_override' as const;
export const CONTENT_MANUAL_OVERRIDE_HEALTH_MODE = 'v2-phase-11-9-manual-override' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'payload_json',
  'raw_payload',
  'rollback_payload',
  'encrypted_',
  'bearer ',
];

function normalizeReason(value: unknown): string {
  const normalized = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || 'Founder manually disabled content auto-run.').slice(0, 700);
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

export function buildContentManualOverrideSafety(): ContentManualOverrideSafety {
  return {
    manualOverrideOnly: true,
    disablesContentAutoRunOnly: true,
    doesNotPublish: true,
    doesNotApprove: true,
    doesNotExecute: true,
    externalApiCalled: false,
    tokenNotReturned: true,
    rawPayloadNotReturned: true,
    rollbackPayloadNotReturned: true,
    resumeDoesNotExecuteWaitingActions: true,
  };
}

export function buildContentManualOverrideStatus(): ContentManualOverrideStatus {
  return {
    phase: CONTENT_MANUAL_OVERRIDE_PHASE,
    healthMode: CONTENT_MANUAL_OVERRIDE_HEALTH_MODE,
    deliverable: 'manual_override_control',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    enabled: true,
    purpose: 'Founder can instantly disable the future content auto-run lane by activating the content pause override. This does not approve, execute, publish, or call LinkedIn.',
    controls: {
      status: 'GET /api/v1/content-auto-run/manual-override/status',
      preview: 'GET /api/v1/content-auto-run/manual-override/preview',
      disable: 'POST /api/v1/content-auto-run/manual-override/disable',
    },
    permissionRequired: {
      authenticated: true,
      roles: ['owner', 'admin'],
    },
    safety: buildContentManualOverrideSafety(),
  };
}

export function buildContentManualOverridePreview(input: ContentManualOverridePreviewInput = {}): ContentManualOverridePreview {
  const pauseContentActions = asBoolean(input.pauseContentActions);
  const pauseAllAutonomy = asBoolean(input.pauseAllAutonomy);
  const emergencySafeModeActive = asBoolean(input.emergencySafeModeActive);
  const contentAutoRunEnabled = input.contentAutoRunEnabled === undefined ? !pauseContentActions && !pauseAllAutonomy && !emergencySafeModeActive : asBoolean(input.contentAutoRunEnabled);
  const alreadyDisabled = !contentAutoRunEnabled || pauseContentActions || pauseAllAutonomy || emergencySafeModeActive;
  const reason = normalizeReason(input.reason);

  return {
    phase: CONTENT_MANUAL_OVERRIDE_PHASE,
    healthMode: CONTENT_MANUAL_OVERRIDE_HEALTH_MODE,
    deliverable: 'manual_override_control',
    decision: alreadyDisabled ? 'already_disabled' : 'preview_only',
    wouldDisableContentAutoRun: !alreadyDisabled,
    wouldPauseContentActions: true,
    reason: alreadyDisabled
      ? 'Content auto-run is already disabled or blocked by an existing pause/safe-mode condition.'
      : 'Manual override would disable content auto-run immediately by setting the content pause lane.',
    before: {
      contentAutoRunEnabled,
      pauseContentActions,
      pauseAllAutonomy,
      emergencySafeModeActive,
    },
    after: {
      contentAutoRunEnabled: false,
      pauseContentActions: true,
      noWaitingActionExecuted: true,
    },
    recommendedNextSteps: alreadyDisabled
      ? ['Keep content auto-run disabled until the founder explicitly reviews the lane.', 'Review pending approvals manually from the approval queue.']
      : ['Apply manual override if the founder wants content auto-run stopped now.', 'Review pending content actions manually; this link does not execute waiting actions.'],
    safety: buildContentManualOverrideSafety(),
  };
}

export function buildContentManualOverrideDisableResult(params: {
  workspaceId: string;
  actorUserId: string;
  reason?: string | null;
  autonomyUpdate: AutonomyUpdateResponse;
}): ContentManualOverrideDisableResult {
  const preview = buildContentManualOverridePreview({
    contentAutoRunEnabled: false,
    pauseContentActions: true,
    reason: params.reason,
  });

  return {
    ...preview,
    decision: 'content_auto_run_disabled',
    operation: 'disable',
    workspaceId: params.workspaceId,
    actorUserId: params.actorUserId,
    reason: normalizeReason(params.reason),
    autonomyPauseStored: true,
    auditEventStored: params.autonomyUpdate.audit.eventLogged === true,
    autonomyUpdate: {
      operation: params.autonomyUpdate.operation,
      scope: params.autonomyUpdate.scope,
      reason: params.autonomyUpdate.reason,
      changed: params.autonomyUpdate.changed,
      execution: params.autonomyUpdate.execution,
      safety: params.autonomyUpdate.safety,
      audit: params.autonomyUpdate.audit,
    },
  };
}

export function assertContentManualOverrideSafe(result: ContentManualOverridePreview | ContentManualOverrideStatus | ContentManualOverrideDisableResult): void {
  if (!result.safety.manualOverrideOnly || !result.safety.doesNotPublish || !result.safety.doesNotExecute || result.safety.externalApiCalled !== false) {
    throw new Error('Content manual override safety flags are invalid.');
  }

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content manual override output contains forbidden fragment: ${forbidden}`);
    }
  }
}
