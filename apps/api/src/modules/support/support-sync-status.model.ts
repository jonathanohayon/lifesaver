import { z } from 'zod';
import { redactSupportTextForLogs } from './support-privacy-safeguards.model.js';
import type {
  SupportSyncConnectorProvider,
  SupportSyncErrorSeverity,
  SupportSyncHealth,
  SupportSyncSafeError,
  SupportSyncStatusExample,
  SupportSyncStatusInput,
  SupportSyncStatusPreview,
  SupportSyncStatusSnapshot,
  SupportSyncStatusStatus,
  SupportSyncTokenStatus,
} from './support-sync-status.types.js';

export const SUPPORT_SYNC_STATUS_PHASE = 'phase_12_8_sync_status_errors' as const;
export const SUPPORT_SYNC_STATUS_HEALTH_MODE = 'v2-phase-12-8-sync-status-errors' as const;
export const SUPPORT_SYNC_STATUS_PACKAGE = 'lifesaver-v0.7.0-phase-12-8-sync-status-errors.zip' as const;

const providerSchema = z.enum(['gmail', 'helpdesk', 'support_inbox', 'zendesk', 'gorgias', 'help_scout']);
const tokenStatusSchema = z.enum(['valid', 'expiring_soon', 'expired', 'missing', 'unknown']);
const errorSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

const supportSyncStatusInputSchema = z.object({
  provider: providerSchema.optional().nullable(),
  connected: z.boolean().optional().nullable(),
  configured: z.boolean().optional().nullable(),
  lastSyncAt: z.string().trim().max(80).optional().nullable(),
  lastSuccessfulSyncAt: z.string().trim().max(80).optional().nullable(),
  lastAttemptAt: z.string().trim().max(80).optional().nullable(),
  syncErrors: z.array(z.object({
    code: z.string().trim().max(120).optional().nullable(),
    message: z.string().trim().max(1000).optional().nullable(),
    occurredAt: z.string().trim().max(80).optional().nullable(),
    retryable: z.boolean().optional().nullable(),
    severity: errorSeveritySchema.optional().nullable(),
  }).strict()).max(10).optional().nullable(),
  tokenStatus: tokenStatusSchema.optional().nullable(),
  tokenExpiresAt: z.string().trim().max(80).optional().nullable(),
  tokenConnected: z.boolean().optional().nullable(),
  readOnlyScopeGranted: z.boolean().optional().nullable(),
}).strict();

const forbiddenBrowserFragments = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'gmail_client_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'raw_provider_payload',
  'oauth_secret',
  'smtp_password',
];

