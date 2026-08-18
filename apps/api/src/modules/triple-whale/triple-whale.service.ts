import { AppError } from '../../common/errors/AppError.js';
import { decryptSecret } from '../../common/utils/crypto.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getConnectedAccount } from '../connected-accounts/connected-accounts.repository.js';
import { insertMetricsSnapshot } from '../metrics/metrics.repository.js';
import {
  buildTripleWhaleMappingPreview,
  buildTripleWhaleSkeletonRawPayload,
  normalizeTripleWhaleSkeletonPayload,
  normalizeTripleWhaleSummaryPayload,
} from './triple-whale.mapper.js';
import { fetchTripleWhaleAttributionProbe, fetchTripleWhaleSummaryProbe, validateTripleWhaleApiKey } from './triple-whale.client.js';
import { getLatestTripleWhaleRawSnapshot, getTripleWhaleRawSnapshots, recordTripleWhaleSyncEvent, updateTripleWhaleAfterSync, type TripleWhaleSnapshotRow } from './triple-whale.repository.js';
import type { TripleWhaleLiveVerificationResult, TripleWhaleSyncResult } from './triple-whale.types.js';

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required before syncing Triple Whale metrics.');
  }
}

async function getDecryptedTripleWhaleKey(workspaceId: string): Promise<{ apiKey: string; keyHint: string | null }> {
  const account = await getConnectedAccount(workspaceId, 'triple_whale');
  if (!account || !account.encrypted_api_key) {
    throw new AppError(400, 'TRIPLE_WHALE_NOT_CONNECTED', 'Store the Triple Whale API key first before refreshing or validating metrics.');
  }

  let apiKey = '';
  try {
    apiKey = decryptSecret(account.encrypted_api_key);
  } catch (_error) {
    throw new AppError(400, 'TRIPLE_WHALE_KEY_DECRYPT_FAILED', 'Stored Triple Whale key exists but cannot be decrypted. Your APP_ENCRYPTION_KEY probably changed between ZIP versions. Copy the original working .env file into this version folder, then restart the API. If the original encryption key is lost, reconnect Triple Whale once.');
  }

  if (!apiKey || apiKey.trim().length < 8) {
    throw new AppError(400, 'TRIPLE_WHALE_KEY_INVALID', 'Stored Triple Whale key decrypted to an invalid value. Copy the original working .env file or reconnect the API key.');
  }

  return { apiKey, keyHint: account.key_hint };
}

