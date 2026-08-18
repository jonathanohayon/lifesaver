import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPPORT_SYNC_STATUS_HEALTH_MODE,
  SUPPORT_SYNC_STATUS_PACKAGE,
  SUPPORT_SYNC_STATUS_PHASE,
  assertSupportSyncStatusSafe,
  buildSupportSyncStatusCurrent,
  buildSupportSyncStatusExample,
  buildSupportSyncStatusPreview,
  buildSupportSyncStatusSnapshot,
  buildSupportSyncStatusStatus,
} from './support-sync-status.model.js';

test('Phase 12.8 constants are correct', () => {
  assert.equal(SUPPORT_SYNC_STATUS_PHASE, 'phase_12_8_sync_status_errors');
  assert.equal(SUPPORT_SYNC_STATUS_HEALTH_MODE, 'v2-phase-12-8-sync-status-errors');
  assert.equal(SUPPORT_SYNC_STATUS_PACKAGE, 'lifesaver-v0.7.0-phase-12-8-sync-status-errors.zip');
});

test('status confirms connector status UI and no Gmail sending/API client', () => {
  const status = buildSupportSyncStatusStatus();
  assert.equal(status.deliverable, 'support_connector_status_ui');
  assert.equal(status.selectedConnector, 'gmail');
  assert.equal(status.connectorStatusUiAdded, true);
  assert.equal(status.showsConnectedDisconnected, true);
  assert.equal(status.showsLastSync, true);
  assert.equal(status.showsSyncErrors, true);
  assert.equal(status.showsTokenStatus, true);
  assert.equal(status.gmailApiClientAdded, false);
  assert.equal(status.gmailExternalApiCalled, false);
  assert.equal(status.emailSendAdded, false);
  assert.equal(status.supportAutoReplyAdded, false);
  assert.equal(status.tokenValueReturned, false);
});

test('current status is disconnected safe baseline before OAuth exists', () => {
  const current = buildSupportSyncStatusCurrent();
  assert.equal(current.snapshot.provider, 'gmail');
  assert.equal(current.snapshot.connectionState, 'not_configured');
  assert.equal(current.snapshot.connectorConnected, false);
  assert.equal(current.snapshot.tokenStatus, 'missing');
  assert.equal(current.snapshot.safeToImportReadOnly, false);
  assert.equal(current.snapshot.syncHealth, 'disconnected');
  assertSupportSyncStatusSafe(current);
});

test('connected healthy connector is safe for read-only import', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenConnected: true,
    tokenStatus: 'valid',
    tokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    readOnlyScopeGranted: true,
    lastSyncAt: new Date().toISOString(),
    lastSuccessfulSyncAt: new Date().toISOString(),
    syncErrors: [],
  });
  assert.equal(result.connectionState, 'connected');
  assert.equal(result.connectorConnected, true);
  assert.equal(result.syncHealth, 'healthy');
  assert.equal(result.safeToImportReadOnly, true);
  assert.equal(result.tokenValueReturned, false);
  assert.equal(result.rawTokenPayloadReturned, false);
});

test('connected without read-only scope is not safe to import', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenStatus: 'valid',
    tokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    readOnlyScopeGranted: false,
  });
  assert.equal(result.connectionState, 'connected');
  assert.equal(result.safeToImportReadOnly, false);
  assert.match(result.nextRecommendedAction, /read-only scope/i);
});

test('last sync fields are shown as safe ISO values', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenStatus: 'valid',
    tokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    readOnlyScopeGranted: true,
    lastSyncAt: '2026-07-07T10:00:00.000Z',
    lastSuccessfulSyncAt: '2026-07-07T09:59:00.000Z',
    lastAttemptAt: '2026-07-07T10:00:00.000Z',
  });
  assert.equal(result.lastSyncAt, '2026-07-07T10:00:00.000Z');
  assert.equal(result.lastSuccessfulSyncAt, '2026-07-07T09:59:00.000Z');
  assert.equal(result.lastAttemptAt, '2026-07-07T10:00:00.000Z');
});

