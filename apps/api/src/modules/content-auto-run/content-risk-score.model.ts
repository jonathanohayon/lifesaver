import { evaluateApprovedContentStyle } from './approved-content-style-profile.model.js';
import type {
  ContentRiskCategoryKey,
  ContentRiskCategoryScore,
  ContentRiskFinding,
  ContentRiskLevel,
  ContentRiskScoreInput,
  ContentRiskScoreResult,
  ContentRiskScoreStatus,
} from './content-risk-score.types.js';

export const CONTENT_RISK_SCORE_PHASE = 'phase_11_2_content_risk_scoring' as const;
export const CONTENT_RISK_SCORE_HEALTH_MODE = 'v2-phase-11-2-content-risk-scoring' as const;

const scoringCategories: ContentRiskCategoryKey[] = [
  'sensitive_terms',
  'overpromising',
  'discount_claims',
  'brand_mismatch',
  'platform_risk',
  'compliance_concerns',
];

const thresholds = {
  lowMax: 19,
  mediumMax: 39,
  highMax: 69,
  criticalMin: 70,
  futureAutoRunMaxAllowed: 10,
} as const;

const categoryMaxScores: Record<ContentRiskCategoryKey, number> = {
  sensitive_terms: 25,
  overpromising: 25,
  discount_claims: 20,
  brand_mismatch: 15,
  platform_risk: 15,
  compliance_concerns: 30,
};

const sensitiveTerms = [
  'cure',
  'treat disease',
  'medical claim',
  'financial advice',
  'legal advice',
  'guaranteed revenue',
  'guaranteed profit',
  'risk-free income',
];

const overpromisingTerms = [
  'guaranteed results',
  'guaranteed profit',
  'guaranteed revenue',
  'make money while you sleep',
  'no effort required',
  'risk free',
  'risk-free',
  'best in the world',
  'instant success',
];

const discountTerms = [
  'discount',
  '% off',
  'percent off',
  'sale',
  'coupon',
  'promo code',
  'limited time',
  'today only',
  'last chance',
];

const brandMismatchTerms = [
  'destroy your competitors',
  'crush everyone',
  'hustle harder',
  'get rich quick',
  'no-brainer bro',
  'insane hack',
  'explosive guaranteed growth',
];

const complianceConcernTerms = [
  'medical advice',
  'legal advice',
  'financial advice',
  'guaranteed outcome',
  'guaranteed roi',
  'guaranteed roas',
  'guaranteed revenue',
  'guaranteed sales',
  'cure',
  'treat disease',
];

