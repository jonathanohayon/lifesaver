import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APPROVED_CONTENT_STYLE_HEALTH_MODE,
  APPROVED_CONTENT_STYLE_PHASE,
  assertApprovedContentStyleProfileSafe,
  buildApprovedContentStyleStatus,
  buildDefaultApprovedContentStyleProfile,
  evaluateApprovedContentStyle,
} from './approved-content-style-profile.model.js';

test('Phase 11.1 constants are correct', () => {
  assert.equal(APPROVED_CONTENT_STYLE_PHASE, 'phase_11_1_approved_style_definition');
  assert.equal(APPROVED_CONTENT_STYLE_HEALTH_MODE, 'v2-phase-11-1-approved-style-definition');
});

test('default approved content style profile contains required sections', () => {
  const profile = buildDefaultApprovedContentStyleProfile();
  assert.equal(profile.platform, 'linkedin');
  assert.equal(profile.actionType, 'content_publish');
  assert.ok(profile.tone.allowedToneTraits.length >= 5);
  assert.ok(profile.length.maxCharacters > profile.length.minCharacters);
  assert.ok(profile.hashtags.maxHashtags >= 0);
  assert.ok(profile.discountPolicy.requiresOfferSourceForDiscount);
  assert.ok(profile.bannedPhrases.length >= 5);
  assert.ok(profile.complianceNotes.length >= 4);
});

test('profile is definition-only and does not enable auto-run', () => {
  const profile = buildDefaultApprovedContentStyleProfile();
  assert.equal(profile.profileStatus, 'definition_only');
  assert.equal(profile.safety.definitionOnly, true);
  assert.equal(profile.safety.autoRunEnabled, false);
  assert.equal(profile.safety.doesNotPublish, true);
  assert.equal(profile.safety.manualApprovalStillRequired, true);
});

test('profile is safe and contains no secret fragments', () => {
  const profile = buildDefaultApprovedContentStyleProfile();
  assert.doesNotThrow(() => assertApprovedContentStyleProfileSafe(profile));
});

test('status lists deliverable and required sections', () => {
  const status = buildApprovedContentStyleStatus();
  assert.equal(status.deliverable, 'approved_content_style_profile');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.deepEqual(status.requiredProfileSections, ['tone', 'length', 'hashtags', 'discountPolicy', 'bannedPhrases', 'complianceNotes']);
});

test('approved sample content matches style', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'Ecommerce founders do not need another noisy dashboard. They need clear signals, verified metrics, and a calm approval flow before any operator action moves forward.',
    hashtags: ['#ecommerce', '#founders'],
  });
  assert.equal(result.matchesApprovedStyle, true);
  assert.equal(result.decision, 'style_match');
  assert.equal(result.issues.length, 0);
});

test('short caption requires manual review', () => {
  const result = evaluateApprovedContentStyle({ caption: 'Quick update.', hashtags: [] });
  assert.equal(result.matchesApprovedStyle, false);
  assert.equal(result.decision, 'requires_manual_review');
  assert.equal(result.issues[0]?.code, 'caption_too_short');
});

test('caption over max length is blocked', () => {
  const result = evaluateApprovedContentStyle({ caption: 'A'.repeat(1300), hashtags: [] });
  assert.equal(result.decision, 'blocked_by_style_profile');
  assert.equal(result.issues.some((issue) => issue.code === 'caption_too_long'), true);
});

test('too many hashtags requires manual review', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'A practical founder update about building safer ecommerce automation with measured approval gates and verified business data before execution.',
    hashtags: ['#one', '#two', '#three', '#four'],
  });
  assert.equal(result.decision, 'requires_manual_review');
  assert.equal(result.issues.some((issue) => issue.code === 'too_many_hashtags'), true);
});

test('banned hashtag blocks style match', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'A practical founder update about safer ecommerce decision making, human approval, and reliable operator systems for growing teams.',
    hashtags: ['#guaranteedprofit'],
  });
  assert.equal(result.decision, 'blocked_by_style_profile');
  assert.equal(result.issues.some((issue) => issue.code === 'banned_hashtag'), true);
});

test('banned phrase blocks style match', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'This ecommerce system creates guaranteed profit for every founder and removes the need for careful decision making across the business.',
    hashtags: ['#ecommerce'],
  });
  assert.equal(result.decision, 'blocked_by_style_profile');
  assert.equal(result.issues.some((issue) => issue.code === 'banned_phrase'), true);
});

test('discount claim without attached offer source is blocked', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'Our approved ecommerce workflow is now available with a limited time discount for founders who want safer decisions and clearer metrics.',
    hashtags: ['#ecommerce'],
    offerSourceAttached: false,
  });
  assert.equal(result.decision, 'blocked_by_style_profile');
  assert.equal(result.issues.some((issue) => issue.code === 'discount_claim_without_offer_source'), true);
});

test('discount claim with offer source can pass discount gate', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'Our approved ecommerce workflow is now available with a discount for founders who want safer decisions, provided through an attached approved offer source.',
    hashtags: ['#ecommerce'],
    offerSourceAttached: true,
  });
  assert.equal(result.issues.some((issue) => issue.code === 'discount_claim_without_offer_source'), false);
});

test('sensitive claims require compliance note', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'This founder update should never include financial advice or guaranteed revenue claims without careful review and compliance context attached.',
    hashtags: ['#ecommerce'],
    complianceNoteAttached: false,
  });
  assert.equal(result.decision, 'blocked_by_style_profile');
  assert.equal(result.issues.some((issue) => issue.code === 'sensitive_claim_without_compliance_note'), true);
});

test('evaluation summary is safe and does not expose raw payloads or secrets', () => {
  const result = evaluateApprovedContentStyle({
    caption: 'A practical founder update about safer ecommerce automation and approval-first publishing for teams that need calm, verified business decisions.',
    hashtags: ['#ecommerce'],
  });
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['access_token', 'refresh_token', 'authorization', 'database_url', 'payload_json', 'raw_payload', 'rollback_payload', 'encrypted_']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('future auto-run gates are explicitly required', () => {
  const profile = buildDefaultApprovedContentStyleProfile();
  assert.equal(profile.safety.futureAutoRunRequiresPolicyGate, true);
  assert.equal(profile.safety.futureAutoRunRequiresPauseGate, true);
  assert.equal(profile.safety.futureAutoRunRequiresCapGate, true);
  assert.equal(profile.safety.futureAutoRunRequiresResultLogGate, true);
});