test('sync errors are counted and redacted', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenStatus: 'valid',
    tokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    readOnlyScopeGranted: true,
    syncErrors: [
      {
        code: 'gmail_rate_limited',
        message: 'Rate limited for private.customer@example.com with authorization: bearer secret123',
        retryable: true,
        severity: 'warning',
      },
    ],
  });
  assert.equal(result.syncErrorCount, 1);
  assert.equal(result.syncHealth, 'warning');
  assert.equal(result.safeToImportReadOnly, false);
  assert.equal(result.recentSyncErrors[0]?.redacted, true);
  assert.ok(result.recentSyncErrors[0]?.message.includes('[REDACTED_EMAIL]'));
  assert.ok(result.recentSyncErrors[0]?.message.includes('[REDACTED_AUTHORIZATION_HEADER]'));
  assertSupportSyncStatusSafe(result);
});

test('expired token disconnects status and blocks import', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenConnected: true,
    tokenStatus: 'expired',
    readOnlyScopeGranted: true,
  });
  assert.equal(result.connectionState, 'disconnected');
  assert.equal(result.connectorConnected, false);
  assert.equal(result.tokenStatus, 'expired');
  assert.equal(result.safeToImportReadOnly, false);
  assert.match(result.nextRecommendedAction, /refresh|reconnect/i);
});

test('token expiry can infer expiring soon', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenConnected: true,
    tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    readOnlyScopeGranted: true,
  });
  assert.equal(result.tokenStatus, 'expiring_soon');
  assert.equal(result.syncHealth, 'warning');
});

test('token expiry can infer expired', () => {
  const result = buildSupportSyncStatusSnapshot({
    provider: 'gmail',
    configured: true,
    connected: true,
    tokenConnected: true,
    tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    readOnlyScopeGranted: true,
  });
  assert.equal(result.tokenStatus, 'expired');
  assert.equal(result.connectionState, 'disconnected');
});

test('UI badges include connection, token, sync, and error states', () => {
  const result = buildSupportSyncStatusSnapshot({ configured: true, connected: false, tokenStatus: 'missing' });
  assert.ok(result.uiBadges.some((badge) => badge.includes('DISCONNECTED')));
  assert.ok(result.uiBadges.some((badge) => badge.includes('TOKEN MISSING')));
  assert.ok(result.uiBadges.some((badge) => badge.includes('NO SYNC')));
  assert.ok(result.uiBadges.some((badge) => badge.includes('NO SYNC ERRORS')));
});

test('preview builder returns browser-safe safety flags', () => {
  const preview = buildSupportSyncStatusPreview({ configured: true, connected: false, tokenStatus: 'missing' });
  assert.equal(preview.valid, true);
  assert.equal(preview.safety.browserSafeOnly, true);
  assert.equal(preview.safety.tokenValueReturned, false);
  assert.equal(preview.safety.rawTokenPayloadReturned, false);
  assert.equal(preview.safety.rawProviderPayloadReturned, false);
  assert.equal(preview.safety.gmailExternalApiCalled, false);
  assertSupportSyncStatusSafe(preview);
});

test('example contains disconnected, connected, error, and expired-token states', () => {
  const example = buildSupportSyncStatusExample();
  assert.equal(example.disconnected.snapshot.connectionState, 'not_configured');
  assert.equal(example.connectedHealthy.snapshot.syncHealth, 'healthy');
  assert.equal(example.connectedWithErrors.snapshot.syncErrorCount, 1);
  assert.equal(example.expiredToken.snapshot.tokenStatus, 'expired');
  assertSupportSyncStatusSafe(example);
});

test('safe output guard blocks secret fragments', () => {
  assert.throws(() => assertSupportSyncStatusSafe({ leaked: 'access_token=abc123' }), /forbidden fragment/);
});

test('invalid provider is rejected by schema', () => {
  assert.throws(() => buildSupportSyncStatusPreview({ provider: 'unknown_provider' }), /Invalid enum value/);
});
