import type {
  SupportThreadAssociationChecks,
  SupportThreadAssociationDecision,
  SupportThreadAssociationInput,
  SupportThreadAssociationResult,
  SupportThreadAssociationStatus,
  SupportThreadAssociationTicketInput,
} from './support-thread-association.types.js';

export const SUPPORT_THREAD_ASSOCIATION_PHASE = 'phase_13_4_thread_association' as const;
export const SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE = 'v2-phase-13-4-thread-association' as const;
export const SUPPORT_THREAD_ASSOCIATION_PACKAGE = 'lifesaver-v0.7.0-phase-13-4-thread-association.zip' as const;
export const SUPPORT_THREAD_ASSOCIATION_ACTION_TYPE = 'support_reply_send' as const;
export const SUPPORT_THREAD_ASSOCIATION_PROVIDER = 'gmail' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
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
  'raw_ticket_payload',
  'raw_mime',
  'raw_base64',
];

function safeText(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max) : clean;
}

function lower(value: unknown): string | null {
  const clean = safeText(value, 500);
  return clean ? clean.toLowerCase() : null;
}

function dateIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return safeText(value, 80);
}

function knownEmail(ticket: SupportThreadAssociationTicketInput | null | undefined): string | null {
  return lower(ticket?.customerEmail) || lower(ticket?.fromEmailHint);
}

function ticketReferenceMatches(input: SupportThreadAssociationInput, ticket: SupportThreadAssociationTicketInput | null | undefined): boolean {
  const ticketId = safeText(input.ticketId, 240);
  if (!ticketId || !ticket) return false;
  const candidates = [ticket.id, ticket.externalMessageId, ticket.externalThreadId]
    .map((value) => safeText(value, 240))
    .filter(Boolean) as string[];
  return candidates.includes(ticketId);
}

function buildChecks(input: SupportThreadAssociationInput): SupportThreadAssociationChecks {
  const ticket = input.importedTicket || null;
  const provider = lower(input.provider || 'gmail');
  const threadId = safeText(input.threadId, 240);
  const ticketId = safeText(input.ticketId, 240);
  const importedProvider = lower(ticket?.provider);
  const importedThreadId = safeText(ticket?.externalThreadId, 240);
  const payloadCustomerEmail = lower(input.customerEmail);
  const importedEmail = knownEmail(ticket);
  const status = lower(ticket?.status || 'open');
  const importedTicketFound = Boolean(ticket);
  const importedTicketReferenceMatches = ticketReferenceMatches(input, ticket);
  const importedTicketThreadMatches = Boolean(threadId && importedThreadId && threadId === importedThreadId);

  return {
    actionTypeIsSupportReplySend: safeText(input.actionType) === SUPPORT_THREAD_ASSOCIATION_ACTION_TYPE,
    providerIsGmail: provider === SUPPORT_THREAD_ASSOCIATION_PROVIDER,
    ticketIdPresent: Boolean(ticketId),
    threadIdPresent: Boolean(threadId),
    importedTicketFound,
    importedTicketProviderMatches: importedTicketFound && importedProvider === SUPPORT_THREAD_ASSOCIATION_PROVIDER,
    importedTicketReferenceMatches: importedTicketFound && importedTicketReferenceMatches,
    importedTicketThreadMatches: importedTicketFound && importedTicketThreadMatches,
    customerMatchesWhenKnown: !payloadCustomerEmail || !importedEmail || payloadCustomerEmail === importedEmail,
    ticketStatusAllowsReply: !['spam', 'archived'].includes(status || ''),
    replyWillUseGmailThreadId: Boolean(threadId),
  };
}