export async function refreshTripleWhaleMetrics(workspaceId: string, userId: string): Promise<TripleWhaleSyncResult> {
  assertDatabaseReady();

  const { apiKey, keyHint } = await getDecryptedTripleWhaleKey(workspaceId);

  await recordTripleWhaleSyncEvent({
    workspaceId,
    eventType: 'triple_whale_sync_started',
    message: 'Triple Whale metrics refresh started from LIFE.SAVER (manual button, worker, or safe auto-refresh).',
    metadata: { userId, version: '0.6.0', mode: 'live_validation_first' },
  });

  const startedAt = new Date();

  try {
    const validation = await validateTripleWhaleApiKey(apiKey);
    if (!validation.ok) {
      await updateTripleWhaleAfterSync({
        workspaceId,
        status: 'api_key_validation_failed',
        lastError: validation.message,
        metadata: {
          version: '0.6.0',
          validationAt: new Date().toISOString(),
          httpStatus: validation.httpStatus,
          responseKind: validation.responseKind,
        },
      });

      throw new AppError(400, 'TRIPLE_WHALE_API_KEY_VALIDATION_FAILED', validation.message);
    }

    const summaryProbe = await fetchTripleWhaleSummaryProbe(apiKey);
    const endedAt = new Date();

    let mode: TripleWhaleSyncResult['mode'] = 'validated_skeleton';
    let verification: TripleWhaleSyncResult['verification'] = 'api_key_validated';
    let dateRange = 'api_key_validated_today';
    let rawPayload: Record<string, unknown>;
    let normalizedMetrics;

    if (summaryProbe.attempted && summaryProbe.ok && summaryProbe.rawPayload) {
      mode = 'summary_probe';
      verification = 'summary_probe_attempted';
      dateRange = summaryProbe.dateRange || 'triple_whale_summary_probe';
      rawPayload = {
        source: 'triple_whale_summary_probe',
        requestedAt: startedAt.toISOString(),
        keyHint,
        validation: {
          httpStatus: validation.httpStatus,
          responseKind: validation.responseKind,
          preview: redactSensitiveData(validation.responsePreview),
        },
        summaryProbe: {
          httpStatus: summaryProbe.httpStatus,
          responseKind: summaryProbe.responseKind,
          requestMode: summaryProbe.requestMode,
          message: summaryProbe.message,
          attempts: summaryProbe.attempts,
        },
        request: {
          mode: summaryProbe.requestMode,
          dateRange: summaryProbe.dateRange,
          body: summaryProbe.requestBody,
          note: 'Request body stored for developer review. It contains no API key.',
        },
        payload: summaryProbe.rawPayload,
      };
      normalizedMetrics = normalizeTripleWhaleSummaryPayload(summaryProbe.rawPayload, dateRange);
    } else {
      rawPayload = buildTripleWhaleSkeletonRawPayload({
        keyHint,
        requestedAt: startedAt.toISOString(),
        dateRange,
        validation: {
          httpStatus: validation.httpStatus,
          responseKind: validation.responseKind,
          preview: redactSensitiveData(validation.responsePreview),
        },
      });
      normalizedMetrics = normalizeTripleWhaleSkeletonPayload(rawPayload);
    }

    const snapshot = await insertMetricsSnapshot({
      workspaceId,
      provider: 'triple_whale',
      dateRange,
      rawPayload,
      normalizedMetrics,
      sourceStartedAt: startedAt,
      sourceEndedAt: endedAt,
    });

    await updateTripleWhaleAfterSync({
      workspaceId,
      status: mode === 'summary_probe' ? 'summary_probe_snapshot_stored' : 'api_key_validated_snapshot_stored',
      metadata: {
        version: '0.6.0',
        lastValidatedAt: endedAt.toISOString(),
        lastSnapshotId: snapshot.id,
        syncMode: mode,
        summaryProbeAttempted: summaryProbe.attempted,
        summaryProbeHttpStatus: summaryProbe.httpStatus,
        summaryProbeRequestMode: summaryProbe.requestMode,
        summaryProbeDateRange: summaryProbe.dateRange,
        summaryProbeAttempts: summaryProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
      },
    });

    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: mode === 'summary_probe' ? 'triple_whale_summary_probe_snapshot_stored' : 'triple_whale_validated_snapshot_stored',
      message: mode === 'summary_probe'
        ? 'A live Triple Whale Summary probe snapshot was stored. Mapper remains conservative until raw response is reviewed.'
        : 'Triple Whale API key was validated live. A safe placeholder snapshot was stored because the Summary request body is not configured yet.',
      metadata: { userId, snapshotId: snapshot.id, version: '0.6.0', mode },
    });

    return {
      success: true,
      mode,
      verification,
      message: mode === 'summary_probe'
        ? 'Live Triple Whale Summary probe snapshot stored. Review raw_payload before finalizing production metric mapping.'
        : 'Triple Whale API key validated successfully. Stored a safe snapshot while Summary Page request body/mapping remains pending.',
      snapshotId: snapshot.id,
      dateRange,
      provider: 'triple_whale',
      normalizedMetrics: {
        ...normalizedMetrics,
        snapshotId: snapshot.id,
        provider: 'triple_whale',
        lastSyncedAt: snapshot.created_at.toISOString(),
      },
      rawPayloadPreview: {
        source: rawPayload.source,
        verification: rawPayload.verification || verification,
        note: rawPayload.note || 'Raw Triple Whale payload is stored in metrics_snapshots.raw_payload for developer review.',
        keyHint,
        mode,
        requestMode: summaryProbe.requestMode,
        summaryDateRange: summaryProbe.dateRange,
        validationStatus: validation.httpStatus,
        attempts: summaryProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
      },
    };
  } catch (error: any) {
    const message = error?.message || 'Triple Whale refresh failed.';

    await updateTripleWhaleAfterSync({
      workspaceId,
      status: 'sync_error',
      lastError: message,
      metadata: { version: '0.6.0', lastSyncErrorAt: new Date().toISOString() },
    });

    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: 'triple_whale_sync_failed',
      severity: 'error',
      message,
      metadata: { userId, version: '0.6.0', mode: 'live_validation_first' },
    });

    if (error instanceof AppError) throw error;
    throw new AppError(500, 'TRIPLE_WHALE_SYNC_FAILED', message);
  }
}

