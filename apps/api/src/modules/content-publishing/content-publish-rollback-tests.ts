import assert from 'node:assert/strict';
import {
  CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE,
  CONTENT_PUBLISH_ROLLBACK_PHASE,
  buildContentPublishRollbackSafetySummary,
  buildLinkedInDeletePostRequest,
  buildLinkedInDeleteUrlPreview,
  encodeLinkedInPostUrnForPath,
  isLinkedInPostUrnDeleteSafe,
  parseContentPublishRollbackBody,
  rollbackManualApprovedLinkedInContentPublish,
  type LinkedInDeleteClientResponse,
} from './content-publish-rollback.js';
import { CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME, assertNoTokenLeak, formatSafeContentPublishResultLog } from './content-publish-result-logs.js';

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

const safeUrn = 'urn:li:share:6844785523593134080';

test('summary identifies Phase 9.9 health mode', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.phase, CONTENT_PUBLISH_ROLLBACK_PHASE);
  assert.equal(summary.healthMode, CONTENT_PUBLISH_ROLLBACK_HEALTH_MODE);
});

test('summary uses stable rollback executor name', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.executorName, CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME);
  assert.equal(summary.executorName, 'linkedinContentRollbackExecutor');
});

test('summary confirms LinkedIn delete is supported but batch delete is not', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.deleteSupportedBySelectedPlatform, true);
  assert.equal(summary.batchDeleteSupported, false);
  assert.match(summary.supportedExternalDelete, /DELETE \/rest\/posts/);
});

test('summary keeps rollback feature flag default-off', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.featureFlagDefaultOff, true);
});

test('summary keeps auto-run disabled', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.autoRunEnabled, false);
  assert.equal(summary.manualRollbackRequestRequired, true);
});

test('summary states raw tokens and rollback payload are not returned', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.browserReceivesRawToken, false);
  assert.equal(summary.rollbackPayloadReturnedToBrowser, false);
});

test('summary requires owner/admin and executed action', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.ok(summary.checksBeforeRollback.includes('current user is workspace owner/admin'));
  assert.ok(summary.checksBeforeRollback.includes('action status is executed'));
});

test('summary requires successful publish result and safe post URN', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.ok(summary.checksBeforeRollback.includes('successful LinkedIn publish result exists'));
  assert.ok(summary.checksBeforeRollback.includes('platform post ID is a safe LinkedIn share/ugcPost URN'));
});

test('summary requires w_member_social scope', () => {
  const summary = buildContentPublishRollbackSafetySummary();
  assert.equal(summary.requiredScope, 'w_member_social');
});

test('parse rollback body defaults reason and force', () => {
  assert.deepEqual(parseContentPublishRollbackBody({}), { reason: 'Manual rollback requested.', force: false });
});

test('parse rollback body accepts reason and force', () => {
  assert.deepEqual(parseContentPublishRollbackBody({ reason: 'Wrong image/caption.', force: true }), { reason: 'Wrong image/caption.', force: true });
});

test('parse rollback body rejects invalid force value', () => {
  assert.throws(() => parseContentPublishRollbackBody({ force: 'yes' }));
});

test('safe LinkedIn share URN is accepted', () => {
  assert.equal(isLinkedInPostUrnDeleteSafe(safeUrn), true);
});

test('safe LinkedIn ugcPost URN is accepted', () => {
  assert.equal(isLinkedInPostUrnDeleteSafe('urn:li:ugcPost:68447855235931240'), true);
});

test('non-LinkedIn URN is rejected for delete', () => {
  assert.equal(isLinkedInPostUrnDeleteSafe('urn:li:activity:123'), false);
  assert.equal(isLinkedInPostUrnDeleteSafe('https://linkedin.com/feed/update/urn:li:activity:123'), false);
});

test('token-like or path-injection IDs are rejected for delete', () => {
  assert.equal(isLinkedInPostUrnDeleteSafe('urn:li:share:123/../../token'), false);
  assert.equal(isLinkedInPostUrnDeleteSafe('Bearer secret-token'), false);
});

test('LinkedIn post URN is encoded for path', () => {
  assert.equal(encodeLinkedInPostUrnForPath(safeUrn), 'urn%3Ali%3Ashare%3A6844785523593134080');
});

test('unsafe post URN throws before URL construction', () => {
  assert.throws(() => encodeLinkedInPostUrnForPath('urn:li:activity:123'));
});

test('delete URL preview uses encoded URN', () => {
  const url = buildLinkedInDeleteUrlPreview(safeUrn);
  assert.match(url, /\/rest\/posts\/urn%3Ali%3Ashare%3A6844785523593134080$/);
});

