import type { NormalizedMetrics } from '../metrics/metrics.types.js';

export type MetricMappingStatus = 'skeleton' | 'best_effort' | 'configured_paths' | 'triple_whale_metric_array' | 'calculated' | 'missing';

type Candidate = { key: string; value: number; path: string };
type FieldMapping = { value: number; path: string | null; status: MetricMappingStatus; aliases: string[]; label?: string | null; previous?: number | null; metricId?: string | null; id?: string | null; title?: string | null; components?: Array<{ id: string | null; metricId: string | null; title: string | null; value: number; previous: number | null; path: string }>; sourceKind?: string | null };

type MappingResult = {
  revenue: FieldMapping;
  orders: FieldMapping;
  aov: FieldMapping;
  adSpend: FieldMapping;
  roas: FieldMapping;
  conversionRate: FieldMapping;
  sessions: FieldMapping;
  attribution: {
    meta: FieldMapping;
    snapchat: FieldMapping;
    google: FieldMapping;
    tiktok: FieldMapping;
    email: FieldMapping;
  };
  platformConversion: FieldMapping;
  confidence: 'high' | 'medium' | 'low';
  missingFields: string[];
  candidateCount: number;
  metricArrayDetected: boolean;
  metricCatalog: Array<{ id: string | null; metricId: string | null; title: string | null; type: string | null; current: number | null; previous: number | null; path: string }>;
};

export function buildTripleWhaleSkeletonRawPayload(params: {
  keyHint: string | null;
  requestedAt: string;
  dateRange: string;
  validation?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    source: 'triple_whale_sync_skeleton',
    verification: 'api_key_validated_no_summary_body',
    requestedAt: params.requestedAt,
    dateRange: params.dateRange,
    keyHint: params.keyHint,
    validation: params.validation || null,
    note: 'This payload is a safe v0.3.0 placeholder. API key validation is live, but real Summary Page fields are mapped only after a confirmed Summary response is captured.',
    sample: {
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
    },
  };
}

export function normalizeTripleWhaleSkeletonPayload(rawPayload: Record<string, unknown>): NormalizedMetrics {
  const sample = (rawPayload.sample || {}) as Record<string, any>;
  const attribution = (sample.attribution || {}) as Record<string, number>;

  return {
    dateRange: String(rawPayload.dateRange || 'mock_today'),
    revenue: Number(sample.revenue || 0),
    orders: Number(sample.orders || 0),
    aov: Number(sample.aov || 0),
    adSpend: Number(sample.adSpend || 0),
    roas: Number(sample.roas || 0),
    conversionRate: Number(sample.conversionRate || 0),
    attribution: {
      meta: Number(attribution.meta || 0),
      google: Number(attribution.google || 0),
      tiktok: Number(attribution.tiktok || 0),
      email: Number(attribution.email || 0),
    },
    lastSyncedAt: new Date().toISOString(),
    source: 'sample_placeholder_not_production',
    sourceStatus: 'sample_placeholder',
    productionReady: false,
    sourceWarning: 'This is a safe sample placeholder snapshot stored after live Triple Whale API-key validation. It is not real Summary Page business data.',
    sourceNote: 'Stored after live Triple Whale API key validation. Summary Page live mapping is still pending a configured/captured Summary response.',
    mapping: {
      confidence: 'low',
      sourceStatus: 'sample_placeholder',
      productionReady: false,
      status: 'skeleton',
      warning: 'These are placeholder values, not live Triple Whale Summary metrics.',
    },
  };
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%x,]/g, '').trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function collectNumericCandidates(value: unknown, path: string[] = [], out: Candidate[] = []): Candidate[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNumericCandidates(item, [...path, String(index)], out));
    return out;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const n = numericValue(child);
      const childPath = [...path, key];
      if (n !== null) out.push({ key, value: n, path: childPath.join('.') });
      collectNumericCandidates(child, childPath, out);
    }
  }

  return out;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let current: any = value;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) current = current[Number(part)];
    else if (typeof current === 'object') current = current[part];
    else return undefined;
  }
  return current;
}

function pathValue(source: unknown, paths: string[]): { value: number; path: string | null } | null {
  for (const path of paths) {
    const n = numericValue(readPath(source, path));
    if (n !== null) return { value: n, path };
  }
  return null;
}

function findMetric(source: unknown, candidates: Candidate[], aliases: string[], configuredPaths: string[] = []): FieldMapping {
  const configured = pathValue(source, configuredPaths);
  if (configured) return { value: configured.value, path: configured.path, status: 'configured_paths', aliases };

  const normalizedAliases = aliases.map(normalizeKey);
  const exact = candidates.find(c => normalizedAliases.includes(normalizeKey(c.key)));
  if (exact) return { value: exact.value, path: exact.path, status: 'best_effort', aliases };

  const pathHit = candidates.find(c => {
    const normalizedPath = normalizeKey(c.path);
    return normalizedAliases.some(alias => normalizedPath.endsWith(alias) || normalizedPath.includes(alias));
  });
  if (pathHit) return { value: pathHit.value, path: pathHit.path, status: 'best_effort', aliases };

  return { value: 0, path: null, status: 'missing', aliases };
}

type TripleWhaleMetric = {
  metric: Record<string, any>;
  path: string;
  id: string | null;
  metricId: string | null;
  title: string | null;
  type: string | null;
  current: number | null;
  previous: number | null;
};

function valueCurrent(metric: Record<string, any>): number | null {
  return numericValue(metric?.values?.current)
    ?? numericValue(metric?.value?.current)
    ?? numericValue(metric?.current)
    ?? numericValue(metric?.value)
    ?? null;
}

function valuePrevious(metric: Record<string, any>): number | null {
  return numericValue(metric?.values?.previous)
    ?? numericValue(metric?.value?.previous)
    ?? numericValue(metric?.previous)
    ?? null;
}

