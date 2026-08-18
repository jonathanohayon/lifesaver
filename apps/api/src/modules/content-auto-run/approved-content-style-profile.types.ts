export type ApprovedStyleToneProfile = {
  primaryTone: 'calm_strategic_founder_focused';
  allowedToneTraits: string[];
  disallowedToneTraits: string[];
};

export type ApprovedStyleLengthProfile = {
  platform: 'linkedin';
  minCharacters: number;
  idealMinCharacters: number;
  idealMaxCharacters: number;
  maxCharacters: number;
  maxLineBreakGroups: number;
};

export type ApprovedStyleHashtagProfile = {
  style: 'low_volume_relevant_hashtags';
  minHashtags: number;
  maxHashtags: number;
  allowedPattern: string;
  bannedHashtags: string[];
};

export type ApprovedStyleDiscountPolicy = {
  discountClaimsAllowed: 'only_when_explicit_offer_is_attached';
  requiresOfferSourceForDiscount: true;
  bannedDiscountPatterns: string[];
  urgencyClaimsAllowed: 'only_when_time_window_is_explicit_and_verified';
};

export type ApprovedContentStyleProfile = {
  version: '0.7.0';
  phase: 'phase_11_1_approved_style_definition';
  healthMode: 'v2-phase-11-1-approved-style-definition';
  profileKey: 'default_linkedin_approved_content_style_v1';
  profileStatus: 'definition_only';
  actionType: 'content_publish';
  platform: 'linkedin';
  tone: ApprovedStyleToneProfile;
  length: ApprovedStyleLengthProfile;
  hashtags: ApprovedStyleHashtagProfile;
  discountPolicy: ApprovedStyleDiscountPolicy;
  bannedPhrases: string[];
  complianceNotes: string[];
  approvalNotes: string[];
  safety: {
    definitionOnly: true;
    autoRunEnabled: false;
    doesNotPublish: true;
    doesNotApproveActions: true;
    externalApiCalled: false;
    manualApprovalStillRequired: true;
    futureAutoRunRequiresPolicyGate: true;
    futureAutoRunRequiresPauseGate: true;
    futureAutoRunRequiresCapGate: true;
    futureAutoRunRequiresResultLogGate: true;
  };
};

export type ApprovedContentStyleEvaluationInput = {
  caption: string;
  hashtags?: string[];
  offerSourceAttached?: boolean;
  complianceNoteAttached?: boolean;
};

export type ApprovedContentStyleEvaluationIssue = {
  code:
    | 'caption_too_short'
    | 'caption_too_long'
    | 'too_many_hashtags'
    | 'banned_hashtag'
    | 'banned_phrase'
    | 'discount_claim_without_offer_source'
    | 'sensitive_claim_without_compliance_note';
  severity: 'block' | 'ask';
  message: string;
};

export type ApprovedContentStyleEvaluation = {
  phase: ApprovedContentStyleProfile['phase'];
  healthMode: ApprovedContentStyleProfile['healthMode'];
  profileKey: ApprovedContentStyleProfile['profileKey'];
  platform: 'linkedin';
  matchesApprovedStyle: boolean;
  decision: 'style_match' | 'requires_manual_review' | 'blocked_by_style_profile';
  issues: ApprovedContentStyleEvaluationIssue[];
  safeSummary: {
    captionCharacters: number;
    hashtagCount: number;
    bannedPhraseCount: number;
    requiresOfferSource: boolean;
    requiresComplianceNote: boolean;
  };
  safety: ApprovedContentStyleProfile['safety'];
};

export type ApprovedContentStyleStatus = {
  phase: ApprovedContentStyleProfile['phase'];
  healthMode: ApprovedContentStyleProfile['healthMode'];
  enabled: true;
  deliverable: 'approved_content_style_profile';
  supportedPlatform: 'linkedin';
  supportedActionType: 'content_publish';
  profileKey: ApprovedContentStyleProfile['profileKey'];
  requiredProfileSections: string[];
  safety: ApprovedContentStyleProfile['safety'];
};
