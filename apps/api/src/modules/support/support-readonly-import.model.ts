import { z } from 'zod';
import type {
  GmailReadonlyMessageInput,
  NormalizedSupportTicket,
  SafeSupportTicketResponse,
  SupportImportPreviewResult,
  SupportReadonlyImportStatus,
  SupportTicketRow,
} from './support-readonly-import.types.js';

export const SUPPORT_READONLY_IMPORT_PHASE = 'phase_12_2_read_only_support_connector_first' as const;
export const SUPPORT_READONLY_IMPORT_HEALTH_MODE = 'v2-phase-12-2-read-only-support-connector-first' as const;
export const SUPPORT_READONLY_IMPORT_PACKAGE = 'lifesaver-v0.7.0-phase-12-2-read-only-support-connector-first.zip' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'gmail_client_secret',
  'password',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'oauth',
];

const rawProviderPayloadSchema = z.record(z.unknown()).default({});

const gmailMessageSchema = z.object({
  provider: z.literal('gmail').optional().default('gmail'),
  externalMessageId: z.string().trim().min(1).max(200),
  externalThreadId: z.string().trim().min(1).max(200),
  fromEmail: z.string().trim().max(320).optional().nullable(),
  fromName: z.string().trim().max(180).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  snippet: z.string().trim().max(1000).optional().nullable(),
  receivedAt: z.string().trim().datetime({ offset: true }),
  labelIds: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  rawProviderPayload: rawProviderPayloadSchema.optional().default({}),
});

const importInputSchema = z.object({
  messages: z.array(gmailMessageSchema).min(1).max(25),
});

