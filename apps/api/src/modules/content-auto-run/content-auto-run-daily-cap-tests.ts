import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_AUTO_RUN_DAILY_CAP_HEALTH_MODE,
  CONTENT_AUTO_RUN_DAILY_CAP_PHASE,
  assertContentAutoRunDailyCapSafe,
  buildContentAutoRunDailyCapStatus,
  checkContentAutoRunDailyPostCap,
} from './content-auto-run-daily-cap.model.js';

test('Phase 11.3 constants are correct', () => {
  assert.equal(CONTENT_AUTO_RUN_DAILY_CAP_PHASE, 'phase_11_3_max_posts_per_day_enforcement');
  assert.equal(CONTENT_AUTO_RUN_DAILY_CAP_HEALTH_MODE, 'v2-phase-11-3-max-posts-per-day-enforcement');
});

test('status describes daily cap deliverable and safety state', () => {
  const status = buildContentAutoRunDailyCapStatus();
  assert.equal(status.deliverable, 'daily_post_cap_check');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.equal(status.supportedActionType, 'content_publish');
  assert.equal(status.defaultMaxPostsPerDay, 1);
  assert.equal(status.safety.capCheckOnly, true);
  assert.equal(status.safety.autoRunEnabled, false);
});

test('allows future auto-run review when projected posts are below cap', () => {
  const result = checkContentAutoRunDailyPostCap({
    maxPostsPerDay: 3,
    publishedTodayCount: 1,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
  });
  assert.equal(result.decision, 'allowed_for_future_auto_run_review');
  assert.equal(result.capExceeded, false);
  assert.equal(result.remainingToday, 2);
  assert.equal(result.autoRunAllowedNow, false);
});

test('blocks when projected posts exceed max posts per day', () => {
  const result = checkContentAutoRunDailyPostCap({
    maxPostsPerDay: 2,
    publishedTodayCount: 2,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
  });
  assert.equal(result.decision, 'blocked_daily_cap_exceeded');
  assert.equal(result.capExceeded, true);
  assert.equal(result.projectedTotalToday, 3);
});

test('reserved future auto-run slots count against the daily cap', () => {
  const result = checkContentAutoRunDailyPostCap({
    maxPostsPerDay: 2,
    publishedTodayCount: 0,
    reservedTodayCount: 2,
    proposedNewPosts: 1,
  });
  assert.equal(result.decision, 'blocked_daily_cap_exceeded');
  assert.equal(result.remainingToday, 0);
});

test('zero cap blocks content auto-run completely', () => {
  const result = checkContentAutoRunDailyPostCap({
    maxPostsPerDay: 0,
    publishedTodayCount: 0,
  });
  assert.equal(result.decision, 'blocked_invalid_cap');
  assert.equal(result.capExceeded, true);
});

test('unsupported platform is blocked', () => {
  const result = checkContentAutoRunDailyPostCap({
    platform: 'instagram',
    maxPostsPerDay: 3,
  });
  assert.equal(result.decision, 'blocked_invalid_cap');
  assert.equal(result.capExceeded, true);
});

test('unsupported action type is blocked', () => {
  const result = checkContentAutoRunDailyPostCap({
    actionType: 'support_reply_send',
    maxPostsPerDay: 3,
  });
  assert.equal(result.decision, 'blocked_invalid_cap');
  assert.equal(result.capExceeded, true);
});

test('negative counts are normalized safely', () => {
  const result = checkContentAutoRunDailyPostCap({
    maxPostsPerDay: 2,
    publishedTodayCount: -10,
    reservedTodayCount: -5,
    proposedNewPosts: -1,
  });
  assert.equal(result.publishedTodayCount, 0);
  assert.equal(result.reservedTodayCount, 0);
  assert.equal(result.proposedNewPosts, 1);
});

test('safety assertion passes for normal result', () => {
  const result = checkContentAutoRunDailyPostCap({ maxPostsPerDay: 1 });
  assert.doesNotThrow(() => assertContentAutoRunDailyCapSafe(result));
});

test('output never marks auto-run allowed now in Phase 11.3', () => {
  const result = checkContentAutoRunDailyPostCap({ maxPostsPerDay: 10 });
  assert.equal(result.autoRunAllowedNow, false);
  assert.equal(result.safety.manualApprovalStillRequired, true);
});

test('safe output does not contain secret-like fragments', () => {
  const result = checkContentAutoRunDailyPostCap({ maxPostsPerDay: 3, timezone: 'Asia/Karachi' });
  assert.doesNotThrow(() => assertContentAutoRunDailyCapSafe(result));
});
