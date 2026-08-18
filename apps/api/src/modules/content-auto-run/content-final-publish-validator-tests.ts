import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE,
  CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE,
  CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE,
  assertContentFinalPublishValidationSafe,
  buildContentFinalPublishValidationStatus,
  validateContentBeforePublish,
} from './content-final-publish-validator.model.js';

const safeCaption = 'A calm founder update: today we are sharing a practical ecommerce workflow improvement, focused on clearer decisions, safer systems, and better operating rhythm.';

function buildSafeValidation(overrides = {}) {
  return validateContentBeforePublish({
    caption: safeCaption,
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    mediaType: 'none',
    timezone: 'UTC',
    scheduledTime: '2026-07-06T10:00:00.000Z',
    currentTime: '2026-07-06T09:55:00.000Z',
    maxPostsPerDay: 3,
    publishedTodayCount: 0,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
    policyAutoApprovalRuleMatched: true,
    ruleStillEnabled: true,
    tokenConnected: true,
    tokenExpiresAt: '2026-07-07T09:55:00.000Z',
    tokenHasRequiredScope: true,
    ...overrides,
  });
}

test('Phase 11.6 constants are correct', () => {
  assert.equal(CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE, 'phase_11_6_pre_publish_final_validation');
  assert.equal(CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE, 'v2-phase-11-6-pre-publish-final-validation');
  assert.equal(CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE, 'w_member_social');
});

test('status describes final publish validator gates', () => {
  const status = buildContentFinalPublishValidationStatus();
  assert.equal(status.deliverable, 'final_publish_validator');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.equal(status.supportedChannel, 'linkedin_member_feed');
  assert.equal(status.requiredGateNames.includes('token_connected'), true);
  assert.equal(status.requiredGateNames.includes('rule_still_enabled'), true);
  assert.equal(status.safety.validatorOnly, true);
});

test('ready_for_executor_handoff only when every gate passes', () => {
  const result = buildSafeValidation();
  assert.equal(result.decision, 'ready_for_executor_handoff');
  assert.equal(result.readyForExecutorHandoff, true);
  assert.equal(result.gateSummary.failedGates, 0);
  assert.equal(result.gates.every((item) => item.passed), true);
});

test('ready validation still does not publish or call external APIs', () => {
  const result = buildSafeValidation();
  assert.equal(result.autoPublishExecuted, false);
  assert.equal(result.publishCalled, false);
  assert.equal(result.externalApiCalled, false);
  assert.equal(result.safety.doesNotPublish, true);
  assert.equal(result.safety.noDatabaseWrites, true);
});

test('token must be connected', () => {
  const result = buildSafeValidation({ tokenConnected: false });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'token_connected')?.passed, false);
});

test('token must not be expired', () => {
  const result = buildSafeValidation({ tokenExpiresAt: '2026-07-06T09:54:00.000Z' });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.tokenStatusSummary.tokenExpired, true);
  assert.equal(result.gates.find((item) => item.gate === 'token_not_expired')?.passed, false);
});

test('missing token expiry blocks by default', () => {
  const result = buildSafeValidation({ tokenExpiresAt: null });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.tokenStatusSummary.tokenExpired, true);
});

test('required LinkedIn scope must be present', () => {
  const result = buildSafeValidation({ tokenHasRequiredScope: false });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'required_scope_present')?.passed, false);
});

test('master pause blocks final validation', () => {
  const result = buildSafeValidation({ masterPauseActive: true });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'master_pause_off')?.passed, false);
});

test('content pause blocks final validation', () => {
  const result = buildSafeValidation({ contentPauseActive: true });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'content_pause_off')?.passed, false);
});

test('emergency safe mode blocks final validation', () => {
  const result = buildSafeValidation({ emergencySafeModeActive: true });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'emergency_safe_mode_off')?.passed, false);
});

test('daily cap exceeded blocks final validation', () => {
  const result = buildSafeValidation({ maxPostsPerDay: 1, publishedTodayCount: 1 });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'cap_not_exceeded')?.passed, false);
});

test('unsafe content blocks final validation', () => {
  const result = buildSafeValidation({ caption: `${safeCaption} Guaranteed revenue and guaranteed ROAS.` });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'content_safe')?.passed, false);
});

test('disabled rule blocks final validation', () => {
  const result = buildSafeValidation({ ruleStillEnabled: false });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'rule_still_enabled')?.passed, false);
});

test('outside allowed channel/time window blocks final validation', () => {
  const result = buildSafeValidation({ scheduledTime: '2026-07-06T22:00:00.000Z' });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'channel_time_allowed')?.passed, false);
});

test('unsupported platform blocks final validation', () => {
  const result = buildSafeValidation({ platform: 'instagram' });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'platform_supported')?.passed, false);
});

test('image media is not allowed in narrow lane', () => {
  const result = buildSafeValidation({ mediaType: 'image' });
  assert.equal(result.decision, 'blocked_before_publish');
  assert.equal(result.gates.find((item) => item.gate === 'media_type_allowed')?.passed, false);
});

test('safe assertion passes for safe result', () => {
  const result = buildSafeValidation();
  assert.doesNotThrow(() => assertContentFinalPublishValidationSafe(result));
});

test('safe assertion rejects impossible ready result with failed gate', () => {
  const result = buildSafeValidation();
  result.gates[0] = { ...result.gates[0], passed: false };
  assert.throws(() => assertContentFinalPublishValidationSafe(result), /cannot be ready/);
});

test('safe output does not include raw caption, tokens, or secret-like fragments', () => {
  const result = buildSafeValidation();
  const serialized = JSON.stringify(result).toLowerCase();
  assert.equal(serialized.includes(safeCaption.toLowerCase()), false);
  assert.equal(serialized.includes('token-value'), false);
  assert.doesNotThrow(() => assertContentFinalPublishValidationSafe(result));
});