function looksLikeTripleWhaleMetric(item: unknown): item is Record<string, any> {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const obj = item as Record<string, any>;
  return Boolean(
    typeof obj.id === 'string'
    || typeof obj.metricId === 'string'
    || typeof obj.title === 'string'
    || (obj.values && typeof obj.values === 'object' && ('current' in obj.values || 'previous' in obj.values))
  );
}

function collectTripleWhaleMetrics(value: unknown, path: string[] = [], out: TripleWhaleMetric[] = []): TripleWhaleMetric[] {
  if (Array.isArray(value)) {
    const arrayName = path[path.length - 1] || '';
    value.forEach((item, index) => {
      if (looksLikeTripleWhaleMetric(item)) {
        const metric = item as Record<string, any>;
        const current = valueCurrent(metric);
        const previous = valuePrevious(metric);
        const id = typeof metric.id === 'string' ? metric.id : null;
        const metricId = typeof metric.metricId === 'string' ? metric.metricId : null;
        const title = typeof metric.title === 'string' ? metric.title : null;
        const type = typeof metric.type === 'string' ? metric.type : null;
        if (current !== null || previous !== null || normalizeKey(arrayName).includes('metrics')) {
          out.push({ metric, path: [...path, String(index)].join('.'), id, metricId, title, type, current, previous });
        }
      }
      collectTripleWhaleMetrics(item, [...path, String(index)], out);
    });
    return out;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectTripleWhaleMetrics(child, [...path, key], out);
    }
  }

  return out;
}

function metricSearchText(metric: TripleWhaleMetric): string {
  return [metric.id, metric.metricId, metric.title, metric.type].filter(Boolean).map(String).join(' ');
}

function findTripleWhaleMetric(metrics: TripleWhaleMetric[], aliases: string[], requireCurrencyOrNumber = false): FieldMapping {
  const normalizedAliases = aliases.map(normalizeKey);

  const exact = metrics.find(metric => {
    const keys = [metric.id, metric.metricId, metric.title].filter(Boolean).map(value => normalizeKey(String(value)));
    return keys.some(key => normalizedAliases.includes(key));
  });

  const fuzzy = exact || metrics.find(metric => {
    const text = normalizeKey(metricSearchText(metric));
    return normalizedAliases.some(alias => text.includes(alias) || alias.includes(text));
  });

  if (!fuzzy || fuzzy.current === null) return { value: 0, path: null, status: 'missing', aliases };

  if (requireCurrencyOrNumber && fuzzy.type && !['currency', 'number', 'decimal', 'percent', 'percentage'].includes(fuzzy.type)) {
    return { value: 0, path: null, status: 'missing', aliases };
  }

  return {
    value: fuzzy.current,
    previous: fuzzy.previous,
    path: `${fuzzy.path}.values.current`,
    status: 'triple_whale_metric_array',
    aliases,
    label: fuzzy.title,
    metricId: fuzzy.metricId,
    id: fuzzy.id,
    title: fuzzy.title,
  };
}


function exactMetricKey(metric: TripleWhaleMetric): string[] {
  return [metric.id, metric.metricId, metric.title]
    .filter(Boolean)
    .map(value => normalizeKey(String(value)));
}

function findTripleWhaleMetricStrict(metrics: TripleWhaleMetric[], aliases: string[]): FieldMapping {
  const normalizedAliases = aliases.map(normalizeKey);
  const hit = metrics.find(metric => exactMetricKey(metric).some(key => normalizedAliases.includes(key)));
  if (!hit || hit.current === null) return { value: 0, path: null, status: 'missing', aliases };
  return {
    value: hit.current,
    previous: hit.previous,
    path: `${hit.path}.values.current`,
    status: 'triple_whale_metric_array',
    aliases,
    label: hit.title,
    metricId: hit.metricId,
    id: hit.id,
    title: hit.title,
  };
}

const PAID_MEDIA_CHANNEL_ALIASES = [
  'facebookAds', 'fb_ads_spend', 'Facebook Ads',
  'googleAds', 'ga_adCost', 'Google Ads',
  'snapchatAds', 'totalSnapchatSpend', 'Snapchat Ads',
  'tiktokAds', 'tiktok_spend', 'TikTok Ads',
  'twitterAds', 'twitter_spend', 'Twitter Ads', 'X Ads',
  'applovinAds', 'applovin_spend', 'AppLovin Ads', 'Axon by AppLovin',
  'pinterestAds', 'pinterest_spend', 'Pinterest Ads',
  'bingAds', 'microsoftAds', 'microsoft_spend', 'Microsoft Ads'
];

function isPaidMediaSpendMetric(metric: TripleWhaleMetric): boolean {
  if (metric.current === null) return false;
  const id = normalizeKey(metric.id || '');
  const metricId = normalizeKey(metric.metricId || '');
  const title = normalizeKey(metric.title || '');
  const type = normalizeKey(metric.type || '');
  const text = `${id} ${metricId} ${title}`;

  if (type && !['currency', 'decimal', 'number'].includes(type)) return false;

  // v0.3.0: never include benchmark or peer spend in merchant ad spend.
  if (text.includes('benchmark') || text.includes('peer')) return false;

  // Hard excludes prevent false positives such as Cost, Inventory Cost, CPA, CPC, CPM,
  // conversion value, revenue, purchases, clicks, and impressions being treated as ad spend.
  const dangerous = [
    'inventory', 'cogs', 'costper', 'cpa', 'cpc', 'cpm', 'ctr', 'click', 'impression',
    'conversionvalue', 'conversionsvalue', 'purchase', 'purchases', 'roas', 'revenue',
    'sales', 'value', 'customer', 'aov', 'order', 'orders', 'profit', 'margin', 'ltv',
    // v0.3.0: benchmark/peer fields are not this merchant's real ad spend.
    'benchmark', 'benchmarks', 'peer'
  ];
  if (dangerous.some(term => text.includes(term))) {
    // ga_adCost is a true Google ad-cost field even though it contains "cost".
    if (!metricId.includes('adcost')) return false;
  }

  const exactPaidMediaKeys = PAID_MEDIA_CHANNEL_ALIASES.map(normalizeKey);
  if (exactMetricKey(metric).some(key => exactPaidMediaKeys.includes(key))) return true;

  const hasProvider = ['facebook', 'fbads', 'meta', 'google', 'snapchat', 'tiktok', 'twitter', 'applovin', 'pinterest', 'microsoft', 'bing']
    .some(provider => text.includes(provider));
  const hasSpendMarker = metricId.includes('spend') || metricId.includes('adcost') || id.includes('spend') || title.endsWith('ads');
  return hasProvider && hasSpendMarker;
}

