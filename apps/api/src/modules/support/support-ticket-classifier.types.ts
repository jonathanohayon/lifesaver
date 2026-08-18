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

export interface SupportTicketClassifierInput {
  ticketId?: string | null;
  customerEmail?: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
  body?: string | null;
  threadId?: string | null;
  sensitiveFlag?: boolean;
}

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

export interface SupportTicketClassifierStatus {
  phase: 'V2 Phase 12.4 — Ticket Classification';
  healthMode: 'v2-phase-12-4-ticket-classification';
  deliverable: 'ticket_classifier';
  selectedConnector: 'gmail';
  classifierAdded: true;
  categories: SupportClassifierCategory[];
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportReplyActionAdded: false;
  supportAutoReplyAdded: false;
  rawProviderPayloadRequired: false;
  browserReceivesRawProviderPayload: false;
}

export interface SupportTicketClassifierExample {
  input: SupportTicketClassifierInput;
  result: SupportTicketClassifierResult;
}

export interface SupportTicketClassifierPreview {
  valid: true;
  result: SupportTicketClassifierResult;
  warnings: string[];
}
