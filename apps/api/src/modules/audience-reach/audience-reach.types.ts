import type { NormalizedMetrics } from '../metrics/metrics.types.js';

export type AudienceReachSourceStatus =
  | 'derived_from_verified_triple_whale_core_metrics'
  | 'derived_from_pending_metrics_snapshot'
  | 'safe_fallback_metrics';

export type AudienceReachMetric = {
  key: 'customers' | 'estimatedReach' | 'activeChannels' | 'engagementRate' | 'activePlatformConversion';
  label: string;
  value: number | null;
  displayValue: string;
  source: string;
  status: 'live' | 'derived' | 'needs_mapping' | 'awaiting_data' | 'fallback';
  guidance: string;
};

export type AudienceReachReport = {
  version: string;
  healthMode: string;
  module: 'audience_reach';
  title: string;
  statusLabel: 'LIVE' | 'DERIVED' | 'SAFE' | 'PENDING';
  sourceStatus: AudienceReachSourceStatus;
  sourceLabel: string;
  dateRange: string;
  lastSyncedAt: string;
  dataSource: string;
  metricsProductionReady: boolean;
  socialAudienceConnectorEnabled: false;
  metrics: {
    customers: AudienceReachMetric;
    estimatedReach: AudienceReachMetric;
    activeChannels: AudienceReachMetric;
    activePlatformConversion: AudienceReachMetric;
    engagementRate: AudienceReachMetric;
  };
  mapSignal: {
    intensity: number;
    activeRegions: number;
    channelCount: number;
    orderSignal: number;
  };
  notes: string[];
  realValueRequirements: { key: string; label: string; requirement: string; status: 'ready' | 'needs_mapping' | 'future_connector'; }[];
  safety: {
    noSocialConnectorCall: true;
    noExternalWrite: true;
    noActionCreated: true;
    noExecutorCalled: true;
    derivedFromReadOnlyMetrics: true;
    activePlatformConversionOnly: true;
    blocksZeroConversionReachMath: true;
    sessionsReachSourceOnlyWhenMapped: true;
  };
  rawMetricSummary: Pick<NormalizedMetrics, 'revenue' | 'orders' | 'aov' | 'adSpend' | 'roas' | 'conversionRate' | 'conversionRateProductionReady' | 'sessions' | 'sessionsProductionReady' | 'reachEstimate' | 'reachEstimateProductionReady' | 'coreMetricsProductionReady' | 'productionReady' | 'sourceStatus' | 'platformConversionValue' | 'platformConversionSources' | 'platformConversionProductionReady'>;
};

export type AudienceReachStatus = {
  version: string;
  healthMode: string;
  module: 'audience_reach';
  frontendWidget: 'homepage_audience_reach';
  functionalByApi: true;
  socialAudienceConnectorEnabled: false;
  safety: AudienceReachReport['safety'];
  realValueRequirements: AudienceReachReport['realValueRequirements'];
};
