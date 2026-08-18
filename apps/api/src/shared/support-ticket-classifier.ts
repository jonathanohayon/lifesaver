export type SupportClassifierCategory =
  | 'faq'
  | 'shipping'
  | 'complaint'
  | 'refund'
  | 'cancellation'
  | 'payment_issue'
  | 'sensitive'
  | 'escalation';

export type SupportClassifierSeverity = 'low' | 'normal' | 'high' | 'critical';

export interface SupportTicketClassifierResult {
  ticketId: string | null;
  category: SupportClassifierCategory;
  categoryLabel: string;
  confidence: number;
  severity: SupportClassifierSeverity;
  sensitiveFlag: boolean;
  escalationRequired: boolean;
  matchedSignals: string[];
  reason: string;
  safeForBrowser: true;
  externalApiCalled: false;
  emailSent: false;
}