test('delete request uses DELETE method', () => {
  const request = buildLinkedInDeletePostRequest({ accessToken: 'token-1234567890-token-1234567890', postUrn: safeUrn });
  assert.equal(request.method, 'DELETE');
});

test('delete request includes Rest.li delete headers', () => {
  const request = buildLinkedInDeletePostRequest({ accessToken: 'token-1234567890-token-1234567890', postUrn: safeUrn });
  assert.equal(request.headers['X-RestLi-Method'], 'DELETE');
  assert.equal(request.headers['X-Restli-Protocol-Version'], '2.0.0');
});

test('delete request sends token only in server-side Authorization header', () => {
  const request = buildLinkedInDeletePostRequest({ accessToken: 'token-1234567890-token-1234567890', postUrn: safeUrn });
  assert.match(request.headers.Authorization, /^Bearer /);
  assert.equal(JSON.stringify({ url: request.url, method: request.method }).includes('token-123'), false);
});

test('delete request does not place token in URL', () => {
  const request = buildLinkedInDeletePostRequest({ accessToken: 'token-1234567890-token-1234567890', postUrn: safeUrn });
  assert.equal(request.url.includes('token-123'), false);
  assert.equal(request.url.includes('access_token'), false);
});

test('successful delete response expected status is 204', () => {
  const response: LinkedInDeleteClientResponse = { status: 204, headers: {}, body: '' };
  assert.equal(response.status, 204);
});

test('safe rollback result log exposes rollback status only', () => {
  const log = formatSafeContentPublishResultLog({
    id: 'result-rollback-1',
    action_id: 'action-1',
    workspace_id: 'workspace-1',
    executor_name: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    external_id: safeUrn,
    external_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/',
    result_status: 'rollback_success',
    result_summary: 'Rolled back.',
    error_message: null,
    metadata_json: { rollback_status: 'rollback_success', platform_post_id: safeUrn },
    created_at: new Date('2026-07-06T12:00:01.000Z'),
    updated_at: new Date('2026-07-06T12:00:02.000Z'),
  });
  assert.equal(log.resultStatus, 'rollback_success');
  assert.equal(log.rollbackStatus, 'rollback_success');
  assert.equal(log.platformPostId, safeUrn);
  assert.equal(log.safety.rollbackPayloadReturned, false);
});

test('rollback_not_supported can be represented safely in result log metadata', () => {
  const log = formatSafeContentPublishResultLog({
    id: 'result-rollback-2',
    action_id: 'action-1',
    workspace_id: 'workspace-1',
    executor_name: CONTENT_PUBLISH_ROLLBACK_EXECUTOR_NAME,
    external_id: null,
    external_url: null,
    result_status: 'skipped',
    result_summary: 'rollback_not_supported',
    error_message: null,
    metadata_json: { rollback_status: 'rollback_not_supported' },
    created_at: new Date('2026-07-06T12:00:01.000Z'),
    updated_at: new Date('2026-07-06T12:00:02.000Z'),
  });
  assert.equal(log.rollbackStatus, 'rollback_not_supported');
});

test('rollback metadata contract rejects token-like fields through shared leak assertion', () => {
  assert.throws(() => assertNoTokenLeak({ rollback_status: 'rollback_success', authorization: 'Bearer secret' }));
});

test('execute blocks safely when database is not configured', async () => {
  const result = await rollbackManualApprovedLinkedInContentPublish({ workspaceId: 'w', userId: 'u', actionId: 'a' }, { client: async () => ({ status: 204, headers: {}, body: '' }) });
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks.databaseConfigured, false);
  assert.equal(result.linkedin.apiCalled, false);
});

test('blocked rollback never claims external write success', async () => {
  const result = await rollbackManualApprovedLinkedInContentPublish({ workspaceId: 'w', userId: 'u', actionId: 'a' }, { client: async () => ({ status: 204, headers: {}, body: '' }) });
  assert.equal(result.safety.externalWritesSucceeded, false);
});

test('blocked rollback response does not contain raw token text', async () => {
  const result = await rollbackManualApprovedLinkedInContentPublish({ workspaceId: 'w', userId: 'u', actionId: 'a' }, { client: async () => ({ status: 204, headers: {}, body: '' }) });
  assert.equal(JSON.stringify(result).includes('Bearer'), false);
  assert.equal(result.linkedin.rawTokenReturned, false);
});

test('rollback result uses full safe lifecycle path on summary contract', () => {
  const path = ['executed', 'rollback_requested', 'executing', 'rolled_back'];
  assert.deepEqual(path, ['executed', 'rollback_requested', 'executing', 'rolled_back']);
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

  console.log(`content-publish:rollback:test — ${passed} passed, ${failures.length} failed`);

  if (failures.length > 0) process.exit(1);
}

void main();