export async function testTripleWhaleConnection(workspaceId: string, userId: string): Promise<TripleWhaleLiveVerificationResult> {
  assertDatabaseReady();

  const { apiKey } = await getDecryptedTripleWhaleKey(workspaceId);

  await recordTripleWhaleSyncEvent({
    workspaceId,
    eventType: 'triple_whale_api_key_validation_started',
    message: 'Protected Triple Whale API key validation requested from connection screen.',
    metadata: { userId, version: '0.6.0' },
  });

  const result = await validateTripleWhaleApiKey(apiKey);

  await updateTripleWhaleAfterSync({
    workspaceId,
    status: result.ok ? 'api_key_validated' : 'api_key_validation_failed',
    lastError: result.ok ? null : result.message,
    metadata: {
      version: '0.6.0',
      validationAt: new Date().toISOString(),
      httpStatus: result.httpStatus,
      responseKind: result.responseKind,
    },
  });

  await recordTripleWhaleSyncEvent({
    workspaceId,
    eventType: result.ok ? 'triple_whale_api_key_validated' : 'triple_whale_api_key_validation_failed',
    severity: result.ok ? 'info' : 'warning',
    message: result.message,
    metadata: {
      userId,
      version: '0.6.0',
      httpStatus: result.httpStatus,
      responseKind: result.responseKind,
      responsePreview: redactSensitiveData(result.responsePreview),
    },
  });

  return {
    success: result.ok,
    mode: 'api_key_validation',
    message: result.message,
    httpStatus: result.httpStatus,
    responseKind: result.responseKind,
    responsePreview: redactSensitiveData(result.responsePreview),
    safeNote: 'The raw Triple Whale API key was not exposed. LIFE.SAVER validated it server-side with x-api-key and stored only safe status metadata.',
  };
}



const SENSITIVE_KEYS = new Set([
  'apiKey', 'apikey', 'api_key', 'x-api-key', 'authorization', 'accessToken', 'access_token', 'refreshToken', 'refresh_token',
  'token', 'idToken', 'id_token', 'password', 'secret', 'cookie', 'cookies', 'email', 'name', 'user_id', 'userid', 'sub',
  'firebase', 'auth_time', 'email_verified', 'identities', 'iss', 'aud', 'iat', 'exp', 'phone', 'phone_number', 'phonenumber', 'address', 'shipping_address', 'billing_address', 'customer', 'customer_id', 'customerid', 'first_name', 'firstname', 'last_name', 'lastname', 'ip', 'ip_address', 'ipaddress'
]);

function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH_LIMIT]';
  if (Array.isArray(value)) return value.slice(0, 80).map(item => redactSensitiveData(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(normalizedKey)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitiveData(child, depth + 1);
      }
    }
    return out;
  }
  return value;
}


function summarizeAttributionProbePayload(value: unknown): Record<string, unknown> {
  const text = JSON.stringify(value || {});
  const root = value && typeof value === 'object' ? value as Record<string, any> : {};
  const payload = (root.payload && typeof root.payload === 'object') ? root.payload as Record<string, any> : root;
  const candidates = [payload.orders, payload.data, payload.items, payload.results, payload.rows].filter(Array.isArray) as unknown[][];
  const firstList = candidates[0] || [];
  const looksLikeJourney = /journey|attribution|touchpoint|pixel|channel|source|medium/i.test(text);
  return {
    responseKeys: Object.keys(payload).slice(0, 30),
    detectedListLength: firstList.length,
    hasJourneySignals: looksLikeJourney,
    previewOnly: true,
    note: 'Attribution/Pixels payload may contain customer-level journey data. Browser previews are redacted and bounded. Do not use this as dashboard attribution until field semantics are confirmed.',
  };
}

function buildAttributionProbeNormalized(dateRange: string, ok: boolean, rawPayload: Record<string, unknown> | null, message: string) {
  return {
    dateRange,
    revenue: 0,
    orders: 0,
    aov: 0,
    adSpend: 0,
    roas: 0,
    conversionRate: 0,
    attribution: { meta: 0, google: 0, tiktok: 0, email: 0 },
    channelSpend: {},
    lastSyncedAt: new Date().toISOString(),
    source: ok ? 'triple_whale_attribution_probe_raw_capture' : 'triple_whale_attribution_probe_error',
    sourceNote: ok
      ? 'Triple Whale Pixel/Attribution raw response was captured for developer review. It is not used as dashboard attribution until mapping is confirmed.'
      : 'Triple Whale Pixel/Attribution probe returned an error. Review raw_payload diagnostics before mapping.',
    sourceStatus: ok ? 'attribution_probe_success_needs_review' : 'attribution_probe_error',
    productionReady: false,
    coreMetricsProductionReady: false,
    attributionProductionReady: false,
    conversionRateProductionReady: false,
    sourceWarning: 'Attribution/Pixels probe data is diagnostic only. Do not treat it as revenue attribution until exact fields are manually confirmed.',
    mapping: {
      version: '0.5.2',
      type: 'attribution_pixel_probe',
      confidence: 'diagnostic_only',
      productionReady: false,
      attributionProductionReady: false,
      summary: summarizeAttributionProbePayload(rawPayload),
      message,
    },
  };
}