function decide(checks: SupportThreadAssociationChecks): {
  verified: boolean;
  decision: SupportThreadAssociationDecision;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.actionTypeIsSupportReplySend) blockers.push('Only support_reply_send actions can use support thread association.');
  if (!checks.providerIsGmail) blockers.push('Phase 13.4 thread association supports Gmail only.');
  if (!checks.ticketIdPresent || !checks.threadIdPresent) blockers.push('Support reply action payload must include ticket_id and thread_id.');
  if (!checks.importedTicketFound) blockers.push('Imported support ticket must exist before a support reply can be sent.');
  if (checks.importedTicketFound && !checks.importedTicketProviderMatches) blockers.push('Imported support ticket provider must match Gmail.');
  if (checks.importedTicketFound && !checks.importedTicketThreadMatches) blockers.push('Payload thread_id must match the imported support ticket thread.');
  if (checks.importedTicketFound && !checks.customerMatchesWhenKnown) blockers.push('Payload customer email must match the imported ticket customer email when known.');
  if (checks.importedTicketFound && !checks.ticketStatusAllowsReply) blockers.push('Archived or spam support tickets cannot be sent through this executor lane.');

  if (checks.importedTicketFound && !checks.importedTicketReferenceMatches && checks.importedTicketThreadMatches) {
    warnings.push('Ticket reference did not match imported ticket id/message id exactly, but the Gmail thread matched. Review ticket mapping before production send tests.');
  }

  if (!checks.actionTypeIsSupportReplySend) return { verified: false, decision: 'blocked_unsupported_action_type', blockers, warnings };
  if (!checks.providerIsGmail) return { verified: false, decision: 'blocked_unsupported_provider', blockers, warnings };
  if (!checks.ticketIdPresent || !checks.threadIdPresent) return { verified: false, decision: 'blocked_missing_ticket_or_thread', blockers, warnings };
  if (!checks.importedTicketFound) return { verified: false, decision: 'blocked_ticket_not_found', blockers, warnings };
  if (!checks.importedTicketThreadMatches) return { verified: false, decision: 'blocked_thread_mismatch', blockers, warnings };
  if (!checks.customerMatchesWhenKnown) return { verified: false, decision: 'blocked_customer_mismatch', blockers, warnings };
  if (!checks.ticketStatusAllowsReply) return { verified: false, decision: 'blocked_unsafe_ticket_status', blockers, warnings };

  return { verified: true, decision: 'thread_association_verified', blockers, warnings };
}

export function evaluateSupportThreadAssociation(input: SupportThreadAssociationInput = {}): SupportThreadAssociationResult {
  const checks = buildChecks(input);
  const decision = decide(checks);
  const ticket = input.importedTicket || null;
  const result: SupportThreadAssociationResult = {
    version: '0.7.0',
    phase: SUPPORT_THREAD_ASSOCIATION_PHASE,
    healthMode: SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE,
    deliverable: 'thread_safe_reply_handling',
    selectedConnector: SUPPORT_THREAD_ASSOCIATION_PROVIDER,
    actionType: safeText(input.actionType),
    provider: safeText(input.provider || SUPPORT_THREAD_ASSOCIATION_PROVIDER),
    ticketId: safeText(input.ticketId, 240),
    threadId: safeText(input.threadId, 240),
    verified: decision.verified,
    decision: decision.decision,
    checks,
    blockers: decision.blockers,
    warnings: decision.warnings,
    threadBinding: {
      importedTicketId: safeText(ticket?.id, 240),
      importedExternalMessageId: safeText(ticket?.externalMessageId, 240),
      importedExternalThreadId: safeText(ticket?.externalThreadId, 240),
      importedTicketStatus: safeText(ticket?.status, 80),
      threadIdSentToGmail: safeText(input.threadId, 240),
      customerEmailVerified: checks.customerMatchesWhenKnown,
    },
    safeSummary: decision.verified
      ? 'Support reply thread association is verified. The executor must send using the validated Gmail threadId from the approved payload.'
      : 'Support reply thread association is blocked until the approved action payload matches an imported Gmail support ticket thread.',
    safety: {
      emailSent: false,
      gmailApiCalled: false,
      executorMustUseValidatedThreadId: true,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
      note: 'Phase 13.4 verifies that support_reply_send payloads are bound to the correct imported Gmail thread before the send executor can call Gmail. It does not add auto-send and does not return raw provider payloads, tokens, or MIME.',
    },
  };
  assertSupportThreadAssociationOutputSafe(result);
  return result;
}

