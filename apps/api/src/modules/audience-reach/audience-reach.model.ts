import type { NormalizedMetrics } from '../metrics/metrics.types.js';
import type { AudienceReachMetric, AudienceReachReport, AudienceReachSourceStatus, AudienceReachStatus } from './audience-reach.types.js';

export const AUDIENCE_REACH_VERSION = '0.8.4';
export const AUDIENCE_REACH_HEALTH_MODE = 'v2-functional-0-8-4-conversion-reach-source';

export const AUDIENCE_REACH_SAFETY = Object.freeze({
  noSocialConnectorCall: true,
  noExternalWrite: true,
  noActionCreated: true,
  noExecutorCalled: true,
  derivedFromReadOnlyMetrics: true,
  activePlatformConversionOnly: true,
  blocksZeroConversionReachMath: true,
  sessionsReachSourceOnlyWhenMapped: true,
});

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isCoreLive(metrics: NormalizedMetrics): boolean {
  return Boolean(metrics.coreMetricsProductionReady || metrics.productionReady || String(metrics.sourceStatus || '').includes('core_metrics_ready'));
}

function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Needs Mapping';
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (abs >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Needs Mapping';
  return `${value.toFixed(1)}%`;
}


function conversionMetricDetected(metrics: NormalizedMetrics): boolean {
  const mapping = (metrics.mapping || {}) as any;
  return Boolean(
    Number(metrics.conversionRate || 0) > 0
    || String(metrics.conversionRateStatus || '').includes('pending')
    || mapping?.fields?.conversionRate?.status === 'triple_whale_metric_array'
    || mapping?.fields?.conversionRate?.path
  );
}

function conversionDisplay(metrics: NormalizedMetrics): { value: number | null; displayValue: string; status: AudienceReachMetric['status']; source: string; guidance: string; requirementStatus: 'ready' | 'needs_mapping' } {
  const value = asNumber(metrics.conversionRate);
  const ready = Boolean(metrics.conversionRateProductionReady && value > 0);
  if (ready) {
    const calculated = String(metrics.conversionRateStatus || '').includes('calculated_from_orders_sessions');
    return {
      value,
      displayValue: formatPercent(value),
      status: calculated ? 'derived' : 'live',
      source: calculated ? 'calculated from orders ÷ sessions' : 'confirmed conversion rate',
      guidance: calculated
        ? 'Calculated from confirmed order count and mapped sessions/visitors because the direct GA conversion-rate metric is 0 or unavailable.'
        : 'Confirmed conversion rate from Triple Whale mapping.',
      requirementStatus: 'ready',
    };
  }
  if (conversionMetricDetected(metrics) && value <= 0) {
    return {
      value: null,
      displayValue: asNumber(metrics.sessions) > 0 ? 'Awaiting Orders' : 'Awaiting Sessions',
      status: 'awaiting_data',
      source: 'conversion-rate metric exists but currently returns 0',
      guidance: 'Triple Whale exposes a conversion-rate metric, but it is currently 0. LIFE.SAVER will calculate from sessions/visitors when a safe traffic source is mapped, and never divides by zero.',
      requirementStatus: 'needs_mapping',
    };
  }
  return {
    value: null,
    displayValue: 'Needs Mapping',
    status: 'needs_mapping',
    source: 'conversion rate or sessions/visitors mapping required before display',
    guidance: 'Needs Triple Whale conversion-rate or sessions/visitors mapping and validation against provider UI/export.',
    requirementStatus: 'needs_mapping',
  };
}

function activeTrafficReach(metrics: NormalizedMetrics): { value: number | null; displayValue: string; status: AudienceReachMetric['status']; source: string; guidance: string; ready: boolean } {
  const sessions = asNumber(metrics.sessions);
  const storedReach = asNumber(metrics.reachEstimate);
  if (metrics.reachEstimateProductionReady && storedReach > 0) {
    const fromSessions = Boolean(metrics.sessionsProductionReady && sessions > 0 && Math.round(storedReach) === Math.round(sessions));
    return {
      value: storedReach,
      displayValue: formatCompact(storedReach),
      status: fromSessions ? 'live' : 'derived',
      source: metrics.reachEstimateSource || (fromSessions ? 'sessions/visitors traffic metric' : 'orders divided by confirmed conversion rate'),
      guidance: metrics.reachEstimateNote || (fromSessions ? 'Reach estimate uses mapped sessions/visitors as the safe traffic source.' : 'Reach estimate is derived from orders ÷ conversion rate.'),
      ready: true,
    };
  }
  if (metrics.sessionsProductionReady && sessions > 0) {
    return {
      value: sessions,
      displayValue: formatCompact(sessions),
      status: 'live',
      source: metrics.sessionsSourceLabel || 'sessions/visitors traffic metric',
      guidance: metrics.sessionsNote || 'Reach estimate uses mapped sessions/visitors as the safe traffic source.',
      ready: true,
    };
  }
  const conversionRate = asNumber(metrics.conversionRate);
  const orders = asNumber(metrics.orders);
  if (metrics.conversionRateProductionReady && conversionRate > 0 && orders > 0) {
    const estimate = Math.round(orders / (conversionRate / 100));
    return {
      value: estimate,
      displayValue: formatCompact(estimate),
      status: 'derived',
      source: 'orders divided by confirmed conversion rate',
      guidance: 'Reach estimate is derived from orders divided by confirmed non-zero conversion rate because direct sessions/visitors are not mapped.',
      ready: true,
    };
  }
  return {
    value: null,
    displayValue: conversionMetricDetected(metrics) ? 'Awaiting Sessions' : 'Needs Mapping',
    status: conversionMetricDetected(metrics) ? 'awaiting_data' : 'needs_mapping',
    source: 'sessions/visitors or non-zero conversion-rate source required',
    guidance: 'Reach estimate waits for sessions/visitors first. If no traffic source exists, it can use orders ÷ confirmed non-zero conversion rate as a fallback.',
    ready: false,
  };
}

