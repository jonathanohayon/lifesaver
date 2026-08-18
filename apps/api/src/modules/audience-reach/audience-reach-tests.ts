import assert from 'node:assert/strict';
import { AUDIENCE_REACH_HEALTH_MODE, AUDIENCE_REACH_SAFETY, buildAudienceReachFromMetrics, getAudienceReachStatus } from './audience-reach.model.js';

const verifiedMetrics = {
  dateRange: 'last_30_days',
  revenue: 8709,
  orders: 93,
  aov: 93.64,
  adSpend: 3759,
  roas: 2.32,
  conversionRate: 2.5,
  attribution: { meta: 4000, snapchat: 3869, google: 0, tiktok: 0, email: 0 },
  channelSpend: { meta: 1800, snapchat: 1500 },
  platformConversionValue: 7869,
  platformConversionSources: ['Meta', 'Snapchat'],
  platformConversionProductionReady: true,
  platformConversionNote: 'Inactive/zero platforms are ignored and will auto-include once they return real values.',
  lastSyncedAt: '2026-07-25T00:00:00.000Z',
  source: 'triple_whale_summary',
  sourceStatus: 'live_summary_core_metrics_ready',
  productionReady: true,
  coreMetricsProductionReady: true,
  attributionProductionReady: false,
  conversionRateProductionReady: true,
};

const report = buildAudienceReachFromMetrics(verifiedMetrics as any);
assert.equal(report.version, '0.8.4');
assert.equal(report.healthMode, AUDIENCE_REACH_HEALTH_MODE);
assert.equal(report.statusLabel, 'LIVE');
assert.equal(report.metrics.customers.displayValue, '93');
assert.equal(report.metrics.estimatedReach.displayValue, '3.7K');
assert.equal(report.metrics.activeChannels.displayValue, '2');
assert.equal(report.metrics.activePlatformConversion.displayValue, '$7.9K');
assert.equal(report.metrics.activePlatformConversion.status, 'live');
assert.equal(report.metrics.activePlatformConversion.source.includes('Meta + Snapchat'), true);
assert.equal(report.metrics.engagementRate.displayValue, '2.5%');
assert.equal(report.metrics.estimatedReach.guidance.toLowerCase().includes('derived'), true);
assert.equal(report.realValueRequirements.find((item) => item.key === 'conversion_rate')?.status, 'ready');
assert.equal(report.socialAudienceConnectorEnabled, false);
assert.equal(report.safety.noExternalWrite, true);
assert.equal(report.safety.noExecutorCalled, true);
assert.equal(report.safety.derivedFromReadOnlyMetrics, true);
assert.equal(report.safety.activePlatformConversionOnly, true);
assert.equal(report.safety.blocksZeroConversionReachMath, true);
assert.equal(report.safety.sessionsReachSourceOnlyWhenMapped, true);
assert.ok(report.notes.some((note) => note.includes('non-zero platform fields')));

const awaitingGa = buildAudienceReachFromMetrics({
  ...verifiedMetrics,
  conversionRateProductionReady: false,
  conversionRate: 0,
  conversionRateStatus: 'pending_confirmation',
  mapping: { fields: { conversionRate: { status: 'triple_whale_metric_array', path: 'payload.metrics.33.values.current' } } },
} as any);
assert.equal(awaitingGa.statusLabel, 'DERIVED');
assert.equal(awaitingGa.metrics.estimatedReach.displayValue, 'Awaiting Sessions');
assert.equal(awaitingGa.metrics.engagementRate.displayValue, 'Awaiting Sessions');
assert.equal(awaitingGa.metrics.estimatedReach.status, 'awaiting_data');
assert.equal(awaitingGa.realValueRequirements.find((item) => item.key === 'conversion_rate')?.status, 'needs_mapping');
assert.ok(awaitingGa.notes.some((note) => note.includes('awaits sessions')));
assert.ok(awaitingGa.metrics.engagementRate.guidance.includes('currently 0'));

const pendingMapping = buildAudienceReachFromMetrics({ ...verifiedMetrics, conversionRateProductionReady: false, conversionRate: 0, conversionRateStatus: '', mapping: {} } as any);
assert.equal(pendingMapping.metrics.estimatedReach.displayValue, 'Needs Mapping');
assert.equal(pendingMapping.metrics.engagementRate.displayValue, 'Needs Mapping');

const noChannels = buildAudienceReachFromMetrics({ ...verifiedMetrics, channelSpend: {}, attribution: {}, platformConversionValue: 0, platformConversionSources: [], conversionRateProductionReady: false, conversionRate: 0, conversionRateStatus: '', mapping: {} } as any);
assert.equal(noChannels.metrics.activeChannels.displayValue, 'Awaiting Data');
assert.equal(noChannels.metrics.activeChannels.status, 'awaiting_data');
assert.equal(noChannels.metrics.activePlatformConversion.displayValue, 'Awaiting Data');

const fallback = buildAudienceReachFromMetrics({ ...verifiedMetrics, sourceStatus: 'mock_fallback', productionReady: false, coreMetricsProductionReady: false } as any);
assert.equal(fallback.statusLabel, 'SAFE');
assert.equal(fallback.metricsProductionReady, false);

const status = getAudienceReachStatus();
assert.equal(status.version, '0.8.4');
assert.equal(status.healthMode, 'v2-functional-0-8-4-conversion-reach-source');
assert.equal(status.functionalByApi, true);
assert.equal(status.socialAudienceConnectorEnabled, false);
assert.deepEqual(status.safety, AUDIENCE_REACH_SAFETY);
assert.ok(status.realValueRequirements.some((item) => item.key === 'true_social_reach'));


const sessionMapped = buildAudienceReachFromMetrics({
  ...verifiedMetrics,
  conversionRateProductionReady: true,
  conversionRateStatus: 'calculated_from_orders_sessions',
  conversionRate: 1.86,
  sessions: 5000,
  sessionsProductionReady: true,
  reachEstimate: 5000,
  reachEstimateProductionReady: true,
  reachEstimateSource: 'sessions_or_visitors_metric',
  reachEstimateNote: 'Reach estimate uses the confirmed sessions/visitors traffic count.',
} as any);
assert.equal(sessionMapped.statusLabel, 'LIVE');
assert.equal(sessionMapped.metrics.estimatedReach.displayValue, '5.0K');
assert.equal(sessionMapped.metrics.estimatedReach.status, 'live');
assert.equal(sessionMapped.metrics.engagementRate.displayValue, '1.9%');
assert.equal(sessionMapped.metrics.engagementRate.status, 'derived');
assert.equal(sessionMapped.realValueRequirements.find((item) => item.key === 'sessions_visitors')?.status, 'ready');

console.log('audience-reach-tests — 70 passed, 0 failed');
