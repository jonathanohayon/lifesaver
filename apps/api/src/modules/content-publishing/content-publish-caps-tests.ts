import assert from 'node:assert/strict';
import {
  buildContentPublishCapWindows,
  buildContentPublishCapsStatusSummary,
  CONTENT_PUBLISH_CAPS_HEALTH_MODE,
  CONTENT_PUBLISH_CAPS_PHASE,
  evaluateContentPublishCapGate,
  getContentPublishCapConfigFromEnv,
  zeroContentPublishUsage,
  type ContentPublishUsageCounts,
} from './content-publish-caps.js';

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function usage(overrides: Partial<ContentPublishUsageCounts> = {}): ContentPublishUsageCounts {
  return {
    ...zeroContentPublishUsage(true),
    ...overrides,
    databaseConfigured: overrides.databaseConfigured ?? true,
  };
}

const strictLimits = {
  workspaceMaxPostsPerDay: 3,
  workspaceMaxPostsPerHour: 1,
  linkedinMaxPostsPerDay: 3,
  linkedinMaxPostsPerHour: 1,
  accountMaxPostsPerDay: 3,
  accountMaxPostsPerHour: 1,
  countOnlySuccessfulPublishes: true as const,
  source: 'environment' as const,
};

test('caps phase is Phase 9.8', () => {
  assert.equal(CONTENT_PUBLISH_CAPS_PHASE, 'v0.7.0_phase_9_8');
});

test('caps health mode is Phase 9.8 rate post caps', () => {
  assert.equal(CONTENT_PUBLISH_CAPS_HEALTH_MODE, 'v2-phase-9-8-rate-post-caps');
});

test('default cap config is conservative', () => {
  const config = getContentPublishCapConfigFromEnv();
  assert.ok(config.workspaceMaxPostsPerDay >= 0);
  assert.ok(config.workspaceMaxPostsPerHour >= 0);
  assert.equal(config.countOnlySuccessfulPublishes, true);
});

test('windows are rolling one hour and one day', () => {
  const now = new Date('2026-07-06T12:00:00.000Z');
  const windows = buildContentPublishCapWindows(now);
  assert.equal(windows.evaluatedAt, '2026-07-06T12:00:00.000Z');
  assert.equal(windows.hourWindowStartedAt, '2026-07-06T11:00:00.000Z');
  assert.equal(windows.dayWindowStartedAt, '2026-07-05T12:00:00.000Z');
});

test('allows publish when all counts are below cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ workspacePostsLastDay: 1, workspacePostsLastHour: 0, platformPostsLastDay: 1, platformPostsLastHour: 0, accountPostsLastDay: 1, accountPostsLastHour: 0 }),
    limits: strictLimits,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.status, 'allowed');
});

test('blocks when database usage is unavailable', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: zeroContentPublishUsage(false),
    limits: strictLimits,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 'cap_usage_unavailable');
});

test('blocks by workspace hourly cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ workspacePostsLastHour: 1 }),
    limits: strictLimits,
  });
  assert.equal(result.status, 'blocked_by_workspace_hourly_cap');
});

test('blocks by platform hourly cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ platformPostsLastHour: 1 }),
    limits: { ...strictLimits, workspaceMaxPostsPerHour: 5 },
  });
  assert.equal(result.status, 'blocked_by_platform_hourly_cap');
});

test('blocks by account hourly cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ accountPostsLastHour: 1 }),
    limits: { ...strictLimits, workspaceMaxPostsPerHour: 5, linkedinMaxPostsPerHour: 5 },
  });
  assert.equal(result.status, 'blocked_by_account_hourly_cap');
});

test('blocks by workspace daily cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ workspacePostsLastDay: 3 }),
    limits: { ...strictLimits, workspaceMaxPostsPerHour: 5, linkedinMaxPostsPerHour: 5, accountMaxPostsPerHour: 5 },
  });
  assert.equal(result.status, 'blocked_by_workspace_daily_cap');
});

