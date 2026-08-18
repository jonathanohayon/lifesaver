import { env } from '../../config/env.js';
import type { NormalizedMetrics, MetricsSnapshotRow } from './metrics.types.js';
import { getLatestMetricsSnapshot } from './metrics.repository.js';
import { refreshTripleWhaleMetrics } from '../triple-whale/triple-whale.service.js';

const autoRefreshThrottle = new Map<string, number>();

export function getMockMetrics(): NormalizedMetrics {
  return {
    dateRange: 'mock_today',
    revenue: 9068,
    orders: 142,
    aov: 63.86,
    adSpend: 3210,
    roas: 3.4,
    conversionRate: 2.8,
    attribution: {
      meta: 4200,
      google: 2800,
      tiktok: 900,
      email: 1168,
    },
    lastSyncedAt: new Date().toISOString(),
    source: 'mock',
    sourceNote: 'Fallback demo metrics. This is used only when no database metrics snapshot exists.',
    sourceStatus: 'mock_fallback',
    productionReady: false,
    coreMetricsProductionReady: false,
    attributionProductionReady: false,
    conversionRateProductionReady: false,
  sessions: 0,
  sessionsProductionReady: false,
  reachEstimate: 0,
  reachEstimateProductionReady: false,
  };
}

function snapshotAgeMinutes(snapshot: MetricsSnapshotRow): number {
  return Math.max(0, (Date.now() - snapshot.created_at.getTime()) / 60000);
}

function isSnapshotStale(snapshot: MetricsSnapshotRow | null): boolean {
  if (!snapshot) return true;
  const staleAfter = Math.max(1, Number(env.METRICS_AUTO_REFRESH_STALE_MINUTES || 30));
  return snapshotAgeMinutes(snapshot) >= staleAfter;
}


type MetricCatalogEntry = {
  id?: string | null;
  metricId?: string | null;
  title?: string | null;
  current?: number | string | null;
  path?: string | null;
};

const ACTIVE_PLATFORM_ALIASES: Record<string, string[]> = {
  meta: ['facebookWebConversionValue', 'facebookConversionValue', 'facebookMetaConversionValue', 'Facebook Web Conversion Value', 'Facebook Conversion Value', 'Facebook Meta Conversion Value'],
  snapchat: ['snapchatConversionValue', 'totalSnapchatConversionPurchasesValue', 'Snapchat Conversion Value'],
  google: ['googleConversionValue', 'ga_all_transactionsRevenue_adGroup', 'Google Conversion Value', 'Google All Conversions Value'],
  tiktok: ['tiktokConversionValueWOshops', 'tiktokWebConversionsValue', 'tiktokConversionValue', 'tiktokShopConversionsValue', 'TikTok Conversion Value W/O TikTok Shop', 'TikTok Web Conversion Value', 'TikTok Conversion Value', 'TikTok Shop Conversion Value'],
};

const ACTIVE_PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  snapchat: 'Snapchat',
  google: 'Google',
  tiktok: 'TikTok',
};


const TRAFFIC_SESSION_ALIASES = [
  'sessions', 'Sessions', 'totalSessions', 'gaSessions', 'websiteSessions', 'onlineStoreSessions',
  'shopifySessions', 'storeSessions', 'siteSessions', 'trafficSessions', 'visitors', 'uniqueVisitors',
  'users', 'activeUsers', 'Website Sessions', 'Online Store Sessions', 'Store Sessions', 'Visitors', 'Users'
];

function normalizeMetricKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function metricCatalogNumber(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[$,%x,]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function metricCatalogEntries(metrics: NormalizedMetrics): MetricCatalogEntry[] {
  const mapping = (metrics.mapping || {}) as any;
  return Array.isArray(mapping.metricCatalog) ? mapping.metricCatalog : [];
}

function findMetricCatalogValue(catalog: MetricCatalogEntry[], aliases: string[], guard?: (entry: MetricCatalogEntry) => boolean): number {
  for (const alias of aliases) {
    const needle = normalizeMetricKey(alias);
    const hit = catalog.find((entry) => (!guard || guard(entry)) && [entry.id, entry.metricId, entry.title]
      .filter(Boolean)
      .some((value) => normalizeMetricKey(String(value)) === needle));
    if (hit) return metricCatalogNumber(hit.current);
  }
  return 0;
}

function isSessionCatalogEntry(entry: MetricCatalogEntry): boolean {
  const text = [entry.id, entry.metricId, entry.title].filter(Boolean).map(String).join(' ');
  const normalized = normalizeMetricKey(text);
  if (!metricCatalogNumber(entry.current)) return false;
  const dangerous = ['conversionrate', 'cvr', 'transactionspersession', 'persession', 'rate', 'percent', 'percentage', 'conversionvalue', 'revenue', 'sales', 'spend', 'cost', 'roas'];
  if (dangerous.some(term => normalized.includes(term))) return false;
  const exactSessionKeys = TRAFFIC_SESSION_ALIASES.map(normalizeMetricKey);
  const entryKeys = [entry.id, entry.metricId, entry.title].filter(Boolean).map(value => normalizeMetricKey(String(value)));
  return entryKeys.some(key => exactSessionKeys.includes(key)) || ['session', 'sessions', 'visitor', 'visitors', 'users', 'traffic'].some(term => normalized.includes(term));
}

function hydratePlatformConversionFromMapping(metrics: NormalizedMetrics): Pick<NormalizedMetrics, 'attribution' | 'platformConversionValue' | 'platformConversionSources' | 'platformConversionLabel' | 'platformConversionProductionReady' | 'platformConversionNote'> {
  const catalog = metricCatalogEntries(metrics);
  const currentAttribution = metrics.attribution || {};
  const attribution: Record<string, number> = { ...currentAttribution };
  const sources: string[] = [];
  let total = 0;

  for (const [key, aliases] of Object.entries(ACTIVE_PLATFORM_ALIASES)) {
    const existingValue = metricCatalogNumber(currentAttribution[key]);
    const catalogValue = findMetricCatalogValue(catalog, aliases);
    const value = Math.max(0, existingValue > 0 ? existingValue : catalogValue);
    attribution[key] = Number(value.toFixed(2));
    if (value > 0) {
      total += value;
      sources.push(ACTIVE_PLATFORM_LABELS[key] || key);
    }
  }

  if (!sources.length) {
    return {
      attribution,
      platformConversionValue: 0,
      platformConversionSources: [],
      platformConversionLabel: '',
      platformConversionProductionReady: false,
      platformConversionNote: 'No non-zero active platform conversion value fields were found in the latest metrics snapshot.',
    };
  }

  return {
    attribution,
    platformConversionValue: Number(total.toFixed(2)),
    platformConversionSources: sources,
    platformConversionLabel: sources.join(' + '),
    platformConversionProductionReady: true,
    platformConversionNote: 'Active platform conversion value is summed from non-zero Triple Whale platform conversion fields. Inactive/zero platforms are ignored and will auto-include once they return real values.',
  };
}


function hydrateTrafficFromMapping(metrics: NormalizedMetrics): Pick<NormalizedMetrics, 'conversionRate' | 'conversionRateProductionReady' | 'conversionRateStatus' | 'conversionRateNote' | 'sessions' | 'sessionsSourceLabel' | 'sessionsProductionReady' | 'sessionsNote' | 'reachEstimate' | 'reachEstimateProductionReady' | 'reachEstimateSource' | 'reachEstimateNote'> {
  const catalog = metricCatalogEntries(metrics);
  const existingSessions = metricCatalogNumber((metrics as any).sessions);
  const catalogSessions = findMetricCatalogValue(catalog, TRAFFIC_SESSION_ALIASES, isSessionCatalogEntry);
  const sessions = Math.max(0, Math.round(existingSessions > 0 ? existingSessions : catalogSessions));
  const orders = Math.max(0, Number(metrics.orders || 0));
  const directConversion = metricCatalogNumber(metrics.conversionRate);
  const directReady = Boolean(metrics.conversionRateProductionReady && directConversion > 0);
  const calculatedConversion = sessions > 0 && orders > 0 ? Number(((orders / sessions) * 100).toFixed(2)) : 0;

  if (directReady) {
    return {
      conversionRate: directConversion,
      conversionRateProductionReady: true,
      conversionRateStatus: 'confirmed_direct_metric',
      conversionRateNote: metrics.conversionRateNote || 'Conversion rate is mapped from a non-zero confirmed Triple Whale metric.',
      sessions,
      sessionsSourceLabel: sessions > 0 ? 'Sessions / visitors' : metrics.sessionsSourceLabel,
      sessionsProductionReady: sessions > 0,
      sessionsNote: sessions > 0 ? 'Sessions/visitors are available as the reach source.' : 'Sessions/visitors are not mapped yet; reach can use direct conversion-rate fallback.',
      reachEstimate: sessions > 0 ? sessions : Math.round(orders / (directConversion / 100)),
      reachEstimateProductionReady: true,
      reachEstimateSource: sessions > 0 ? 'sessions_or_visitors_metric' : 'orders_divided_by_direct_conversion_rate',
      reachEstimateNote: sessions > 0 ? 'Reach estimate uses sessions/visitors.' : 'Reach estimate is derived from orders divided by confirmed conversion rate.',
    };
  }

  if (calculatedConversion > 0) {
    return {
      conversionRate: calculatedConversion,
      conversionRateProductionReady: true,
      conversionRateStatus: 'calculated_from_orders_sessions',
      conversionRateNote: 'Conversion rate is calculated from confirmed orders divided by confirmed sessions/visitors because the direct GA conversion-rate metric is 0 or unavailable.',
      sessions,
      sessionsSourceLabel: 'Sessions / visitors',
      sessionsProductionReady: true,
      sessionsNote: 'Sessions/visitors are mapped from the latest Triple Whale metric catalog and used as the safe reach source.',
      reachEstimate: sessions,
      reachEstimateProductionReady: true,
      reachEstimateSource: 'sessions_or_visitors_metric',
      reachEstimateNote: 'Reach estimate uses the confirmed sessions/visitors traffic count.',
    };
  }

  return {
    conversionRate: directConversion,
    conversionRateProductionReady: false,
    conversionRateStatus: metrics.conversionRateStatus || (directConversion === 0 ? 'awaiting_sessions_or_nonzero_conversion' : 'needs_mapping'),
    conversionRateNote: metrics.conversionRateNote || 'Conversion rate awaits non-zero conversion or sessions/visitors mapping.',
    sessions,
    sessionsSourceLabel: sessions > 0 ? 'Sessions / visitors' : metrics.sessionsSourceLabel,
    sessionsProductionReady: sessions > 0,
    sessionsNote: sessions > 0 ? 'Sessions/visitors are mapped, but orders are not available to calculate conversion.' : 'No non-zero sessions/visitors metric is available yet.',
    reachEstimate: sessions > 0 ? sessions : 0,
    reachEstimateProductionReady: sessions > 0,
    reachEstimateSource: sessions > 0 ? 'sessions_or_visitors_metric' : 'sessions_or_conversion_rate_mapping_required',
    reachEstimateNote: sessions > 0 ? 'Reach estimate uses sessions/visitors.' : 'Reach estimate awaits sessions/visitors or non-zero conversion rate.',
  };
}

function canAttemptAutoRefresh(workspaceId: string): boolean {
  const lastAttempt = autoRefreshThrottle.get(workspaceId) || 0;
  const minGapMs = 2 * 60 * 1000;
  if (Date.now() - lastAttempt < minGapMs) return false;
  autoRefreshThrottle.set(workspaceId, Date.now());
  return true;
}

function normalizeSnapshotMetrics(snapshot: MetricsSnapshotRow): NormalizedMetrics {
  const metrics = snapshot.normalized_metrics;
  const mapping = (metrics.mapping || {}) as Record<string, any>;
  const fields = (mapping.fields || {}) as Record<string, any>;
  const paths = [fields.revenue?.path, fields.orders?.path, fields.adSpend?.path, fields.aov?.path, fields.roas?.path, fields.conversionRate?.path]
    .filter(Boolean)
    .map(String);
  const isSamplePlaceholder = String(metrics.source || '').includes('skeleton')
    || String(metrics.sourceStatus || '').includes('placeholder')
    || paths.some(path => path.startsWith('sample.'));

  const coreReady = Boolean(metrics.coreMetricsProductionReady || metrics.productionReady || String(metrics.sourceStatus || '').includes('core_metrics_ready'));

  const platformConversion = hydratePlatformConversionFromMapping(metrics);
  const traffic = hydrateTrafficFromMapping({ ...metrics, ...platformConversion } as NormalizedMetrics);

  return {
    ...metrics,
    ...platformConversion,
    ...traffic,
    dateRange: snapshot.date_range || metrics.dateRange,
    lastSyncedAt: snapshot.created_at.toISOString(),
    source: isSamplePlaceholder ? 'sample_placeholder_not_production' : (metrics.source || 'database_snapshot'),
    sourceStatus: isSamplePlaceholder ? 'sample_placeholder' : (metrics.sourceStatus || metrics.source || 'database_snapshot'),
    productionReady: isSamplePlaceholder ? false : Boolean(coreReady),
    coreMetricsProductionReady: isSamplePlaceholder ? false : Boolean(coreReady),
    attributionProductionReady: Boolean(metrics.attributionProductionReady),
    conversionRateProductionReady: Boolean(traffic.conversionRateProductionReady),
    sourceWarning: isSamplePlaceholder ? 'Latest snapshot uses sample.* placeholder metric paths. It is not production Triple Whale business data yet.' : metrics.sourceWarning,
    snapshotId: snapshot.id,
    provider: snapshot.provider,
  };
}

async function maybeAutoRefreshMetrics(workspaceId?: string, userId?: string): Promise<{ attempted: boolean; ok: boolean; reason: string; error?: string }> {
  if (!workspaceId) return { attempted: false, ok: false, reason: 'no_workspace' };
  if (!env.METRICS_AUTO_REFRESH_ENABLED) return { attempted: false, ok: false, reason: 'disabled_by_env' };
  if (!canAttemptAutoRefresh(workspaceId)) return { attempted: false, ok: false, reason: 'recent_attempt_throttled' };

  try {
    await refreshTripleWhaleMetrics(workspaceId, userId || 'system_auto_refresh');
    return { attempted: true, ok: true, reason: 'stale_or_missing_snapshot_refreshed' };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      reason: 'refresh_failed_safe_fallback_used',
      error: error instanceof Error ? error.message : 'Automatic Triple Whale metrics refresh failed safely.',
    };
  }
}

export async function getLatestMetrics(workspaceId?: string, userId?: string): Promise<NormalizedMetrics> {
  let snapshot = await getLatestMetricsSnapshot(workspaceId);
  let autoRefresh = { attempted: false, ok: false, reason: 'not_needed' } as { attempted: boolean; ok: boolean; reason: string; error?: string };

  if (workspaceId && isSnapshotStale(snapshot)) {
    autoRefresh = await maybeAutoRefreshMetrics(workspaceId, userId);
    if (autoRefresh.ok) {
      snapshot = await getLatestMetricsSnapshot(workspaceId);
    }
  }

  if (!snapshot) {
    return {
      ...getMockMetrics(),
      sourceWarning: autoRefresh.attempted && !autoRefresh.ok
        ? `Automatic read-only Triple Whale refresh could not complete: ${autoRefresh.error || autoRefresh.reason}`
        : 'No database metrics snapshot exists yet. Connect Triple Whale or run the worker/manual refresh.',
      mapping: {
        sourceStatus: 'mock_fallback',
        productionReady: false,
        autoRefresh,
      },
    } as any;
  }

  return {
    ...normalizeSnapshotMetrics(snapshot),
    autoRefresh,
  } as any;
}
