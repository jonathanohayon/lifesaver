export type ActionPollingMode = 'manual' | 'polling' | 'paused';

export interface ActionLiveRefreshSettings {
  readonly enabledByDefault: boolean;
  readonly defaultIntervalMs: number;
  readonly minIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly pausesWhenTabHidden: boolean;
  readonly pausesDuringReviewModal: boolean;
  readonly endpoint: string;
  readonly safetyBoundary: string;
}

export const ACTION_LIVE_REFRESH_SETTINGS: ActionLiveRefreshSettings = {
  enabledByDefault: true,
  defaultIntervalMs: 60000,
  minIntervalMs: 30000,
  maxIntervalMs: 60000,
  pausesWhenTabHidden: true,
  pausesDuringReviewModal: true,
  endpoint: 'GET /api/v1/actions',
  safetyBoundary: 'Polling is read-only. It must never approve, reject, cancel, queue, execute, publish, send, spend, pause, refund, edit products, rollback, or write to external platforms.',
};

export const ACTION_LIVE_REFRESH_TESTS = [
  'Manual refresh reloads the workspace-scoped action list.',
  'Auto polling checks the list endpoint every 30–60 seconds only.',
  'Polling pauses when the browser tab is hidden.',
  'Polling pauses while detail, approve, or reject modals are open.',
  'Polling does not call approve/reject/cancel/executor endpoints.',
] as const;
