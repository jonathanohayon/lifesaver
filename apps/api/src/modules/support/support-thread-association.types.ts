export type SupportThreadAssociationProvider = 'gmail';
export type SupportThreadAssociationDecision =
  | 'thread_association_verified'
  | 'blocked_unsupported_action_type'
  | 'blocked_unsupported_provider'
  | 'blocked_missing_ticket_or_thread'
  | 'blocked_ticket_not_found'
  | 'blocked_thread_mismatch'
  | 'blocked_customer_mismatch'
  | 'blocked_unsafe_ticket_status';

export interface SupportThreadAssociationTicketInput {
  id?: string | null;
  workspaceId?: string | null;
  provider?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  customerEmail?: string | null;
  fromEmailHint?: string | null;
  subject?: string | null;
  status?: string | null;
  updatedAt?: string | Date | null;
}

export interface SupportThreadAssociationInput {
  actionType?: string | null;
  provider?: string | null;
  ticketId?: string | null;
  threadId?: string | null;
  customerEmail?: string | null;
  subject?: string | null;
  importedTicket?: SupportThreadAssociationTicketInput | null;
}

export interface SupportThreadAssociationChecks {
  actionTypeIsSupportReplySend: boolean;
  providerIsGmail: boolean;
  ticketIdPresent: boolean;
  threadIdPresent: boolean;
  importedTicketFound: boolean;
  importedTicketProviderMatches: boolean;
  importedTicketReferenceMatches: boolean;
  importedTicketThreadMatches: boolean;
  customerMatchesWhenKnown: boolean;
  ticketStatusAllowsReply: boolean;
  replyWillUseGmailThreadId: boolean;
}

export interface SupportThreadAssociationResult {
  version: '0.7.0';
  phase: 'phase_13_4_thread_association';
  healthMode: 'v2-phase-13-4-thread-association';
  deliverable: 'thread_safe_reply_handling';
  selectedConnector: 'gmail';
  actionType: string | null;
  provider: string | null;
  ticketId: string | null;
  threadId: string | null;
  verified: boolean;
  decision: SupportThreadAssociationDecision;
  checks: SupportThreadAssociationChecks;
  blockers: string[];
  warnings: string[];
  threadBinding: {
    importedTicketId: string | null;
    importedExternalMessageId: string | null;
    importedExternalThreadId: string | null;
    importedTicketStatus: string | null;
    threadIdSentToGmail: string | null;
    customerEmailVerified: boolean;
  };
  safeSummary: string;
  safety: {
    previewOnly?: boolean;
    emailSent: false;
    gmailApiCalled: false;
    executorMustUseValidatedThreadId: true;
    rawProviderPayloadReturned: false;
    rawTokenReturned: false;
    rawMimeReturned: false;
    note: string;
  };
}

export interface SupportThreadAssociationStatus {
  phase: 'V2 Phase 13.4 — Thread Association';
  healthMode: 'v2-phase-13-4-thread-association';
  deliverable: 'thread_safe_reply_handling';
  selectedConnector: 'gmail';
  actionType: 'support_reply_send';
  requiresImportedTicketMatch: true;
  requiresThreadIdMatch: true;
  executorUsesValidatedThreadId: true;
  blocksMissingTicket: true;
  blocksThreadMismatch: true;
  blocksCustomerMismatchWhenKnown: true;
  blocksArchivedOrSpamTicket: true;
  previewCallsGmail: false;
  previewSendsEmail: false;
  rawProviderPayloadReturned: false;
  rawTokenReturned: false;
  rawMimeReturned: false;
  nextStep: 'Phase 13.5 — FAQ Auto-Reply Policy';
}