function classifyTripleWhaleSnapshot(snapshot: TripleWhaleSnapshotRow): {
  kind: 'summary_probe_success' | 'summary_probe_error' | 'attribution_probe_success' | 'attribution_probe_error' | 'api_key_validation' | 'sample_placeholder' | 'mapped_metrics' | 'unknown';
  label: string;
  isSummaryProbe: boolean;
  isError: boolean;
  httpStatus: unknown;
  message: string | null;
} {
  const raw = snapshot.raw_payload || {};
  const normalized = snapshot.normalized_metrics || {};
  const dateRange = snapshot.date_range || '';
  const source = String((raw as any).source || (normalized as any).source || '');
  const sourceStatus = String((normalized as any).sourceStatus || '');
  const verification = String((raw as any).verification || '');
  const probe = (raw as any).summaryProbe || {};
  const httpStatus = probe.httpStatus ?? (raw as any).validation?.httpStatus ?? null;
  const message = typeof probe.message === 'string' ? probe.message : (typeof (raw as any).note === 'string' ? (raw as any).note : null);

  if (source.includes('attribution_probe') || sourceStatus.includes('attribution_probe') || dateRange.includes('attribution_probe')) {
    const attributionProbe = (raw as any).attributionProbe || {};
    const ok = Boolean(attributionProbe.ok) || sourceStatus.includes('success');
    return {
      kind: ok ? 'attribution_probe_success' : 'attribution_probe_error',
      label: ok ? 'Attribution/Pixels probe success/raw capture' : 'Attribution/Pixels probe error/raw diagnostics',
      isSummaryProbe: false,
      isError: !ok,
      httpStatus: attributionProbe.httpStatus ?? httpStatus,
      message: typeof attributionProbe.message === 'string' ? attributionProbe.message : message,
    };
  }

  if (source.includes('summary_probe') || dateRange.includes('summary_probe')) {
    const ok = Boolean(probe.ok) || dateRange.includes('summary_probe_raw_capture') && !dateRange.includes('error');
    return {
      kind: ok ? 'summary_probe_success' : 'summary_probe_error',
      label: ok ? 'Summary probe success/raw capture' : 'Summary probe error/raw diagnostics',
      isSummaryProbe: true,
      isError: !ok,
      httpStatus,
      message,
    };
  }

  if (verification === 'api_key_validated_no_summary_body' || dateRange === 'api_key_validated_today') {
    return {
      kind: 'api_key_validation',
      label: 'API key validation placeholder',
      isSummaryProbe: false,
      isError: false,
      httpStatus,
      message,
    };
  }

  if (sourceStatus === 'sample_placeholder' || source.includes('sample_placeholder')) {
    return {
      kind: 'sample_placeholder',
      label: 'Sample placeholder snapshot',
      isSummaryProbe: false,
      isError: false,
      httpStatus,
      message,
    };
  }

  if (source.includes('triple_whale_summary') || sourceStatus.includes('live_summary')) {
    return {
      kind: 'mapped_metrics',
      label: 'Mapped Triple Whale metrics candidate',
      isSummaryProbe: true,
      isError: false,
      httpStatus,
      message,
    };
  }

  return { kind: 'unknown', label: 'Unknown Triple Whale snapshot', isSummaryProbe: false, isError: false, httpStatus, message };
}

function matchesRequestedKind(snapshot: TripleWhaleSnapshotRow, requestedKind: string): boolean {
  const c = classifyTripleWhaleSnapshot(snapshot);
  if (requestedKind === 'all') return true;
  if (requestedKind === 'summary_probe') return c.kind === 'summary_probe_success' || c.kind === 'summary_probe_error';
  if (requestedKind === 'summary_probe_error') return c.kind === 'summary_probe_error';
  if (requestedKind === 'summary_probe_success') return c.kind === 'summary_probe_success';
  if (requestedKind === 'attribution_probe') return c.kind === 'attribution_probe_success' || c.kind === 'attribution_probe_error';
  if (requestedKind === 'attribution_probe_success') return c.kind === 'attribution_probe_success';
  if (requestedKind === 'attribution_probe_error') return c.kind === 'attribution_probe_error';
  if (requestedKind === 'api_key_validation') return c.kind === 'api_key_validation';
  return true;
}

function toBoundedJsonPreview(value: unknown, maxChars = 9000): { payload: unknown; truncated: boolean; sizeChars: number } {
  const redacted = redactSensitiveData(value);
  const text = JSON.stringify(redacted, null, 2);
  if (text.length <= maxChars) {
    return { payload: redacted, truncated: false, sizeChars: text.length };
  }
  return {
    payload: {
      preview: `${text.slice(0, maxChars)}…`,
      truncated: true,
      redacted: true,
      note: 'This preview was redacted and truncated for browser safety. Full raw payload remains stored in metrics_snapshots.raw_payload, but should be handled as sensitive developer data.',
    },
    truncated: true,
    sizeChars: text.length,
  };
}