function buildPaidMediaSpendField(metrics: TripleWhaleMetric[], aliases: string[]): FieldMapping {
  const components = metrics
    .filter(isPaidMediaSpendMetric)
    .map(metric => ({
      id: metric.id,
      metricId: metric.metricId,
      title: metric.title,
      value: metric.current || 0,
      previous: metric.previous,
      path: `${metric.path}.values.current`,
    }));

  if (!components.length) return { value: 0, path: null, status: 'missing', aliases };

  const value = components.reduce((sum, component) => sum + component.value, 0);
  const previous = components.reduce((sum, component) => sum + (component.previous || 0), 0);

  return {
    value,
    previous,
    path: `calculated:sum_paid_media_spend(${components.map(component => component.path.replace('.values.current', '')).join('+')})`,
    status: 'calculated',
    aliases,
    label: 'Paid Media Spend',
    title: 'Paid Media Spend',
    metricId: 'sum_paid_media_spend',
    id: 'paidMediaSpend',
    components,
    sourceKind: 'sum_of_channel_spend',
  };
}


const PLATFORM_CONVERSION_ALIASES = {
  meta: ['facebookWebConversionValue', 'facebookConversionValue', 'facebookMetaConversionValue', 'Facebook Web Conversion Value', 'Facebook Conversion Value', 'Facebook Meta Conversion Value'],
  snapchat: ['snapchatConversionValue', 'totalSnapchatConversionPurchasesValue', 'Snapchat Conversion Value'],
  google: ['googleConversionValue', 'ga_all_transactionsRevenue_adGroup', 'Google Conversion Value', 'Google All Conversions Value'],
  tiktok: ['tiktokConversionValueWOshops', 'tiktokWebConversionsValue', 'tiktokConversionValue', 'tiktokShopConversionsValue', 'TikTok Conversion Value W/O TikTok Shop', 'TikTok Web Conversion Value', 'TikTok Conversion Value', 'TikTok Shop Conversion Value'],
} as const;

const PLATFORM_CONVERSION_LABELS: Record<keyof typeof PLATFORM_CONVERSION_ALIASES, string> = {
  meta: 'Meta',
  snapchat: 'Snapchat',
  google: 'Google',
  tiktok: 'TikTok',
};

function findTripleWhaleMetricByAliasPriority(metrics: TripleWhaleMetric[], aliases: readonly string[]): FieldMapping {
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const hit = metrics.find(metric => exactMetricKey(metric).some(key => key === normalizedAlias));
    if (hit && hit.current !== null) {
      return {
        value: hit.current,
        previous: hit.previous,
        path: `${hit.path}.values.current`,
        status: 'triple_whale_metric_array',
        aliases: Array.from(aliases),
        label: hit.title,
        metricId: hit.metricId,
        id: hit.id,
        title: hit.title,
      };
    }
  }

  return { value: 0, path: null, status: 'missing', aliases: Array.from(aliases) };
}

function buildActivePlatformConversionFields(metrics: TripleWhaleMetric[]): {
  platformConversion: FieldMapping;
  attribution: MappingResult['attribution'];
} {
  const fields = {
    meta: findTripleWhaleMetricByAliasPriority(metrics, PLATFORM_CONVERSION_ALIASES.meta),
    snapchat: findTripleWhaleMetricByAliasPriority(metrics, PLATFORM_CONVERSION_ALIASES.snapchat),
    google: findTripleWhaleMetricByAliasPriority(metrics, PLATFORM_CONVERSION_ALIASES.google),
    tiktok: findTripleWhaleMetricByAliasPriority(metrics, PLATFORM_CONVERSION_ALIASES.tiktok),
    email: { value: 0, path: null, status: 'missing', aliases: ['emailRevenue', 'klaviyoRevenue', 'email'], label: 'Email attribution revenue is separate from active ad platform conversion value.' } as FieldMapping,
  };

  const activeComponents = (Object.entries(fields) as Array<[keyof typeof fields, FieldMapping]>)
    .filter(([key, field]) => key !== 'email' && Number(field.value || 0) > 0)
    .map(([key, field]) => ({
      id: field.id || null,
      metricId: field.metricId || null,
      title: field.title || PLATFORM_CONVERSION_LABELS[key as keyof typeof PLATFORM_CONVERSION_LABELS] || key,
      value: field.value,
      previous: field.previous || null,
      path: field.path || 'missing',
    }));

  if (!activeComponents.length) {
    return {
      platformConversion: {
        value: 0,
        path: null,
        status: 'missing',
        aliases: ['activePlatformConversionValue', 'facebookConversionValue', 'snapchatConversionValue', 'googleConversionValue', 'tiktokConversionValue'],
        label: 'No active platform conversion value detected yet',
        sourceKind: 'active_platform_conversion_value',
      },
      attribution: fields,
    };
  }

  const value = activeComponents.reduce((sum, component) => sum + component.value, 0);
  const previous = activeComponents.reduce((sum, component) => sum + (component.previous || 0), 0);

  return {
    platformConversion: {
      value,
      previous,
      path: `calculated:sum_active_platform_conversion_value(${activeComponents.map(component => component.path.replace('.values.current', '')).join('+')})`,
      status: 'calculated',
      aliases: ['activePlatformConversionValue', 'facebookConversionValue', 'snapchatConversionValue', 'googleConversionValue', 'tiktokConversionValue'],
      label: 'Active Platform Conversion Value',
      title: 'Active Platform Conversion Value',
      metricId: 'sum_active_platform_conversion_value',
      id: 'activePlatformConversionValue',
      components: activeComponents,
      sourceKind: 'active_platform_conversion_value',
    },
    attribution: fields,
  };
}


