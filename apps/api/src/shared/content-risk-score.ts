export type SharedContentRiskCategoryKey =
  | 'sensitive_terms'
  | 'overpromising'
  | 'discount_claims'
  | 'brand_mismatch'
  | 'platform_risk'
  | 'compliance_concerns';

export type SharedContentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SharedContentRiskScoreSummary = {
  phase: 'phase_11_2_content_risk_scoring';
  healthMode: 'v2-phase-11-2-content-risk-scoring';
  deliverable: 'content_risk_score_function';
  platform: 'linkedin';
  totalScore: number;
  riskLevel: SharedContentRiskLevel;
  autoRunEligibleNow: false;
  scoringCategories: SharedContentRiskCategoryKey[];
};

export const CONTENT_RISK_SCORE_SHARED_PHASE = 'phase_11_2_content_risk_scoring' as const;
export const CONTENT_RISK_SCORE_SHARED_HEALTH_MODE = 'v2-phase-11-2-content-risk-scoring' as const;
export const CONTENT_RISK_SCORE_SHARED_CATEGORIES: SharedContentRiskCategoryKey[] = [
  'sensitive_terms',
  'overpromising',
  'discount_claims',
  'brand_mismatch',
  'platform_risk',
  'compliance_concerns',
];
