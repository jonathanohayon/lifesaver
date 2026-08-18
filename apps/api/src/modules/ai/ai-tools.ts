import type { NormalizedMetrics } from '../metrics/metrics.types.js';

function money(value: unknown): string {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(num);
}

function roas(value: unknown): string {
  const num = Number(value || 0);
  return `${num.toFixed(2)}x`;
}

function percent(value: unknown): string {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

export function buildBusinessMetricsContext(metrics: NormalizedMetrics): string {
  const isCoreReady = Boolean(metrics.coreMetricsProductionReady || metrics.productionReady);
  const attributionReady = Boolean(metrics.attributionProductionReady);
  const conversionReady = Boolean(metrics.conversionRateProductionReady);
  const channelSpend = metrics.channelSpend || {};

  return JSON.stringify({
    source: metrics.source,
    sourceStatus: metrics.sourceStatus,
    productionReady: Boolean(metrics.productionReady),
    coreMetricsProductionReady: isCoreReady,
    attributionProductionReady: attributionReady,
    conversionRateProductionReady: conversionReady,
    snapshotId: metrics.snapshotId || null,
    provider: metrics.provider || null,
    dateRange: metrics.dateRange,
    lastSyncedAt: metrics.lastSyncedAt,
    verifiedCoreMetrics: {
      revenue: { value: metrics.revenue, formatted: money(metrics.revenue) },
      orders: metrics.orders,
      aov: { value: metrics.aov, formatted: money(metrics.aov) },
      paidMediaSpend: { value: metrics.adSpend, formatted: money(metrics.adSpend) },
      blendedRoas: { value: metrics.roas, formatted: roas(metrics.roas) },
    },
    optionalMetrics: {
      conversionRate: conversionReady ? { value: metrics.conversionRate, formatted: percent(metrics.conversionRate) } : 'not_confirmed',
      attributionRevenue: attributionReady ? metrics.attribution : 'not_confirmed',
    },
    channelSpend,
    notes: {
      sourceNote: metrics.sourceNote || null,
      sourceWarning: metrics.sourceWarning || null,
      attributionNote: metrics.attributionNote || 'Attribution revenue is not production-ready unless explicitly confirmed.',
      v1Safety: 'Read + advise + draft only. No external actions.'
    }
  }, null, 2);
}

export function describeSafeToolInventory(): Array<{ name: string; purpose: string; externalAction: false; execution: string }> {
  return [
    {
      name: 'get_business_metrics',
      purpose: 'Reads the latest normalized Triple Whale core metrics from PostgreSQL and returns revenue, orders, AOV, paid-media spend, ROAS, channel spend, source status, and confirmation flags.',
      externalAction: false,
      execution: 'server_side_safe_tool',
    },
    {
      name: 'draft_content',
      purpose: 'Creates a content draft for founder approval only. It does not post, schedule, publish, or send anything.',
      externalAction: false,
      execution: 'server_side_safe_tool_saves_internal_draft_only',
    },
    {
      name: 'draft_support_reply',
      purpose: 'Creates a customer support reply draft for founder approval only. It does not send email, message customers, refund, or modify orders.',
      externalAction: false,
      execution: 'server_side_safe_tool_saves_internal_draft_only',
    },
  ];
}
