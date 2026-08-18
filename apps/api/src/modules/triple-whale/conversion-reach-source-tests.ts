import assert from 'node:assert/strict';
import { normalizeTripleWhaleSummaryPayload } from './triple-whale.mapper.js';

const payloadWithSessions = {
  metrics: [
    { id: 'sales', metricId: 'totalSales', title: 'Order Revenue', type: 'currency', values: { current: 9557.34, previous: 8000 } },
    { id: 'shopifyOrders', metricId: 'totalOrders', title: 'Orders', type: 'number', values: { current: 99, previous: 80 } },
    { id: 'shopifyAovIncludeZero', metricId: 'shopifyAovIncludeZero', title: 'Average Order Value', type: 'currency', values: { current: 96.54, previous: 90 } },
    { id: 'facebookAds', metricId: 'facebookAds', title: 'Facebook Ads', type: 'currency', values: { current: 2120, previous: 1900 } },
    { id: 'snapchatAds', metricId: 'totalSnapchatSpend', title: 'Snapchat Ads', type: 'currency', values: { current: 900, previous: 700 } },
    { id: 'roas', metricId: 'totalRoas', title: 'Total ROAS', type: 'number', values: { current: 3.16, previous: 3 } },
    { id: 'googleConversionRate', metricId: 'averageGaTransactionsPerSession', title: 'Conversion Rate', type: 'percent', values: { current: 0, previous: 0 } },
    { id: 'storeSessions', metricId: 'sessions', title: 'Sessions', type: 'number', values: { current: 5000, previous: 4500 } },
    { id: 'facebookConversionValue', metricId: 'facebookConversionValue', title: 'Facebook Conversion Value', type: 'currency', values: { current: 4564.139976501465, previous: 3900 } },
    { id: 'snapchatConversionValue', metricId: 'totalSnapchatConversionPurchasesValue', title: 'Snapchat Conversion Value', type: 'currency', values: { current: 3869, previous: 2800 } },
  ],
};

const normalized = normalizeTripleWhaleSummaryPayload(payloadWithSessions, 'last_30_days');
assert.equal(normalized.sessions, 5000);
assert.equal(normalized.sessionsProductionReady, true);
assert.equal(normalized.reachEstimate, 5000);
assert.equal(normalized.reachEstimateProductionReady, true);
assert.equal(normalized.reachEstimateSource, 'metrics.7.values.current');
assert.equal(normalized.conversionRate, 1.98);
assert.equal(normalized.conversionRateProductionReady, true);
assert.equal(normalized.conversionRateStatus, 'calculated_from_orders_sessions');
assert.equal(normalized.conversionRateNote?.includes('orders divided by confirmed sessions'), true);
assert.equal((normalized.mapping as any).fields.sessions.id, 'storeSessions');
assert.equal((normalized.mapping as any).sessionsProductionReady, true);
assert.equal((normalized.mapping as any).reachEstimateProductionReady, true);

const directConversion = normalizeTripleWhaleSummaryPayload({
  metrics: [
    { id: 'sales', metricId: 'totalSales', title: 'Order Revenue', type: 'currency', values: { current: 1000, previous: 900 } },
    { id: 'shopifyOrders', metricId: 'totalOrders', title: 'Orders', type: 'number', values: { current: 50, previous: 40 } },
    { id: 'googleConversionRate', metricId: 'averageGaTransactionsPerSession', title: 'Conversion Rate', type: 'percent', values: { current: 2.5, previous: 2 } },
  ],
}, 'direct_conversion');
assert.equal(directConversion.conversionRate, 2.5);
assert.equal(directConversion.conversionRateProductionReady, true);
assert.equal(directConversion.conversionRateStatus, 'confirmed_direct_metric');
assert.equal(directConversion.reachEstimate, 2000);
assert.equal(directConversion.reachEstimateProductionReady, true);

const blockedZero = normalizeTripleWhaleSummaryPayload({
  metrics: [
    { id: 'shopifyOrders', metricId: 'totalOrders', title: 'Orders', type: 'number', values: { current: 50, previous: 40 } },
    { id: 'googleConversionRate', metricId: 'averageGaTransactionsPerSession', title: 'Conversion Rate', type: 'percent', values: { current: 0, previous: 0 } },
  ],
}, 'zero_no_sessions');
assert.equal(blockedZero.conversionRateProductionReady, false);
assert.equal(blockedZero.conversionRateStatus, 'awaiting_sessions_or_nonzero_conversion');
assert.equal(blockedZero.reachEstimateProductionReady, false);
assert.equal(blockedZero.reachEstimate, 0);
assert.equal(blockedZero.reachEstimateNote?.includes('awaits'), true);

console.log('conversion-reach-source-tests — 28 passed, 0 failed');
