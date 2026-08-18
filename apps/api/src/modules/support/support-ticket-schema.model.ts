import { z } from 'zod';
import type {
  CanonicalSupportTicketSchemaRecord,
  SupportTicketCategory,
  SupportTicketSchemaExample,
  SupportTicketSchemaField,
  SupportTicketSchemaPreview,
  SupportTicketSchemaStatus,
  SupportTicketStatus,
} from './support-ticket-schema.types.js';

export const SUPPORT_TICKET_SCHEMA_PHASE = 'phase_12_3_ticket_data_model' as const;
export const SUPPORT_TICKET_SCHEMA_HEALTH_MODE = 'v2-phase-12-3-ticket-data-model' as const;
export const SUPPORT_TICKET_SCHEMA_PACKAGE = 'lifesaver-v0.7.0-phase-12-3-ticket-data-model.zip' as const;

const statusValues = ['open', 'pending_review', 'closed', 'spam', 'archived'] as const;
const categoryValues = ['uncategorized', 'order_status', 'shipping', 'returns', 'refunds', 'product_question', 'complaint', 'vip', 'spam'] as const;

const FORBIDDEN_BROWSER_FRAGMENTS = [
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
  '"raw_provider_payload"',
  '"rawproviderpayload"',
];

export const supportTicketSchemaFields: SupportTicketSchemaField[] = [
  {
    key: 'ticket_id',
    apiField: 'ticketId',
    dbColumn: 'id',
    required: true,
    browserSafe: true,
    description: 'Canonical LIFE.SAVER support ticket id. Maps to support_tickets.id for persisted tickets.',
  },
  {
    key: 'customer_email',
    apiField: 'customerEmail',
    dbColumn: 'customer_email',
    required: true,
    browserSafe: false,
    description: 'Server-side customer email for routing support work. Browser responses should prefer customerEmailHint.',
  },
  {
    key: 'subject',
    apiField: 'subject',
    dbColumn: 'subject',
    required: false,
    browserSafe: true,
    description: 'Email/support ticket subject, cleaned and length-limited.',
  },
  {
    key: 'body_snippet',
    apiField: 'bodySnippet',
    dbColumn: 'body_snippet',
    required: false,
    browserSafe: true,
    description: 'Short preview of the support message body. Sensitive values are redacted before browser display.',
  },
  {
    key: 'thread_id',
    apiField: 'threadId',
    dbColumn: 'external_thread_id',
    required: true,
    browserSafe: true,
    description: 'Provider thread id used to group support messages safely.',
  },
  {
    key: 'status',
    apiField: 'status',
    dbColumn: 'status',
    required: true,
    browserSafe: true,
    description: 'LIFE.SAVER support ticket workflow status.',
  },
  {
    key: 'category',
    apiField: 'category',
    dbColumn: 'category',
    required: true,
    browserSafe: true,
    description: 'Support category for triage and future draft routing.',
  },
  {
    key: 'sensitive_flag',
    apiField: 'sensitiveFlag',
    dbColumn: 'sensitive_flag',
    required: true,
    browserSafe: true,
    description: 'True when content may contain sensitive customer/payment/security/compliance data.',
  },
];

const schemaInput = z.object({
  ticketId: z.string().trim().min(1).max(120).optional().nullable(),
  customerEmail: z.string().trim().email().max(320),
  subject: z.string().trim().max(500).optional().nullable(),
  bodySnippet: z.string().trim().max(2000).optional().nullable(),
  threadId: z.string().trim().min(1).max(240),
  status: z.enum(statusValues).optional().default('open'),
  category: z.enum(categoryValues).optional().default('uncategorized'),
  sensitiveFlag: z.boolean().optional().default(false),
});