const TRAFFIC_SESSION_ALIASES = [
  'sessions', 'Sessions', 'totalSessions', 'gaSessions', 'websiteSessions', 'onlineStoreSessions',
  'shopifySessions', 'storeSessions', 'siteSessions', 'trafficSessions', 'visitors', 'uniqueVisitors',
  'users', 'activeUsers', 'Website Sessions', 'Online Store Sessions', 'Store Sessions', 'Visitors', 'Users'
];

function isTrafficSessionMetric(metric: TripleWhaleMetric): boolean {
  if (metric.current === null || metric.current <= 0) return false;
  const id = normalizeKey(metric.id || '');
  const metricId = normalizeKey(metric.metricId || '');
  const title = normalizeKey(metric.title || '');
  const type = normalizeKey(metric.type || '');
  const text = `${id} ${metricId} ${title}`;

  if (type && !['number', 'decimal', 'integer'].includes(type)) return false;

  // Exclude rates and per-session fields. A traffic source must be a count, not CVR.
  const dangerous = ['conversionrate', 'cvr', 'transactionspersession', 'persession', 'rate', 'percentage', 'percent', 'conversionvalue', 'revenue', 'sales', 'spend', 'cost', 'roas'];
  if (dangerous.some(term => text.includes(term))) return false;

  const exactTrafficKeys = TRAFFIC_SESSION_ALIASES.map(normalizeKey);
  if (exactMetricKey(metric).some(key => exactTrafficKeys.includes(key))) return true;

  const hasTrafficMarker = ['session', 'sessions', 'visitor', 'visitors', 'users', 'traffic'].some(term => text.includes(term));
  return hasTrafficMarker;
}

function buildTrafficSessionField(metrics: TripleWhaleMetric[], aliases: string[]): FieldMapping {
  const hit = metrics.find(isTrafficSessionMetric);
  if (!hit) return { value: 0, path: null, status: 'missing', aliases };
  return {
    value: hit.current || 0,
    previous: hit.previous,
    path: `${hit.path}.values.current`,
    status: 'triple_whale_metric_array',
    aliases,
    label: hit.title || 'Sessions',
    metricId: hit.metricId,
    id: hit.id,
    title: hit.title || 'Sessions',
    sourceKind: 'traffic_sessions',
  };
}

function sessionDerivedConversionRate(orders: FieldMapping, sessions: FieldMapping): number {
  if (!orders.value || !sessions.value || sessions.value <= 0) return 0;
  return (orders.value / sessions.value) * 100;
}

function directConversionRateReady(field: FieldMapping): boolean {
  return field.status !== 'missing' && Number(field.value || 0) > 0;
}

function effectiveConversionRate(mapping: MappingResult): { value: number; productionReady: boolean; status: string; note: string; source: string; sourceKind: string } {
  if (directConversionRateReady(mapping.conversionRate)) {
    return {
      value: mapping.conversionRate.value,
      productionReady: true,
      status: 'confirmed_direct_metric',
      note: 'Conversion rate is mapped from a non-zero Triple Whale conversion-rate metric.',
      source: mapping.conversionRate.path || 'triple_whale_conversion_rate_metric',
      sourceKind: 'direct_conversion_rate_metric',
    };
  }

  const calculated = sessionDerivedConversionRate(mapping.orders, mapping.sessions);
  if (calculated > 0) {
    return {
      value: calculated,
      productionReady: true,
      status: 'calculated_from_orders_sessions',
      note: 'Conversion rate is calculated from confirmed orders divided by confirmed sessions because the direct GA conversion-rate metric is 0 or unavailable.',
      source: `calculated:orders/sessions(${mapping.orders.path || 'orders'} / ${mapping.sessions.path || 'sessions'})`,
      sourceKind: 'calculated_from_orders_sessions',
    };
  }

  return {
    value: mapping.conversionRate.value || 0,
    productionReady: false,
    status: mapping.conversionRate.status === 'missing' ? 'needs_mapping' : 'awaiting_sessions_or_nonzero_conversion',
    note: mapping.conversionRate.status === 'missing'
      ? 'Conversion rate needs a confirmed conversion-rate or sessions/visitors metric before display.'
      : 'Triple Whale exposes a conversion-rate metric, but it is 0 and no usable sessions/visitors metric is available yet.',
    source: mapping.conversionRate.path || 'conversion_rate_or_sessions_mapping_required',
    sourceKind: 'pending_mapping',
  };
}

function buildMetricCatalog(metrics: TripleWhaleMetric[]): Array<{ id: string | null; metricId: string | null; title: string | null; type: string | null; current: number | null; previous: number | null; path: string }> {
  return metrics.slice(0, 120).map(metric => ({
    id: metric.id,
    metricId: metric.metricId,
    title: metric.title,
    type: metric.type,
    current: metric.current,
    previous: metric.previous,
    path: metric.path,
  }));
}

function mergePreferTripleWhale(arrayField: FieldMapping, fallback: FieldMapping): FieldMapping {
  return arrayField.status !== 'missing' ? arrayField : fallback;
}

function calculatedField(value: number, path: string, aliases: string[]): FieldMapping {
  return { value, path, status: 'calculated', aliases };
}

