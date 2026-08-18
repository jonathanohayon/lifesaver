export const SANDBOX_ADS_EXECUTOR_SHARED_PHASE = 'v0.6.0 Phase 8.5 Sandbox Ads Executor' as const;

export const SANDBOX_ADS_EXECUTOR_SHARED_CONTRACT = {
  version: '0.6.0',
  phase: SANDBOX_ADS_EXECUTOR_SHARED_PHASE,
  executorNames: ['sandboxAdsBudgetExecutor', 'sandboxAdsPauseExecutor'],
  actionTypes: ['ad_budget_adjust', 'ad_pause'],
  returns: ['fake_before_state', 'fake_after_state', 'sandbox_success'],
  sandboxOnly: true,
  realExternalWriteEnabled: false,
  externalWritesEnabled: false,
  autoRunEnabled: false,
  wiredToActionFlow: false,
  adsApiCalled: false,
  realBudgetChanged: false,
  realCampaignPaused: false,
  note: 'Shared contract marker for Phase 8.5. The sandbox ads executor returns fake before/after state only and must not touch Meta Ads, Google Ads, TikTok Ads, Snapchat Ads, or any ad platform provider.',
} as const;
