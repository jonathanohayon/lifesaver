import type {
  SupportFaqAutoReplyCapInput,
  SupportFaqAutoReplyDecision,
  SupportFaqAutoReplyExplicitRuleInput,
  SupportFaqAutoReplyPolicyChecks,
  SupportFaqAutoReplyPolicyInput,
  SupportFaqAutoReplyPolicyResult,
  SupportFaqAutoReplyPolicyStatus,
  SupportFaqRiskLevel,
} from './support-faq-auto-reply-policy.types.js';

export const SUPPORT_FAQ_AUTO_REPLY_POLICY_PHASE = 'phase_13_5_faq_auto_reply_policy' as const;
export const SUPPORT_FAQ_AUTO_REPLY_POLICY_HEALTH_MODE = 'v2-phase-13-5-faq-auto-reply-policy' as const;
export const SUPPORT_FAQ_AUTO_REPLY_POLICY_PACKAGE = 'lifesaver-v0.7.0-phase-13-5-faq-auto-reply-policy.zip' as const;
export const SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE = 'support_reply_send' as const;
export const SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER = 'gmail' as const;
export const SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE = 0.9 as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'gmail_client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'raw_provider_payload',
  'raw_mime',
  'raw_base64',
];

function safeText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function lower(value: unknown): string {
  return safeText(value)?.toLowerCase() || '';
}

function bool(value: unknown): boolean {
  return value === true;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%,$\s,]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeRisk(value: unknown): SupportFaqRiskLevel {
  const risk = lower(value);
  if (risk === 'low' || risk === 'medium' || risk === 'high' || risk === 'critical') return risk;
  return 'unknown';
}

function riskRank(value: SupportFaqRiskLevel): number {
  if (value === 'low') return 1;
  if (value === 'medium') return 2;
  if (value === 'high') return 3;
  if (value === 'critical') return 4;
  return 99;
}

function ruleScopeMatches(rule: SupportFaqAutoReplyExplicitRuleInput | null | undefined, input: SupportFaqAutoReplyPolicyInput): boolean {
  if (!rule) return false;
  const actionType = lower(rule.actionType || SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE);
  const provider = lower(rule.provider || SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER);
  const category = lower(rule.category || 'faq');
  const minConfidence = finiteNumber(rule.minConfidenceScore) ?? SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE;
  const maxRiskLevel = normalizeRisk(rule.maxRiskLevel || 'low');
  const inputConfidence = finiteNumber(input.confidenceScore) ?? -1;
  const inputRisk = normalizeRisk(input.riskLevel || 'unknown');

  return actionType === SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE
    && provider === SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER
    && category === 'faq'
    && inputConfidence >= minConfidence
    && riskRank(inputRisk) <= riskRank(maxRiskLevel);
}

function capConfigured(cap: SupportFaqAutoReplyCapInput | null | undefined): boolean {
  const daily = finiteNumber(cap?.maxSupportAutoRepliesPerDay);
  return daily !== null && daily > 0;
}

function capNotExceeded(cap: SupportFaqAutoReplyCapInput | null | undefined): boolean {
  const dailyLimit = finiteNumber(cap?.maxSupportAutoRepliesPerDay);
  const dailyCurrent = finiteNumber(cap?.sentSupportAutoRepliesToday) ?? 0;
  const hourlyLimit = finiteNumber(cap?.maxSupportAutoRepliesPerHour);
  const hourlyCurrent = finiteNumber(cap?.sentSupportAutoRepliesThisHour) ?? 0;

  if (dailyLimit === null || dailyLimit <= 0) return false;
  if (dailyCurrent + 1 > dailyLimit) return false;
  if (hourlyLimit !== null && hourlyLimit >= 0 && hourlyCurrent + 1 > hourlyLimit) return false;
  return true;
}

function buildChecks(input: SupportFaqAutoReplyPolicyInput): SupportFaqAutoReplyPolicyChecks {
  const category = lower(input.category);
  const confidence = finiteNumber(input.confidenceScore);
  const risk = normalizeRisk(input.riskLevel || 'unknown');
  const explicitRule = input.explicitRule || null;

  return {
    actionTypeIsSupportReplySend: lower(input.actionType) === SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE,
    providerIsGmail: lower(input.provider || SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER) === SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER,
    categoryIsFaq: category === 'faq',
    confidenceHigh: confidence !== null && confidence >= SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE,
    ticketLowRisk: risk === 'low',
    sensitiveFlagOff: !bool(input.sensitiveFlag),
    escalationNotRequired: !bool(input.escalationRequired),
    capConfigured: capConfigured(input.capUsage),
    capNotExceeded: capNotExceeded(input.capUsage),
    explicitRulePresent: Boolean(explicitRule),
    explicitRuleEnabled: explicitRule?.enabled === true,
    explicitRuleAllowsAutoReply: explicitRule?.allowAutoReply === true,
    explicitRuleDecisionAutoApprove: lower(explicitRule?.decision) === 'auto_approve',
    explicitRuleScopeMatches: ruleScopeMatches(explicitRule, input),
    singleRecipientOnly: (finiteNumber(input.recipientCount) ?? 1) === 1,
    threadAssociationVerified: input.threadAssociationVerified === true,
  };
}