test('blocks by platform daily cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ platformPostsLastDay: 3 }),
    limits: { ...strictLimits, workspaceMaxPostsPerDay: 10, workspaceMaxPostsPerHour: 5, linkedinMaxPostsPerHour: 5, accountMaxPostsPerHour: 5 },
  });
  assert.equal(result.status, 'blocked_by_platform_daily_cap');
});

test('blocks by account daily cap', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage({ accountPostsLastDay: 3 }),
    limits: { ...strictLimits, workspaceMaxPostsPerDay: 10, linkedinMaxPostsPerDay: 10, workspaceMaxPostsPerHour: 5, linkedinMaxPostsPerHour: 5, accountMaxPostsPerHour: 5 },
  });
  assert.equal(result.status, 'blocked_by_account_daily_cap');
});

test('zero limit blocks immediately', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abc123XYZ',
    usage: usage(),
    limits: { ...strictLimits, workspaceMaxPostsPerHour: 0 },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 'blocked_by_workspace_hourly_cap');
});

test('account ID is safely hinted, not fully exposed', () => {
  const result = evaluateContentPublishCapGate({
    platform: 'linkedin',
    accountId: 'urn:li:person:abcdefghijklmnopqrstuvwxyz',
    usage: usage(),
    limits: strictLimits,
  });
  assert.match(String(result.accountIdHint), /^urn:li:p/);
  assert.match(String(result.accountIdHint), /wxyz$/);
  assert.equal(String(result.accountIdHint).includes('abcdefghijklmnopqrstuv'), false);
});

test('summary states LinkedIn numeric limit is not published by docs', () => {
  const summary = buildContentPublishCapsStatusSummary();
  const platform = summary.platformSpecificLimits as Record<string, unknown>;
  assert.equal(platform.linkedinOfficialNumericLimitPublished, false);
});

test('summary states platform 429 is still handled safely', () => {
  const summary = buildContentPublishCapsStatusSummary();
  const platform = summary.platformSpecificLimits as Record<string, unknown>;
  assert.equal(platform.handlesPlatform429AsFailure, true);
});

test('summary stores/counts from action_results only', () => {
  const summary = buildContentPublishCapsStatusSummary();
  const storage = summary.storage as Record<string, unknown>;
  assert.equal(storage.countedTable, 'action_results');
  assert.equal(storage.countedStatus, 'success');
});

test('summary confirms auto-run remains disabled', () => {
  const summary = buildContentPublishCapsStatusSummary();
  const safety = summary.safety as Record<string, unknown>;
  assert.equal(safety.autoRunEnabled, false);
});

test('summary confirms manual approval remains required', () => {
  const summary = buildContentPublishCapsStatusSummary();
  const safety = summary.safety as Record<string, unknown>;
  assert.equal(safety.manualApprovalStillRequired, true);
});

test('summary confirms cap checks do not call external API', () => {
  const result = evaluateContentPublishCapGate({ platform: 'linkedin', accountId: 'x', usage: usage(), limits: strictLimits });
  assert.equal(result.safety.externalApiCalledDuringCapCheck, false);
});

test('summary confirms raw token is never returned', () => {
  const result = evaluateContentPublishCapGate({ platform: 'linkedin', accountId: 'x', usage: usage(), limits: strictLimits });
  assert.equal(result.safety.rawTokenReturned, false);
});

test('reason explains successful usage against caps', () => {
  const result = evaluateContentPublishCapGate({ platform: 'linkedin', accountId: 'x', usage: usage({ workspacePostsLastDay: 2 }), limits: strictLimits });
  assert.match(result.reason, /Content publish caps passed/);
});

async function main() {
  let passed = 0;
  const failures: Array<{ name: string; error: unknown }> = [];

  for (const item of tests) {
    try {
      await item.run();
      passed += 1;
    } catch (error) {
      failures.push({ name: item.name, error });
    }
  }

  for (const failure of failures) {
    console.error(`FAIL ${failure.name}`);
    console.error(failure.error);
  }

  console.log(`phase9:content-caps:test — ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