function compact(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function safeDate(value: string | null | undefined): string | null {
  const clean = compact(value, 80);
  if (!clean) return null;
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return clean;
  return parsed.toISOString();
}

function connectorLabel(provider: SupportSyncConnectorProvider): string {
  return {
    gmail: 'Gmail',
    helpdesk: 'Helpdesk',
    support_inbox: 'Support inbox',
    zendesk: 'Zendesk',
    gorgias: 'Gorgias',
    help_scout: 'Help Scout',
  }[provider];
}

function inferTokenStatus(parsed: z.infer<typeof supportSyncStatusInputSchema>): SupportSyncTokenStatus {
  if (parsed.tokenStatus) return parsed.tokenStatus;
  if (parsed.connected !== true || parsed.tokenConnected === false) return 'missing';
  if (!parsed.tokenExpiresAt) return 'unknown';
  const expiresAt = new Date(parsed.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return 'unknown';
  const now = Date.now();
  if (expiresAt <= now) return 'expired';
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return expiresAt - now <= twentyFourHours ? 'expiring_soon' : 'valid';
}

function buildSafeError(input: {
  code?: string | null;
  message?: string | null;
  occurredAt?: string | null;
  retryable?: boolean | null;
  severity?: SupportSyncErrorSeverity | null;
}): SupportSyncSafeError {
  const redacted = redactSupportTextForLogs(input.message || 'Support connector sync failed.', 500);
  return {
    code: compact(input.code, 120) || 'sync_error',
    message: redacted.value || 'Support connector sync failed.',
    occurredAt: safeDate(input.occurredAt),
    retryable: input.retryable !== false,
    severity: input.severity || 'error',
    redacted: redacted.reasons.length > 0,
  };
}

function inferConnectionState(configured: boolean, connected: boolean): 'connected' | 'disconnected' | 'not_configured' {
  if (!configured) return 'not_configured';
  return connected ? 'connected' : 'disconnected';
}

function inferSyncHealth(snapshot: Pick<SupportSyncStatusSnapshot, 'connectionState' | 'syncErrorCount' | 'tokenStatus'>): SupportSyncHealth {
  if (snapshot.connectionState !== 'connected') return 'disconnected';
  if (snapshot.tokenStatus === 'expired' || snapshot.tokenStatus === 'missing') return 'error';
  if (snapshot.syncErrorCount > 0 || snapshot.tokenStatus === 'expiring_soon' || snapshot.tokenStatus === 'unknown') return 'warning';
  return 'healthy';
}

function buildBadges(snapshot: Pick<SupportSyncStatusSnapshot, 'connectionState' | 'syncErrorCount' | 'tokenStatus' | 'lastSyncAt'>): string[] {
  const badges: string[] = [];
  badges.push(snapshot.connectionState === 'connected' ? 'CONNECTED' : snapshot.connectionState === 'disconnected' ? 'DISCONNECTED' : 'NOT CONFIGURED');
  badges.push(`TOKEN ${snapshot.tokenStatus.replace(/_/g, ' ').toUpperCase()}`);
  badges.push(snapshot.lastSyncAt ? 'LAST SYNC AVAILABLE' : 'NO SYNC YET');
  badges.push(snapshot.syncErrorCount > 0 ? `${snapshot.syncErrorCount} SYNC ERROR${snapshot.syncErrorCount === 1 ? '' : 'S'}` : 'NO SYNC ERRORS');
  return badges;
}

function nextAction(snapshot: Pick<SupportSyncStatusSnapshot, 'connectionState' | 'tokenStatus' | 'syncErrorCount' | 'readOnlyScopeGranted'>): string {
  if (snapshot.connectionState === 'not_configured') return 'Connect Gmail with read-only scope when OAuth is added in a later phase.';
  if (snapshot.connectionState === 'disconnected') return 'Reconnect the support connector before importing tickets.';
  if (snapshot.tokenStatus === 'expired') return 'Refresh or reconnect the connector token before the next support sync.';
  if (snapshot.tokenStatus === 'missing') return 'Reconnect the connector because no usable token status is available.';
  if (!snapshot.readOnlyScopeGranted) return 'Grant Gmail read-only scope only; do not request send or modify scope yet.';
  if (snapshot.syncErrorCount > 0) return 'Review the redacted sync errors and retry read-only import after the issue is fixed.';
  return 'Connector status looks safe for read-only ticket import.';
}

export function assertSupportSyncStatusSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of forbiddenBrowserFragments) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support sync status output contains forbidden fragment: ${fragment}`);
    }
  }
}

export function buildSupportSyncStatusSnapshot(input: unknown): SupportSyncStatusSnapshot {
  const parsed = supportSyncStatusInputSchema.parse(input) as SupportSyncStatusInput;
  const provider = (parsed.provider || 'gmail') as SupportSyncConnectorProvider;
  const configured = parsed.configured === true || parsed.connected === true || parsed.tokenConnected === true;
  const tokenStatus = inferTokenStatus(parsed);
  const connected = parsed.connected === true && !['expired', 'missing'].includes(tokenStatus);
  const connectionState = inferConnectionState(configured, connected);
  const recentSyncErrors = (parsed.syncErrors || []).map(buildSafeError);
  const partial = {
    provider,
    connectorLabel: connectorLabel(provider),
    connectionState,
    connectorConnected: connectionState === 'connected',
    configured,
    lastSyncAt: safeDate(parsed.lastSyncAt),
    lastSuccessfulSyncAt: safeDate(parsed.lastSuccessfulSyncAt),
    lastAttemptAt: safeDate(parsed.lastAttemptAt),
    syncErrorCount: recentSyncErrors.length,
    recentSyncErrors,
    tokenStatus,
    tokenExpiresAt: safeDate(parsed.tokenExpiresAt),
    tokenValueReturned: false as const,
    rawTokenPayloadReturned: false as const,
    readOnlyScopeGranted: parsed.readOnlyScopeGranted === true,
    safeToImportReadOnly: false,
    syncHealth: 'disconnected' as SupportSyncHealth,
    uiBadges: [] as string[],
    nextRecommendedAction: '',
  };

  const snapshot: SupportSyncStatusSnapshot = {
    ...partial,
    syncHealth: inferSyncHealth(partial),
    safeToImportReadOnly: partial.connectionState === 'connected'
      && partial.readOnlyScopeGranted
      && partial.tokenStatus === 'valid'
      && partial.syncErrorCount === 0,
    uiBadges: buildBadges(partial),
    nextRecommendedAction: '',
  };
  snapshot.nextRecommendedAction = nextAction(snapshot);

  assertSupportSyncStatusSafe(snapshot);
  return snapshot;
}

export function buildSupportSyncStatusPreview(input: unknown): SupportSyncStatusPreview {
  const preview: SupportSyncStatusPreview = {
    valid: true,
    snapshot: buildSupportSyncStatusSnapshot(input),
    safety: {
      browserSafeOnly: true,
      tokenValueReturned: false,
      rawTokenPayloadReturned: false,
      rawProviderPayloadReturned: false,
      gmailExternalApiCalled: false,
      emailSendAdded: false,
      supportAutoReplyAdded: false,
    },
  };
  assertSupportSyncStatusSafe(preview);
  return preview;
}

export function buildSupportSyncStatusCurrent(): SupportSyncStatusPreview {
  // Phase 12.8 has no real Gmail OAuth/token lookup yet. This is the safe UI baseline.
  return buildSupportSyncStatusPreview({
    provider: 'gmail',
    configured: false,
    connected: false,
    tokenStatus: 'missing',
    readOnlyScopeGranted: false,
    syncErrors: [],
  });
}

export function buildSupportSyncStatusExample(): SupportSyncStatusExample {
  const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return {
    disconnected: buildSupportSyncStatusCurrent(),
    connectedHealthy: buildSupportSyncStatusPreview({
      provider: 'gmail',
      configured: true,
      connected: true,
      tokenConnected: true,
      tokenStatus: 'valid',
      tokenExpiresAt: tomorrow,
      readOnlyScopeGranted: true,
      lastSyncAt: new Date().toISOString(),
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      syncErrors: [],
    }),
    connectedWithErrors: buildSupportSyncStatusPreview({
      provider: 'gmail',
      configured: true,
      connected: true,
      tokenConnected: true,
      tokenStatus: 'expiring_soon',
      tokenExpiresAt: soon,
      readOnlyScopeGranted: true,
      lastSyncAt: yesterday,
      lastSuccessfulSyncAt: yesterday,
      lastAttemptAt: new Date().toISOString(),
      syncErrors: [
        {
          code: 'gmail_rate_limited',
          message: 'Gmail read-only import was rate limited for private.customer@example.com. authorization: bearer abc123 was removed.',
          occurredAt: new Date().toISOString(),
          retryable: true,
          severity: 'warning',
        },
      ],
    }),
    expiredToken: buildSupportSyncStatusPreview({
      provider: 'gmail',
      configured: true,
      connected: true,
      tokenConnected: true,
      tokenStatus: 'expired',
      tokenExpiresAt: yesterday,
      readOnlyScopeGranted: true,
      lastSyncAt: yesterday,
      lastSuccessfulSyncAt: yesterday,
      lastAttemptAt: new Date().toISOString(),
      syncErrors: [],
    }),
  };
}

export function buildSupportSyncStatusStatus(): SupportSyncStatusStatus {
  return {
    phase: 'V2 Phase 12.8 — Sync Status + Errors',
    healthMode: SUPPORT_SYNC_STATUS_HEALTH_MODE,
    deliverable: 'support_connector_status_ui',
    selectedConnector: 'gmail',
    connectorStatusUiAdded: true,
    showsConnectedDisconnected: true,
    showsLastSync: true,
    showsSyncErrors: true,
    showsTokenStatus: true,
    browserSafeOnly: true,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportAutoReplyAdded: false,
    tokenValueReturned: false,
  };
}
