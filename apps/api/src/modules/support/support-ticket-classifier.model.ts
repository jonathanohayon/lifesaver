import { z } from 'zod';
import type {
  SupportClassifierCategory,
  SupportClassifierSeverity,
  SupportTicketClassifierExample,
  SupportTicketClassifierInput,
  SupportTicketClassifierPreview,
  SupportTicketClassifierResult,
  SupportTicketClassifierStatus,
} from './support-ticket-classifier.types.js';

export const SUPPORT_TICKET_CLASSIFIER_PHASE = 'phase_12_4_ticket_classification' as const;
export const SUPPORT_TICKET_CLASSIFIER_HEALTH_MODE = 'v2-phase-12-4-ticket-classification' as const;
export const SUPPORT_TICKET_CLASSIFIER_PACKAGE = 'lifesaver-v0.7.0-phase-12-4-ticket-classification.zip' as const;

export const supportClassifierCategories: SupportClassifierCategory[] = [
  'faq',
  'shipping',
  'complaint',
  'refund',
  'cancellation',
  'payment_issue',
  'sensitive',
  'escalation',
];

const categoryLabels: Record<SupportClassifierCategory, string> = {
  faq: 'FAQ',
  shipping: 'Shipping',
  complaint: 'Complaint',
  refund: 'Refund',
  cancellation: 'Cancellation',
  payment_issue: 'Payment issue',
  sensitive: 'Sensitive',
  escalation: 'Escalation',
};

const classifierInputSchema = z.object({
  ticketId: z.string().trim().min(1).max(160).optional().nullable(),
  customerEmail: z.string().trim().max(320).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  bodySnippet: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  threadId: z.string().trim().max(240).optional().nullable(),
  sensitiveFlag: z.boolean().optional().default(false),
}).strict();

