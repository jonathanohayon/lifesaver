import type {
  ApprovedContentStyleEvaluation,
  ApprovedContentStyleEvaluationInput,
  ApprovedContentStyleEvaluationIssue,
  ApprovedContentStyleProfile,
  ApprovedContentStyleStatus,
} from './approved-content-style-profile.types.js';

export const APPROVED_CONTENT_STYLE_PHASE = 'phase_11_1_approved_style_definition' as const;
export const APPROVED_CONTENT_STYLE_HEALTH_MODE = 'v2-phase-11-1-approved-style-definition' as const;
export const APPROVED_CONTENT_STYLE_PROFILE_KEY = 'default_linkedin_approved_content_style_v1' as const;

const sensitiveClaimPatterns = [
  'guaranteed results',
  'guaranteed revenue',
  'guaranteed profit',
  'cure',
  'treat disease',
  'medical claim',
  'financial advice',
  'legal advice',
];

const discountClaimPatterns = [
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

export function buildApprovedContentStyleSafety(): ApprovedContentStyleProfile['safety'] {
  return {
    definitionOnly: true,
    autoRunEnabled: false,
    doesNotPublish: true,
    doesNotApproveActions: true,
    externalApiCalled: false,
    manualApprovalStillRequired: true,
    futureAutoRunRequiresPolicyGate: true,
    futureAutoRunRequiresPauseGate: true,
    futureAutoRunRequiresCapGate: true,
    futureAutoRunRequiresResultLogGate: true,
  };
}

export function buildDefaultApprovedContentStyleProfile(): ApprovedContentStyleProfile {
  return {
    version: '0.7.0',
    phase: APPROVED_CONTENT_STYLE_PHASE,
    healthMode: APPROVED_CONTENT_STYLE_HEALTH_MODE,
    profileKey: APPROVED_CONTENT_STYLE_PROFILE_KEY,
    profileStatus: 'definition_only',
    actionType: 'content_publish',
    platform: 'linkedin',
    tone: {
      primaryTone: 'calm_strategic_founder_focused',
      allowedToneTraits: [
        'calm',
        'clear',
        'practical',
        'founder-focused',
        'strategic',
        'ecommerce-aware',
        'confident without hype',
      ],
      disallowedToneTraits: [
        'aggressive hype',
        'fear-based selling',
        'misleading urgency',
        'guaranteed outcome claims',
        'competitor attacks',
        'unsupported financial promises',
      ],
    },
    length: {
      platform: 'linkedin',
      minCharacters: 80,
      idealMinCharacters: 180,
      idealMaxCharacters: 900,
      maxCharacters: 1200,
      maxLineBreakGroups: 6,
    },
    hashtags: {
      style: 'low_volume_relevant_hashtags',
      minHashtags: 0,
      maxHashtags: 3,
      allowedPattern: '^#[A-Za-z0-9_]{2,40}$',
      bannedHashtags: ['#guaranteedprofit', '#getrichquick', '#riskfree', '#medicalcure'],
    },
    discountPolicy: {
      discountClaimsAllowed: 'only_when_explicit_offer_is_attached',
      requiresOfferSourceForDiscount: true,
      bannedDiscountPatterns: ['fake scarcity', 'unverified discount', 'misleading countdown', 'guaranteed savings'],
      urgencyClaimsAllowed: 'only_when_time_window_is_explicit_and_verified',
    },
    bannedPhrases: [
      'guaranteed results',
      'guaranteed profit',
      'risk-free income',
      'make money while you sleep',
      'get rich quick',
      'no effort required',
      'we are the best in the world',
      'destroy your competitors',
      'limited time only',
      'today only',
      'last chance',
    ],
    complianceNotes: [
      'Only make performance claims when they are supported by verified workspace data or an approved source.',
      'Discount, sale, and urgency claims require an explicit approved offer source.',
      'Do not make medical, legal, financial, or guaranteed-outcome claims.',
      'Regulated-product content must follow the customer workspace compliance notes before any future auto-run lane is considered.',
      'If the content mentions a specific metric, the metric must come from verified data and not from a draft guess.',
    ],
    approvalNotes: [
      'Phase 11.1 defines the approved style profile only.',
      'Manual approval remains required for all publishing in this phase.',
      'Future auto-run must also pass policy, pause, cap, permission, and result-log gates.',
    ],
    safety: buildApprovedContentStyleSafety(),
  };
}

function normalizeText(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function includesAny(normalizedCaption: string, patterns: string[]): string[] {
  const lower = normalizedCaption.toLowerCase();
  return patterns.filter((pattern) => lower.includes(pattern.toLowerCase()));
}

function normalizeHashtag(tag: string): string {
  return String(tag || '').trim().toLowerCase();
}

export function evaluateApprovedContentStyle(input: ApprovedContentStyleEvaluationInput): ApprovedContentStyleEvaluation {
  const profile = buildDefaultApprovedContentStyleProfile();
  const caption = normalizeText(input.caption);
  const hashtags = Array.isArray(input.hashtags) ? input.hashtags.map(normalizeHashtag).filter(Boolean) : [];
  const issues: ApprovedContentStyleEvaluationIssue[] = [];

  if (caption.length < profile.length.minCharacters) {
    issues.push({
      code: 'caption_too_short',
      severity: 'ask',
      message: `Caption has ${caption.length} characters; approved profile minimum is ${profile.length.minCharacters}.`,
    });
  }

  if (caption.length > profile.length.maxCharacters) {
    issues.push({
      code: 'caption_too_long',
      severity: 'block',
      message: `Caption has ${caption.length} characters; approved profile maximum is ${profile.length.maxCharacters}.`,
    });
  }

  if (hashtags.length > profile.hashtags.maxHashtags) {
    issues.push({
      code: 'too_many_hashtags',
      severity: 'ask',
      message: `Hashtag count is ${hashtags.length}; approved profile maximum is ${profile.hashtags.maxHashtags}.`,
    });
  }

  for (const tag of hashtags) {
    if (profile.hashtags.bannedHashtags.includes(tag)) {
      issues.push({
        code: 'banned_hashtag',
        severity: 'block',
        message: `Hashtag ${tag} is not allowed by the approved content style profile.`,
      });
    }
  }

  const bannedMatches = includesAny(caption, profile.bannedPhrases);
  for (const phrase of bannedMatches) {
    issues.push({
      code: 'banned_phrase',
      severity: 'block',
      message: `Caption contains banned phrase: ${phrase}.`,
    });
  }

  const discountMatches = includesAny(caption, discountClaimPatterns);
  if (discountMatches.length > 0 && !input.offerSourceAttached) {
    issues.push({
      code: 'discount_claim_without_offer_source',
      severity: 'block',
      message: 'Caption contains discount, sale, or urgency language without an attached approved offer source.',
    });
  }

  const sensitiveMatches = includesAny(caption, sensitiveClaimPatterns);
  if (sensitiveMatches.length > 0 && !input.complianceNoteAttached) {
    issues.push({
      code: 'sensitive_claim_without_compliance_note',
      severity: 'block',
      message: 'Caption contains sensitive/regulated claim language without an attached compliance note.',
    });
  }

  const hasBlock = issues.some((issue) => issue.severity === 'block');
  const hasAsk = issues.some((issue) => issue.severity === 'ask');

  return {
    phase: APPROVED_CONTENT_STYLE_PHASE,
    healthMode: APPROVED_CONTENT_STYLE_HEALTH_MODE,
    profileKey: APPROVED_CONTENT_STYLE_PROFILE_KEY,
    platform: 'linkedin',
    matchesApprovedStyle: issues.length === 0,
    decision: hasBlock ? 'blocked_by_style_profile' : hasAsk ? 'requires_manual_review' : 'style_match',
    issues,
    safeSummary: {
      captionCharacters: caption.length,
      hashtagCount: hashtags.length,
      bannedPhraseCount: bannedMatches.length,
      requiresOfferSource: discountMatches.length > 0,
      requiresComplianceNote: sensitiveMatches.length > 0,
    },
    safety: profile.safety,
  };
}

export function buildApprovedContentStyleStatus(): ApprovedContentStyleStatus {
  const profile = buildDefaultApprovedContentStyleProfile();
  return {
    phase: APPROVED_CONTENT_STYLE_PHASE,
    healthMode: APPROVED_CONTENT_STYLE_HEALTH_MODE,
    enabled: true,
    deliverable: 'approved_content_style_profile',
    supportedPlatform: 'linkedin',
    supportedActionType: 'content_publish',
    profileKey: profile.profileKey,
    requiredProfileSections: ['tone', 'length', 'hashtags', 'discountPolicy', 'bannedPhrases', 'complianceNotes'],
    safety: profile.safety,
  };
}

export function assertApprovedContentStyleProfileSafe(profile: ApprovedContentStyleProfile): void {
  const serialized = JSON.stringify(profile).toLowerCase();
  for (const forbidden of ['access_token', 'refresh_token', 'authorization', 'client_secret', 'database_url', 'app_encryption_key', 'worker_shared_secret', 'payload_json', 'raw_payload', 'rollback_payload', 'encrypted_']) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Approved content style profile contains forbidden fragment: ${forbidden}`);
    }
  }
  if (!profile.safety.definitionOnly || profile.safety.autoRunEnabled || !profile.safety.manualApprovalStillRequired) {
    throw new Error('Approved content style profile safety flags are invalid for Phase 11.1.');
  }
}
