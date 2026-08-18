import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_RISK_SCORE_HEALTH_MODE,
  CONTENT_RISK_SCORE_PHASE,
  assertContentRiskScoreSafe,
  buildContentRiskScoreStatus,
  calculateContentRiskScore,
  severityForTesting,
} from './content-risk-score.model.js';

test('Phase 11.2 constants are correct', () => {
  assert.equal(CONTENT_RISK_SCORE_PHASE, 'phase_11_2_content_risk_scoring');
  assert.equal(CONTENT_RISK_SCORE_HEALTH_MODE, 'v2-phase-11-2-content-risk-scoring');
});

test('status lists all required risk categories', () => {
  const status = buildContentRiskScoreStatus();
  assert.equal(status.deliverable, 'content_risk_score_function');
  assert.equal(status.supportedPlatform, 'linkedin');
  assert.deepEqual(status.scoringCategories, [
    'sensitive_terms',
    'overpromising',
    'discount_claims',
    'brand_mismatch',
    'platform_risk',
    'compliance_concerns',
  ]);
  assert.equal(status.safety.scoringOnly, true);
  assert.equal(status.safety.autoRunEnabled, false);
});

test('safe approved style content receives low risk score', () => {
  const result = calculateContentRiskScore({
    caption: 'Ecommerce founders need calm operating systems: verified metrics, thoughtful approval gates, and careful execution paths before any action affects customers or channels.',
    hashtags: ['#ecommerce', '#founders'],
    platform: 'linkedin',
    mediaType: 'none',
    verifiedMetricSourceAttached: true,
  });
  assert.equal(result.riskLevel, 'low');
  assert.equal(result.totalScore, 0);
  assert.equal(result.decision, 'eligible_for_future_auto_run_review');
  assert.equal(result.autoRunEligibleNow, false);
});

test('sensitive terms increase sensitive category risk', () => {
  const result = calculateContentRiskScore({
    caption: 'This update should not claim financial advice, legal advice, or guaranteed revenue for ecommerce founders without manual review.',
    hashtags: ['#ecommerce'],
    platform: 'linkedin',
  });
  assert.ok(result.findings.some((finding) => finding.category === 'sensitive_terms'));
  assert.ok(result.totalScore > 0);
  assert.notEqual(result.decision, 'eligible_for_future_auto_run_review');
});

test('overpromising language is detected', () => {
  const result = calculateContentRiskScore({
    caption: 'This system creates guaranteed results and instant success for every ecommerce founder with no effort required.',
    hashtags: ['#ecommerce'],
    platform: 'linkedin',
  });
  assert.ok(result.findings.some((finding) => finding.category === 'overpromising'));
  assert.ok(result.totalScore >= 20);
});

test('discount claim without offer source is high risk', () => {
  const result = calculateContentRiskScore({
    caption: 'A calm founder update about a limited time discount for safer ecommerce operations and approval-first workflows.',
    hashtags: ['#ecommerce'],
    offerSourceAttached: false,
  });
  assert.ok(result.findings.some((finding) => finding.code === 'discount_claim_without_source'));
  assert.equal(result.safeSummary.hasDiscountClaim, true);
});

test('discount claim with offer source is still recorded but lower risk', () => {
  const withoutSource = calculateContentRiskScore({
    caption: 'A calm founder update about a discount for safer ecommerce workflows and approval-first decisions.',
    hashtags: ['#ecommerce'],
    offerSourceAttached: false,
  });
  const withSource = calculateContentRiskScore({
    caption: 'A calm founder update about a discount for safer ecommerce workflows and approval-first decisions.',
    hashtags: ['#ecommerce'],
    offerSourceAttached: true,
  });
  assert.ok(withSource.totalScore < withoutSource.totalScore);
  assert.ok(withSource.findings.some((finding) => finding.code === 'discount_claim_with_source'));
});

test('brand mismatch language is detected', () => {
  const result = calculateContentRiskScore({
    caption: 'Use this insane hack to destroy your competitors and crush everyone in ecommerce without careful approval gates.',
    hashtags: ['#ecommerce'],
  });
  assert.ok(result.findings.some((finding) => finding.category === 'brand_mismatch'));
});

test('unsupported platform is blocked by platform risk', () => {
  const result = calculateContentRiskScore({
    caption: 'A calm founder update about safer ecommerce automation and approval-first content operations for the team.',
    hashtags: ['#ecommerce'],
    platform: 'instagram',
  });
  assert.ok(result.findings.some((finding) => finding.code === 'unsupported_platform_for_lane'));
  assert.equal(result.decision, 'blocked_by_risk_score');
});

test('unsupported media type is high platform risk', () => {
  const result = calculateContentRiskScore({
    caption: 'A calm founder update about safer ecommerce automation and approval-first content operations for the team.',
    hashtags: ['#ecommerce'],
    mediaType: 'video',
  });
  assert.ok(result.findings.some((finding) => finding.code === 'media_type_not_supported_for_auto_run_lane'));
});

