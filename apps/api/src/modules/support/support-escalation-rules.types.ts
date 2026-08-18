export type SupportEscalationCategory =
  | 'faq'
  | 'shipping'
  | 'complaint'
  | 'refund'
  | 'cancellation'
  | 'payment_issue'
  | 'sensitive'
  | 'escalation';

export type SupportEscalationSeverity = 'low' | 'normal' | 'high' | 'critical';

export type SupportEscalationDecision = 'no_escalation_required' | 'escalate_to_founder' | 'manual_review_required';

export type SupportEscalationRuleId =
  | 'refund_request'
  | 'legal_threat'
  | 'chargeback'
  | 'angry_complaint'
  | 'uncertain_answer'
  | 'medical_or_sensitive_content'
  | 'high_value_customer_configured'
  | 'classifier_escalation_category'
  | 'classifier_sensitive_flag';

export interface SupportEscalationRulesInput {
  ticketId?: string | null;
  threadId?: string | null;
  customerEmail?: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
  body?: string | null;
  category?: SupportEscalationCategory | string | null;
  sensitiveFlag?: boolean | null;
  classifierConfidence?: number | null;
  draftReply?: string | null;
  answerUncertain?: boolean | null;
  highValueCustomer?: boolean | null;
  highValueCustomerEscalationEnabled?: boolean | null;
  customerLifetimeValueCents?: number | null;
  highValueThresholdCents?: number | null;
}

export interface SupportEscalationMatchedRule {
  ruleId: SupportEscalationRuleId;
  label: string;
  severity: SupportEscalationSeverity;
  reason: string;
  alwaysEscalate: boolean;
}

export interface SupportEscalationRulesResult {
  ticketId: string | null;
  threadId: string | null;
  decision: SupportEscalationDecision;
  escalationRequired: boolean;
  severity: SupportEscalationSeverity;
  matchedRules: SupportEscalationMatchedRule[];
  founderReviewRequired: boolean;
  suggestedQueue: 'standard_support' | 'founder_review' | 'sensitive_review';
  customerEmailHint: string | null;
  subjectPreview: string | null;
  bodySnippetPreview: string | null;
  rawTicketPayloadReturned: false;
  fullBodyReturned: false;
  emailSent: false;
  externalApiCalled: false;
  supportReplyActionCreated: false;
  safeForBrowser: true;
}

export interface SupportEscalationRulesStatus {
  phase: 'V2 Phase 12.7 — Escalation Rules';
  healthMode: 'v2-phase-12-7-escalation-rules';
  deliverable: 'support_escalation_logic';
  selectedConnector: 'gmail';
  escalationLogicAdded: true;
  alwaysEscalateRules: SupportEscalationRuleId[];
  highValueCustomerEscalatesOnlyIfConfigured: true;
  privacySafeguardsApplied: true;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportAutoReplyAdded: false;
  supportReplyActionCreated: false;
  rawTicketPayloadReturned: false;
}

export interface SupportEscalationRulesExample {
  input: SupportEscalationRulesInput;
  result: SupportEscalationRulesResult;
}

export interface SupportEscalationRulesPreview {
  valid: true;
  result: SupportEscalationRulesResult;
  warnings: string[];
}