function buildMapping(source: unknown): MappingResult {
  const candidates = collectNumericCandidates(source);
  const summaryMetrics = collectTripleWhaleMetrics(source);

  // v0.3.0: Triple Whale Summary returns payload.metrics[] where each metric has id/metricId/title and values.current/previous.
  // These aliases are deliberately conservative and keep productionReady=false until the client confirms field semantics.
  const revenueAliases = [
    'totalSales', 'sales', 'Order Revenue', 'orderRevenue', 'netSales', 'Total Sales', 'grossSales', 'revenue', 'shopifyRevenue', 'totalRevenue'
  ];
  const ordersAliases = [
    'orders', 'totalOrders', 'orderCount', 'Total Orders', 'Orders', 'purchases', 'shopifyOrders', 'ordersCount', 'orders_count'
  ];
  const adSpendAliases = [
    'adSpend', 'totalAdSpend', 'blendedAdSpend', 'adsSpend', 'marketingSpend', 'Total Spend', 'Ad Spend', 'paidMediaSpend', 'sumPaidMediaSpend'
  ];
  const aovAliases = ['aov', 'averageOrderValue', 'Average Order Value', 'average_order_value'];
  const roasAliases = ['roas', 'blendedRoas', 'Total ROAS', 'Blended ROAS', 'totalRoas', 'blended_roas'];
  const conversionRateAliases = ['conversionRate', 'cvr', 'Conversion Rate', 'storeConversionRate', 'conversion_rate'];
  const sessionsAliases = TRAFFIC_SESSION_ALIASES;

  const revenueFromArray = findTripleWhaleMetric(summaryMetrics, revenueAliases, true);
  const ordersFromArray = findTripleWhaleMetric(summaryMetrics, ordersAliases, true);
  const adSpendFromArray = buildPaidMediaSpendField(summaryMetrics, adSpendAliases);

  // v0.6.0 QA fix: prefer Triple Whale's confirmed AOV metric before any fuzzy AOV match.
  // Client-confirmed field: id/metricId shopifyAovIncludeZero, title Average Order Value, values.current.
  const aovStrict = findTripleWhaleMetricStrict(summaryMetrics, ['shopifyAovIncludeZero', 'shopifyAov']);
  const aovFromArray = aovStrict.status !== 'missing' ? aovStrict : findTripleWhaleMetric(summaryMetrics, aovAliases, true);

  const roasFromArray = findTripleWhaleMetric(summaryMetrics, roasAliases, true);
  const conversionRateFromArray = findTripleWhaleMetric(summaryMetrics, conversionRateAliases, true);
  const sessionsFromArray = buildTrafficSessionField(summaryMetrics, sessionsAliases);

  const revenueFallback = findMetric(source, candidates, [
    'revenue', 'totalRevenue', 'sales', 'grossSales', 'netSales', 'orderRevenue', 'shopifyRevenue', 'totalSales', 'total_sales'
  ], [
    'summary.revenue', 'summary.totalRevenue', 'data.revenue', 'data.totalRevenue', 'payload.revenue', 'metrics.revenue'
  ]);

  const ordersFallback = findMetric(source, candidates, [
    'orders', 'totalOrders', 'orderCount', 'purchases', 'shopifyOrders', 'total_orders'
  ], [
    'summary.orders', 'summary.totalOrders', 'data.orders', 'data.totalOrders', 'payload.orders', 'metrics.orders'
  ]);

  const adSpendFallback = findMetric(source, candidates, [
    'adSpend', 'spend', 'marketingSpend', 'blendedAdSpend', 'totalAdSpend', 'total_spend', 'adsSpend'
  ], [
    'summary.adSpend', 'summary.spend', 'data.adSpend', 'data.spend', 'payload.adSpend', 'metrics.adSpend'
  ]);

  const aovFallback = findMetric(source, candidates, ['aov', 'averageOrderValue', 'average_order_value'], [
    'summary.aov', 'data.aov', 'payload.aov', 'metrics.aov'
  ]);

  const roasFallback = findMetric(source, candidates, ['roas', 'blendedRoas', 'totalRoas', 'blended_roas'], [
    'summary.roas', 'summary.blendedRoas', 'data.roas', 'data.blendedRoas', 'payload.roas', 'metrics.roas'
  ]);

  const conversionRateFallback = findMetric(source, candidates, ['conversionRate', 'cvr', 'storeConversionRate', 'conversion_rate'], [
    'summary.conversionRate', 'data.conversionRate', 'payload.conversionRate', 'metrics.conversionRate'
  ]);

  const sessionsFallback = findMetric(source, candidates, ['sessions', 'totalSessions', 'visitors', 'uniqueVisitors', 'users', 'trafficSessions'], [
    'summary.sessions', 'summary.totalSessions', 'data.sessions', 'data.totalSessions', 'payload.sessions', 'metrics.sessions', 'summary.visitors', 'data.visitors', 'metrics.visitors'
  ]);

  const revenue = mergePreferTripleWhale(revenueFromArray, revenueFallback);
  const orders = mergePreferTripleWhale(ordersFromArray, ordersFallback);
  let adSpend = mergePreferTripleWhale(adSpendFromArray, adSpendFallback);

  let aov = mergePreferTripleWhale(aovFromArray, aovFallback);
  if (aov.status === 'missing' && orders.value > 0 && revenue.value > 0) {
    aov = { ...calculatedField(revenue.value / orders.value, 'calculated:revenue/orders', aovAliases), label: 'AOV calculated from confirmed revenue/orders because Triple Whale AOV metric was missing', title: 'Average Order Value', sourceKind: 'calculated_from_revenue_orders' };
  }

  let roas = mergePreferTripleWhale(roasFromArray, roasFallback);
  if (adSpend.status === 'missing' && roas.value > 0 && revenue.value > 0) {
    adSpend = {
      ...calculatedField(revenue.value / roas.value, 'calculated:revenue/roas', adSpendAliases),
      label: 'Ad Spend calculated from Revenue / ROAS',
      title: 'Ad Spend',
      sourceKind: 'calculated_from_revenue_roas',
    };
  }
  if (roas.status === 'missing' && adSpend.value > 0 && revenue.value > 0) {
    roas = calculatedField(revenue.value / adSpend.value, 'calculated:revenue/adSpend', roasAliases);
  }

  const conversionRate = mergePreferTripleWhale(conversionRateFromArray, conversionRateFallback);
  const sessions = mergePreferTripleWhale(sessionsFromArray, sessionsFallback);

  // v0.8.3: Summary payload can safely expose active ad platform conversion value fields.
  // This is not full attribution revenue. It is a visible platform conversion value rollup.
  // Zero/inactive platforms are ignored in the displayed total and active source label.
  const { platformConversion, attribution } = buildActivePlatformConversionFields(summaryMetrics);

  const core = { revenue, orders, adSpend, aov, roas, conversionRate, sessions };
  const missingFields = Object.entries(core).filter(([, field]) => field.status === 'missing').map(([name]) => name);
  const configuredCount = Object.values(core).filter(field => field.status === 'configured_paths').length;
  const tripleWhaleArrayCount = Object.values(core).filter(field => field.status === 'triple_whale_metric_array' || field.status === 'calculated').length;
  const mappedCount = Object.values(core).filter(field => field.status !== 'missing').length;
  const confidence = tripleWhaleArrayCount >= 4 || configuredCount >= 3 || mappedCount >= 5 ? 'high' : mappedCount >= 2 ? 'medium' : 'low';

  return {
    revenue, orders, aov, adSpend, roas, conversionRate, sessions,
    attribution,
    platformConversion,
    confidence,
    missingFields,
    candidateCount: candidates.length,
    metricArrayDetected: summaryMetrics.length > 0,
    metricCatalog: buildMetricCatalog(summaryMetrics),
  };
}



