export type ContentRiskCategoryKey =
  | 'sensitive_terms'
  | 'overpromising'
  | 'discount_claims'
  | 'brand_mismatch'
  | 'platform_risk'
  | 'compliance_concerns';

export type ContentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ContentRiskDecision =
  | 'eligible_for_future_auto_run_review'
  | 'requires_manual_review'
  | 'blocked_by_risk_score';

export type ContentRiskScoreInput = {
  caption: string;
  platform?: 'linkedin' | string;
  hashtags?: string[];
  mediaType?: 'none' | 'link' | 'image' | 'video' | 'document' | string;
  linkUrl?: string;
  offerSourceAttached?: boolean;
  verifiedMetricSourceAttached?: boolean;
  complianceNoteAttached?: boolean;
  approvedBrandStyleMatched?: boolean;
};

export type ContentRiskFinding = {
  category: ContentRiskCategoryKey;
  code: string;
  severity: ContentRiskLevel;
  points: number;
  message: string;
  matchedTerms?: string[];
};

export type ContentRiskCategoryScore = {
  category: ContentRiskCategoryKey;
  score: number;
  maxScore: number;
  findings: ContentRiskFinding[];
};

export type ContentRiskScoreResult = {
  phase: 'phase_11_2_content_risk_scoring';
  healthMode: 'v2-phase-11-2-content-risk-scoring';
  deliverable: 'content_risk_score_function';
  platform: 'linkedin';
  totalScore: number;
  riskLevel: ContentRiskLevel;
  decision: ContentRiskDecision;
  autoRunEligibleNow: false;
  categoryScores: ContentRiskCategoryScore[];
  findings: ContentRiskFinding[];
  safeSummary: {
    captionCharacters: number;
    hashtagCount: number;
    mediaType: string;
    hasDiscountClaim: boolean;
    hasSensitiveTerms: boolean;
    hasComplianceConcern: boolean;
    approvedBrandStyleMatched: boolean;
  };
  thresholds: {
    lowMax: number;
    mediumMax: number;
    highMax: number;
    criticalMin: number;
    futureAutoRunMaxAllowed: number;
  };
  safety: {
    scoringOnly: true;
    autoRunEnabled: false;
    autoApprovalEnabled: false;
    doesNotPublish: true;
    externalApiCalled: false;
    manualApprovalStillRequired: true;
    noDatabaseWrites: true;
    futureAutoRunRequiresAdditionalGates: true;
  };
};

export type ContentRiskScoreStatus = {
  phase: ContentRiskScoreResult['phase'];
  healthMode: ContentRiskScoreResult['healthMode'];
  enabled: true;
  deliverable: ContentRiskScoreResult['deliverable'];
  supportedPlatform: 'linkedin';
  supportedActionType: 'content_publish';
  scoringCategories: ContentRiskCategoryKey[];
  safety: ContentRiskScoreResult['safety'];
};
