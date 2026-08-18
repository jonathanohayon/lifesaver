import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADS_CONNECTOR_AUDIT_HEALTH_MODE,
  ADS_CONNECTOR_AUDIT_PACKAGE,
  ADS_CONNECTOR_AUDIT_PHASE,
  assertAdsConnectorAuditSafe,
  buildAdsConnectorAuditReport,
  buildAdsConnectorAuditStatus,
  buildAdsConnectorDependencies,
  buildAdsControlBoundaries,
  buildHardCapDependenciesForFuturePhases,
  buildRecommendedAdsControlOrder,
  buildRequiredBeforeAnyAdsExecutor,
} from './ads-connector-audit.model.js';

test('Phase 14.1 constants are correct', () => {
  assert.equal(ADS_CONNECTOR_AUDIT_PHASE, 'phase_14_1_ads_connector_audit');
  assert.equal(ADS_CONNECTOR_AUDIT_HEALTH_MODE, 'v2-phase-14-1-ads-connector-audit');
  assert.equal(ADS_CONNECTOR_AUDIT_PACKAGE, 'lifesaver-v0.7.0-phase-14-1-ads-connector-audit.zip');
});

test('audit clearly separates Triple Whale reads from direct platform controls', () => {
  const boundaries = buildAdsControlBoundaries();
  const tripleWhale = boundaries.find((item) => item.source === 'triple_whale');
  const direct = boundaries.find((item) => item.source === 'direct_platform_api');
  assert.equal(tripleWhale?.allowedInPhase141, true);
  assert.equal(direct?.allowedInPhase141, false);
  assert.equal(tripleWhale?.forbiddenInPhase141.includes('change budgets'), true);
  assert.equal(direct?.forbiddenInPhase141.includes('call ad APIs'), true);
});

test('dependency report includes Triple Whale plus direct ad platforms', () => {
  const dependencies = buildAdsConnectorDependencies();
  const platforms = dependencies.map((item) => item.platform).sort();
  assert.deepEqual(platforms, ['google_ads', 'meta_ads', 'microsoft_ads', 'pinterest_ads', 'snapchat_ads', 'tiktok_ads', 'triple_whale'].sort());
  assert.equal(dependencies.find((item) => item.platform === 'triple_whale')?.role, 'read_performance_only');
  assert.equal(dependencies.find((item) => item.platform === 'meta_ads')?.role, 'direct_control_required');
  assert.equal(dependencies.find((item) => item.platform === 'google_ads')?.role, 'direct_control_required');
});

test('required controls include approval, pause, caps, logs, and rollback planning', () => {
  const required = buildRequiredBeforeAnyAdsExecutor().join(' ').toLowerCase();
  assert.match(required, /manual approval/);
  assert.match(required, /master pause/);
  assert.match(required, /hard caps/);
  assert.match(required, /result logs/);
  assert.match(required, /rollback/);
});

test('future hard cap dependencies are recorded before any ads executor', () => {
  const caps = buildHardCapDependenciesForFuturePhases();
  assert.equal(caps.includes('max_daily_budget_change'), true);
  assert.equal(caps.includes('max_percentage_change'), true);
  assert.equal(caps.includes('never_exceed_emergency_limit'), true);
  assert.equal(caps.includes('duplicate execution/idempotency protection'), true);
});

test('recommended order starts with Meta and Google', () => {
  const order = buildRecommendedAdsControlOrder();
  assert.deepEqual(order.slice(0, 2), ['meta_ads', 'google_ads']);
});

test('Phase 14.1 report is audit-only and adds no external behavior', () => {
  const report = buildAdsConnectorAuditReport();
  assert.equal(report.planningOnly, true);
  assert.equal(report.safety.auditOnly, true);
  assert.equal(report.safety.tripleWhaleReadOnlyStill, true);
  assert.equal(report.safety.directAdPlatformApiClientAdded, false);
  assert.equal(report.safety.oauthRoutesAdded, false);
  assert.equal(report.safety.tokenStorageAdded, false);
  assert.equal(report.safety.adWriteScopeRequested, false);
  assert.equal(report.safety.campaignPaused, false);
  assert.equal(report.safety.budgetChanged, false);
  assert.equal(report.safety.autoRunAdsEnabled, false);
  assert.equal(report.safety.externalApiCalled, false);
  assert.equal(report.safety.noDatabaseMigrationRequired, true);
});

test('Phase 14.1 status is concise and safe', () => {
  const status = buildAdsConnectorAuditStatus();
  assert.equal(status.deliverable, 'ads_connector_dependency_report');
  assert.equal(status.planningOnly, true);
  assert.equal(status.separatesTripleWhaleReadsFromDirectControls, true);
  assert.equal(status.tripleWhaleReadOnlyStill, true);
  assert.equal(status.directAdPlatformApiClientAdded, false);
  assert.equal(status.externalApiCalled, false);
  assert.doesNotThrow(() => assertAdsConnectorAuditSafe(status));
});

test('full audit output has no secret-like output', () => {
  const report = buildAdsConnectorAuditReport();
  assert.doesNotThrow(() => assertAdsConnectorAuditSafe(report));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsConnectorAuditReport() as any;
  report.accidental = 'access_token must not be returned';
  assert.throws(() => assertAdsConnectorAuditSafe(report), /forbidden fragment/);
});