function platformComponentKey(component: { id: string | null; metricId: string | null; title: string | null }): string {
  const text = normalizeKey([component.id, component.metricId, component.title].filter(Boolean).join(' '));
  if (text.includes('facebook') || text.includes('meta')) return 'meta';
  if (text.includes('snapchat')) return 'snapchat';
  if (text.includes('google')) return 'google';
  if (text.includes('tiktok')) return 'tiktok';
  return 'other';
}

function buildAttributionValueMap(attribution: MappingResult['attribution']): Record<string, number> {
  return {
    meta: roundMoney(Math.max(0, attribution.meta.value || 0)),
    snapchat: roundMoney(Math.max(0, attribution.snapchat.value || 0)),
    google: roundMoney(Math.max(0, attribution.google.value || 0)),
    tiktok: roundMoney(Math.max(0, attribution.tiktok.value || 0)),
    email: roundMoney(Math.max(0, attribution.email.value || 0)),
  };
}

function activePlatformLabels(platformConversion: FieldMapping): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const component of platformConversion.components || []) {
    if (component.value <= 0) continue;
    const key = platformComponentKey(component);
    const label = PLATFORM_CONVERSION_LABELS[key as keyof typeof PLATFORM_CONVERSION_LABELS] || component.title || key;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

function channelKey(component: { id: string | null; metricId: string | null; title: string | null }): string {
  const text = normalizeKey([component.id, component.metricId, component.title].filter(Boolean).join(' '));
  if (text.includes('facebook') || text.includes('fbads') || text.includes('meta')) return 'meta';
  if (text.includes('google')) return 'google';
  if (text.includes('snapchat')) return 'snapchat';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('twitter')) return 'twitter';
  if (text.includes('applovin') || text.includes('axon')) return 'applovin';
  if (text.includes('pinterest')) return 'pinterest';
  if (text.includes('microsoft') || text.includes('bing')) return 'microsoft';
  return component.id || component.metricId || 'other';
}

function buildChannelSpendMap(adSpend: FieldMapping): Record<string, number> {
  const out: Record<string, number> = {};
  for (const component of adSpend.components || []) {
    const key = channelKey(component);
    out[key] = roundMoney((out[key] || 0) + component.value);
  }
  return out;
}

function roundMoney(value: number): number { return Number(value.toFixed(2)); }
function roundCount(value: number): number { return Math.round(value); }
function roundRate(value: number): number { return Number(value.toFixed(2)); }

function isConfirmedCoreField(field: FieldMapping, allowedMetricIds: string[], allowedIds: string[], allowCalculated = false): boolean {
  if (field.status === 'missing') return false;
  if (field.status === 'calculated') return allowCalculated && field.value >= 0;
  const metricId = normalizeKey(field.metricId || '');
  const id = normalizeKey(field.id || '');
  const metricOk = allowedMetricIds.map(normalizeKey).includes(metricId);
  const idOk = allowedIds.map(normalizeKey).includes(id);
  return metricOk || idOk;
}

function hasBenchmarkSpendComponent(field: FieldMapping): boolean {
  return Boolean((field.components || []).some(component => {
    const text = normalizeKey([component.id, component.metricId, component.title].filter(Boolean).join(' '));
    return text.includes('benchmark') || text.includes('peer');
  }));
}

function coreMetricsReady(mapping: MappingResult): boolean {
  const revenueOk = isConfirmedCoreField(mapping.revenue, ['totalSales', 'netSales'], ['sales', 'netSales']);
  const ordersOk = isConfirmedCoreField(mapping.orders, ['totalOrders'], ['shopifyOrders']);
  const aovOk = isConfirmedCoreField(mapping.aov, ['shopifyAovIncludeZero', 'shopifyAov'], ['shopifyAovIncludeZero', 'shopifyAov'], true);
  const roasOk = isConfirmedCoreField(mapping.roas, ['totalRoas'], ['roas'], true);
  const adSpendOk = mapping.adSpend.status === 'calculated'
    && mapping.adSpend.sourceKind === 'sum_of_channel_spend'
    && !hasBenchmarkSpendComponent(mapping.adSpend);
  return revenueOk && ordersOk && aovOk && adSpendOk && roasOk;
}

