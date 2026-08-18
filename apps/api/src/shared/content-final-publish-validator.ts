export const CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE = 'phase_11_6_pre_publish_final_validation' as const;
export const CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE = 'v2-phase-11-6-pre-publish-final-validation' as const;
export const CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE = 'w_member_social' as const;

export type ContentFinalPublishValidationDecision = 'ready_for_executor_handoff' | 'blocked_before_publish';

export type ContentFinalPublishValidationSummary = {
  phase: typeof CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE;
  healthMode: typeof CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE;
  deliverable: 'final_publish_validator';
  decision: ContentFinalPublishValidationDecision;
  readyForExecutorHandoff: boolean;
  publishCalled: false;
  externalApiCalled: false;
  requiredScope: typeof CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE;
};