function snapshotSummary(snapshot: TripleWhaleSnapshotRow) {
  const c = classifyTripleWhaleSnapshot(snapshot);
  return {
    id: snapshot.id,
    provider: snapshot.provider,
    dateRange: snapshot.date_range,
    createdAt: snapshot.created_at.toISOString(),
    kind: c.kind,
    label: c.label,
    isSummaryProbe: c.isSummaryProbe,
    isError: c.isError,
    httpStatus: c.httpStatus,
    message: c.message,
    sourceStatus: (snapshot.normalized_metrics as any)?.sourceStatus || null,
    productionReady: Boolean((snapshot.normalized_metrics as any)?.productionReady),
  };
}

export async function getTripleWhaleSnapshotHistory(workspaceId: string) {
  assertDatabaseReady();
  const snapshots = await getTripleWhaleRawSnapshots(workspaceId, 15);
  return {
    hasSnapshots: snapshots.length > 0,
    message: snapshots.length
      ? 'v0.5.2 snapshot history loaded with explicit snapshot kinds. Use Summary Probe rows for live Triple Whale debugging; API-key validation rows are not business metrics.'
      : 'No Triple Whale snapshots are stored yet.',
    snapshots: snapshots.map(snapshotSummary),
  };
}

export async function getLatestTripleWhaleRawResponse(workspaceId: string, requestedKind = 'summary_probe') {
  assertDatabaseReady();

  const snapshots = await getTripleWhaleRawSnapshots(workspaceId, 20);
  if (!snapshots.length) {
    return {
      hasSnapshot: false,
      message: 'No Triple Whale raw snapshot is stored yet. Run Probe Summary API first.',
      requestedKind,
      snapshot: null,
      history: [],
    };
  }

  const safeKind = requestedKind || 'summary_probe';
  let snapshot = snapshots.find(row => matchesRequestedKind(row, safeKind));
  let fallbackUsed = false;
  if (!snapshot) {
    snapshot = snapshots[0];
    fallbackUsed = true;
  }

  const classification = classifyTripleWhaleSnapshot(snapshot);
  const preview = toBoundedJsonPreview(snapshot.raw_payload);
  return {
    hasSnapshot: true,
    requestedKind: safeKind,
    fallbackUsed,
    message: fallbackUsed
      ? `No ${safeKind} snapshot was found, so the latest Triple Whale snapshot was returned instead. Check Snapshot History to see available rows.`
      : `Latest ${classification.label} loaded. Sensitive user/auth fields are redacted from this browser preview.`,
    snapshot: {
      ...snapshotSummary(snapshot),
      rawPayloadPreview: preview.payload,
      rawPayloadTruncated: preview.truncated,
      rawPayloadSizeChars: preview.sizeChars,
      normalizedMetrics: redactSensitiveData(snapshot.normalized_metrics),
    },
    history: snapshots.slice(0, 8).map(snapshotSummary),
  };
}

export async function getLatestTripleWhaleMappingPreview(workspaceId: string) {
  assertDatabaseReady();

  const snapshots = await getTripleWhaleRawSnapshots(workspaceId, 20);
  if (!snapshots.length) {
    return {
      hasSnapshot: false,
      message: 'No Triple Whale raw snapshot exists yet. Run Probe Summary API first.',
      preview: null,
      history: [],
    };
  }

  const snapshot = snapshots.find(row => {
    const c = classifyTripleWhaleSnapshot(row);
    return c.kind === 'summary_probe_success' || c.kind === 'summary_probe_error' || c.kind === 'mapped_metrics';
  }) || snapshots[0];

  const classification = classifyTripleWhaleSnapshot(snapshot);
  const preview = buildTripleWhaleMappingPreview(snapshot.raw_payload, snapshot.date_range || 'latest_triple_whale_snapshot');
  return {
    hasSnapshot: true,
    message: classification.isSummaryProbe
      ? 'v0.5.2 mapping preview generated from the latest Summary Probe snapshot, not from API-key validation placeholders.'
      : 'v0.5.2 mapping preview fell back to the latest available snapshot because no Summary Probe snapshot was found.',
    snapshot: snapshotSummary(snapshot),
    preview,
    history: snapshots.slice(0, 8).map(snapshotSummary),
  };
}

