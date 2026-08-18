import assert from 'node:assert/strict';
import {
  buildLinkedInCommentary,
  buildLinkedInPostsApiRequestBody,
  buildRealPublishExecutorSafetySummary,
  CONTENT_REAL_PUBLISH_EXECUTOR_HEALTH_MODE,
  CONTENT_REAL_PUBLISH_EXECUTOR_NAME,
  executeManualApprovedLinkedInContentPublish,
  LINKEDIN_REQUIRED_WRITE_SCOPE,
  parseRealPublishExecutionBody,
  type LinkedInPostClientResponse,
} from './content-real-publish.executor.js';
import { parseContentPublishPayload } from './content-action-payload.js';

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [];
function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function samplePayload(overrides: Record<string, unknown> = {}) {
  return parseContentPublishPayload({
    platform: 'linkedin',
    account_id: 'urn:li:person:abc123XYZ',
    caption: 'Certainly, sir. Revenue is steady today.',
    hashtags: ['#Ecommerce', 'founder ops', 'Ecommerce'],
    media_type: 'none',
    safety: {
      manual_approval_required: true,
      real_publish_allowed_by_payload: false,
      auto_run_allowed_by_payload: false,
      external_api_call_allowed_by_payload: false,
    },
    ...overrides,
  });
}

test('safety summary identifies Phase 9.6 health mode', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.equal(summary.healthMode, CONTENT_REAL_PUBLISH_EXECUTOR_HEALTH_MODE);
  assert.equal(summary.executorName, CONTENT_REAL_PUBLISH_EXECUTOR_NAME);
  assert.equal(summary.selectedPlatform, 'linkedin');
});

test('safety summary requires w_member_social', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.equal(summary.requiredScope, LINKEDIN_REQUIRED_WRITE_SCOPE);
  assert.ok(summary.checksBeforePublish.includes('w_member_social scope present'));
});

test('safety summary keeps auto-run disabled', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.equal(summary.autoRunEnabled, false);
  assert.equal(summary.manualApprovalRequired, true);
});

test('safety summary keeps browser token exposure disabled', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.equal(summary.browserReceivesRawToken, false);
});

test('safety summary states media upload is not supported in this phase', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.equal(summary.mediaUploadSupportedInThisPhase, false);
});

test('execution body defaults force to false', () => {
  assert.deepEqual(parseRealPublishExecutionBody({}), { force: false });
});

test('execution body accepts force boolean', () => {
  assert.deepEqual(parseRealPublishExecutionBody({ force: true }), { force: true });
});

test('execution body rejects invalid force value', () => {
  assert.throws(() => parseRealPublishExecutionBody({ force: 'yes' }));
});

test('commentary includes normalized hashtags once', () => {
  const payload = samplePayload();
  const commentary = buildLinkedInCommentary(payload);
  assert.match(commentary, /#ecommerce/);
  assert.match(commentary, /#founderops/);
  assert.equal((commentary.match(/#ecommerce/g) || []).length, 1);
});

test('commentary appends link URL for link payloads', () => {
  const payload = samplePayload({ media_type: 'link', link_url: 'https://lifesaveragent.com' });
  const commentary = buildLinkedInCommentary(payload);
  assert.match(commentary, /https:\/\/lifesaveragent\.com/);
});

test('commentary stays within LinkedIn safety cap', () => {
  const payload = samplePayload({ caption: 'x'.repeat(2990), hashtags: ['#toolongbutvalid'] });
  assert.equal(buildLinkedInCommentary(payload).length, 3000);
});

test('LinkedIn request body has required author field', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(body.author, 'urn:li:person:abc123XYZ');
});

test('LinkedIn request body has required commentary field', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(typeof body.commentary, 'string');
  assert.match(String(body.commentary), /Revenue is steady/);
});

test('LinkedIn request body sets PUBLIC visibility', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(body.visibility, 'PUBLIC');
});

test('LinkedIn request body sets MAIN_FEED distribution', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  const distribution = body.distribution as Record<string, unknown>;
  assert.equal(distribution.feedDistribution, 'MAIN_FEED');
});

test('LinkedIn request body sets PUBLISHED lifecycleState', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(body.lifecycleState, 'PUBLISHED');
});

