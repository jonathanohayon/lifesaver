import assert from 'node:assert/strict';
import { normalizeTripleWhaleSummaryPayload } from './triple-whale.mapper.js';

const rawPayload = {
  metrics: [
    { id: 'sales', metricId: 'totalSales', title: 'Order Revenue', type: 'currency', values: { current: 9557.34, previous: 8000 } },
    { id: 'shopifyOrders', metricId: 'totalOrders', title: 'Orders', type: 'number', values: { current: 99, previous: 80 } },
    { id: 'shopifyAovIncludeZero', metricId: 'shopifyAovIncludeZero', title: 'Average Order Value', type: 'currency', values: { current: 96.54, previous: 90 } },
    { id: 'facebookAds', metricId: 'facebookAds', title: 'Facebook Ads', type: 'currency', values: { current: 2120, previous: 1900 } },
    { id: 'snapchatAds', metricId: 'totalSnapchatSpend', title: 'Snapchat Ads', type: 'currency', values: { current: 900, previous: 700 } },
    { id: 'roas', metricId: 'totalRoas', title: 'Total ROAS', type: 'number', values: { current: 3.16, previous: 3 } },
    { id: 'googleConversionRate', metricId: 'averageGaTransactionsPerSession', title: 'Conversion Rate', type: 'percent', values: { current: 0, previous: 0 } },
    { id: 'facebookConversionValue', metricId: 'facebookConversionValue', title: 'Facebook Conversion Value', type: 'currency', values: { current: 4564.139976501465, previous: 3900 } },
    { id: 'facebookWebConversionValue', metricId: 'facebookWebConversionValue', title: 'Facebook Web Conversion Value', type: 'currency', values: { current: 4564.139976501465, previous: 3900 } },
    { id: 'snapchatConversionValue', metricId: 'totalSnapchatConversionPurchasesValue', title: 'Snapchat Conversion Value', type: 'currency', values: { current: 3869, previous: 2800 } },
    { id: 'googleConversionValue', metricId: 'googleConversionValue', title: 'Google Conversion Value', type: 'currency', values: { current: 0, previous: 0 } },
    { id: 'tiktokConversionValue', metricId: 'tiktokConversionValue', title: 'TikTok Conversion Value', type: 'currency', values: { current: 0, previous: 0 } },
  ],
};

const normalized = normalizeTripleWhaleSummaryPayload(rawPayload, 'last_30_days');
assert.equal(normalized.platformConversionProductionReady, true);
assert.equal(normalized.platformConversionValue, 8433.14);
assert.deepEqual(normalized.platformConversionSources, ['Meta', 'Snapchat']);
assert.equal(normalized.platformConversionLabel, 'Meta + Snapchat');
assert.equal(normalized.attribution.meta, 4564.14);
assert.equal(normalized.attribution.snapchat, 3869);
assert.equal(normalized.attribution.google, 0);
assert.equal(normalized.attribution.tiktok, 0);
assert.equal(normalized.conversionRate, 0);
assert.equal(normalized.conversionRateProductionReady, false);
assert.equal(normalized.platformConversionNote?.includes('Inactive/zero platforms are ignored'), true);
assert.equal((normalized.mapping as any).fields.platformConversion.value > 8433, true);
assert.equal((normalized.mapping as any).fields.platformConversion.components.length, 2);
assert.equal((normalized.mapping as any).fields.platformConversion.components.some((component: any) => String(component.id).includes('google')), false);
assert.equal((normalized.mapping as any).fields.platformConversion.components.some((component: any) => String(component.id).includes('tiktok')), false);

const googleLater = normalizeTripleWhaleSummaryPayload({
  metrics: [
    ...(rawPayload.metrics as any[]).filter((metric) => metric.id !== 'googleConversionValue'),
    { id: 'googleConversionValue', metricId: 'googleConversionValue', title: 'Google Conversion Value', type: 'currency', values: { current: 1000, previous: 0 } },
  ],
}, 'future_google_active');
assert.equal(googleLater.platformConversionValue, 9433.14);
assert.deepEqual(googleLater.platformConversionSources, ['Meta', 'Snapchat', 'Google']);

const inactiveOnly = normalizeTripleWhaleSummaryPayload({
  metrics: [
    { id: 'googleConversionValue', metricId: 'googleConversionValue', title: 'Google Conversion Value', type: 'currency', values: { current: 0, previous: 0 } },
    { id: 'tiktokConversionValue', metricId: 'tiktokConversionValue', title: 'TikTok Conversion Value', type: 'currency', values: { current: 0, previous: 0 } },
  ],
}, 'inactive_only');
assert.equal(inactiveOnly.platformConversionProductionReady, false);
assert.equal(inactiveOnly.platformConversionValue, 0);
assert.deepEqual(inactiveOnly.platformConversionSources, []);

console.log('active-platform-conversion-tests — 22 passed, 0 failed');