export async function probeTripleWhaleSummary(workspaceId: string, userId: string): Promise<TripleWhaleSyncResult> {
  assertDatabaseReady();

  const { apiKey, keyHint } = await getDecryptedTripleWhaleKey(workspaceId);

  await recordTripleWhaleSyncEvent({
    workspaceId,
    eventType: 'triple_whale_summary_probe_started',
    message: 'Manual Triple Whale Summary API probe started. This is for raw response capture and mapping review only.',
    metadata: { userId, version: '0.6.0', mode: 'summary_probe_raw_capture' },
  });

  const startedAt = new Date();

  try {
    const validation = await validateTripleWhaleApiKey(apiKey);
    if (!validation.ok) {
      await updateTripleWhaleAfterSync({
        workspaceId,
        status: 'api_key_validation_failed',
        lastError: validation.message,
        metadata: {
          version: '0.6.0',
          validationAt: new Date().toISOString(),
          httpStatus: validation.httpStatus,
          responseKind: validation.responseKind,
        },
      });
      throw new AppError(400, 'TRIPLE_WHALE_API_KEY_VALIDATION_FAILED', validation.message);
    }

    const summaryProbe = await fetchTripleWhaleSummaryProbe(apiKey);
    const endedAt = new Date();

    if (!summaryProbe.attempted) {
      await updateTripleWhaleAfterSync({
        workspaceId,
        status: 'summary_probe_not_configured',
        lastError: summaryProbe.message,
        metadata: {
          version: '0.6.0',
          summaryProbeAt: endedAt.toISOString(),
          summaryProbeConfigured: false,
        },
      });

      await recordTripleWhaleSyncEvent({
        workspaceId,
        eventType: 'triple_whale_summary_probe_not_configured',
        severity: 'warning',
        message: summaryProbe.message,
        metadata: { userId, version: '0.6.0' },
      });

      throw new AppError(400, 'TRIPLE_WHALE_SUMMARY_PROBE_NOT_CONFIGURED', summaryProbe.message);
    }

    const rawPayload: Record<string, unknown> = {
      source: 'triple_whale_summary_probe_raw_capture',
      requestedAt: startedAt.toISOString(),
      keyHint,
      validation: {
        httpStatus: validation.httpStatus,
        responseKind: validation.responseKind,
        preview: redactSensitiveData(validation.responsePreview),
      },
      summaryProbe: {
        httpStatus: summaryProbe.httpStatus,
        responseKind: summaryProbe.responseKind,
        contentType: summaryProbe.contentType,
        message: summaryProbe.message,
        ok: summaryProbe.ok,
        attempts: summaryProbe.attempts,
      },
      request: {
        mode: summaryProbe.requestMode,
        dateRange: summaryProbe.dateRange,
        body: summaryProbe.requestBody,
        note: 'Request body stored for developer review. It contains no API key.',
      },
      payload: summaryProbe.rawPayload || { preview: summaryProbe.responsePreview },
      note: 'v0.5.2 raw capture using captured Triple Whale Summary payload builder. Review this response before finalizing normalized dashboard field mapping.',
    };

    const normalizedMetrics = summaryProbe.ok && summaryProbe.rawPayload
      ? normalizeTripleWhaleSummaryPayload(summaryProbe.rawPayload, summaryProbe.dateRange || 'triple_whale_summary_probe_raw_capture')
      : normalizeTripleWhaleSkeletonPayload(buildTripleWhaleSkeletonRawPayload({
          keyHint,
          requestedAt: startedAt.toISOString(),
          dateRange: 'summary_probe_error_raw_capture',
          validation: {
            httpStatus: validation.httpStatus,
            responseKind: validation.responseKind,
            preview: redactSensitiveData(validation.responsePreview),
            summaryProbeHttpStatus: summaryProbe.httpStatus,
            summaryProbeMessage: summaryProbe.message,
          },
        }));

    const snapshot = await insertMetricsSnapshot({
      workspaceId,
      provider: 'triple_whale',
      dateRange: summaryProbe.ok ? (summaryProbe.dateRange || 'triple_whale_summary_probe_raw_capture') : 'summary_probe_error_raw_capture',
      rawPayload,
      normalizedMetrics,
      sourceStartedAt: startedAt,
      sourceEndedAt: endedAt,
    });

    await updateTripleWhaleAfterSync({
      workspaceId,
      status: summaryProbe.ok ? 'summary_probe_raw_snapshot_stored' : 'summary_probe_error_snapshot_stored',
      lastError: summaryProbe.ok ? null : summaryProbe.message,
      metadata: {
        version: '0.6.0',
        lastSummaryProbeAt: endedAt.toISOString(),
        lastSnapshotId: snapshot.id,
        summaryProbeHttpStatus: summaryProbe.httpStatus,
        summaryProbeOk: summaryProbe.ok,
        summaryProbeRequestMode: summaryProbe.requestMode,
        summaryProbeDateRange: summaryProbe.dateRange,
        summaryProbeAttempts: summaryProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
      },
    });

    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: summaryProbe.ok ? 'triple_whale_summary_probe_raw_snapshot_stored' : 'triple_whale_summary_probe_error_snapshot_stored',
      severity: summaryProbe.ok ? 'info' : 'warning',
      message: summaryProbe.ok
        ? 'Live Triple Whale Summary probe raw response was stored for mapping review.'
        : 'Triple Whale Summary probe returned an error response; bounded raw diagnostics were stored for review.',
      metadata: {
        userId,
        snapshotId: snapshot.id,
        version: '0.6.0',
        httpStatus: summaryProbe.httpStatus,
        requestMode: summaryProbe.requestMode,
        dateRange: summaryProbe.dateRange,
        attempts: summaryProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
      },
    });

    return {
      success: true,
      mode: 'summary_probe',
      verification: 'summary_probe_attempted',
      message: summaryProbe.ok
        ? 'Triple Whale Summary API probe completed using the captured Summary payload shape and raw response was stored. Review mapping preview before production use.'
        : 'Triple Whale Summary API probe returned an error; diagnostic snapshot was stored for request/body adjustment.',
      snapshotId: snapshot.id,
      dateRange: summaryProbe.ok ? (summaryProbe.dateRange || 'triple_whale_summary_probe_raw_capture') : 'summary_probe_error_raw_capture',
      provider: 'triple_whale',
      normalizedMetrics: {
        ...normalizedMetrics,
        snapshotId: snapshot.id,
        provider: 'triple_whale',
        lastSyncedAt: snapshot.created_at.toISOString(),
      },
      rawPayloadPreview: {
        source: rawPayload.source,
        keyHint,
        summaryProbeHttpStatus: summaryProbe.httpStatus,
        summaryProbeResponseKind: summaryProbe.responseKind,
        requestMode: summaryProbe.requestMode,
        summaryDateRange: summaryProbe.dateRange,
        attempts: summaryProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
        note: 'Full raw payload is stored in metrics_snapshots.raw_payload. Use Latest Raw Response to inspect a bounded preview.',
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Triple Whale Summary probe failed.';
    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: 'triple_whale_summary_probe_failed',
      severity: 'error',
      message,
      metadata: { userId, version: '0.6.0' },
    });
    throw new AppError(500, 'TRIPLE_WHALE_SUMMARY_PROBE_FAILED', message);
  }
}