function cleanNullableText(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function maskCustomerEmail(email: string): string {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
  if (!local || !domain) return email.trim().toLowerCase();
  const first = local[0] ?? '*';
  const maskedLocal = local.length <= 2 ? `${first}*` : `${first}${'*'.repeat(Math.min(5, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

export function inferSensitiveReasons(input: { customerEmail?: string; subject?: string | null; bodySnippet?: string | null; category?: SupportTicketCategory }): string[] {
  const text = `${input.customerEmail ?? ''} ${input.subject ?? ''} ${input.bodySnippet ?? ''} ${input.category ?? ''}`.toLowerCase();
  const reasons: string[] = [];
  if (/\b(password|login code|otp|2fa|reset code|security code)\b/.test(text)) reasons.push('account_security');
  if (/\b(credit card|card number|cvv|cvc|bank account|wire transfer|iban|routing number)\b/.test(text)) reasons.push('payment_or_banking');
  if (/\b(ssn|passport|national id|driver license|government id)\b/.test(text)) reasons.push('identity_document');
  if (text.includes('access token') || text.includes('refresh token') || text.includes('api key') || text.includes('client secret') || text.includes('authorization bearer')) reasons.push('secret_like_text');
  if (/\b(medical|diagnosis|prescription|allergy)\b/.test(text)) reasons.push('health_related');
  if (input.category === 'refunds') reasons.push('refund_or_payment_workflow');
  return Array.from(new Set(reasons));
}

export function redactSensitiveBodySnippet(value: string | null): string | null {
  if (!value) return value;
  return value
    .replace(/(access token|refresh token|api key|client secret|authorization bearer)(\s*(is|:)?\s*[^\s,.;)]*)?/gi, '[redacted-secret]')
    .replace(/(password|login code|otp|2fa|security code)\s*(is|:)?\s*[^\s,.;)]*/gi, '$1 [redacted]')
    .replace(/\b\d{13,19}\b/g, '[redacted-number]')
    .slice(0, 1000);
}

export function normalizeSupportTicketSchema(input: unknown): CanonicalSupportTicketSchemaRecord {
  const parsed = schemaInput.parse(input);
  const rawSubject = cleanNullableText(parsed.subject, 500);
  const rawSnippet = cleanNullableText(parsed.bodySnippet, 1000);
  const reasons = inferSensitiveReasons({
    customerEmail: parsed.customerEmail,
    subject: rawSubject,
    bodySnippet: rawSnippet,
    category: parsed.category,
  });
  const sensitiveFlag = parsed.sensitiveFlag || reasons.length > 0;

  const record: CanonicalSupportTicketSchemaRecord = {
    ticketId: parsed.ticketId?.trim() || `ticket_${parsed.threadId.trim()}`,
    customerEmail: parsed.customerEmail.trim().toLowerCase(),
    customerEmailHint: maskCustomerEmail(parsed.customerEmail),
    subject: rawSubject,
    bodySnippet: sensitiveFlag ? redactSensitiveBodySnippet(rawSnippet) : rawSnippet,
    threadId: parsed.threadId.trim(),
    status: parsed.status as SupportTicketStatus,
    category: parsed.category as SupportTicketCategory,
    sensitiveFlag,
    sensitiveReasons: reasons,
    rawProviderPayloadSeparated: true,
    safeForBrowser: true,
  };
  assertSupportTicketSchemaSafe(record);
  return record;
}

export function buildSupportTicketSchemaStatus(): SupportTicketSchemaStatus {
  return {
    phase: 'V2 Phase 12.3 — Ticket Data Model',
    healthMode: SUPPORT_TICKET_SCHEMA_HEALTH_MODE,
    deliverable: 'support_ticket_schema',
    selectedConnector: 'gmail',
    ticketSchemaAdded: true,
    migrationAdded: true,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportReplyActionAdded: false,
    rawProviderPayloadSeparated: true,
    browserReceivesRawProviderPayload: false,
    sensitiveFlagAdded: true,
  };
}

export function buildSupportTicketSchemaExample(): SupportTicketSchemaExample {
  return {
    fields: supportTicketSchemaFields,
    exampleRecord: normalizeSupportTicketSchema({
      ticketId: 'ticket_example_001',
      customerEmail: 'customer@example.com',
      subject: 'Where is my order?',
      bodySnippet: 'Hello, can you please share the tracking update for order #1001?',
      threadId: 'gmail_thread_example_001',
      status: 'open',
      category: 'shipping',
      sensitiveFlag: false,
    }),
    externalApiCalled: false,
    emailSent: false,
  };
}

export function buildSupportTicketSchemaPreview(input: unknown): SupportTicketSchemaPreview {
  return {
    valid: true,
    record: normalizeSupportTicketSchema(input),
    externalApiCalled: false,
    emailSent: false,
    warnings: [],
  };
}

export function assertSupportTicketSchemaSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_BROWSER_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Support ticket schema output contains forbidden fragment: ${fragment}`);
    }
  }
}