function normalizeText(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeLower(value: string): string {
  return normalizeText(value).toLowerCase();
}

function findMatches(caption: string, terms: string[]): string[] {
  const lower = normalizeLower(caption);
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function normalizeHashtags(hashtags: unknown): string[] {
  if (!Array.isArray(hashtags)) return [];
  return hashtags.map((tag) => String(tag || '').trim()).filter(Boolean);
}

function clampScore(score: number, maxScore: number): number {
  return Math.max(0, Math.min(score, maxScore));
}

function addFinding(findings: ContentRiskFinding[], finding: ContentRiskFinding): void {
  findings.push(finding);
}

function severityFromPoints(points: number): ContentRiskLevel {
  if (points >= 25) return 'critical';
  if (points >= 16) return 'high';
  if (points >= 8) return 'medium';
  return 'low';
}

function buildCategoryScore(category: ContentRiskCategoryKey, findings: ContentRiskFinding[]): ContentRiskCategoryScore {
  const categoryFindings = findings.filter((finding) => finding.category === category);
  const maxScore = categoryMaxScores[category];
  return {
    category,
    score: clampScore(categoryFindings.reduce((sum, finding) => sum + finding.points, 0), maxScore),
    maxScore,
    findings: categoryFindings,
  };
}

export function buildContentRiskSafety(): ContentRiskScoreResult['safety'] {
  return {
    scoringOnly: true,
    autoRunEnabled: false,
    autoApprovalEnabled: false,
    doesNotPublish: true,
    externalApiCalled: false,
    manualApprovalStillRequired: true,
    noDatabaseWrites: true,
    futureAutoRunRequiresAdditionalGates: true,
  };
}

export function calculateContentRiskScore(input: ContentRiskScoreInput): ContentRiskScoreResult {
  const caption = normalizeText(input.caption);
  const hashtags = normalizeHashtags(input.hashtags);
  const platform = String(input.platform || 'linkedin').toLowerCase();
  const mediaType = String(input.mediaType || 'none').toLowerCase();
  const findings: ContentRiskFinding[] = [];

  const sensitiveMatches = findMatches(caption, sensitiveTerms);
  if (sensitiveMatches.length > 0) {
    addFinding(findings, {
      category: 'sensitive_terms',
      code: 'sensitive_terms_detected',
      severity: 'high',
      points: Math.min(25, 10 + sensitiveMatches.length * 5),
      message: 'Caption contains sensitive terms that require manual review before any future auto-run lane.',
      matchedTerms: sensitiveMatches,
    });
  }

  const overpromisingMatches = findMatches(caption, overpromisingTerms);
  if (overpromisingMatches.length > 0) {
    addFinding(findings, {
      category: 'overpromising',
      code: 'overpromising_detected',
      severity: 'high',
      points: Math.min(25, 12 + overpromisingMatches.length * 5),
      message: 'Caption appears to overpromise results or outcomes.',
      matchedTerms: overpromisingMatches,
    });
  }

  const discountMatches = findMatches(caption, discountTerms);
  if (discountMatches.length > 0) {
    addFinding(findings, {
      category: 'discount_claims',
      code: input.offerSourceAttached ? 'discount_claim_with_source' : 'discount_claim_without_source',
      severity: input.offerSourceAttached ? 'medium' : 'high',
      points: input.offerSourceAttached ? 6 : Math.min(20, 10 + discountMatches.length * 4),
      message: input.offerSourceAttached
        ? 'Caption contains discount/urgency language with an offer source attached, so manual review remains recommended.'
        : 'Caption contains discount/urgency language without an approved offer source.',
      matchedTerms: discountMatches,
    });
  }

  const brandMismatchMatches = findMatches(caption, brandMismatchTerms);
  if (brandMismatchMatches.length > 0) {
    addFinding(findings, {
      category: 'brand_mismatch',
      code: 'brand_mismatch_language_detected',
      severity: 'medium',
      points: Math.min(15, 7 + brandMismatchMatches.length * 4),
      message: 'Caption contains language that does not match the calm approved brand style.',
      matchedTerms: brandMismatchMatches,
    });
  }

  const styleEvaluation = evaluateApprovedContentStyle({
    caption,
    hashtags,
    offerSourceAttached: input.offerSourceAttached,
    complianceNoteAttached: input.complianceNoteAttached,
  });
  const approvedBrandStyleMatched = input.approvedBrandStyleMatched ?? styleEvaluation.matchesApprovedStyle;
  if (!approvedBrandStyleMatched) {
    addFinding(findings, {
      category: 'brand_mismatch',
      code: 'approved_style_profile_mismatch',
      severity: styleEvaluation.decision === 'blocked_by_style_profile' ? 'high' : 'medium',
      points: styleEvaluation.decision === 'blocked_by_style_profile' ? 12 : 6,
      message: 'Caption does not fully match the Phase 11.1 approved style profile.',
    });
  }

  if (platform !== 'linkedin') {
    addFinding(findings, {
      category: 'platform_risk',
      code: 'unsupported_platform_for_lane',
      severity: 'critical',
      points: 15,
      message: 'Phase 11 content auto-run risk scoring currently supports LinkedIn only.',
      matchedTerms: [platform],
    });
  }

  if (!['none', 'link'].includes(mediaType)) {
    addFinding(findings, {
      category: 'platform_risk',
      code: 'media_type_not_supported_for_auto_run_lane',
      severity: 'high',
      points: 12,
      message: 'The future narrow auto-run lane may only consider text/link content until media publishing is explicitly approved.',
      matchedTerms: [mediaType],
    });
  }

  if (hashtags.length > 3) {
    addFinding(findings, {
      category: 'platform_risk',
      code: 'too_many_hashtags_for_linkedin_lane',
      severity: 'medium',
      points: 6,
      message: 'LinkedIn content has more hashtags than the approved style profile allows.',
    });
  }

  if (caption.length > 1200) {
    addFinding(findings, {
      category: 'platform_risk',
      code: 'caption_too_long_for_approved_lane',
      severity: 'high',
      points: 10,
      message: 'Caption exceeds the approved style profile maximum length.',
    });
  }

  const complianceMatches = findMatches(caption, complianceConcernTerms);
  const mentionsMetric = /\b(roas|revenue|profit|sales|orders|conversion rate|aov|ad spend|roi)\b/i.test(caption);
  if (complianceMatches.length > 0) {
    addFinding(findings, {
      category: 'compliance_concerns',
      code: input.complianceNoteAttached ? 'compliance_terms_with_note' : 'compliance_terms_without_note',
      severity: input.complianceNoteAttached ? 'medium' : 'critical',
      points: input.complianceNoteAttached ? 10 : Math.min(30, 16 + complianceMatches.length * 5),
      message: input.complianceNoteAttached
        ? 'Compliance-sensitive terms are present with a compliance note; manual review still remains required.'
        : 'Compliance-sensitive terms are present without an attached compliance note.',
      matchedTerms: complianceMatches,
    });
  }

  if (mentionsMetric && !input.verifiedMetricSourceAttached) {
    addFinding(findings, {
      category: 'compliance_concerns',
      code: 'metric_claim_without_verified_source',
      severity: 'high',
      points: 14,
      message: 'Caption mentions performance metrics without an attached verified metric source.',
    });
  }

  const categoryScores = scoringCategories.map((category) => buildCategoryScore(category, findings));
  const totalScore = Math.min(100, categoryScores.reduce((sum, item) => sum + item.score, 0));
  const hasCriticalFinding = findings.some((finding) => finding.severity === 'critical');
  const riskLevel: ContentRiskLevel = hasCriticalFinding || totalScore >= thresholds.criticalMin
    ? 'critical'
    : totalScore > thresholds.mediumMax
      ? 'high'
      : totalScore > thresholds.lowMax
        ? 'medium'
        : 'low';

  const decision = riskLevel === 'critical' || totalScore > thresholds.highMax
    ? 'blocked_by_risk_score'
    : totalScore <= thresholds.futureAutoRunMaxAllowed && findings.length === 0
      ? 'eligible_for_future_auto_run_review'
      : 'requires_manual_review';

  return {
    phase: CONTENT_RISK_SCORE_PHASE,
    healthMode: CONTENT_RISK_SCORE_HEALTH_MODE,
    deliverable: 'content_risk_score_function',
    platform: 'linkedin',
    totalScore,
    riskLevel,
    decision,
    autoRunEligibleNow: false,
    categoryScores,
    findings,
    safeSummary: {
      captionCharacters: caption.length,
      hashtagCount: hashtags.length,
      mediaType,
      hasDiscountClaim: discountMatches.length > 0,
      hasSensitiveTerms: sensitiveMatches.length > 0,
      hasComplianceConcern: complianceMatches.length > 0 || (mentionsMetric && !input.verifiedMetricSourceAttached),
      approvedBrandStyleMatched,
    },
    thresholds,
    safety: buildContentRiskSafety(),
  };
}

export function buildContentRiskScoreStatus(): ContentRiskScoreStatus {
  return {
    phase: CONTENT_RISK_SCORE_PHASE,
    healthMode: CONTENT_RISK_SCORE_HEALTH_MODE,
    enabled: true,
    deliverable: 'content_risk_score_function',
    supportedPlatform: 'linkedin',
    supportedActionType: 'content_publish',
    scoringCategories,
    safety: buildContentRiskSafety(),
  };
}

export function assertContentRiskScoreSafe(result: ContentRiskScoreResult): void {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of [
    'access_token',
    'refresh_token',
    'authorization',
    'client_secret',
    'database_url',
    'app_encryption_key',
    'worker_shared_secret',
    'payload_json',
    'raw_payload',
    'rollback_payload',
    'encrypted_',
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content risk score output contains forbidden fragment: ${forbidden}`);
    }
  }
  if (!result.safety.scoringOnly || result.safety.autoRunEnabled || result.safety.autoApprovalEnabled || !result.safety.manualApprovalStillRequired || result.autoRunEligibleNow) {
    throw new Error('Content risk score safety flags are invalid for Phase 11.2.');
  }
}

export function severityForTesting(points: number): ContentRiskLevel {
  return severityFromPoints(points);
}