export async function probeTripleWhaleAttribution(workspaceId: string, userId: string): Promise<TripleWhaleSyncResult> {
  assertDatabaseReady();

  const { apiKey, keyHint } = await getDecryptedTripleWhaleKey(workspaceId);

  await recordTripleWhaleSyncEvent({
    workspaceId,
    eventType: 'triple_whale_attribution_probe_started',
    message: 'Manual Triple Whale Pixel/Attribution API probe started. This captures diagnostics only and does not update dashboard attribution.',
    metadata: { userId, version: '0.5.2', mode: 'attribution_pixel_probe_raw_capture' },
  });

  const startedAt = new Date();

  try {
    const validation = await validateTripleWhaleApiKey(apiKey);
    if (!validation.ok) {
      await updateTripleWhaleAfterSync({
        workspaceId,
        status: 'api_key_validation_failed',
        lastError: validation.message,
        metadata: {
          version: '0.5.2',
          validationAt: new Date().toISOString(),
          httpStatus: validation.httpStatus,
          responseKind: validation.responseKind,
        },
      });
      throw new AppError(400, 'TRIPLE_WHALE_API_KEY_VALIDATION_FAILED', validation.message);
    }

    const attributionProbe = await fetchTripleWhaleAttributionProbe(apiKey);
    const endedAt = new Date();

    if (!attributionProbe.attempted) {
      await recordTripleWhaleSyncEvent({
        workspaceId,
        eventType: 'triple_whale_attribution_probe_not_configured',
        severity: 'warning',
        message: attributionProbe.message,
        metadata: { userId, version: '0.5.2' },
      });
      throw new AppError(400, 'TRIPLE_WHALE_ATTRIBUTION_PROBE_NOT_CONFIGURED', attributionProbe.message);
    }

    const dateRange = attributionProbe.ok ? (attributionProbe.dateRange || 'triple_whale_attribution_probe_raw_capture') : 'attribution_probe_error_raw_capture';
    const rawPayload: Record<string, unknown> = {
      source: attributionProbe.ok ? 'triple_whale_attribution_probe_raw_capture' : 'triple_whale_attribution_probe_error',
      requestedAt: startedAt.toISOString(),
      keyHint,
      validation: {
        httpStatus: validation.httpStatus,
        responseKind: validation.responseKind,
        preview: redactSensitiveData(validation.responsePreview),
      },
      attributionProbe: {
        httpStatus: attributionProbe.httpStatus,
        responseKind: attributionProbe.responseKind,
        contentType: attributionProbe.contentType,
        message: attributionProbe.message,
        ok: attributionProbe.ok,
        attempts: attributionProbe.attempts,
      },
      request: {
        mode: attributionProbe.requestMode,
        dateRange: attributionProbe.dateRange,
        body: attributionProbe.requestBody,
        note: 'Request body stored for developer review. It contains no API key. Journey data is excluded by default for safer diagnostics.',
      },
      payload: attributionProbe.rawPayload || { preview: attributionProbe.responsePreview },
      note: 'v0.5.2 raw capture using the Triple Whale customer journey attribution endpoint. Review before mapping; do not treat as dashboard attribution yet.',
    };

    const normalizedMetrics = buildAttributionProbeNormalized(dateRange, attributionProbe.ok, rawPayload, attributionProbe.message);

    const snapshot = await insertMetricsSnapshot({
      workspaceId,
      provider: 'triple_whale_attribution',
      dateRange,
      rawPayload,
      normalizedMetrics,
      sourceStartedAt: startedAt,
      sourceEndedAt: endedAt,
    });

    await updateTripleWhaleAfterSync({
      workspaceId,
      status: attributionProbe.ok ? 'attribution_probe_raw_snapshot_stored' : 'attribution_probe_error_snapshot_stored',
      lastError: attributionProbe.ok ? null : attributionProbe.message,
      metadata: {
        version: '0.5.2',
        lastAttributionProbeAt: endedAt.toISOString(),
        lastAttributionSnapshotId: snapshot.id,
        attributionProbeHttpStatus: attributionProbe.httpStatus,
        attributionProbeOk: attributionProbe.ok,
        attributionProbeRequestMode: attributionProbe.requestMode,
        attributionProbeDateRange: attributionProbe.dateRange,
      },
    });

    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: attributionProbe.ok ? 'triple_whale_attribution_probe_raw_snapshot_stored' : 'triple_whale_attribution_probe_error_snapshot_stored',
      severity: attributionProbe.ok ? 'info' : 'warning',
      message: attributionProbe.ok
        ? 'Triple Whale Pixel/Attribution raw response was stored for mapping review. Dashboard attribution remains disabled until confirmed.'
        : 'Triple Whale Pixel/Attribution probe returned an error response; bounded diagnostics were stored for review.',
      metadata: {
        userId,
        snapshotId: snapshot.id,
        version: '0.5.2',
        httpStatus: attributionProbe.httpStatus,
        requestMode: attributionProbe.requestMode,
        dateRange: attributionProbe.dateRange,
      },
    });

    return {
      success: true,
      mode: 'summary_probe',
      verification: 'summary_probe_attempted',
      message: attributionProbe.ok
        ? 'Triple Whale Pixel/Attribution probe completed and raw response was stored. Attribution mapping remains disabled until exact fields are confirmed.'
        : 'Triple Whale Pixel/Attribution probe returned an error; diagnostic snapshot was stored for request/body adjustment.',
      snapshotId: snapshot.id,
      dateRange,
      provider: 'triple_whale',
      normalizedMetrics: {
        ...normalizedMetrics,
        snapshotId: snapshot.id,
        provider: 'triple_whale_attribution',
        lastSyncedAt: snapshot.created_at.toISOString(),
      },
      rawPayloadPreview: {
        source: rawPayload.source,
        keyHint,
        attributionProbeHttpStatus: attributionProbe.httpStatus,
        attributionProbeResponseKind: attributionProbe.responseKind,
        requestMode: attributionProbe.requestMode,
        attributionDateRange: attributionProbe.dateRange,
        attempts: attributionProbe.attempts?.map((attempt) => ({ mode: attempt.mode, ok: attempt.ok, httpStatus: attempt.httpStatus })),
        note: 'Full raw payload is stored in metrics_snapshots.raw_payload under provider triple_whale_attribution. Browser previews are redacted.',
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Triple Whale Pixel/Attribution probe failed.';
    await recordTripleWhaleSyncEvent({
      workspaceId,
      eventType: 'triple_whale_attribution_probe_failed',
      severity: 'error',
      message,
      metadata: { userId, version: '0.5.2' },
    });
    throw new AppError(500, 'TRIPLE_WHALE_ATTRIBUTION_PROBE_FAILED', message);
  }
}