export function normalizeTripleWhaleSummaryPayload(rawPayload: Record<string, unknown>, dateRange = 'triple_whale_summary_live'): NormalizedMetrics {
  const mapping = buildMapping(rawPayload);
  const mappedCoreCount = [mapping.revenue, mapping.orders, mapping.adSpend, mapping.aov, mapping.roas, mapping.conversionRate, mapping.sessions]
    .filter(field => field.status !== 'missing').length;
  const liveArrayMapping = mapping.metricArrayDetected && mappedCoreCount > 0;
  const coreReady = liveArrayMapping && coreMetricsReady(mapping);
  const conversion = effectiveConversionRate(mapping);
  const sessions = roundCount(mapping.sessions.value);
  const reachEstimate = sessions > 0
    ? sessions
    : (conversion.productionReady && mapping.orders.value > 0 ? roundCount(mapping.orders.value / (conversion.value / 100)) : 0);
  const reachSource = sessions > 0 ? (mapping.sessions.path || 'triple_whale_sessions_metric') : (conversion.productionReady ? conversion.source : 'sessions_or_conversion_rate_mapping_required');

  return {
    dateRange,
    revenue: roundMoney(mapping.revenue.value),
    orders: roundCount(mapping.orders.value),
    aov: roundMoney(mapping.aov.value),
    adSpend: roundMoney(mapping.adSpend.value),
    roas: roundRate(mapping.roas.value),
    conversionRate: roundRate(conversion.value),
    sessions,
    sessionsSourceLabel: mapping.sessions.title || mapping.sessions.metricId || mapping.sessions.id || undefined,
    sessionsProductionReady: sessions > 0,
    sessionsNote: sessions > 0
      ? 'Sessions/visitor traffic count is mapped from Triple Whale and can be used as the safest read-only reach estimate.'
      : 'No non-zero sessions/visitors metric is mapped yet. Reach can still fall back to orders ÷ conversion rate only after conversion is production-ready.',
    reachEstimate,
    reachEstimateProductionReady: reachEstimate > 0,
    reachEstimateSource: reachSource,
    reachEstimateNote: sessions > 0
      ? 'Reach estimate is using confirmed sessions/visitors as the safer traffic reach source.'
      : (reachEstimate > 0 ? 'Reach estimate is derived from orders divided by confirmed conversion rate.' : 'Reach estimate awaits sessions/visitors or non-zero conversion rate.'),
    attribution: buildAttributionValueMap(mapping.attribution),
    channelSpend: buildChannelSpendMap(mapping.adSpend),
    platformConversionValue: roundMoney(mapping.platformConversion.value),
    platformConversionSources: activePlatformLabels(mapping.platformConversion),
    platformConversionLabel: activePlatformLabels(mapping.platformConversion).join(' + '),
    platformConversionProductionReady: mapping.platformConversion.value > 0,
    platformConversionNote: mapping.platformConversion.value > 0
      ? 'Active platform conversion value is summed from non-zero Triple Whale platform conversion fields. Inactive/zero platforms are ignored and will auto-include once they return real values.'
      : 'No non-zero platform conversion value fields are available yet.',
    attributionNote: mapping.platformConversion.value > 0
      ? 'Dashboard platform conversion value is mapped from active ad-platform conversion value fields. This remains separate from full customer-level attribution revenue.'
      : 'Summary payload did not contain non-zero platform conversion value fields yet. Full revenue attribution will be mapped separately when confirmed.',
    lastSyncedAt: new Date().toISOString(),
    source: coreReady ? 'triple_whale_summary_core_metrics_live' : (mapping.confidence === 'low' ? 'triple_whale_summary_mapping_needs_review' : 'triple_whale_summary_live_mapped'),
    sourceNote: coreReady
      ? 'Live Triple Whale Summary response was captured and confirmed for core dashboard metrics: revenue, orders, AOV, paid-media ad spend, and blended ROAS. Active platform conversion value is mapped separately from full attribution revenue; conversion/reach can now use sessions when available.'
      : liveArrayMapping
        ? 'Live Triple Whale Summary response was captured and mapped from payload.metrics[].values.current through the v0.3.0 metric-array mapper with paid-media spend guard. Core readiness remains false until field semantics are confirmed.'
        : 'Live Triple Whale Summary response was captured, but automatic metric mapping has low confidence. Review raw_payload and mapped field paths before using as production truth.',
    sourceStatus: coreReady ? 'live_summary_core_metrics_ready' : (liveArrayMapping ? 'live_summary_metric_array_mapped_needs_review' : 'live_summary_mapping_needs_review'),
    productionReady: coreReady,
    coreMetricsProductionReady: coreReady,
    attributionProductionReady: false,
    conversionRateProductionReady: conversion.productionReady,
    conversionRateStatus: conversion.status,
    conversionRateNote: conversion.note,
    sourceWarning: coreReady
      ? 'Core dashboard metrics are confirmed from Triple Whale Summary. Active platform conversion value is available when non-zero platform conversion fields exist; conversion/reach uses sessions/visitors when available and blocks unsafe zero-rate math.'
      : liveArrayMapping
        ? 'v0.3.0 mapped real Triple Whale Summary metrics from the metrics[] array, but core production readiness remains false until the exact metric IDs are confirmed.'
        : 'v0.3.0 captured live Triple Whale response, but real metric paths still need manual confirmation before production use.',
    mapping: {
      version: '0.3.0',
      confidence: mapping.confidence,
      missingFields: mapping.missingFields,
      candidateCount: mapping.candidateCount,
      metricArrayDetected: mapping.metricArrayDetected,
      metricCatalog: mapping.metricCatalog,
      coreMetricsProductionReady: coreReady,
      attributionProductionReady: false,
      conversionRateProductionReady: conversion.productionReady,
      conversionRateStatus: conversion.status,
      sessionsProductionReady: sessions > 0,
      reachEstimateProductionReady: reachEstimate > 0,
      confirmedCoreMetricIds: {
        revenue: mapping.revenue.metricId || null,
        orders: mapping.orders.metricId || null,
        aov: mapping.aov.metricId || null,
        adSpend: mapping.adSpend.metricId || null,
        roas: mapping.roas.metricId || null,
      },
      fields: {
        revenue: mapping.revenue,
        orders: mapping.orders,
        aov: mapping.aov,
        adSpend: mapping.adSpend,
        roas: mapping.roas,
        conversionRate: mapping.conversionRate,
        sessions: mapping.sessions,
        attribution: mapping.attribution,
        platformConversion: mapping.platformConversion,
      },
    },
  };
}