function activeChannelCount(metrics: NormalizedMetrics): number {
  const channelSpend = metrics.channelSpend || {};
  const attribution = metrics.attribution || {};
  const channelEntries = Object.values(channelSpend).filter((value) => asNumber(value) > 0);
  if (channelEntries.length) return channelEntries.length;
  return Object.values(attribution).filter((value) => asNumber(value) > 0).length;
}

function metric(key: AudienceReachMetric['key'], label: string, value: number | null, displayValue: string, source: string, status: AudienceReachMetric['status'], guidance: string): AudienceReachMetric {
  return { key, label, value, displayValue, source, status, guidance };
}

function buildRealValueRequirements(conversionReady: boolean, channels: number, conversionDetected = false, reachReady = false, sessionsReady = false) {
  return [
    {
      key: 'conversion_rate',
      label: 'Conversion Rate / Conv.',
      requirement: conversionReady
        ? 'Conversion is production-ready from either a non-zero Triple Whale conversion-rate metric or calculated from confirmed orders ÷ sessions.'
        : (conversionDetected ? 'Triple Whale conversion-rate metric is detected but currently returns 0. Map sessions/visitors or confirm GA/session tracking before showing conversion.' : 'Confirm the correct Triple Whale conversion-rate or sessions/visitors metric/path before showing conversion.'),
      status: conversionReady ? 'ready' as const : 'needs_mapping' as const,
    },
    {
      key: 'reach_estimate',
      label: 'Reach Est.',
      requirement: reachReady
        ? (sessionsReady ? 'Reach estimate is using confirmed sessions/visitors from Triple Whale.' : 'Reach estimate is derived from orders ÷ confirmed non-zero conversion rate because direct sessions were unavailable.')
        : 'Reach estimate waits for a sessions/visitors metric first; it will never use a zero conversion rate.',
      status: reachReady ? 'ready' as const : 'needs_mapping' as const,
    },
    {
      key: 'sessions_visitors',
      label: 'Sessions / Visitors',
      requirement: sessionsReady
        ? 'Sessions/visitors source is mapped and can power Reach Est. directly.'
        : 'Map a non-zero Triple Whale sessions/visitors/traffic metric to make Reach Est. fully live.',
      status: sessionsReady ? 'ready' as const : 'needs_mapping' as const,
    },
    {
      key: 'channel_count',
      label: 'Channels',
      requirement: 'Keep reading non-zero paid-media channel spend / attribution entries from the latest metrics snapshot. A future social connector can replace this with true social audience channels.',
      status: channels > 0 ? 'ready' as const : 'needs_mapping' as const,
    },
    {
      key: 'true_social_reach',
      label: 'True Social Reach / Followers',
      requirement: 'Add a dedicated read-only social audience connector later if the founder wants true followers/impressions/reach instead of ecommerce-derived estimates.',
      status: 'future_connector' as const,
    },
  ];
}