function decide(checks: SupportFaqAutoReplyPolicyChecks): {
  eligible: boolean;
  decision: SupportFaqAutoReplyDecision;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.actionTypeIsSupportReplySend) blockers.push('Only support_reply_send actions can be evaluated for FAQ auto-reply policy.');
  if (!checks.providerIsGmail) blockers.push('Phase 13.5 FAQ auto-reply policy supports the Gmail support connector only.');
  if (!checks.categoryIsFaq) blockers.push('FAQ auto-reply policy requires ticket category to be FAQ.');
  if (!checks.confidenceHigh) blockers.push(`FAQ auto-reply policy requires confidence score >= ${SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE}.`);
  if (!checks.ticketLowRisk || !checks.sensitiveFlagOff || !checks.escalationNotRequired) blockers.push('FAQ auto-reply policy requires a low-risk, non-sensitive, non-escalation ticket.');
  if (!checks.capConfigured || !checks.capNotExceeded) blockers.push('FAQ auto-reply policy requires configured support auto-reply caps and projected usage must not exceed them.');
  if (!checks.explicitRulePresent || !checks.explicitRuleEnabled || !checks.explicitRuleAllowsAutoReply || !checks.explicitRuleDecisionAutoApprove || !checks.explicitRuleScopeMatches) blockers.push('FAQ auto-reply policy requires an enabled explicit rule allowing FAQ auto-reply for this action scope.');
  if (!checks.singleRecipientOnly) blockers.push('FAQ auto-reply policy never permits bulk sending.');
  if (!checks.threadAssociationVerified) blockers.push('FAQ auto-reply policy requires Phase 13.4 thread association to be verified before any future auto-send lane can use it.');

  if (!checks.actionTypeIsSupportReplySend) return { eligible: false, decision: 'blocked_unsupported_action_type', blockers, warnings };
  if (!checks.providerIsGmail) return { eligible: false, decision: 'blocked_unsupported_provider', blockers, warnings };
  if (!checks.categoryIsFaq) return { eligible: false, decision: 'blocked_non_faq_category', blockers, warnings };
  if (!checks.confidenceHigh) return { eligible: false, decision: 'blocked_low_confidence', blockers, warnings };
  if (!checks.ticketLowRisk || !checks.sensitiveFlagOff || !checks.escalationNotRequired) return { eligible: false, decision: 'blocked_ticket_not_low_risk', blockers, warnings };
  if (!checks.capConfigured || !checks.capNotExceeded) return { eligible: false, decision: 'blocked_missing_or_exceeded_cap', blockers, warnings };
  if (!checks.explicitRulePresent || !checks.explicitRuleEnabled || !checks.explicitRuleAllowsAutoReply || !checks.explicitRuleDecisionAutoApprove || !checks.explicitRuleScopeMatches) return { eligible: false, decision: 'blocked_missing_explicit_rule', blockers, warnings };
  if (!checks.singleRecipientOnly) return { eligible: false, decision: 'blocked_bulk_send', blockers, warnings };
  if (!checks.threadAssociationVerified) return { eligible: false, decision: 'blocked_thread_not_verified', blockers, warnings };

  warnings.push('All FAQ auto-reply policy gates pass, but Phase 13.5 does not enable support auto-send. Manual approval remains required until a later explicitly approved phase changes that.');
  return { eligible: true, decision: 'eligible_future_auto_reply_manual_gate_active', blockers, warnings };
}

export function evaluateSupportFaqAutoReplyPolicy(input: SupportFaqAutoReplyPolicyInput = {}): SupportFaqAutoReplyPolicyResult {
  const checks = buildChecks(input);
  const decision = decide(checks);
  const rule = input.explicitRule || null;
  const cap = input.capUsage || null;

  const result: SupportFaqAutoReplyPolicyResult = {
    version: '0.7.0',
    phase: SUPPORT_FAQ_AUTO_REPLY_POLICY_PHASE,
    healthMode: SUPPORT_FAQ_AUTO_REPLY_POLICY_HEALTH_MODE,
    deliverable: 'faq_auto_reply_policy',
    selectedConnector: SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER,
    actionType: safeText(input.actionType),
    provider: safeText(input.provider || SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER) || SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER,
    category: safeText(input.category),
    confidenceScore: finiteNumber(input.confidenceScore),
    riskLevel: safeText(input.riskLevel),
    eligibleForFutureAutoReply: decision.eligible,
    autoSendNow: false,
    decision: decision.decision,
    checks,
    blockers: decision.blockers,
    warnings: decision.warnings,
    policySummary: {
      explicitRuleId: safeText(rule?.id, 120),
      explicitRuleName: safeText(rule?.name, 180),
      minimumConfidenceScore: SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE,
      maxSupportAutoRepliesPerDay: finiteNumber(cap?.maxSupportAutoRepliesPerDay),
      sentSupportAutoRepliesToday: finiteNumber(cap?.sentSupportAutoRepliesToday),
      maxSupportAutoRepliesPerHour: finiteNumber(cap?.maxSupportAutoRepliesPerHour),
      sentSupportAutoRepliesThisHour: finiteNumber(cap?.sentSupportAutoRepliesThisHour),
    },
    safeSummary: decision.eligible
      ? 'FAQ auto-reply policy gates pass for future auto-send eligibility, but this phase keeps support sends manual-approval-first and does not send email.'
      : 'FAQ auto-reply policy blocks this action from future auto-send eligibility until every FAQ/confidence/risk/cap/rule/thread gate passes.',
    safety: {
      evaluationOnly: true,
      autoSendEnabledNow: false,
      manualApprovalStillRequiredThisPhase: true,
      emailSent: false,
      gmailApiCalled: false,
      bulkSendAllowed: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
      note: 'Phase 13.5 adds the FAQ auto-reply policy evaluator only. It proves the rule gates for a future safe FAQ auto-send lane: FAQ category, high confidence, low risk, cap not exceeded, explicit enabled rule, single recipient, and verified thread association. It does not enable auto-send and it does not call Gmail.',
    },
  };

  assertSupportFaqAutoReplyPolicyOutputSafe(result);
  return result;
}

