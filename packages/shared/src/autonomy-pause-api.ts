export const AUTONOMY_PAUSE_API_VERSION = 'v0.6.0' as const;
export const AUTONOMY_PAUSE_API_PHASE = 'Phase 5.9 — Pause Audit Events' as const;

export const AUTONOMY_PAUSE_SCOPES = ['all', 'content', 'support', 'ads', 'research', 'dev'] as const;
export type AutonomyPauseScope = typeof AUTONOMY_PAUSE_SCOPES[number];

export type AutonomyPauseApiEndpoint = {
  method: 'GET' | 'POST';
  path: string;
  purpose: string;
  authRequired: true;
  allowedRoles: string[];
  externalWritesEnabled: false;
};

export const AUTONOMY_PAUSE_API_ENDPOINTS: AutonomyPauseApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/autonomy/status',
    purpose: 'Read current global and category-level pause state for the authenticated workspace.',
    authRequired: true,
    allowedRoles: ['owner', 'admin', 'member', 'viewer'],
    externalWritesEnabled: false,
  },
  {
    method: 'POST',
    path: '/api/v1/autonomy/pause',
    purpose: 'Pause global or category autonomy for the authenticated workspace. This only updates internal pause flags.',
    authRequired: true,
    allowedRoles: ['owner', 'admin'],
    externalWritesEnabled: false,
  },
  {
    method: 'POST',
    path: '/api/v1/autonomy/resume',
    purpose: 'Resume global or category autonomy for the authenticated workspace. This does not execute waiting actions.',
    authRequired: true,
    allowedRoles: ['owner', 'admin'],
    externalWritesEnabled: false,
  },
];

export const AUTONOMY_PAUSE_API_SAFETY_RULES = [
  'GET /api/v1/autonomy/status is read-only and workspace-scoped.',
  'POST /api/v1/autonomy/pause only updates pause flags and updated_by/updated_at.',
  'POST /api/v1/autonomy/resume only updates pause flags and updated_by/updated_at.',
  'Resume never executes approved, queued, pending, or proposed actions.',
  'Pause never cancels existing actions; it blocks future auto-approval/executor layers.',
  'No executor registry, real connector, external write, auto-run policy, or rollback execution is enabled in Phase 5.9.',
] as const;