function cleanString(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function maskEmailHint(value: string | null | undefined): string | null {
  const cleaned = cleanString(value, 320);
  if (!cleaned || !cleaned.includes('@')) return cleaned;
  const [localPart, domainPart] = cleaned.toLowerCase().split('@');
  if (!localPart || !domainPart) return cleaned;
  const first = localPart[0] ?? '*';
  const maskedLocal = localPart.length <= 2 ? `${first}*` : `${first}${'*'.repeat(Math.min(5, localPart.length - 1))}`;
  return `${maskedLocal}@${domainPart}`;
}

export function inferSupportCategory(message: Pick<GmailReadonlyMessageInput, 'subject' | 'snippet' | 'labelIds'>): NormalizedSupportTicket['category'] {
  const text = `${message.subject ?? ''} ${message.snippet ?? ''} ${(message.labelIds ?? []).join(' ')}`.toLowerCase();
  if (/refund|money back|charged|chargeback/.test(text)) return 'refunds';
  if (/return|exchange|replace/.test(text)) return 'returns';
  if (/shipping|delivery|tracking|where is my order|late/.test(text)) return 'shipping';
  if (/order status|status of my order|order #|order number/.test(text)) return 'order_status';
  if (/question|how do i|size|ingredient|product/.test(text)) return 'product_question';
  if (/complaint|angry|unhappy|bad experience/.test(text)) return 'complaint';
  if (/vip|wholesale|partner/.test(text)) return 'vip';
  if (/spam|promotion|unsubscribe/.test(text)) return 'spam';
  return 'uncategorized';
}

export function inferSupportPriority(message: Pick<GmailReadonlyMessageInput, 'subject' | 'snippet' | 'labelIds'>): NormalizedSupportTicket['priority'] {
  const text = `${message.subject ?? ''} ${message.snippet ?? ''} ${(message.labelIds ?? []).join(' ')}`.toLowerCase();
  if (/urgent|asap|immediately|chargeback|legal|fraud/.test(text)) return 'urgent';
  if (/refund|complaint|angry|lost package|not delivered/.test(text)) return 'high';
  if (/question|shipping|return|order/.test(text)) return 'normal';
  return 'low';
}

export function inferSupportSentiment(message: Pick<GmailReadonlyMessageInput, 'subject' | 'snippet'>): NormalizedSupportTicket['sentiment'] {
  const text = `${message.subject ?? ''} ${message.snippet ?? ''}`.toLowerCase();
  if (/thank you|thanks|great|love|happy/.test(text)) return 'positive';
  if (/angry|terrible|bad|unhappy|frustrated|scam|worst/.test(text)) return 'negative';
  if (text.trim()) return 'neutral';
  return 'unknown';
}

export function assertNoSecretLikeProviderPayload(payload: Record<string, unknown>): void {
  const text = JSON.stringify(payload).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Provider payload contains forbidden secret-like fragment: ${fragment}`);
    }
  }
}

export function normalizeGmailReadonlyMessage(input: unknown): { ticket: NormalizedSupportTicket; rawProviderPayload: Record<string, unknown> } {
  const parsed = gmailMessageSchema.parse(input);
  assertNoSecretLikeProviderPayload(parsed.rawProviderPayload);

  const ticket: NormalizedSupportTicket = {
    provider: 'gmail',
    externalThreadId: parsed.externalThreadId.trim(),
    externalMessageId: parsed.externalMessageId.trim(),
    fromEmailHint: maskEmailHint(parsed.fromEmail),
    fromNameHint: cleanString(parsed.fromName, 180),
    subject: cleanString(parsed.subject, 500),
    snippet: cleanString(parsed.snippet, 1000),
    receivedAt: new Date(parsed.receivedAt).toISOString(),
    status: inferSupportCategory(parsed) === 'spam' ? 'spam' : 'open',
    priority: inferSupportPriority(parsed),
    category: inferSupportCategory(parsed),
    sentiment: inferSupportSentiment(parsed),
    labels: parsed.labelIds.map((label) => label.trim()).filter(Boolean).slice(0, 30),
    rawPayloadSeparated: true,
    safeForBrowser: true,
  };

  assertSupportTicketSafeForBrowser(ticket);
  return { ticket, rawProviderPayload: parsed.rawProviderPayload };
}

export function parseSupportImportMessages(input: unknown): { tickets: NormalizedSupportTicket[]; rawPayloads: Record<string, unknown>[]; warnings: string[] } {
  const parsed = importInputSchema.parse(input);
  const seen = new Set<string>();
  const tickets: NormalizedSupportTicket[] = [];
  const rawPayloads: Record<string, unknown>[] = [];
  const warnings: string[] = [];

  for (const message of parsed.messages) {
    const { ticket, rawProviderPayload } = normalizeGmailReadonlyMessage(message);
    const key = `${ticket.provider}:${ticket.externalMessageId}`;
    if (seen.has(key)) {
      warnings.push(`Duplicate message in request ignored: ${ticket.externalMessageId}`);
      continue;
    }
    seen.add(key);
    tickets.push(ticket);
    rawPayloads.push(rawProviderPayload);
  }

  return { tickets, rawPayloads, warnings };
}

export function buildSupportReadonlyImportStatus(): SupportReadonlyImportStatus {
  return {
    phase: 'V2 Phase 12.2 — Read-Only Support Connector First',
    healthMode: SUPPORT_READONLY_IMPORT_HEALTH_MODE,
    deliverable: 'read_only_ticket_import',
    selectedConnector: 'gmail',
    readOnlyImportAdded: true,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    gmailModifyAdded: false,
    supportReplyActionAdded: false,
    autoReplyAdded: false,
    rawPayloadSeparated: true,
    browserReceivesRawProviderPayload: false,
    tokenExposureAllowedInBrowser: false,
  };
}

export function buildSupportImportPreview(input: unknown): SupportImportPreviewResult {
  const parsed = parseSupportImportMessages(input);
  return {
    imported: false,
    externalApiCalled: false,
    emailSent: false,
    normalizedTickets: parsed.tickets,
    warnings: parsed.warnings,
  };
}

export function supportTicketRowToSafeResponse(row: SupportTicketRow): SafeSupportTicketResponse {
  const response: SafeSupportTicketResponse = {
    id: row.id,
    provider: row.provider,
    externalThreadId: row.external_thread_id,
    externalMessageId: row.external_message_id,
    fromEmailHint: row.from_email_hint,
    fromNameHint: row.from_name_hint,
    subject: row.subject,
    snippet: row.snippet,
    receivedAt: new Date(row.received_at).toISOString(),
    status: row.status,
    priority: row.priority,
    category: row.category,
    sentiment: row.sentiment,
    labels: Array.isArray(row.labels_json) ? row.labels_json : [],
    importedAt: new Date(row.imported_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  assertSupportTicketSafeForBrowser(response);
  return response;
}

export function assertSupportTicketSafeForBrowser(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Support ticket browser output contains forbidden fragment: ${fragment}`);
    }
  }
  if (text.includes('rawproviderpayload') || text.includes('raw_provider_payload')) {
    throw new Error('Support ticket browser output must not include raw provider payload.');
  }
}