export function buildAudienceReachFromMetrics(metrics: NormalizedMetrics): AudienceReachReport {
  const coreLive = isCoreLive(metrics);
  const conversion = conversionDisplay(metrics);
  const conversionReady = conversion.requirementStatus === 'ready';
  const detectedConversionMetric = conversionMetricDetected(metrics);
  const reach = activeTrafficReach(metrics);
  const reachReady = reach.ready;
  const sessionsReady = Boolean(metrics.sessionsProductionReady && asNumber(metrics.sessions) > 0);
  const orders = Math.max(0, Math.round(asNumber(metrics.orders)));
  const channels = activeChannelCount(metrics);
  const sourceStatus: AudienceReachSourceStatus = coreLive
    ? 'derived_from_verified_triple_whale_core_metrics'
    : metrics.sourceStatus && metrics.sourceStatus !== 'mock_fallback'
      ? 'derived_from_pending_metrics_snapshot'
      : 'safe_fallback_metrics';
  const statusLabel: AudienceReachReport['statusLabel'] = coreLive
    ? (conversionReady && reachReady ? 'LIVE' : 'DERIVED')
    : (sourceStatus === 'safe_fallback_metrics' ? 'SAFE' : 'PENDING');

  const orderSignal = Math.min(100, Math.round((orders / Math.max(1, orders + 50)) * 100));
  const intensity = Math.min(100, Math.max(15, orderSignal + Math.min(20, channels * 4)));
  const activeRegions = Math.max(1, Math.min(6, channels || (orders > 0 ? 2 : 1)));

  return {
    version: AUDIENCE_REACH_VERSION,
    healthMode: AUDIENCE_REACH_HEALTH_MODE,
    module: 'audience_reach',
    title: 'Audience Reach',
    statusLabel,
    sourceStatus,
    sourceLabel: coreLive ? (reachReady ? 'Core live · reach source mapped' : (detectedConversionMetric ? 'Core live · awaiting sessions/reach source' : 'Core live · conversion/reach mapping needed')) : 'Awaiting verified audience source',
    dateRange: metrics.dateRange || 'latest_snapshot',
    lastSyncedAt: metrics.lastSyncedAt || new Date().toISOString(),
    dataSource: metrics.provider || metrics.source || 'metrics',
    metricsProductionReady: coreLive,
    socialAudienceConnectorEnabled: false,
    metrics: {
      customers: metric('customers', 'Customers', orders, formatCompact(orders), 'orders from latest metrics snapshot', coreLive ? 'live' : 'fallback', 'Real order count from the latest stored metrics snapshot.'),
      estimatedReach: metric('estimatedReach', 'Reach Est.', reach.value, reach.displayValue, reach.source, reach.status, reach.guidance),
      activePlatformConversion: metric('activePlatformConversion', 'Platform Conv. Value', asNumber(metrics.platformConversionValue) > 0 ? asNumber(metrics.platformConversionValue) : null, asNumber(metrics.platformConversionValue) > 0 ? `$${formatCompact(asNumber(metrics.platformConversionValue))}` : 'Awaiting Data', asNumber(metrics.platformConversionValue) > 0 ? `active sources: ${(metrics.platformConversionSources || []).join(' + ')}` : 'no non-zero platform conversion value yet', asNumber(metrics.platformConversionValue) > 0 ? 'live' : 'awaiting_data', metrics.platformConversionNote || 'Inactive/zero platforms are ignored and will auto-include once they return real values.'),
      activeChannels: metric('activeChannels', 'Channels', channels || null, channels ? String(channels) : 'Awaiting Data', channels ? 'non-zero channel spend/attribution entries' : 'channel source not confirmed yet', channels ? 'derived' : 'awaiting_data', channels ? 'Derived from active paid-media channel entries.' : 'Needs at least one confirmed channel spend/attribution entry.'),
      engagementRate: metric('engagementRate', 'Conv.', conversion.value, conversion.displayValue, conversion.source, conversion.status, conversion.guidance),
    },
    mapSignal: {
      intensity,
      activeRegions,
      channelCount: channels,
      orderSignal,
    },
    notes: [
      'This module is no longer static demo text. It is populated from the LIFE.SAVER read-only metrics API.',
      'True social followers/reach are not claimed because no social audience connector is enabled in this phase.',
      'Active platform conversion value now sums only non-zero platform fields, so inactive Google/TikTok values do not affect totals.',
      sessionsReady
        ? 'Reach estimate now uses mapped sessions/visitors as the safer read-only traffic source.'
        : (reachReady ? 'Reach estimate is derived from orders and confirmed non-zero conversion rate.' : 'Reach estimate awaits sessions/visitors or a confirmed non-zero conversion rate.'),
    ],
    realValueRequirements: buildRealValueRequirements(conversionReady, channels, detectedConversionMetric, reachReady, sessionsReady),
    safety: { ...AUDIENCE_REACH_SAFETY },
    rawMetricSummary: {
      revenue: metrics.revenue,
      orders: metrics.orders,
      aov: metrics.aov,
      adSpend: metrics.adSpend,
      roas: metrics.roas,
      conversionRate: metrics.conversionRate,
      conversionRateProductionReady: metrics.conversionRateProductionReady,
      sessions: metrics.sessions,
      sessionsProductionReady: metrics.sessionsProductionReady,
      reachEstimate: metrics.reachEstimate,
      reachEstimateProductionReady: metrics.reachEstimateProductionReady,
      coreMetricsProductionReady: metrics.coreMetricsProductionReady,
      productionReady: metrics.productionReady,
      sourceStatus: metrics.sourceStatus,
      platformConversionValue: metrics.platformConversionValue,
      platformConversionSources: metrics.platformConversionSources,
      platformConversionProductionReady: metrics.platformConversionProductionReady,
    },
  };
}

export function getAudienceReachStatus(): AudienceReachStatus {
  return {
    version: AUDIENCE_REACH_VERSION,
    healthMode: AUDIENCE_REACH_HEALTH_MODE,
    module: 'audience_reach',
    frontendWidget: 'homepage_audience_reach',
    functionalByApi: true,
    socialAudienceConnectorEnabled: false,
    safety: { ...AUDIENCE_REACH_SAFETY },
    realValueRequirements: buildRealValueRequirements(false, 0, false, false, false),
  };
}