export function previewSupportThreadAssociation(input: SupportThreadAssociationInput = {}) {
  const result = evaluateSupportThreadAssociation(input);
  return {
    ...result,
    previewOnly: true,
    safety: {
      ...result.safety,
      previewOnly: true,
      emailSent: false,
      gmailApiCalled: false,
    },
  };
}

export function buildSupportThreadAssociationStatus(): SupportThreadAssociationStatus {
  return {
    phase: 'V2 Phase 13.4 — Thread Association',
    healthMode: SUPPORT_THREAD_ASSOCIATION_HEALTH_MODE,
    deliverable: 'thread_safe_reply_handling',
    selectedConnector: SUPPORT_THREAD_ASSOCIATION_PROVIDER,
    actionType: SUPPORT_THREAD_ASSOCIATION_ACTION_TYPE,
    requiresImportedTicketMatch: true,
    requiresThreadIdMatch: true,
    executorUsesValidatedThreadId: true,
    blocksMissingTicket: true,
    blocksThreadMismatch: true,
    blocksCustomerMismatchWhenKnown: true,
    blocksArchivedOrSpamTicket: true,
    previewCallsGmail: false,
    previewSendsEmail: false,
    rawProviderPayloadReturned: false,
    rawTokenReturned: false,
    rawMimeReturned: false,
    nextStep: 'Phase 13.5 — FAQ Auto-Reply Policy',
  };
}

export function buildSupportThreadAssociationExample() {
  const importedTicket: SupportThreadAssociationTicketInput = {
    id: 'support_ticket_123',
    workspaceId: 'workspace_123',
    provider: 'gmail',
    externalMessageId: 'gmail_message_123',
    externalThreadId: 'gmail_thread_123',
    customerEmail: 'customer@example.com',
    fromEmailHint: 'customer@example.com',
    subject: 'Where is my order?',
    status: 'open',
    updatedAt: '2026-07-08T10:00:00.000Z',
  };

  return {
    status: buildSupportThreadAssociationStatus(),
    verified: evaluateSupportThreadAssociation({
      actionType: 'support_reply_send',
      provider: 'gmail',
      ticketId: 'support_ticket_123',
      threadId: 'gmail_thread_123',
      customerEmail: 'customer@example.com',
      subject: 'Where is my order?',
      importedTicket,
    }),
    blockedWrongThread: evaluateSupportThreadAssociation({
      actionType: 'support_reply_send',
      provider: 'gmail',
      ticketId: 'support_ticket_123',
      threadId: 'gmail_thread_wrong',
      customerEmail: 'customer@example.com',
      importedTicket,
    }),
    safety: {
      exampleSendsEmail: false,
      gmailApiCalled: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function normalizeSupportThreadAssociationTicketRow(row: {
  id: string;
  workspace_id: string;
  provider: string;
  external_thread_id: string;
  external_message_id: string;
  customer_email?: string | null;
  from_email_hint?: string | null;
  subject?: string | null;
  status?: string | null;
  updated_at?: Date | string | null;
} | null): SupportThreadAssociationTicketInput | null {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    externalThreadId: row.external_thread_id,
    externalMessageId: row.external_message_id,
    customerEmail: row.customer_email || null,
    fromEmailHint: row.from_email_hint || null,
    subject: row.subject || null,
    status: row.status || null,
    updatedAt: dateIso(row.updated_at),
  };
}

export function assertSupportThreadAssociationOutputSafe(output: unknown): void {
  const serialized = JSON.stringify(output).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support thread association output contains forbidden fragment: ${fragment}`);
    }
  }
}
