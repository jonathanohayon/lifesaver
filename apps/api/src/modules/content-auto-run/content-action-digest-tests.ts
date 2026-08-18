import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_ACTION_DIGEST_HEALTH_MODE,
  CONTENT_ACTION_DIGEST_PHASE,
  assertContentActionDigestSafe,
  buildContentActionDigest,
  buildContentActionDigestStatus,
} from './content-action-digest.model.js';

const sampleActions = [
  {
    actionId: 'act_1',
    title: 'Founder update',
    actionType: 'content_publish',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    status: 'executed',
    riskLevel: 'low',
    publishedAt: '2026-07-06T10:00:00.000Z',
    permalink: 'https://www.linkedin.com/feed/update/urn:li:share:123',
    publishReason: 'Published because approved style, low risk, caps, and final validation all passed.',
  },
  {
    actionId: 'act_2',
    title: 'Discount post',
    actionType: 'content_publish',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    status: 'proposed',
    riskLevel: 'medium',
    reason: 'Waiting because discount claims need founder approval.',
  },
  {
    actionId: 'act_3',
    title: 'Failed post',
    actionType: 'content_publish',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    status: 'failed',
    riskLevel: 'low',
    failureReason: 'Token expired before publish.',
  },
  {
    actionId: 'act_4',
    title: 'Support reply',
    actionType: 'support_reply_send',
    platform: 'gmail',
    channel: 'support',
    status: 'failed',
  },
];

test('Phase 11.7 constants are correct', () => {
  assert.equal(CONTENT_ACTION_DIGEST_PHASE, 'phase_11_7_daily_action_digest');
  assert.equal(CONTENT_ACTION_DIGEST_HEALTH_MODE, 'v2-phase-11-7-daily-action-digest');
});

test('status describes Daily Brief content action digest', () => {
  const status = buildContentActionDigestStatus();
  assert.equal(status.deliverable, 'content_action_digest');
  assert.equal(status.reports.includes('what_was_published'), true);
  assert.equal(status.reports.includes('what_failed'), true);
  assert.equal(status.safety.digestOnly, true);
});

test('digest buckets published, waiting, and failed content actions', () => {
  const digest = buildContentActionDigest({ timezone: 'UTC', digestDate: '2026-07-06T23:59:00.000Z', actions: sampleActions });
  assert.equal(digest.counts.totalInputActions, 4);
  assert.equal(digest.counts.published, 1);
  assert.equal(digest.counts.waitingForApproval, 1);
  assert.equal(digest.counts.failed, 1);
  assert.equal(digest.counts.ignoredNonContentActions, 1);
});

test('digest reports what was published and why', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  assert.equal(digest.published[0].title, 'Founder update');
  assert.equal(digest.published[0].reason.includes('approved style'), true);
  assert.equal(digest.published[0].safeLinkAvailable, true);
});

test('digest reports waiting approvals', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  assert.equal(digest.waitingForApproval[0].title, 'Discount post');
  assert.equal(digest.waitingForApproval[0].reason.includes('founder approval'), true);
});

test('digest reports failures', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  assert.equal(digest.failed[0].title, 'Failed post');
  assert.equal(digest.failed[0].reason.includes('Token expired'), true);
});

test('daily brief section includes required summary lines', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  assert.equal(digest.dailyBriefSection.heading, 'Content Actions');
  assert.equal(digest.dailyBriefSection.summary.includes('1 published'), true);
  assert.equal(digest.dailyBriefSection.bulletLines.some((line) => line.startsWith('Published:')), true);
  assert.equal(digest.dailyBriefSection.bulletLines.some((line) => line.startsWith('Waiting for approval:')), true);
  assert.equal(digest.dailyBriefSection.bulletLines.some((line) => line.startsWith('Failed:')), true);
});

test('digest does not expose unsafe non-LinkedIn permalink', () => {
  const digest = buildContentActionDigest({ actions: [{ ...sampleActions[0], permalink: 'https://evil.example.com/post' }] });
  assert.equal(digest.published[0].safeLinkAvailable, false);
  assert.equal('permalink' in digest.published[0], false);
});

test('digest is safe and read-only', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  assert.equal(digest.safety.doesNotPublish, true);
  assert.equal(digest.safety.doesNotApprove, true);
  assert.equal(digest.safety.doesNotNotify, true);
  assert.equal(digest.safety.noDatabaseWrites, true);
  assert.doesNotThrow(() => assertContentActionDigestSafe(digest));
});

test('digest handles empty action list with calm fallback lines', () => {
  const digest = buildContentActionDigest({ actions: [] });
  assert.equal(digest.counts.published, 0);
  assert.equal(digest.counts.waitingForApproval, 0);
  assert.equal(digest.counts.failed, 0);
  assert.equal(digest.dailyBriefSection.bulletLines.some((line) => line.includes('Nothing was published')), true);
});

test('safe assertion rejects secret-like output', () => {
  const digest = buildContentActionDigest({ actions: sampleActions });
  digest.published[0].reason = 'contains access_token accidentally';
  assert.throws(() => assertContentActionDigestSafe(digest), /forbidden fragment/);
});

test('raw captions and payloads are not required in digest output', () => {
  const digest = buildContentActionDigest({ actions: [{ ...sampleActions[0], reason: 'Safe summary only.' }] });
  const serialized = JSON.stringify(digest).toLowerCase();
  assert.equal(serialized.includes('payload_json'), false);
  assert.equal(serialized.includes('raw_payload'), false);
});