const FORBIDDEN_BROWSER_FRAGMENTS = [
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

type Rule = {
  category: SupportClassifierCategory;
  severity: SupportClassifierSeverity;
  escalationRequired: boolean;
  signals: Array<{ name: string; pattern: RegExp; points: number }>;
};

const rules: Rule[] = [
  {
    category: 'sensitive',
    severity: 'critical',
    escalationRequired: true,
    signals: [
      { name: 'password_or_otp', pattern: /\b(password|passcode|otp|2fa|login code|security code|reset code)\b/i, points: 45 },
      { name: 'payment_card_or_bank', pattern: /\b(credit card|card number|cvv|cvc|bank account|routing number|iban|wire transfer)\b/i, points: 45 },
      { name: 'identity_document', pattern: /\b(ssn|passport|national id|driver'?s? license|government id)\b/i, points: 45 },
      { name: 'secret_like_text', pattern: /\b(api key|access token|refresh token|client secret|authorization bearer)\b/i, points: 55 },
      { name: 'long_card_like_number', pattern: /\b\d{13,19}\b/i, points: 40 },
    ],
  },
  {
    category: 'escalation',
    severity: 'critical',
    escalationRequired: true,
    signals: [
      { name: 'legal_or_lawsuit', pattern: /\b(legal|lawyer|lawsuit|attorney|court|sue you|legal action)\b/i, points: 40 },
      { name: 'chargeback_or_fraud', pattern: /\b(chargeback|fraud|scam|unauthorized transaction)\b/i, points: 38 },
      { name: 'urgent_high_risk', pattern: /\b(urgent|asap|immediately|right now|emergency)\b/i, points: 25 },
      { name: 'public_reputation_threat', pattern: /\b(review everywhere|social media|twitter|x.com|trustpilot|bbb)\b/i, points: 28 },
    ],
  },
  {
    category: 'cancellation',
    severity: 'high',
    escalationRequired: false,
    signals: [
      { name: 'cancel_order', pattern: /\b(cancel|cancellation|stop my order|do not ship|cancel subscription)\b/i, points: 35 },
      { name: 'order_change_before_ship', pattern: /\b(change my order|wrong item|wrong address)\b/i, points: 20 },
    ],
  },
  {
    category: 'refund',
    severity: 'high',
    escalationRequired: false,
    signals: [
      { name: 'refund_request', pattern: /\b(refund|money back|return my money|reimburse|reimbursement)\b/i, points: 35 },
      { name: 'charged_but_no_goods', pattern: /\b(charged but|paid but|took my money)\b/i, points: 25 },
    ],
  },
  {
    category: 'payment_issue',
    severity: 'high',
    escalationRequired: false,
    signals: [
      { name: 'payment_failed', pattern: /\b(payment failed|card declined|checkout failed|payment error|billing issue)\b/i, points: 35 },
      { name: 'duplicate_charge', pattern: /\b(double charged|charged twice|duplicate charge|wrong amount)\b/i, points: 30 },
      { name: 'invoice_receipt', pattern: /\b(invoice|receipt|billing|payment confirmation)\b/i, points: 15 },
    ],
  },
  {
    category: 'complaint',
    severity: 'high',
    escalationRequired: false,
    signals: [
      { name: 'negative_experience', pattern: /\b(complaint|angry|unhappy|frustrated|bad experience|terrible|worst|disappointed)\b/i, points: 34 },
      { name: 'damaged_or_wrong_item', pattern: /\b(damaged|broken|wrong item|missing item|defective)\b/i, points: 28 },
    ],
  },
  {
    category: 'shipping',
    severity: 'normal',
    escalationRequired: false,
    signals: [
      { name: 'tracking_or_delivery', pattern: /\b(shipping|delivery|tracking|track my order|where is my order|shipped|shipment)\b/i, points: 32 },
      { name: 'late_or_lost_package', pattern: /\b(late package|lost package|not delivered|delayed|delivery date)\b/i, points: 30 },
    ],
  },
  {
    category: 'faq',
    severity: 'low',
    escalationRequired: false,
    signals: [
      { name: 'how_to_or_policy', pattern: /\b(how do i|how can i|what is your|policy|faq|question|can you tell me)\b/i, points: 26 },
      { name: 'product_question', pattern: /\b(size|ingredients|product details|available|stock|hours|location)\b/i, points: 22 },
      { name: 'simple_order_question', pattern: /\b(order status|status update|quick question)\b/i, points: 15 },
    ],
  },
];

function clean(value: string | null | undefined, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildClassifierText(input: z.infer<typeof classifierInputSchema>): string {
  return [input.subject, input.bodySnippet, input.body, input.customerEmail].map((value) => clean(value, 8000)).filter(Boolean).join(' ');
}

function calculateConfidence(points: number): number {
  if (points <= 0) return 0.52;
  return Math.min(0.98, Number((0.55 + points / 100).toFixed(2)));
}

function severityRank(severity: SupportClassifierSeverity): number {
  return { low: 1, normal: 2, high: 3, critical: 4 }[severity];
}

function betterCandidate(a: Candidate | null, b: Candidate): Candidate {
  if (!a) return b;
  if (b.category === 'sensitive' && a.category !== 'sensitive') return b;
  if (b.category === 'escalation' && !['sensitive', 'escalation'].includes(a.category)) return b;
  if (b.points !== a.points) return b.points > a.points ? b : a;
  if (severityRank(b.severity) !== severityRank(a.severity)) return severityRank(b.severity) > severityRank(a.severity) ? b : a;
  return a;
}

type Candidate = {
  category: SupportClassifierCategory;
  severity: SupportClassifierSeverity;
  escalationRequired: boolean;
  points: number;
  matchedSignals: string[];
};

export function classifySupportTicket(input: unknown): SupportTicketClassifierResult {
  const parsed = classifierInputSchema.parse(input);
  const text = buildClassifierText(parsed);
  let best: Candidate | null = null;

  for (const rule of rules) {
    const matchedSignals: string[] = [];
    let points = 0;
    for (const signal of rule.signals) {
      if (signal.pattern.test(text)) {
        matchedSignals.push(signal.name);
        points += signal.points;
      }
    }
    if (points > 0) {
      best = betterCandidate(best, {
        category: rule.category,
        severity: rule.severity,
        escalationRequired: rule.escalationRequired,
        points,
        matchedSignals,
      });
    }
  }

  if (parsed.sensitiveFlag) {
    best = betterCandidate(best, {
      category: 'sensitive',
      severity: 'critical',
      escalationRequired: true,
      points: 60,
      matchedSignals: ['input_sensitive_flag'],
    });
  }

  const finalCandidate = best ?? {
    category: 'faq' as const,
    severity: 'low' as const,
    escalationRequired: false,
    points: 0,
    matchedSignals: ['default_low_risk_faq_review'],
  };

  const result: SupportTicketClassifierResult = {
    ticketId: parsed.ticketId?.trim() || null,
    category: finalCandidate.category,
    categoryLabel: categoryLabels[finalCandidate.category],
    confidence: calculateConfidence(finalCandidate.points),
    severity: finalCandidate.severity,
    sensitiveFlag: finalCandidate.category === 'sensitive' || Boolean(parsed.sensitiveFlag),
    escalationRequired: finalCandidate.escalationRequired,
    matchedSignals: finalCandidate.matchedSignals,
    reason: buildClassificationReason(finalCandidate),
    safeForBrowser: true,
    externalApiCalled: false,
    emailSent: false,
  };

  assertSupportTicketClassifierSafe(result);
  return result;
}

export function buildClassificationReason(candidate: Candidate): string {
  if (candidate.category === 'faq' && candidate.points === 0) {
    return 'No high-risk support signals matched, so the ticket is routed to FAQ/manual triage by default.';
  }
  return `Matched ${categoryLabels[candidate.category]} support signals: ${candidate.matchedSignals.join(', ')}.`;
}

export function buildSupportTicketClassifierStatus(): SupportTicketClassifierStatus {
  return {
    phase: 'V2 Phase 12.4 — Ticket Classification',
    healthMode: SUPPORT_TICKET_CLASSIFIER_HEALTH_MODE,
    deliverable: 'ticket_classifier',
    selectedConnector: 'gmail',
    classifierAdded: true,
    categories: supportClassifierCategories,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportReplyActionAdded: false,
    supportAutoReplyAdded: false,
    rawProviderPayloadRequired: false,
    browserReceivesRawProviderPayload: false,
  };
}

export function buildSupportTicketClassifierExample(): SupportTicketClassifierExample {
  const input: SupportTicketClassifierInput = {
    ticketId: 'ticket_example_shipping_001',
    customerEmail: 'customer@example.com',
    subject: 'Where is my order?',
    bodySnippet: 'Can you please send me the tracking update? The delivery looks delayed.',
    threadId: 'gmail_thread_example_shipping_001',
    sensitiveFlag: false,
  };
  return {
    input,
    result: classifySupportTicket(input),
  };
}

export function buildSupportTicketClassifierPreview(input: unknown): SupportTicketClassifierPreview {
  return {
    valid: true,
    result: classifySupportTicket(input),
    warnings: [],
  };
}

export function assertSupportTicketClassifierSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_BROWSER_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Support ticket classifier output contains forbidden fragment: ${fragment}`);
    }
  }
}
