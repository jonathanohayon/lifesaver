export const SUPPORT_READONLY_IMPORT_HEALTH_MODE = 'v2-phase-12-2-read-only-support-connector-first' as const;
export const SUPPORT_READONLY_IMPORT_DELIVERABLE = 'read_only_ticket_import' as const;
export type SupportTicketProvider = 'gmail';
export type SupportTicketStatus = 'open' | 'pending_review' | 'closed' | 'spam' | 'archived';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketCategory = 'uncategorized' | 'order_status' | 'shipping' | 'returns' | 'refunds' | 'product_question' | 'complaint' | 'vip' | 'spam';
export type SupportTicketSentiment = 'unknown' | 'positive' | 'neutral' | 'negative';
