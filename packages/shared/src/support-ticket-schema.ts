export type SupportTicketSchemaProvider = 'gmail';
export type SupportTicketSchemaStatusValue = 'open' | 'pending_review' | 'closed' | 'spam' | 'archived';
export type SupportTicketSchemaCategoryValue = 'uncategorized' | 'order_status' | 'shipping' | 'returns' | 'refunds' | 'product_question' | 'complaint' | 'vip' | 'spam';

export interface SupportTicketSchemaField {
  key: 'ticket_id' | 'customer_email' | 'subject' | 'body_snippet' | 'thread_id' | 'status' | 'category' | 'sensitive_flag';
  apiField: 'ticketId' | 'customerEmail' | 'subject' | 'bodySnippet' | 'threadId' | 'status' | 'category' | 'sensitiveFlag';
  dbColumn: string;
  required: boolean;
  browserSafe: boolean;
  description: string;
}

export interface CanonicalSupportTicketSchemaRecord {
  ticketId: string;
  customerEmail: string;
  customerEmailHint: string;
  subject: string | null;
  bodySnippet: string | null;
  threadId: string;
  status: SupportTicketSchemaStatusValue;
  category: SupportTicketSchemaCategoryValue;
  sensitiveFlag: boolean;
  sensitiveReasons: string[];
  rawProviderPayloadSeparated: true;
  safeForBrowser: true;
}

export const SUPPORT_TICKET_SCHEMA_HEALTH_MODE = 'v2-phase-12-3-ticket-data-model' as const;
export const SUPPORT_TICKET_SCHEMA_DELIVERABLE = 'support_ticket_schema' as const;
