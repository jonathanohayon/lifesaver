import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSecureApprovalDeepLink, normalizeActionIdForDeepLink, normalizeAppBaseUrl } from './notification-deep-links.model.js';

const actionId = '11111111-1111-4111-8111-111111111111';

test('builds relative secure approval deep link', () => {
  const link = buildSecureApprovalDeepLink({ actionId, source: 'email_notification' });
  assert.equal(link.phase, 'phase_10_4_approval_deep_links');
  assert.equal(link.requiresLogin, true);
  assert.equal(link.reviewUrl, './actions.html?actionId=11111111-1111-4111-8111-111111111111&source=email_notification');
  assert.equal(link.safety.canApproveByLinkAlone, false);
  assert.equal(link.safety.canExecuteByLinkAlone, false);
});

test('builds HTTPS absolute approval deep link when app base is provided', () => {
  const link = buildSecureApprovalDeepLink({ actionId, source: 'in_app_notification_center', appBaseUrl: 'https://lifesaveragent.com/' });
  assert.equal(link.reviewUrl, 'https://lifesaveragent.com/actions.html?actionId=11111111-1111-4111-8111-111111111111&source=in_app_notification_center');
});

test('allows localhost app base for development', () => {
  assert.equal(normalizeAppBaseUrl('http://localhost:3000'), 'http://localhost:3000');
});

test('rejects non-HTTPS non-local app base', () => {
  assert.throws(() => normalizeAppBaseUrl('http://example.com'), /HTTPS/);
});

test('rejects invalid action ids', () => {
  assert.throws(() => normalizeActionIdForDeepLink('not a real id'), /safe action identifier/);
});

test('deep links never contain token or payload wording', () => {
  const link = buildSecureApprovalDeepLink({ actionId });
  const serialized = JSON.stringify(link).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'payload_json', 'rollback_payload']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});
