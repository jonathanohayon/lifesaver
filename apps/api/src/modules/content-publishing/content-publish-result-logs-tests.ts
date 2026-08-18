import assert from 'node:assert/strict';
import {
  CONTENT_PUBLISH_RESULT_LOGS_HEALTH_MODE,
  CONTENT_PUBLISH_RESULT_LOGS_PHASE,
  assertNoTokenLeak,
  buildContentPublishResultMetadata,
  buildContentPublishResultTracking,
  buildContentPublishResultTrackingSummary,
  buildPlatformResponseSummary,
  extractLinkedInPermalink,
  extractLinkedInPlatformPostId,
  formatSafeContentPublishResultLog,
} from './content-publish-result-logs.js';
import type { LinkedInPostClientResponse } from './content-real-publish.executor.js';

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function successResponse(overrides: Partial<LinkedInPostClientResponse> = {}): LinkedInPostClientResponse {
  return {
    status: 201,
    headers: { 'x-restli-id': 'urn:li:share:6844785523593134080', 'content-type': 'application/json' },
    body: {},
    ...overrides,
  };
}

test('summary identifies Phase 9.7 health mode', () => {
  const summary = buildContentPublishResultTrackingSummary();
  assert.equal(summary.phase, CONTENT_PUBLISH_RESULT_LOGS_PHASE);
  assert.equal(summary.healthMode, CONTENT_PUBLISH_RESULT_LOGS_HEALTH_MODE);
});

test('summary targets action_results table', () => {
  const summary = buildContentPublishResultTrackingSummary();
  assert.equal(summary.targetTable, 'action_results');
  assert.ok(summary.stores.some((item) => item.includes('action_results.external_id')));
});

test('summary states raw tokens are not stored', () => {
  const summary = buildContentPublishResultTrackingSummary();
  assert.ok(summary.doesNotStore.includes('raw OAuth access token'));
  assert.ok(summary.doesNotStore.includes('Authorization header'));
});

test('extracts LinkedIn post ID from x-restli-id', () => {
  const result = extractLinkedInPlatformPostId(successResponse());
  assert.equal(result.id, 'urn:li:share:6844785523593134080');
  assert.equal(result.source, 'x-restli-id');
});

test('extracts LinkedIn post ID from body id fallback', () => {
  const result = extractLinkedInPlatformPostId(successResponse({ headers: {}, body: { id: 'urn:li:ugcPost:1' } }));
  assert.equal(result.id, 'urn:li:ugcPost:1');
  assert.equal(result.source, 'body.id');
});

test('does not invent a permalink when LinkedIn does not return one', () => {
  const result = extractLinkedInPermalink(successResponse());
  assert.equal(result.permalink, null);
  assert.equal(result.source, 'none');
});

