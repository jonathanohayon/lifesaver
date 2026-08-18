import assert from 'node:assert/strict';
import {
  assertSafeEmailTemplate,
  buildApprovalNeededEmailTemplate,
  escapeHtml,
  normalizeCreatedAt,
  redactSensitiveText,
  validateReviewUrl,
} from './notification-email-template.model.js';
import type { NotificationEmailTemplateActionInput } from './notification-email-template.types.js';

function input(overrides: Partial<NotificationEmailTemplateActionInput> = {}): NotificationEmailTemplateActionInput {
  return {
    actionId: '11111111-1111-1111-1111-111111111111',
    title: 'Approve LinkedIn test post',
    actionType: 'content_publish',
    riskLevel: 'high',
    reason: 'Manual approval is required before publishing this LinkedIn post.',
    reviewUrl: 'https://lifesaveragent.com/actions.html?actionId=11111111-1111-1111-1111-111111111111',
    createdAt: '2026-07-06T12:00:00.000Z',
    workspaceName: 'Founder Workspace',
    ...overrides,
  };
}

function expectThrows(fn: () => unknown, fragment: string) {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.match(String((error as Error).message), new RegExp(fragment, 'i'));
  }
  assert.equal(thrown, true, `Expected error containing ${fragment}`);
}

const tests: Array<[string, () => void]> = [
  ['builds required template metadata', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.version, '0.7.0');
    assert.equal(template.phase, 'phase_10_3_email_notification_template');
    assert.equal(template.templateKey, 'approval_needed_email');
  }],
  ['subject includes action title', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.subject.includes('Approve LinkedIn test post'), true);
  }],
  ['text body includes action title', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.textBody.includes('Action title: Approve LinkedIn test post'), true);
  }],
  ['text body includes action type', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.textBody.includes('Action type: content_publish'), true);
  }],
  ['text body includes risk level', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.textBody.includes('Risk level: high'), true);
  }],
  ['text body includes reason', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.textBody.includes('Manual approval is required'), true);
  }],
  ['text body includes review link', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.textBody.includes('https://lifesaveragent.com/actions.html'), true);
  }],
  ['html body includes safe CTA link', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.htmlBody.includes('Review action'), true);
    assert.equal(template.htmlBody.includes('href="https://lifesaveragent.com/actions.html'), true);
  }],
  ['html escapes action title', () => {
    const template = buildApprovalNeededEmailTemplate(input({ title: '<b>Danger</b> approval' }));
    assert.equal(template.htmlBody.includes('&lt;b&gt;Danger&lt;/b&gt; approval'), true);
    assert.equal(template.htmlBody.includes('<b>Danger</b>'), false);
  }],
  ['html escapes reason', () => {
    const template = buildApprovalNeededEmailTemplate(input({ reason: 'Use <script>alert(1)</script> safely' }));
    assert.equal(template.htmlBody.includes('&lt;script&gt;'), true);
    assert.equal(template.htmlBody.toLowerCase().includes('<script'), false);
  }],
  ['relative review URL is allowed', () => {
    const template = buildApprovalNeededEmailTemplate(input({ reviewUrl: './actions.html?actionId=abc' }));
    assert.equal(template.reviewUrl, './actions.html?actionId=abc');
  }],
  ['root-relative review URL is allowed', () => {
    const template = buildApprovalNeededEmailTemplate(input({ reviewUrl: '/actions.html?actionId=abc' }));
    assert.equal(template.reviewUrl, '/actions.html?actionId=abc');
  }],
  ['HTTP absolute review URL is blocked', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'http://lifesaveragent.com/actions.html' })), 'HTTPS');
  }],
  ['javascript review URL is blocked', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'javascript:alert(1)' })), 'unsafe URL');
  }],
  ['data review URL is blocked', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'data:text/html,hello' })), 'unsafe URL');
  }],
  ['review URL with token query is blocked', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'https://lifesaveragent.com/actions.html?access_token=secret' })), 'token');
  }],
  ['review URL with embedded credentials is blocked', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'https://user:pass@lifesaveragent.com/actions.html' })), 'embedded credentials');
  }],
  ['redacts secret-like text from reason', () => {
    const template = buildApprovalNeededEmailTemplate(input({ reason: 'authorization: Bearer abc123 should not show' }));
    assert.equal(template.textBody.toLowerCase().includes('bearer'), false);
    assert.equal(template.textBody.includes('[redacted secret]'), true);
  }],
  ['redacts secret-like text from title', () => {
    const template = buildApprovalNeededEmailTemplate(input({ title: 'access_token=abc approve post' }));
    assert.equal(template.subject.toLowerCase().includes('access_token'), false);
    assert.equal(template.subject.includes('[redacted secret]'), true);
  }],
  ['template safety flags say no send', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.safety.templateOnly, true);
    assert.equal(template.safety.sendsEmailInThisPhase, false);
    assert.equal(template.safety.callsExternalEmailProvider, false);
  }],
  ['template safety flags include required fields', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assert.equal(template.safety.includesActionTitle, true);
    assert.equal(template.safety.includesActionType, true);
    assert.equal(template.safety.includesRiskLevel, true);
    assert.equal(template.safety.includesReason, true);
    assert.equal(template.safety.includesReviewLink, true);
  }],
  ['safe assertion passes normal template', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    assertSafeEmailTemplate(template);
  }],
  ['safe assertion rejects unsafe HTML', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    (template as any).htmlBody += '<script>alert(1)</script>';
    expectThrows(() => assertSafeEmailTemplate(template), 'unsafe HTML');
  }],
  ['safe assertion rejects sending claim', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    (template.safety as any).sendsEmailInThisPhase = true;
    expectThrows(() => assertSafeEmailTemplate(template), 'template-only');
  }],
  ['safe assertion rejects forbidden fragment if injected', () => {
    const template = buildApprovalNeededEmailTemplate(input());
    (template as any).raw = 'refresh_token=secret';
    expectThrows(() => assertSafeEmailTemplate(template), 'forbidden fragment');
  }],
  ['missing title is rejected', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ title: '' })), 'title');
  }],
  ['missing reason is rejected', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reason: '' })), 'reason');
  }],
  ['normalizeCreatedAt returns ISO', () => {
    assert.equal(normalizeCreatedAt('2026-07-06T12:00:00.000Z'), '2026-07-06T12:00:00.000Z');
  }],
  ['normalizeCreatedAt handles invalid value', () => {
    assert.equal(normalizeCreatedAt('not-a-date'), null);
  }],
  ['escapeHtml escapes quotes and ampersand', () => {
    assert.equal(escapeHtml('Tom & "Jerry"'), 'Tom &amp; &quot;Jerry&quot;');
  }],
  ['redactSensitiveText removes payload_json fragment', () => {
    const value = redactSensitiveText('payload_json: { secret: true }');
    assert.equal(value.toLowerCase().includes('payload_json'), false);
  }],
  ['validateReviewUrl returns HTTPS absolute URL', () => {
    assert.equal(validateReviewUrl('https://lifesaveragent.com/actions.html').startsWith('https://'), true);
  }],
  ['rejects email review links that try to approve automatically', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: 'https://lifesaveragent.com/actions.html?actionId=abc&approve=true' })), 'review only');
  }],
  ['rejects email review links that try to execute automatically', () => {
    expectThrows(() => buildApprovalNeededEmailTemplate(input({ reviewUrl: './actions.html?actionId=abc&execute=true' })), 'review only');
  }],
];

let failed = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS notification-email-template:test — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL notification-email-template:test — ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`notification-email-template:test — ${tests.length - failed} passed, ${failed} failed`);
  process.exit(1);
}

console.log(`notification-email-template:test — ${tests.length} passed, 0 failed`);
