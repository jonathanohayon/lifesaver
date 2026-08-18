export const EXECUTOR_PAUSE_ENFORCEMENT_PHASE = 'v0.6.0 Phase 5.6 Executor Pause Enforcement' as const;

export const EXECUTOR_PAUSE_ENFORCEMENT_RULES = [
  'Every future executor must check pause state immediately before execution.',
  'If pause_all_autonomy is true, execution is blocked even if the action was approved earlier.',
  'If a category pause is true, matching category execution is blocked.',
  'If pause state cannot be read, executor enforcement must fail closed.',
  'Resume only changes pause flags; it must not automatically execute waiting actions.',
  'Pause guard success is not enough to execute; approval, status, policy, caps, audit log, idempotency, and connector-scope checks still apply.',
] as const;

export const EXECUTOR_PAUSE_CATEGORY_MAP = {
  content_publish: 'content',
  support_reply_send: 'support',
  ad_budget_adjust: 'ads',
  ad_pause: 'ads',
  research_task: 'research',
  dev_task: 'dev',
  notification_send: 'system',
  rollback_action: 'system',
} as const;

export const EXECUTOR_PAUSE_PHASE_DISABLED_CAPABILITIES = [
  'executor registry activation',
  'sandbox executor execution',
  'real content publishing',
  'support reply sending',
  'ad budget changes',
  'campaign pause execution',
  'external platform writes',
  'rollback execution',
  'auto-run rules',
] as const;