test('extracts safe LinkedIn permalink from response body', () => {
  const result = extractLinkedInPermalink(successResponse({ body: { permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:123/' } }));
  assert.equal(result.permalink, 'https://www.linkedin.com/feed/update/urn:li:activity:123/');
  assert.equal(result.source, 'body.permalink');
});

test('rejects non-LinkedIn permalink values', () => {
  const result = extractLinkedInPermalink(successResponse({ body: { permalink: 'https://evil.example/track?token=abc' } }));
  assert.equal(result.permalink, null);
  assert.equal(result.source, 'none');
});

test('platform response summary records success and header keys safely', () => {
  const response = successResponse();
  const summary = buildPlatformResponseSummary({
    response,
    success: true,
    platformPostId: 'urn:li:share:6844785523593134080',
    postIdSource: 'x-restli-id',
    permalink: null,
    permalinkSource: 'none',
    publishedTime: '2026-07-06T12:00:00.000Z',
  });
  assert.equal(summary.success, true);
  assert.equal(summary.httpStatus, 201);
  assert.deepEqual(summary.safeHeaderKeys, ['content-type', 'x-restli-id']);
  assert.equal(summary.rawResponseBodyStored, false);
});

test('platform response summary removes unsafe header keys', () => {
  const response = successResponse({ headers: { authorization: 'Bearer secret', 'x-restli-id': 'urn:li:share:1', cookie: 'nope' } });
  const summary = buildPlatformResponseSummary({ response, success: true, platformPostId: 'urn:li:share:1', postIdSource: 'x-restli-id', permalink: null, permalinkSource: 'none', publishedTime: '2026-07-06T12:00:00.000Z' });
  assert.deepEqual(summary.safeHeaderKeys, ['x-restli-id']);
});

test('result tracking includes platform post ID and published time', () => {
  const response = successResponse();
  const tracking = buildContentPublishResultTracking({ response, success: true, platformPostId: 'urn:li:share:1', postIdSource: 'x-restli-id', permalink: null, permalinkSource: 'none', publishedTime: '2026-07-06T12:00:00.000Z', errorIfFailed: null, storedInActionResults: true });
  assert.equal(tracking.platformPostId, 'urn:li:share:1');
  assert.equal(tracking.publishedTime, '2026-07-06T12:00:00.000Z');
  assert.equal(tracking.storedInActionResults, true);
});

test('failed result tracking includes error but no post ID', () => {
  const response = successResponse({ status: 403, headers: { 'content-type': 'application/json' }, body: { serviceErrorCode: 100, message: 'Denied' } });
  const tracking = buildContentPublishResultTracking({ response, success: false, platformPostId: null, postIdSource: 'none', permalink: null, permalinkSource: 'none', publishedTime: null, errorIfFailed: 'LinkedIn API returned 403', storedInActionResults: true });
  assert.equal(tracking.platformPostId, null);
  assert.equal(tracking.errorIfFailed, 'LinkedIn API returned 403');
  assert.equal(tracking.platformResponseSummary.success, false);
});

test('metadata stores required result fields', () => {
  const response = successResponse();
  const summary = buildPlatformResponseSummary({ response, success: true, platformPostId: 'urn:li:share:1', postIdSource: 'x-restli-id', permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:1/', permalinkSource: 'body.permalink', publishedTime: '2026-07-06T12:00:00.000Z' });
  const metadata = buildContentPublishResultMetadata({
    publishedTime: '2026-07-06T12:00:00.000Z',
    platformPostId: 'urn:li:share:1',
    permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:1/',
    platformResponseSummary: summary,
    errorIfFailed: null,
  });
  assert.equal(metadata.platform_post_id, 'urn:li:share:1');
  assert.equal(metadata.permalink, 'https://www.linkedin.com/feed/update/urn:li:activity:1/');
  assert.equal(metadata.published_time, '2026-07-06T12:00:00.000Z');
  assert.equal(metadata.error_if_failed, null);
});

test('metadata never stores raw response body', () => {
  const response = successResponse();
  const summary = buildPlatformResponseSummary({ response, success: true, platformPostId: 'urn:li:share:1', postIdSource: 'x-restli-id', permalink: null, permalinkSource: 'none', publishedTime: '2026-07-06T12:00:00.000Z' });
  const metadata = buildContentPublishResultMetadata({ publishedTime: '2026-07-06T12:00:00.000Z', platformPostId: 'urn:li:share:1', permalink: null, platformResponseSummary: summary, errorIfFailed: null });
  assert.equal(metadata.raw_response_body_stored, false);
  assertNoTokenLeak(metadata);
});

test('safe result log formatter exposes post ID, permalink, published time, and summary', () => {
  const response = successResponse();
  const summary = buildPlatformResponseSummary({ response, success: true, platformPostId: 'urn:li:share:1', postIdSource: 'x-restli-id', permalink: null, permalinkSource: 'none', publishedTime: '2026-07-06T12:00:00.000Z' });
  const row = formatSafeContentPublishResultLog({
    id: 'result-1',
    action_id: 'action-1',
    workspace_id: 'workspace-1',
    executor_name: 'linkedinManualApprovedContentExecutor',
    external_id: 'urn:li:share:1',
    external_url: null,
    result_status: 'success',
    result_summary: 'Published.',
    error_message: null,
    metadata_json: { published_time: '2026-07-06T12:00:00.000Z', platform_response_summary: summary },
    created_at: new Date('2026-07-06T12:00:01.000Z'),
    updated_at: new Date('2026-07-06T12:00:02.000Z'),
  });
  assert.equal(row.platformPostId, 'urn:li:share:1');
  assert.equal(row.publishedTime, '2026-07-06T12:00:00.000Z');
  assert.equal(row.platformResponseSummary?.httpStatus, 201);
  assert.equal(row.safety.rawTokenReturned, false);
});

test('safe result log formatter exposes failed error', () => {
  const row = formatSafeContentPublishResultLog({
    id: 'result-2',
    action_id: 'action-2',
    workspace_id: 'workspace-1',
    executor_name: 'linkedinManualApprovedContentExecutor',
    external_id: null,
    external_url: null,
    result_status: 'failed',
    result_summary: 'Failed.',
    error_message: 'LinkedIn API returned 403',
    metadata_json: {},
    created_at: new Date('2026-07-06T12:00:01.000Z'),
    updated_at: new Date('2026-07-06T12:00:02.000Z'),
  });
  assert.equal(row.errorIfFailed, 'LinkedIn API returned 403');
  assert.equal(row.platformPostId, null);
});

test('assertNoTokenLeak catches token-like content', () => {
  assert.throws(() => assertNoTokenLeak({ authorization: 'Bearer secret-token' }));
});

test('assertNoTokenLeak permits safe content publish metadata', () => {
  assert.doesNotThrow(() => assertNoTokenLeak({ platform_post_id: 'urn:li:share:1', raw_token_returned: false }));
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

  console.log(`content-publish:result-logs:test — ${passed} passed, ${failures.length} failed`);

  if (failures.length > 0) process.exit(1);
}

void main();