export function previewSupportFaqAutoReplyPolicy(input: SupportFaqAutoReplyPolicyInput = {}) {
  const result = evaluateSupportFaqAutoReplyPolicy(input);
  return {
    ...result,
    previewOnly: true,
    safety: {
      ...result.safety,
      evaluationOnly: true,
      autoSendEnabledNow: false,
      emailSent: false,
      gmailApiCalled: false,
    },
  };
}

export function buildSupportFaqAutoReplyPolicyStatus(): SupportFaqAutoReplyPolicyStatus {
  return {
    phase: 'V2 Phase 13.5 — FAQ Auto-Reply Policy',
    healthMode: SUPPORT_FAQ_AUTO_REPLY_POLICY_HEALTH_MODE,
    deliverable: 'faq_auto_reply_policy',
    selectedConnector: SUPPORT_FAQ_AUTO_REPLY_POLICY_PROVIDER,
    actionType: SUPPORT_FAQ_AUTO_REPLY_POLICY_ACTION_TYPE,
    evaluationOnly: true,
    autoSendEnabledNow: false,
    manualApprovalStillRequiredThisPhase: true,
    requiredCategory: 'faq',
    minimumConfidenceScore: SUPPORT_FAQ_AUTO_REPLY_MIN_CONFIDENCE,
    requiredRiskLevel: 'low',
    requiresExplicitRule: true,
    requiresCapNotExceeded: true,
    requiresThreadAssociation: true,
    bulkSendAllowed: false,
    previewCallsGmail: false,
    previewSendsEmail: false,
    rawProviderPayloadReturned: false,
    rawTokenReturned: false,
    rawMimeReturned: false,
    nextStep: 'Phase 13.6 — No Bulk Sends',
  };
}

export function buildSupportFaqAutoReplyPolicyExample() {
  const goodInput: SupportFaqAutoReplyPolicyInput = {
    actionType: 'support_reply_send',
    provider: 'gmail',
    category: 'faq',
    confidenceScore: 0.96,
    riskLevel: 'low',
    sensitiveFlag: false,
    escalationRequired: false,
    recipientCount: 1,
    threadAssociationVerified: true,
    capUsage: {
      maxSupportAutoRepliesPerDay: 5,
      sentSupportAutoRepliesToday: 2,
      maxSupportAutoRepliesPerHour: 2,
      sentSupportAutoRepliesThisHour: 0,
    },
    explicitRule: {
      id: 'policy_faq_auto_reply_preview',
      name: 'FAQ replies may auto-send later when all safety gates pass',
      enabled: true,
      actionType: 'support_reply_send',
      provider: 'gmail',
      category: 'faq',
      decision: 'auto_approve',
      allowAutoReply: true,
      minConfidenceScore: 0.9,
      maxRiskLevel: 'low',
    },
  };

  return {
    status: buildSupportFaqAutoReplyPolicyStatus(),
    eligibleFutureAutoReply: evaluateSupportFaqAutoReplyPolicy(goodInput),
    blockedLowConfidence: evaluateSupportFaqAutoReplyPolicy({ ...goodInput, confidenceScore: 0.72 }),
    blockedNonFaq: evaluateSupportFaqAutoReplyPolicy({ ...goodInput, category: 'shipping' }),
    blockedCapExceeded: evaluateSupportFaqAutoReplyPolicy({
      ...goodInput,
      capUsage: { maxSupportAutoRepliesPerDay: 5, sentSupportAutoRepliesToday: 5 },
    }),
    blockedMissingRule: evaluateSupportFaqAutoReplyPolicy({ ...goodInput, explicitRule: null }),
    safety: {
      exampleSendsEmail: false,
      gmailApiCalled: false,
      autoSendEnabledNow: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function assertSupportFaqAutoReplyPolicyOutputSafe(output: unknown): void {
  const serialized = JSON.stringify(output).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support FAQ auto-reply policy output contains forbidden fragment: ${fragment}`);
    }
  }
}
