import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADS_WRITE_SCOPE_HEALTH_MODE,
  ADS_WRITE_SCOPE_PACKAGE,
  ADS_WRITE_SCOPE_PHASE,
  assertAdsWriteScopeSafe,
  buildAdsWriteScopeChecklist,
  buildAdsWriteScopePlatformPlans,
  buildAdsWriteScopeReport,
  buildAdsWriteScopeSharedSafetyGates,
  buildAdsWriteScopeStatus,
} from './ads-write-scope-planning.model.js';

test('Phase 14.2 constants are correct', () => {
  assert.equal(ADS_WRITE_SCOPE_PHASE, 'phase_14_2_write_scope_planning');
  assert.equal(ADS_WRITE_SCOPE_HEALTH_MODE, 'v2-phase-14-2-write-scope-planning');
  assert.equal(ADS_WRITE_SCOPE_PACKAGE, 'lifesaver-v0.7.0-phase-14-2-write-scope-planning.zip');
});

test('write-scope planning covers Meta Marketing API and Google Ads API', () => {
  const plans = buildAdsWriteScopePlatformPlans();
  const labels = plans.map((platform) => platform.label).sort();
  assert.deepEqual(labels, ['Google Ads API', 'Meta Marketing API'].sort());
  assert.equal(plans.every((platform) => platform.futureControls.length >= 4), true);
});

test('each platform includes account permission, OAuth, app review, least privilege, and token storage checklist categories', () => {
  const checklist = buildAdsWriteScopeChecklist();
  for (const platform of ['meta_marketing_api', 'google_ads_api'] as const) {
    const categories = checklist.filter((item) => item.platform === platform).map((item) => item.category).sort();
    assert.deepEqual(categories, ['account_permission', 'app_review', 'least_privilege', 'oauth', 'token_storage'].sort());
  }
});

test('checklist keeps every requirement blocked until a future executor phase', () => {
  const checklist = buildAdsWriteScopeChecklist();
  assert.equal(checklist.every((item) => item.requiredBeforeExecutor), true);
  assert.equal(checklist.some((item) => item.safetyGate.toLowerCase().includes('no meta oauth route')), true);
  assert.equal(checklist.some((item) => item.safetyGate.toLowerCase().includes('no google ads oauth route')), true);
  assert.equal(checklist.some((item) => item.safetyGate.toLowerCase().includes('manual-approval-only executor')), true);
});

test('shared safety gates keep Triple Whale read-only and block ads control in this phase', () => {
  const gates = buildAdsWriteScopeSharedSafetyGates().join(' ').toLowerCase();
  assert.match(gates, /triple whale remains read-only/);
  assert.match(gates, /no ad api client/);
  assert.match(gates, /no campaign/);
  assert.match(gates, /no budget/);
  assert.match(gates, /manual approval/);
  assert.match(gates, /hard caps/);
});

test('report is checklist-only and adds no external ads behavior', () => {
  const report = buildAdsWriteScopeReport();
  assert.equal(report.deliverable, 'ads_write_scope_checklist');
  assert.equal(report.planningOnly, true);
  assert.equal(report.safety.noAdApiClientAdded, true);
  assert.equal(report.safety.noOAuthRouteAdded, true);
  assert.equal(report.safety.noTokenStorageAdded, true);
  assert.equal(report.safety.noWriteScopeRequested, true);
  assert.equal(report.safety.noCampaignPaused, true);
  assert.equal(report.safety.noBudgetChanged, true);
  assert.equal(report.safety.noAdsAutoRunEnabled, true);
  assert.equal(report.safety.noExternalAdApiCalled, true);
  assert.equal(report.safety.noDatabaseMigrationRequired, true);
});

test('token storage policy is encrypted and browser-safe', () => {
  const report = buildAdsWriteScopeReport();
  assert.equal(report.tokenStoragePolicy.encryptedAtRestRequired, true);
  assert.equal(report.tokenStoragePolicy.keyHintOnlyInBrowser, true);
  assert.equal(report.tokenStoragePolicy.rawTokenReturnedToBrowser, false);
  assert.equal(report.tokenStoragePolicy.rawTokenLogged, false);
  assert.equal(report.tokenStoragePolicy.disconnectRequired, true);
});

test('status is concise and safe', () => {
  const status = buildAdsWriteScopeStatus();
  assert.equal(status.healthMode, ADS_WRITE_SCOPE_HEALTH_MODE);
  assert.equal(status.deliverable, 'ads_write_scope_checklist');
  assert.equal(status.platforms.includes('Meta Marketing API'), true);
  assert.equal(status.platforms.includes('Google Ads API'), true);
  assert.equal(status.writeScopeRequested, false);
  assert.equal(status.externalAdApiCalled, false);
  assert.doesNotThrow(() => assertAdsWriteScopeSafe(status));
});

test('full write-scope output has no secret-like output', () => {
  const report = buildAdsWriteScopeReport();
  assert.doesNotThrow(() => assertAdsWriteScopeSafe(report));
});

test('safe assertion rejects secret-like output', () => {
  const report = buildAdsWriteScopeReport() as any;
  report.accidental = 'client_secret=abc123';
  assert.throws(() => assertAdsWriteScopeSafe(report), /forbidden fragment/);
});