test('too many hashtags creates platform risk', () => {
  const result = calculateContentRiskScore({
    caption: 'A calm founder update about safer ecommerce automation and approval-first content operations for the team.',
    hashtags: ['#one', '#two', '#three', '#four'],
  });
  assert.ok(result.findings.some((finding) => finding.code === 'too_many_hashtags_for_linkedin_lane'));
});

test('metric claims require verified source', () => {
  const result = calculateContentRiskScore({
    caption: 'Revenue, ROAS, and ad spend improved after the team adopted calmer ecommerce approval workflows.',
    hashtags: ['#ecommerce'],
    verifiedMetricSourceAttached: false,
  });
  assert.ok(result.findings.some((finding) => finding.code === 'metric_claim_without_verified_source'));
  assert.equal(result.safeSummary.hasComplianceConcern, true);
});

test('compliance terms without note can become critical', () => {
  const result = calculateContentRiskScore({
    caption: 'This must not be treated as legal advice, medical advice, financial advice, guaranteed revenue, or guaranteed ROI for any founder.',
    hashtags: ['#ecommerce'],
    complianceNoteAttached: false,
  });
  assert.equal(result.riskLevel, 'critical');
  assert.equal(result.decision, 'blocked_by_risk_score');
  assert.ok(result.findings.some((finding) => finding.code === 'compliance_terms_without_note'));
});

test('compliance note lowers compliance concern but does not auto-run now', () => {
  const result = calculateContentRiskScore({
    caption: 'This careful founder note references financial advice only as something LIFE.SAVER should avoid without compliance review.',
    hashtags: ['#ecommerce'],
    complianceNoteAttached: true,
  });
  assert.ok(result.totalScore > 0);
  assert.equal(result.autoRunEligibleNow, false);
});

test('result has one category score for each category', () => {
  const result = calculateContentRiskScore({
    caption: 'A practical founder update about safer ecommerce automation and approval-first content systems for calmer decisions.',
    hashtags: ['#ecommerce'],
  });
  assert.equal(result.categoryScores.length, 6);
  for (const categoryScore of result.categoryScores) {
    assert.ok(categoryScore.maxScore > 0);
    assert.ok(categoryScore.score >= 0);
  }
});

test('total score is capped at 100', () => {
  const result = calculateContentRiskScore({
    caption: 'Guaranteed results, guaranteed profit, guaranteed revenue, financial advice, legal advice, medical advice, cure, treat disease, today only, last chance, destroy your competitors, get rich quick, guaranteed ROAS, guaranteed sales.',
    hashtags: ['#guaranteedprofit', '#getrichquick', '#riskfree', '#medicalcure'],
    platform: 'instagram',
    mediaType: 'video',
    offerSourceAttached: false,
    complianceNoteAttached: false,
    verifiedMetricSourceAttached: false,
  });
  assert.equal(result.totalScore <= 100, true);
  assert.equal(result.riskLevel, 'critical');
});

test('safe assertion rejects forbidden secret fragments', () => {
  const result = calculateContentRiskScore({
    caption: 'A practical founder update about safer ecommerce automation and approval-first content systems for calmer decisions.',
    hashtags: ['#ecommerce'],
  });
  assert.doesNotThrow(() => assertContentRiskScoreSafe(result));
  const unsafe = { ...result, findings: [{ ...result.findings[0], message: 'access_token leaked' }] } as any;
  assert.throws(() => assertContentRiskScoreSafe(unsafe), /forbidden fragment/);
});

test('risk score output never exposes raw payloads or secrets', () => {
  const result = calculateContentRiskScore({
    caption: 'A practical founder update about safer ecommerce automation and approval-first content systems for calmer decisions.',
    hashtags: ['#ecommerce'],
  });
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['access_token', 'refresh_token', 'authorization', 'database_url', 'payload_json', 'raw_payload', 'rollback_payload', 'encrypted_']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('safety flags confirm scoring-only and no auto approval', () => {
  const result = calculateContentRiskScore({
    caption: 'A practical founder update about safer ecommerce automation and approval-first content systems for calmer decisions.',
    hashtags: ['#ecommerce'],
  });
  assert.equal(result.safety.scoringOnly, true);
  assert.equal(result.safety.autoRunEnabled, false);
  assert.equal(result.safety.autoApprovalEnabled, false);
  assert.equal(result.safety.doesNotPublish, true);
  assert.equal(result.safety.externalApiCalled, false);
  assert.equal(result.safety.manualApprovalStillRequired, true);
  assert.equal(result.safety.noDatabaseWrites, true);
});

test('severity helper remains deterministic', () => {
  assert.equal(severityForTesting(3), 'low');
  assert.equal(severityForTesting(8), 'medium');
  assert.equal(severityForTesting(16), 'high');
  assert.equal(severityForTesting(25), 'critical');
});
