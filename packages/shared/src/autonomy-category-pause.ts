export const AUTONOMY_CATEGORY_PAUSE_PHASE = 'v0.6.0 Phase 5.9 Emergency Safe Mode' as const;

export const AUTONOMY_ACTION_CATEGORIES = ['content', 'support', 'ads', 'research', 'dev'] as const;
export type AutonomyActionCategory = typeof AUTONOMY_ACTION_CATEGORIES[number];

export const CATEGORY_PAUSE_FLAGS = {
  content: 'pause_content_actions',
  support: 'pause_support_actions',
  ads: 'pause_ads_actions',
  research: 'pause_research_actions',
  dev: 'pause_dev_actions'
} as const;

export const ACTION_TYPE_TO_AUTONOMY_CATEGORY = {
  content_publish: 'content',
  support_reply_send: 'support',
  ad_budget_adjust: 'ads',
  ad_pause: 'ads',
  research_task: 'research',
  dev_task: 'dev'
} as const;

export type CategoryPauseDecision = {
  category: AutonomyActionCategory | 'system';
  categoryPaused: boolean;
  pauseAllAutonomy: boolean;
  autoApprovalAllowed: boolean;
  executorExecutionAllowed: boolean;
  proposedActionCreationAllowed: true;
  manualReviewAllowed: true;
};

export const CATEGORY_PAUSE_RULES = {
  phase: AUTONOMY_CATEGORY_PAUSE_PHASE,
  categories: AUTONOMY_ACTION_CATEGORIES,
  whenCategoryPauseIsTrue: {
    noAutoApprovalForThatCategory: true,
    noExecutorExecutionForThatCategory: true,
    proposedActionsRemainReviewable: true,
    safeNewProposedActionsMayStillBeCreated: true
  },
  actionTypeMapping: ACTION_TYPE_TO_AUTONOMY_CATEGORY,
  allowedInPhase53: [
    'read content/support/ads/research/dev pause flags from autonomy_settings',
    'add research/dev pause columns through an additive migration',
    'force relevant proposed actions to policy_decision=ask when their category is paused',
    'force relevant proposed actions to approval_required=true when their category is paused',
    'include category pause state in createProposedAction audit metadata',
    'document future policy/executor category enforcement rules'
  ],
  forbiddenInPhase53: [
    'pause/resume API endpoints',
    'pause switch UI',
    'policy auto-approval',
    'executor registry',
    'sandbox executor',
    'real executor',
    'queueing actions for execution',
    'content publishing',
    'support sending',
    'ad budget changes',
    'campaign pause',
    'external platform writes'
  ]
} as const;

export function getCategoryForActionType(actionType: string): AutonomyActionCategory | 'system' {
  return (ACTION_TYPE_TO_AUTONOMY_CATEGORY as Record<string, AutonomyActionCategory | undefined>)[actionType] || 'system';
}
