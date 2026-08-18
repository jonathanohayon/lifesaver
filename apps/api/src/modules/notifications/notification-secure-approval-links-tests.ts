import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertReviewUrlIsOpenOnly,
  buildSecureApprovalLinksStatus,
  buildSecureApprovalReviewUrl,
} from './notification-secure-approval-links.model.js';

const actionId = '11111111-1111-4111-8111-111111111111';

test('builds an email approval link that opens app review only', () => {
  const link = buildSecureApprovalReviewUrl({ actionId, source: 'email_notification' });
  assert.equal(link.phase, 'phase_10_9_secure_approval_links');
  assert.equal(link.reviewUrl, './actions.html?actionId=11111111-1111-4111-8111-111111111111&source=email_notification&linkMode=review_only');
  assert.equal(link.behavior.opensApp, true);
  assert.equal(link.behavior.requiresLogin, true);
  assert.equal(link.safety.canApproveByClickingEmailLink, false);
  assert.equal(link.safety.requiresSeparateButtonClickInsideApp, true);
});

test('builds an absolute HTTPS secure approval link', () => {
  const link = buildSecureApprovalReviewUrl({ actionId, source: 'approval_reminder', appBaseUrl: 'https://lifesaveragent.com/' });
  assert.equal(link.reviewUrl, 'https://lifesaveragent.com/actions.html?actionId=11111111-1111-4111-8111-111111111111&source=approval_reminder&linkMode=review_only');
});

test('can attach a safe notification key without adding mutation behavior', () => {
  const link = buildSecureApprovalReviewUrl({ actionId, source: 'in_app_notification_center', notificationKey: 'approval-reminder:abc_123' });
  assert.equal(link.notificationKey, 'approval-reminder:abc_123');
  assert.equal(link.reviewUrl.includes('notificationKey=approval-reminder%3Aabc_123'), true);
  assert.equal(link.safety.canExecuteByClickingEmailLink, false);
});

test('rejects unsafe notification key characters', () => {
  assert.throws(() => buildSecureApprovalReviewUrl({ actionId, notificationKey: 'bad key with spaces' }), /notification key/);
});

test('rejects links that target approve mutation routes', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://lifesaveragent.com/api/v1/actions/abc/approve'), /action review screen|API mutation/);
});

test('rejects links with approval query params', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://lifesaveragent.com/actions.html?actionId=abc&approve=true'), /mutating query parameter/);
});

test('rejects links with execution query params', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://lifesaveragent.com/actions.html?actionId=abc&execute=true'), /mutating query parameter/);
});

test('rejects links with publishing query params', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://lifesaveragent.com/actions.html?actionId=abc&publish=true'), /mutating query parameter/);
});

test('rejects unsafe URL schemes', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('javascript:alert(1)'), /unsafe URL/);
});

test('rejects embedded credentials', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://user:pass@lifesaveragent.com/actions.html?actionId=abc'), /embedded credentials/);
});

test('rejects token-bearing links', () => {
  assert.throws(() => assertReviewUrlIsOpenOnly('https://lifesaveragent.com/actions.html?actionId=abc&access_token=secret'), /forbidden fragment/);
});

test('allows localhost review links for development', () => {
  assert.doesNotThrow(() => assertReviewUrlIsOpenOnly('http://localhost:3000/actions.html?actionId=abc&source=email_notification&linkMode=review_only'));
});

test('status states link opens app only and cannot approve', () => {
  const status = buildSecureApprovalLinksStatus();
  assert.equal(status.phase, 'phase_10_9_secure_approval_links');
  assert.equal(status.behavior.opensApp, true);
  assert.equal(status.safety.canApproveByClickingEmailLink, false);
  assert.equal(status.safety.canExecuteByClickingEmailLink, false);
});

test('serialized output does not contain sensitive fragments', () => {
  const link = buildSecureApprovalReviewUrl({ actionId, source: 'email_notification' });
  const serialized = JSON.stringify(link).toLowerCase();
  for (const fragment of ['access_token', 'refresh_token', 'authorization', 'payload_json', 'rollback_payload', 'client_secret']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
});
