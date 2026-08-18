import { env } from '../../config/env.js';
import { getMockMetrics } from '../metrics/metrics.service.js';
import { getLatestMetricsSnapshot } from '../metrics/metrics.repository.js';
import type { MetricsSnapshotRow, NormalizedMetrics } from '../metrics/metrics.types.js';
import { getLatestBrief, insertBrief, recordBriefEvent } from './briefs.repository.js';
import type { BriefResponse, BriefRow, WeeklySummaryResponse } from './briefs.types.js';

function money(value: number): string {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function money2(value: number): string {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roas(value: number): string {
  return `${Number(value || 0).toFixed(2)}x`;
}

function percent(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

function isSamplePlaceholder(metrics: NormalizedMetrics): boolean {
  const mapping = (metrics.mapping || {}) as Record<string, any>;
  const fields = (mapping.fields || {}) as Record<string, any>;
  const source = String(metrics.source || '');
  const sourceStatus = String((metrics as any).sourceStatus || '');

  const paths = [
    fields.revenue?.path,
    fields.orders?.path,
    fields.adSpend?.path,
    fields.roas?.path,
    fields.conversionRate?.path,
  ].filter(Boolean).map(String);

  return source.includes('skeleton')
    || sourceStatus.includes('placeholder')
    || paths.some(path => path.startsWith('sample.'));
}

function sourceStatusFor(metrics: NormalizedMetrics): { sourceStatus: string; productionReady: boolean; warning: string | null } {
  if (isSamplePlaceholder(metrics)) {
    return {
      sourceStatus: 'sample_placeholder',
      productionReady: false,
      warning: 'These metrics are sample placeholder values generated after API-key validation. Do not treat them as real Triple Whale business numbers yet.',
    };
  }

  const mapping = (metrics.mapping || {}) as Record<string, any>;
  const confidence = String(mapping.confidence || '').toLowerCase();
  const coreReady = Boolean((metrics as any).coreMetricsProductionReady || mapping.coreMetricsProductionReady || metrics.productionReady);

  if (coreReady) {
    return {
      sourceStatus: String(metrics.sourceStatus || 'live_summary_core_metrics_ready'),
      productionReady: true,
      warning: metrics.sourceWarning || null,
    };
  }

  if (confidence === 'low') {
    return {
      sourceStatus: 'mapping_needs_review',
      productionReady: false,
      warning: 'Triple Whale payload exists, but field mapping confidence is low. Review raw_payload and mapped paths before using this as production truth.',
    };
  }

  return {
    sourceStatus: String(metrics.sourceStatus || 'mapped_metrics_available'),
    productionReady: Boolean(metrics.productionReady),
    warning: metrics.sourceWarning || null,
  };
}

function metricsFromSnapshot(snapshot: MetricsSnapshotRow | null): { metrics: NormalizedMetrics; snapshotId: string | null; workspaceId: string | null } {
  if (!snapshot) {
    const m = getMockMetrics();
    return { metrics: { ...m, sourceStatus: 'mock_fallback', productionReady: false } as any, snapshotId: null, workspaceId: null };
  }

  const sourceInfo = sourceStatusFor(snapshot.normalized_metrics);
  return {
    metrics: {
      ...snapshot.normalized_metrics,
      dateRange: snapshot.date_range || snapshot.normalized_metrics.dateRange,
      lastSyncedAt: snapshot.created_at.toISOString(),
      snapshotId: snapshot.id,
      provider: snapshot.provider,
      sourceStatus: sourceInfo.sourceStatus,
      productionReady: sourceInfo.productionReady,
      sourceWarning: sourceInfo.warning,
    } as any,
    snapshotId: snapshot.id,
    workspaceId: snapshot.workspace_id,
  };
}


function shouldUseStoredBrief(row: BriefRow, snapshotId: string | null, liveMetricsReady: boolean): boolean {
  // v0.3.0: If a live/production-ready metrics snapshot exists, do not let an older
  // sample_placeholder brief override the current dashboard. Stored briefs are used
  // only when they were generated from the current snapshot or when no live metrics
  // are available yet.
  if (!liveMetricsReady) return true;

  const metadata = row.metadata || {};
  const rowReady = Boolean((metadata as any).productionReady);
  const rowStatus = String((metadata as any).sourceStatus || '').toLowerCase();
  const rowFromCurrentSnapshot = Boolean(snapshotId && row.source_snapshot_id === snapshotId);
  const rowIsPlaceholder = rowStatus.includes('placeholder') || rowStatus.includes('mock') || rowStatus.includes('sample');

  if (rowFromCurrentSnapshot && rowReady && !rowIsPlaceholder) return true;
  return false;
}

function dailyContent(metrics: NormalizedMetrics): string {
  const sourceStatus = String((metrics as any).sourceStatus || 'unknown');
  const productionReady = Boolean((metrics as any).productionReady);

  if (!productionReady) {
    return `Good morning. LIFE.SAVER currently has ${money(metrics.revenue)} revenue, ${metrics.orders} orders, ${money(metrics.adSpend)} ad spend, and ${roas(metrics.roas)} ROAS in the stored snapshot, but this snapshot is marked ${sourceStatus}. I would treat it as a pipeline test until the real Triple Whale Summary response is captured and confirmed.`;
  }

  const platformReady = Boolean((metrics as any).platformConversionProductionReady && Number((metrics as any).platformConversionValue || 0) > 0);
  const platformLabel = Array.isArray((metrics as any).platformConversionSources) && (metrics as any).platformConversionSources.length ? (metrics as any).platformConversionSources.join(' + ') : 'active platforms';

  return `Good morning. Verified Triple Whale core metrics show ${money(metrics.revenue)} revenue, ${metrics.orders} orders, ${money2(metrics.aov)} AOV, ${money(metrics.adSpend)} paid-media spend, and ${roas(metrics.roas)} blended ROAS.${platformReady ? ` Active platform conversion value is ${money((metrics as any).platformConversionValue)} from ${platformLabel}.` : ' Active platform conversion value is awaiting non-zero platform data.'} Conversion rate remains separate confirmation work, so I would not estimate reach yet.`;
}

function weeklyContent(metrics: NormalizedMetrics): string {
  const sourceStatus = String((metrics as any).sourceStatus || 'unknown');
  const productionReady = Boolean((metrics as any).productionReady);

  if (!productionReady) {
    return `Weekly summary is available from the latest stored snapshot, but the source is ${sourceStatus}. Revenue, orders, AOV, ad spend, ROAS, conversion, and attribution should remain labelled as non-production until a confirmed Triple Whale Summary API payload is stored.`;
  }

  const platformReady = Boolean((metrics as any).platformConversionProductionReady && Number((metrics as any).platformConversionValue || 0) > 0);
  const platformLabel = Array.isArray((metrics as any).platformConversionSources) && (metrics as any).platformConversionSources.length ? (metrics as any).platformConversionSources.join(' + ') : 'active platforms';

  return `Weekly summary: verified Triple Whale core metrics show ${money(metrics.revenue)} revenue, ${metrics.orders} orders, ${money2(metrics.aov)} AOV, ${money(metrics.adSpend)} paid-media spend, and ${roas(metrics.roas)} blended ROAS.${platformReady ? ` Platform conversion value is ${money((metrics as any).platformConversionValue)} from ${platformLabel}; inactive zero-value platforms are ignored.` : ' Platform conversion value is awaiting active source data.'} Conversion rate/reach remains blocked until non-zero GA/session data is confirmed.`;
}

function briefRowToResponse(row: BriefRow): BriefResponse {
  const metadata = row.metadata || {};
  return {
    type: row.type,
    content: row.content,
    source: 'database',
    sourceSnapshotId: row.source_snapshot_id,
    generatedAt: row.created_at.toISOString(),
    sourceStatus: String(metadata.sourceStatus || 'database_brief'),
    productionReady: Boolean(metadata.productionReady),
    metadata,
  };
}

function fallbackDaily(): BriefResponse {
  const m = getMockMetrics();
  return {
    type: 'daily',
    content: `Good morning. Demo ecommerce metrics show ${money(m.revenue)} revenue, ${m.orders} orders, ${money(m.adSpend)} ad spend, and ${roas(m.roas)} ROAS. This is fallback mock data because no database brief has been generated yet.`,
    source: 'mock',
    sourceSnapshotId: null,
    generatedAt: new Date().toISOString(),
    sourceStatus: 'mock_fallback',
    productionReady: false,
  };
}

function fallbackWeekly(): WeeklySummaryResponse {
  const m = getMockMetrics();
  return {
    type: 'weekly',
    content: 'Weekly demo summary is currently using fallback mock data. Generate a database-backed weekly summary after a metrics snapshot exists.',
    source: 'mock',
    sourceSnapshotId: null,
    generatedAt: new Date().toISOString(),
    sourceStatus: 'mock_fallback',
    productionReady: false,
    metrics: {
      revenue: m.revenue,
      orders: m.orders,
      aov: m.aov,
      adSpend: m.adSpend,
      roas: m.roas,
      conversionRate: m.conversionRate,
    },
  };
}

export async function getLatestDailyBrief(workspaceId?: string, userId?: string): Promise<BriefResponse> {
  const snapshot = await getLatestMetricsSnapshot(workspaceId);
  const { metrics, snapshotId } = metricsFromSnapshot(snapshot);
  const sourceInfo = sourceStatusFor(metrics);
  const latest = await getLatestBrief('daily', workspaceId);

  if (latest && shouldUseStoredBrief(latest, snapshotId, sourceInfo.productionReady)) {
    return briefRowToResponse(latest);
  }

  if (!snapshot) return fallbackDaily();

  if (env.BRIEFS_AUTO_GENERATE_ON_READ && workspaceId) {
    return generateDailyBrief(workspaceId, userId || 'system_auto_brief');
  }

  return {
    type: 'daily',
    content: dailyContent(metrics),
    source: sourceInfo.productionReady ? 'generated_from_live_metrics' : 'generated_from_metrics',
    sourceSnapshotId: snapshotId,
    generatedAt: new Date().toISOString(),
    sourceStatus: sourceInfo.sourceStatus,
    productionReady: sourceInfo.productionReady,
    metadata: {
      generatedLive: true,
      ignoredStoredBrief: Boolean(latest),
      reason: latest ? 'Stored Daily Brief was older/non-production compared with latest live metrics snapshot.' : 'No stored Daily Brief available.',
      metrics: {
        revenue: metrics.revenue,
        orders: metrics.orders,
        aov: metrics.aov,
        adSpend: metrics.adSpend,
        roas: metrics.roas,
        conversionRate: metrics.conversionRate,
      },
      ...sourceInfo,
    },
  };
}

export async function getLatestWeeklySummary(workspaceId?: string, userId?: string): Promise<WeeklySummaryResponse> {
  const snapshot = await getLatestMetricsSnapshot(workspaceId);
  const { metrics, snapshotId } = metricsFromSnapshot(snapshot);
  const sourceInfo = sourceStatusFor(metrics);
  const latest = await getLatestBrief('weekly', workspaceId);

  if (latest && shouldUseStoredBrief(latest, snapshotId, sourceInfo.productionReady)) {
    const storedMetrics = (latest.metadata?.metrics || {}) as WeeklySummaryResponse['metrics'];
    return { ...briefRowToResponse(latest), metrics: storedMetrics } as WeeklySummaryResponse;
  }

  if (!snapshot) return fallbackWeekly();

  if (env.BRIEFS_AUTO_GENERATE_ON_READ && workspaceId) {
    return generateWeeklySummary(workspaceId, userId || 'system_auto_brief');
  }

  const weeklyMetrics = {
    revenue: metrics.revenue,
    orders: metrics.orders,
    aov: metrics.aov,
    adSpend: metrics.adSpend,
    roas: metrics.roas,
    conversionRate: metrics.conversionRate,
  };

  return {
    type: 'weekly',
    content: weeklyContent(metrics),
    source: sourceInfo.productionReady ? 'generated_from_live_metrics' : 'generated_from_metrics',
    sourceSnapshotId: snapshotId,
    generatedAt: new Date().toISOString(),
    sourceStatus: sourceInfo.sourceStatus,
    productionReady: sourceInfo.productionReady,
    metadata: {
      generatedLive: true,
      ignoredStoredBrief: Boolean(latest),
      reason: latest ? 'Stored Weekly Summary was older/non-production compared with latest live metrics snapshot.' : 'No stored Weekly Summary available.',
      metrics: weeklyMetrics,
      ...sourceInfo,
    },
    metrics: weeklyMetrics,
  };
}

export async function generateDailyBrief(workspaceId: string, userId: string): Promise<BriefResponse> {
  const snapshot = await getLatestMetricsSnapshot(workspaceId);
  const { metrics, snapshotId } = metricsFromSnapshot(snapshot);
  const sourceInfo = sourceStatusFor(metrics);
  const content = dailyContent(metrics);

  const row = await insertBrief({
    workspaceId,
    type: 'daily',
    sourceSnapshotId: snapshotId,
    content,
    metadata: {
      version: '0.6.0',
      userId,
      generator: 'template_from_normalized_metrics',
      sourceStatus: sourceInfo.sourceStatus,
      productionReady: sourceInfo.productionReady,
      warning: sourceInfo.warning,
      metrics: {
        revenue: metrics.revenue,
        orders: metrics.orders,
        aov: metrics.aov,
        adSpend: metrics.adSpend,
        roas: metrics.roas,
        conversionRate: metrics.conversionRate,
      },
    },
  });

  await recordBriefEvent({
    workspaceId,
    eventType: 'daily_brief_generated',
    message: `Daily Brief generated from ${sourceInfo.sourceStatus}.`,
    severity: sourceInfo.productionReady ? 'info' : 'warning',
    metadata: { userId, sourceSnapshotId: snapshotId, version: '0.3.0' },
  });

  return briefRowToResponse(row);
}

export async function generateWeeklySummary(workspaceId: string, userId: string): Promise<WeeklySummaryResponse> {
  const snapshot = await getLatestMetricsSnapshot(workspaceId);
  const { metrics, snapshotId } = metricsFromSnapshot(snapshot);
  const sourceInfo = sourceStatusFor(metrics);
  const content = weeklyContent(metrics);
  const weeklyMetrics = {
    revenue: metrics.revenue,
    orders: metrics.orders,
    aov: metrics.aov,
    adSpend: metrics.adSpend,
    roas: metrics.roas,
    conversionRate: metrics.conversionRate,
  };

  const row = await insertBrief({
    workspaceId,
    type: 'weekly',
    sourceSnapshotId: snapshotId,
    content,
    metadata: {
      version: '0.6.0',
      userId,
      generator: 'template_from_normalized_metrics',
      sourceStatus: sourceInfo.sourceStatus,
      productionReady: sourceInfo.productionReady,
      warning: sourceInfo.warning,
      metrics: weeklyMetrics,
    },
  });

  await recordBriefEvent({
    workspaceId,
    eventType: 'weekly_summary_generated',
    message: `Weekly Summary generated from ${sourceInfo.sourceStatus}.`,
    severity: sourceInfo.productionReady ? 'info' : 'warning',
    metadata: { userId, sourceSnapshotId: snapshotId, version: '0.3.0' },
  });

  return { ...briefRowToResponse(row), metrics: weeklyMetrics } as WeeklySummaryResponse;
}
