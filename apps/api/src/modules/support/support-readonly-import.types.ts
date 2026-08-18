export type SupportTicketProvider = 'gmail';
export type SupportTicketStatus = 'open' | 'pending_review' | 'closed' | 'spam' | 'archived';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketCategory = 'uncategorized' | 'order_status' | 'shipping' | 'returns' | 'refunds' | 'product_question' | 'complaint' | 'vip' | 'spam';
export type SupportTicketSentiment = 'unknown' | 'positive' | 'neutral' | 'negative';

export interface GmailReadonlyMessageInput {
  provider?: SupportTicketProvider;
  externalMessageId: string;
  externalThreadId: string;
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  receivedAt: string;
  labelIds?: string[];
  rawProviderPayload?: Record<string, unknown>;
}

export interface NormalizedSupportTicket {
  provider: SupportTicketProvider;
  externalThreadId: string;
  externalMessageId: string;
  fromEmailHint: string | null;
  fromNameHint: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: SupportTicketCategory;
  sentiment: SupportTicketSentiment;
  labels: string[];
  rawPayloadSeparated: true;
  safeForBrowser: true;
}

export interface SupportTicketRow {
  id: string;
  workspace_id: string;
  provider: SupportTicketProvider;
  external_thread_id: string;
  external_message_id: string;
  from_email_hint: string | null;
  from_name_hint: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: Date;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: SupportTicketCategory;
  sentiment: SupportTicketSentiment;
  labels_json: string[];
  imported_by: string | null;
  imported_at: Date;
  updated_at: Date;
}

export interface SafeSupportTicketResponse {
  id: string;
  provider: SupportTicketProvider;
  externalThreadId: string;
  externalMessageId: string;
  fromEmailHint: string | null;
  fromNameHint: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: SupportTicketCategory;
  sentiment: SupportTicketSentiment;
  labels: string[];
  importedAt: string;
  updatedAt: string;
}

export interface SupportReadonlyImportStatus {
  phase: 'V2 Phase 12.2 — Read-Only Support Connector First';
  healthMode: 'v2-phase-12-2-read-only-support-connector-first';
  deliverable: 'read_only_ticket_import';
  selectedConnector: 'gmail';
  readOnlyImportAdded: true;
  gmailApiClientAdded: false;
  gmailExternalApiCalled: false;
  emailSendAdded: false;
  gmailModifyAdded: false;
  supportReplyActionAdded: false;
  autoReplyAdded: false;
  rawPayloadSeparated: true;
  browserReceivesRawProviderPayload: false;
  tokenExposureAllowedInBrowser: false;
}

export interface SupportImportPreviewResult {
  imported: false;
  externalApiCalled: false;
  emailSent: false;
  normalizedTickets: NormalizedSupportTicket[];
  warnings: string[];
}

export interface SupportImportResult {
  imported: true;
  externalApiCalled: false;
  emailSent: false;
  createdOrUpdatedCount: number;
  tickets: SafeSupportTicketResponse[];
  warnings: string[];
}
