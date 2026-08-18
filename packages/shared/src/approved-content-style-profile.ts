export const APPROVED_CONTENT_STYLE_PHASE = 'phase_11_1_approved_style_definition' as const;
export const APPROVED_CONTENT_STYLE_HEALTH_MODE = 'v2-phase-11-1-approved-style-definition' as const;

export type ApprovedContentStyleProfileSummary = {
  phase: typeof APPROVED_CONTENT_STYLE_PHASE;
  healthMode: typeof APPROVED_CONTENT_STYLE_HEALTH_MODE;
  profileKey: 'default_linkedin_approved_content_style_v1';
  platform: 'linkedin';
  actionType: 'content_publish';
  requiredSections: string[];
  safety: {
    definitionOnly: true;
    autoRunEnabled: false;
    manualApprovalStillRequired: true;
    doesNotPublish: true;
  };
};

export const APPROVED_CONTENT_STYLE_PROFILE_SUMMARY: ApprovedContentStyleProfileSummary = {
  phase: APPROVED_CONTENT_STYLE_PHASE,
  healthMode: APPROVED_CONTENT_STYLE_HEALTH_MODE,
  profileKey: 'default_linkedin_approved_content_style_v1',
  platform: 'linkedin',
  actionType: 'content_publish',
  requiredSections: ['tone', 'length', 'hashtags', 'discountPolicy', 'bannedPhrases', 'complianceNotes'],
  safety: {
    definitionOnly: true,
    autoRunEnabled: false,
    manualApprovalStillRequired: true,
    doesNotPublish: true,
  },
};