function isSkeletonPlaceholderPayload(rawPayload: Record<string, unknown>): boolean {
  return rawPayload.source === 'triple_whale_sync_skeleton'
    || rawPayload.verification === 'api_key_validated_no_summary_body'
    || Boolean(rawPayload.sample && !rawPayload.payload);
}

function markSamplePlaceholder(normalized: NormalizedMetrics): NormalizedMetrics {
  return {
    ...normalized,
    source: 'sample_placeholder_not_production',
    sourceStatus: 'sample_placeholder',
    productionReady: false,
    sourceWarning: 'This snapshot uses LIFE.SAVER sample placeholder values after API-key validation. It is useful for testing the pipeline only; it is not real Triple Whale Summary business data.',
    mapping: {
      ...(normalized.mapping || {}),
      version: '0.3.0',
      confidence: 'low',
      sourceStatus: 'sample_placeholder',
      productionReady: false,
      warning: 'Mapped field paths point to sample.* placeholder values. Do not treat this as production metrics.',
    },
  };
}

function isSummaryProbeErrorPayload(rawPayload: Record<string, unknown>): boolean {
  const probe = (rawPayload as any).summaryProbe;
  return Boolean(rawPayload.source === 'triple_whale_summary_probe_raw_capture' && probe && probe.ok === false)
    || String(rawPayload.dateRange || '').includes('summary_probe_error')
    || String((rawPayload as any).payload?.error || '').length > 0;
}

function buildSummaryProbeErrorPreview(rawPayload: Record<string, unknown>, dateRange: string): Record<string, unknown> {
  const probe = (rawPayload as any).summaryProbe || {};
  const payload = (rawPayload as any).payload || {};
  const normalized = normalizeTripleWhaleSummaryPayload(payload && typeof payload === 'object' ? payload : {}, dateRange);
  return {
    message: 'v0.3.0 Summary probe diagnostics: the latest Summary API attempt returned an error or no usable metrics payload. This is not API-key validation data and should be fixed before real mapping.',
    sourceStatus: 'summary_probe_error',
    productionReady: false,
    summaryProbe: {
      ok: false,
      httpStatus: probe.httpStatus ?? null,
      responseKind: probe.responseKind ?? null,
      contentType: probe.contentType ?? null,
      message: probe.message || payload.message || 'Summary probe did not return a usable metrics payload.',
    },
    request: (rawPayload as any).request || null,
    normalizedMetrics: {
      ...normalized,
      source: 'summary_probe_error_not_metrics',
      sourceStatus: 'summary_probe_error',
      productionReady: false,
      sourceWarning: 'Triple Whale Summary API did not return real metric fields in this snapshot. Review summaryProbe/message/request before mapping.',
      mapping: {
        ...(normalized.mapping || {}),
        version: '0.3.0',
        confidence: 'low',
        sourceStatus: 'summary_probe_error',
        productionReady: false,
        warning: 'No real metric fields were mapped because this snapshot is a Summary probe error diagnostic.',
      },
    },
    mapping: {
      ...(normalized.mapping || {}),
      version: '0.3.0',
      confidence: 'low',
      sourceStatus: 'summary_probe_error',
      productionReady: false,
    },
  };
}

export function buildTripleWhaleMappingPreview(rawPayload: Record<string, unknown>, dateRange = 'mapping_preview'): Record<string, unknown> {
  if (isSummaryProbeErrorPayload(rawPayload)) {
    return buildSummaryProbeErrorPreview(rawPayload, dateRange);
  }

  if (isSkeletonPlaceholderPayload(rawPayload)) {
    const normalized = markSamplePlaceholder(normalizeTripleWhaleSkeletonPayload(rawPayload));
    return {
      message: 'v0.3.0 mapping safety check: latest snapshot is a sample/API-key-validation placeholder, not a confirmed Triple Whale Summary payload.',
      sourceStatus: 'sample_placeholder',
      productionReady: false,
      normalizedMetrics: normalized,
      mapping: normalized.mapping || null,
    };
  }

  const source = (rawPayload.payload && typeof rawPayload.payload === 'object')
    ? rawPayload.payload as Record<string, unknown>
    : rawPayload;
  const normalized = normalizeTripleWhaleSummaryPayload(source, dateRange);
  return {
    message: 'v0.3.0 mapping preview generated from the latest Summary/raw payload candidate. It now understands Triple Whale payload.metrics[].values.current.',
    sourceStatus: normalized.sourceStatus || normalized.source || 'mapped_payload',
    productionReady: Boolean(normalized.productionReady),
    normalizedMetrics: {
      ...normalized,
      mapping: {
        ...(normalized.mapping || {}),
        version: '0.3.0',
      },
    },
    mapping: normalized.mapping ? { ...normalized.mapping, version: '0.3.0' } : null,
  };
}
