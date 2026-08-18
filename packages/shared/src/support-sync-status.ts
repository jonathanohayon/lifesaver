export const SUPPORT_SYNC_STATUS_PHASE = 'phase_12_8_sync_status_errors';
export const SUPPORT_SYNC_STATUS_HEALTH_MODE = 'v2-phase-12-8-sync-status-errors';
export const SUPPORT_SYNC_STATUS_PACKAGE = 'lifesaver-v0.7.0-phase-12-8-sync-status-errors.zip';

export const SUPPORT_SYNC_STATUS_FIELDS = [
  'connector_connected_or_disconnected',
  'last_sync',
  'sync_errors',
  'token_status',
] as const;

export const SUPPORT_SYNC_STATUS_SAFETY = {
  browserSafeOnly: true,
  tokenValueReturned: false,
  rawTokenPayloadReturned: false,
  rawProviderPayloadReturned: false,
  gmailExternalApiCalled: false,
  emailSendAdded: false,
  supportAutoReplyAdded: false,
} as const;
