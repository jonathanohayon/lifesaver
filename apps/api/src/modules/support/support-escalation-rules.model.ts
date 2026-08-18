import { z } from 'zod';
import { redactSupportTextForLogs } from './support-privacy-safeguards.model.js';
import type {
  SupportEscalationMatchedRule,
  SupportEscalationRulesExample,
  SupportEscalationRulesInput,
  SupportEscalationRulesPreview,
  SupportEscalationRulesResult,
  SupportEscalationRulesStatus,
  SupportEscalationRuleId,
  SupportEscalationSeverity,
} from './support-escalation-rules.types.js';

export const SUPPORT_ESCALATION_RULES_PHASE = 'phase_12_7_escalation_rules' as const;
export const SUPPORT_ESCALATION_RULES_HEALTH_MODE = 'v2-phase-12-7-escalation-rules' as const;
export const SUPPORT_ESCALATION_RULES_PACKAGE = 'lifesaver-v0.7.0-phase-12-7-escalation-rules.zip' as const;

const supportEscalationInputSchema = z.object({
  ticketId: z.string().trim().max(180).optional().nullable(),
  threadId: z.string().trim().max(240).optional().nullable(),
  customerEmail: z.string().trim().max(320).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  bodySnippet: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  sensitiveFlag: z.boolean().optional().nullable(),
  classifierConfidence: z.number().min(0).max(1).optional().nullable(),
  draftReply: z.string().trim().max(8000).optional().nullable(),
  answerUncertain: z.boolean().optional().nullable(),
  highValueCustomer: z.boolean().optional().nullable(),
  highValueCustomerEscalationEnabled: z.boolean().optional().nullable(),
  customerLifetimeValueCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  highValueThresholdCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
}).strict();

const forbiddenBrowserFragments = [
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
  'rawproviderpayload',
  'oauth',
];

export const supportAlwaysEscalateRuleIds: SupportEscalationRuleId[] = [
  'refund_request',
  'legal_threat',
  'chargeback',
  'angry_complaint',
  'uncertain_answer',
  'medical_or_sensitive_content',
  'classifier_escalation_category',
  'classifier_sensitive_flag',
  'high_value_customer_configured',
];

type InternalRule = {
  ruleId: SupportEscalationRuleId;
  label: string;
  severity: SupportEscalationSeverity;
  reason: string;
  alwaysEscalate: boolean;
  matches: (context: EscalationContext) => boolean;
};

type EscalationContext = z.infer<typeof supportEscalationInputSchema> & {
  text: string;
  draftText: string;
  categoryKey: string;
  configuredHighValue: boolean;
};

