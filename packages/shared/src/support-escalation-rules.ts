export const SUPPORT_ESCALATION_RULES_PHASE = 'phase_12_7_escalation_rules';
export const SUPPORT_ESCALATION_RULES_HEALTH_MODE = 'v2-phase-12-7-escalation-rules';
export const SUPPORT_ESCALATION_RULES_PACKAGE = 'lifesaver-v0.7.0-phase-12-7-escalation-rules.zip';

export const SUPPORT_ESCALATION_ALWAYS_ESCALATE_RULES = [
  'refund_request',
  'legal_threat',
  'chargeback',
  'angry_complaint',
  'uncertain_answer',
  'medical_or_sensitive_content',
  'classifier_escalation_category',
  'classifier_sensitive_flag',
  'high_value_customer_configured',
] as const;

export type SupportEscalationAlwaysEscalateRule = typeof SUPPORT_ESCALATION_ALWAYS_ESCALATE_RULES[number];

export const SUPPORT_ESCALATION_SAFETY = {
  gmailApiClientAdded: false,
  gmailExternalApiCalled: false,
  emailSendAdded: false,
  supportAutoReplyAdded: false,
  supportReplyActionCreated: false,
  rawTicketPayloadReturned: false,
  fullBodyReturned: false,
} as const;
