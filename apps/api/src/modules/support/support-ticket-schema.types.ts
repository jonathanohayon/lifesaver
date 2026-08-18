export type SupportTicketProvider = 'gmail';
export type SupportTicketStatus = 'open' | 'pending_review' | 'closed' | 'spam' | 'archived';
export type SupportTicketCategory = 'uncategorized' | 'order_status' | 'shipping' | 'returns' | 'refunds' | 'product_question' | 'complaint' | 'vip' | 'spam';

export interface SupportTicketSchemaField {
  key: 'ticket_id' | 'customer_email' | 'subject' | 'body_snippet' | 'thread_id' | 'status' | 'category' | 'sensitive_flag';
  apiField: 'ticketId' | 'customerEmail' | 'subject' | 'bodySnippet' | 'threadId' | 'status' | 'category' | 'sensitiveFlag';
  dbColumn: string;
  required: boolean;
  browserSafe: boolean;
  description: string;
}

export interface SupportTicketSchemaStatus {
  phase: 'V2 Phase 12.3 — Ticket Data Model';
  healthMode: 'v2-phase-12-3-ticket-data-model';
  deliverable: 'support_ticket_schema';
  selectedConnector: 'gmail';
  ticketSchemaAdded: true;
  migrationAdded: true;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  supportReplyActionAdded: false;
  rawProviderPayloadSeparated: true;
  browserReceivesRawProviderPayload: false;
  sensitiveFlagAdded: true;
}

export interface SupportTicketSchemaInput {
  ticketId?: string | null;
  customerEmail: string;
  subject?: string | null;
  bodySnippet?: string | null;
  threadId: string;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  sensitiveFlag?: boolean;
}

export interface CanonicalSupportTicketSchemaRecord {
  ticketId: string;
  customerEmail: string;
  customerEmailHint: string;
  subject: string | null;
  bodySnippet: string | null;
  threadId: string;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  sensitiveFlag: boolean;
  sensitiveReasons: string[];
  rawProviderPayloadSeparated: true;
  safeForBrowser: true;
}

export interface SupportTicketSchemaExample {
  fields: SupportTicketSchemaField[];
  exampleRecord: CanonicalSupportTicketSchemaRecord;
  externalApiCalled: false;
  emailSent: false;
}

export interface SupportTicketSchemaPreview {
  valid: true;
  record: CanonicalSupportTicketSchemaRecord;
  externalApiCalled: false;
  emailSent: false;
  warnings: string[];
}