function compact(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function maskEmail(value: string | null | undefined): string | null {
  const clean = compact(value, 320);
  if (!clean || !clean.includes('@')) return null;
  const [name, domain] = clean.split('@');
  if (!domain) return '[REDACTED_EMAIL]';
  const visible = name.length <= 2 ? `${name.slice(0, 1) || '*'}*` : `${name.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function severityRank(severity: SupportEscalationSeverity): number {
  return { low: 1, normal: 2, high: 3, critical: 4 }[severity];
}

function maxSeverity(rules: SupportEscalationMatchedRule[]): SupportEscalationSeverity {
  return rules.reduce<SupportEscalationSeverity>((highest, rule) => {
    return severityRank(rule.severity) > severityRank(highest) ? rule.severity : highest;
  }, 'low');
}

function buildText(parsed: z.infer<typeof supportEscalationInputSchema>): string {
  return [parsed.subject, parsed.bodySnippet, parsed.body, parsed.category, parsed.customerEmail]
    .map((value) => compact(value, 8000))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildDraftText(parsed: z.infer<typeof supportEscalationInputSchema>): string {
  return compact(parsed.draftReply, 8000)?.toLowerCase() ?? '';
}

function isHighValueConfigured(parsed: z.infer<typeof supportEscalationInputSchema>): boolean {
  if (parsed.highValueCustomerEscalationEnabled !== true) return false;
  if (parsed.highValueCustomer === true) return true;
  const threshold = parsed.highValueThresholdCents ?? 50_000;
  return typeof parsed.customerLifetimeValueCents === 'number' && parsed.customerLifetimeValueCents >= threshold;
}

function hasLowClassifierConfidence(parsed: z.infer<typeof supportEscalationInputSchema>): boolean {
  return typeof parsed.classifierConfidence === 'number' && parsed.classifierConfidence > 0 && parsed.classifierConfidence < 0.65;
}

const supportEscalationRules: InternalRule[] = [
  {
    ruleId: 'classifier_sensitive_flag',
    label: 'Classifier sensitive flag',
    severity: 'critical',
    reason: 'The ticket is already marked sensitive and must be reviewed by a human before any reply is sent.',
    alwaysEscalate: true,
    matches: (context) => context.sensitiveFlag === true || context.categoryKey === 'sensitive',
  },
  {
    ruleId: 'classifier_escalation_category',
    label: 'Classifier escalation category',
    severity: 'critical',
    reason: 'The classifier routed this ticket to escalation, so the founder should review it.',
    alwaysEscalate: true,
    matches: (context) => context.categoryKey === 'escalation',
  },
  {
    ruleId: 'refund_request',
    label: 'Refund request',
    severity: 'high',
    reason: 'Refund requests can affect cash, policy, and customer trust, so they must be escalated.',
    alwaysEscalate: true,
    matches: (context) => context.categoryKey === 'refund' || /\b(refund|money back|return my money|reimburse|reimbursement|credit me)\b/i.test(context.text),
  },
  {
    ruleId: 'legal_threat',
    label: 'Legal threat',
    severity: 'critical',
    reason: 'Legal threats require founder or authorized human review before any response.',
    alwaysEscalate: true,
    matches: (context) => /\b(legal action|lawyer|attorney|lawsuit|court|sue you|solicitor|legal notice|cease and desist)\b/i.test(context.text),
  },
  {
    ruleId: 'chargeback',
    label: 'Chargeback',
    severity: 'critical',
    reason: 'Chargebacks and payment disputes can affect merchant risk and must be escalated.',
    alwaysEscalate: true,
    matches: (context) => /\b(chargeback|charge back|payment dispute|dispute this charge|unauthorized charge|unauthorised charge|fraudulent charge)\b/i.test(context.text),
  },
  {
    ruleId: 'angry_complaint',
    label: 'Angry complaint',
    severity: 'high',
    reason: 'Angry complaints should not be auto-handled because the tone and resolution need human judgment.',
    alwaysEscalate: true,
    matches: (context) => context.categoryKey === 'complaint' || /\b(angry|furious|upset|unhappy|terrible|worst|disappointed|complaint|bad experience|never buying|scam|fraud)\b/i.test(context.text),
  },
  {
    ruleId: 'uncertain_answer',
    label: 'Uncertain answer',
    severity: 'high',
    reason: 'Uncertain answers should not be sent to customers without founder review.',
    alwaysEscalate: true,
    matches: (context) => context.answerUncertain === true
      || hasLowClassifierConfidence(context)
      || /\b(not sure|unsure|uncertain|maybe|might be|probably|i think|i guess|unknown|need to check|cannot confirm)\b/i.test(context.draftText),
  },
  {
    ruleId: 'medical_or_sensitive_content',
    label: 'Medical or sensitive content',
    severity: 'critical',
    reason: 'Medical, safety, identity, account-security, or highly private content must be escalated.',
    alwaysEscalate: true,
    matches: (context) => /\b(medical|doctor|hospital|health|illness|allergic|allergy|reaction|dosage|dose|pregnant|anxiety|depression|suicide|self harm|passport|ssn|national id|driver'?s? license|password|otp|2fa|security code|credit card|bank account|cvv|cvc)\b/i.test(context.text),
  },
  {
    ruleId: 'high_value_customer_configured',
    label: 'High-value customer',
    severity: 'high',
    reason: 'High-value customer escalation is enabled for this workspace, so founder review is required.',
    alwaysEscalate: true,
    matches: (context) => context.configuredHighValue,
  },
];

export function evaluateSupportEscalationRules(input: unknown): SupportEscalationRulesResult {
  const parsed = supportEscalationInputSchema.parse(input);
  const context: EscalationContext = {
    ...parsed,
    text: buildText(parsed),
    draftText: buildDraftText(parsed),
    categoryKey: compact(parsed.category, 80)?.toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? '',
    configuredHighValue: isHighValueConfigured(parsed),
  };

  const matchedRules = supportEscalationRules
    .filter((rule) => rule.matches(context))
    .map<SupportEscalationMatchedRule>((rule) => ({
      ruleId: rule.ruleId,
      label: rule.label,
      severity: rule.severity,
      reason: rule.reason,
      alwaysEscalate: rule.alwaysEscalate,
    }));

  const escalationRequired = matchedRules.length > 0;
  const severity = escalationRequired ? maxSeverity(matchedRules) : 'low';
  const subject = redactSupportTextForLogs(parsed.subject, 180);
  const snippet = redactSupportTextForLogs(parsed.bodySnippet || parsed.body, 420);
  const sensitiveQueue = matchedRules.some((rule) => ['medical_or_sensitive_content', 'classifier_sensitive_flag'].includes(rule.ruleId));

  const result: SupportEscalationRulesResult = {
    ticketId: compact(parsed.ticketId, 180),
    threadId: compact(parsed.threadId, 240),
    decision: escalationRequired ? 'escalate_to_founder' : 'no_escalation_required',
    escalationRequired,
    severity,
    matchedRules,
    founderReviewRequired: escalationRequired,
    suggestedQueue: escalationRequired ? (sensitiveQueue ? 'sensitive_review' : 'founder_review') : 'standard_support',
    customerEmailHint: maskEmail(parsed.customerEmail),
    subjectPreview: subject.value,
    bodySnippetPreview: snippet.value,
    rawTicketPayloadReturned: false,
    fullBodyReturned: false,
    emailSent: false,
    externalApiCalled: false,
    supportReplyActionCreated: false,
    safeForBrowser: true,
  };

  assertSupportEscalationRulesSafe(result);
  return result;
}

export function buildSupportEscalationRulesStatus(): SupportEscalationRulesStatus {
  return {
    phase: 'V2 Phase 12.7 — Escalation Rules',
    healthMode: SUPPORT_ESCALATION_RULES_HEALTH_MODE,
    deliverable: 'support_escalation_logic',
    selectedConnector: 'gmail',
    escalationLogicAdded: true,
    alwaysEscalateRules: supportAlwaysEscalateRuleIds,
    highValueCustomerEscalatesOnlyIfConfigured: true,
    privacySafeguardsApplied: true,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportAutoReplyAdded: false,
    supportReplyActionCreated: false,
    rawTicketPayloadReturned: false,
  };
}

export function buildSupportEscalationRulesExample(): SupportEscalationRulesExample {
  const input: SupportEscalationRulesInput = {
    ticketId: 'ticket_refund_legal_001',
    threadId: 'gmail_thread_refund_legal_001',
    customerEmail: 'customer@example.com',
    subject: 'Refund request and legal action',
    bodySnippet: 'I want a refund today or I will contact my lawyer and dispute this charge.',
    category: 'refund',
    sensitiveFlag: false,
    classifierConfidence: 0.91,
  };
  return {
    input,
    result: evaluateSupportEscalationRules(input),
  };
}

export function buildSupportEscalationRulesPreview(input: unknown): SupportEscalationRulesPreview {
  const result = evaluateSupportEscalationRules(input);
  return {
    valid: true,
    result,
    warnings: result.escalationRequired
      ? ['Ticket must be escalated to founder/manual review before any support reply action can be approved or sent.']
      : ['No mandatory escalation rule matched. Continue normal support review flow.'],
  };
}

export function assertSupportEscalationRulesSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of forbiddenBrowserFragments) {
    if (text.includes(fragment)) {
      throw new Error(`Support escalation output contains forbidden fragment: ${fragment}`);
    }
  }
}