test('LinkedIn request body does not contain access token field', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(JSON.stringify(body).includes('access_token'), false);
  assert.equal(JSON.stringify(body).includes('Bearer'), false);
});

test('LinkedIn request body does not contain refresh token field', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.equal(JSON.stringify(body).includes('refresh_token'), false);
});

test('parse payload still requires manual approval safety flag', () => {
  const payload = samplePayload();
  assert.equal(payload.safety.manual_approval_required, true);
  assert.equal(payload.safety.auto_run_allowed_by_payload, false);
});

test('parse payload rejects token-looking keys', () => {
  assert.throws(() => parseContentPublishPayload({
    platform: 'linkedin',
    account_id: 'urn:li:person:abc123XYZ',
    caption: 'x',
    access_token: 'secret-token-value',
  }));
});

test('execute blocks safely when database is not configured', async () => {
  const response = await executeManualApprovedLinkedInContentPublish({
    workspaceId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    actionId: '00000000-0000-0000-0000-000000000003',
  }, {
    client: async () => ({ status: 201, headers: { 'x-restli-id': 'urn:li:share:1' }, body: {} }),
  });
  assert.equal(response.status, 'blocked');
  assert.equal(response.checks.databaseConfigured, false);
  assert.equal(response.linkedin.apiCalled, false);
});

test('blocked execution result never says external write succeeded', async () => {
  const response = await executeManualApprovedLinkedInContentPublish({
    workspaceId: 'w', userId: 'u', actionId: 'a',
  }, { client: async () => ({ status: 201, headers: {}, body: {} }) });
  assert.equal(response.safety.externalWritesSucceeded, false);
});

test('blocked execution result does not return raw token', async () => {
  const response = await executeManualApprovedLinkedInContentPublish({
    workspaceId: 'w', userId: 'u', actionId: 'a',
  }, { client: async () => ({ status: 201, headers: {}, body: {} }) });
  assert.equal(JSON.stringify(response).includes('Bearer'), false);
  assert.equal(response.linkedin.rawTokenReturned, false);
});

test('mock LinkedIn success response shape remains parseable by client contract', () => {
  const response: LinkedInPostClientResponse = { status: 201, headers: { 'x-restli-id': 'urn:li:share:123' }, body: {} };
  assert.equal(response.status, 201);
  assert.equal(response.headers['x-restli-id'], 'urn:li:share:123');
});

test('selected executor name is stable for result logs', () => {
  assert.equal(CONTENT_REAL_PUBLISH_EXECUTOR_NAME, 'linkedinManualApprovedContentExecutor');
});

test('checks include master pause off gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('master pause off'));
});

test('checks include content pause off gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('content pause off'));
});

test('checks include cap validation gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.some((item) => item.includes('cap validation')));
});

test('checks include approved status gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('status is approved'));
});

test('checks include manual approved event gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('manual approved event exists'));
});

test('checks include connector token gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('LinkedIn connector token exists and is not expired'));
});

test('checks include payload validation gate', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('payload validates'));
});

test('Phase 9.6 only supports text/link publish media', () => {
  const summary = buildRealPublishExecutorSafetySummary();
  assert.ok(summary.checksBeforePublish.includes('media_type is none or link only in this phase'));
});

test('link payload can use media_url as link fallback', () => {
  const payload = samplePayload({ media_type: 'link', media_url: 'https://lifesaveragent.com/rules.html' });
  const commentary = buildLinkedInCommentary(payload);
  assert.match(commentary, /rules\.html/);
});

test('request body is JSON serializable', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  assert.doesNotThrow(() => JSON.stringify(body));
});

test('request body preview data would be safe for action_results metadata', () => {
  const body = buildLinkedInPostsApiRequestBody(samplePayload());
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('authorization'), false);
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

  console.log(`content-real:publish:test — ${passed} passed, ${failures.length} failed`);

  if (failures.length > 0) process.exit(1);
}

void main();
