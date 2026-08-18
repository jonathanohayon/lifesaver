import { z } from 'zod';
import type {
  SupportPrivacyRedactionInput,
  SupportPrivacySafeLog,
  SupportPrivacySafeguardsPreview,
  SupportPrivacySafeguardsStatus,
} from './support-privacy-safeguards.types.js';

export const SUPPORT_PRIVACY_SAFEGUARDS_PHASE = 'phase_12_6_customer_data_protection' as const;
export const SUPPORT_PRIVACY_SAFEGUARDS_HEALTH_MODE = 'v2-phase-12-6-customer-data-protection' as const;
export const SUPPORT_PRIVACY_SAFEGUARDS_PACKAGE = 'lifesaver-v0.7.0-phase-12-6-customer-data-protection.zip' as const;

const supportPrivacyInputSchema = z.object({
  event: z.string().trim().max(160).optional().nullable(),
  ticketId: z.string().trim().max(180).optional().nullable(),
  threadId: z.string().trim().max(240).optional().nullable(),
  customerEmail: z.string().trim().max(320).optional().nullable(),
  customerName: z.string().trim().max(180).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  bodySnippet: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  sensitiveFlag: z.boolean().optional().nullable(),
  rawTicketPayload: z.unknown().optional(),
  adminLogMetadata: z.record(z.unknown()).optional().nullable(),
}).strict();

const secretLeakFragments = [
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
  'smtp_password',
  'sendgrid_api_key',
  'mailgun_api_key',
  'resend_api_key',
  'raw_provider_payload',
];

type Redaction = {
  value: string | null;
  reasons: string[];
};

function compact(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function maskEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.includes('@')) return null;
  const [name, domain] = value.split('@');
  if (!domain) return '[REDACTED_EMAIL]';
  const safeName = name.length <= 2 ? `${name.slice(0, 1) || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function maskName(value: string | null | undefined): string | null {
  const clean = compact(value, 80);
  if (!clean) return null;
  const parts = clean.split(' ').filter(Boolean);
  return parts.map((part) => `${part.slice(0, 1)}***`).join(' ');
}

const redactionRules: Array<{ reason: string; pattern: RegExp; replacement: string }> = [
  { reason: 'email_address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
  { reason: 'authorization_header', pattern: /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, replacement: '[REDACTED_AUTHORIZATION_HEADER]' },
  { reason: 'oauth_token', pattern: /\b(access_token|refresh_token|id_token|client_secret)\b\s*[:=]\s*['\"]?[^\s,'\"}]+/gi, replacement: '[REDACTED_SECRET_FIELD]' },
  { reason: 'api_key', pattern: /\b(api[_-]?key|secret[_-]?key|sendgrid_api_key|mailgun_api_key|resend_api_key)\b\s*[:=]\s*['\"]?[^\s,'\"}]+/gi, replacement: '[REDACTED_SECRET_FIELD]' },
  { reason: 'credit_card_like_number', pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[REDACTED_CARD]' },
  { reason: 'otp_or_security_code', pattern: /\b(otp|2fa|security code|verification code|reset code)\b\s*[:#-]?\s*\d{4,8}\b/gi, replacement: '$1 [REDACTED_CODE]' },
  { reason: 'phone_number', pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
  { reason: 'postal_address_hint', pattern: /\b\d{1,6}\s+[A-Za-z0-9.' -]+\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Drive|Dr\.?)\b/gi, replacement: '[REDACTED_ADDRESS]' },
];

export function redactSupportTextForLogs(value: string | null | undefined, max = 700): Redaction {
  const clean = compact(value, max);
  if (!clean) return { value: null, reasons: [] };
  let output = clean;
  const reasons = new Set<string>();
  for (const rule of redactionRules) {
    if (rule.pattern.test(output)) {
      reasons.add(rule.reason);
      output = output.replace(rule.pattern, rule.replacement);
    }
    rule.pattern.lastIndex = 0;
  }
  return { value: output, reasons: [...reasons] };
}

export function assertSupportPrivacySafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of secretLeakFragments) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support privacy output contains forbidden fragment: ${fragment}`);
    }
  }
}

export function buildSupportPrivacySafeguardsPreview(input: unknown): SupportPrivacySafeguardsPreview {
  const parsed = supportPrivacyInputSchema.parse(input) as SupportPrivacyRedactionInput;
  const subject = redactSupportTextForLogs(parsed.subject, 180);
  const body = redactSupportTextForLogs(parsed.bodySnippet || parsed.body, 700);
  const reasons = [...new Set([...subject.reasons, ...body.reasons])];
  const hasRawPayload = Object.prototype.hasOwnProperty.call(parsed, 'rawTicketPayload');
  if (hasRawPayload) reasons.push('raw_ticket_payload_omitted_from_admin_log');
  if (parsed.sensitiveFlag) reasons.push('ticket_marked_sensitive');

  const redactionApplied = reasons.length > 0;
  const safeLog: SupportPrivacySafeLog = {
    event: compact(parsed.event, 120) || 'support_ticket_log_preview',
    ticketId: compact(parsed.ticketId, 180),
    threadId: compact(parsed.threadId, 240),
    customerEmailHint: maskEmail(parsed.customerEmail),
    customerNameHint: maskName(parsed.customerName),
    subjectPreview: subject.value,
    bodySnippetPreview: body.value,
    category: compact(parsed.category, 80),
    sensitiveFlag: parsed.sensitiveFlag === true || reasons.some((reason) => ['credit_card_like_number', 'otp_or_security_code', 'authorization_header', 'oauth_token', 'api_key'].includes(reason)),
    redactionApplied,
    redactionReasons: reasons,
    privateDataMinimized: true,
    fullTicketBodyReturned: false,
    providerPayloadReturned: false,
    safeForAdminLog: true,
  };

  const preview: SupportPrivacySafeguardsPreview = {
    valid: true,
    decision: redactionApplied ? 'sensitive_log_redacted' : 'safe_log_ready',
    safeLog,
    blockedFields: [
      'providerPayload',
      'fullBody',
      'accessToken',
      'refreshToken',
      'authorizationHeader',
      'customerFullEmailInLogs',
    ],
    warnings: redactionApplied
      ? ['Sensitive or private ticket data was redacted before building an admin/browser-safe log preview.']
      : ['No sensitive patterns detected, but full raw ticket payload is still omitted by default.'],
    safety: {
      sensitiveDataRedactedInLogs: true,
      customerPrivateDataMinimized: true,
      fullRawTicketPayloadInAdminLogs: false,
      fullTicketBodyReturned: false,
      providerPayloadReturned: false,
      emailSendAdded: false,
      externalApiCalled: false,
    },
  };

  assertSupportPrivacySafe({
    ...preview,
    blockedFields: preview.blockedFields.filter((field) => !field.toLowerCase().includes('token')),
  });
  return preview;
}

export function buildSupportPrivacySafeguardsStatus(): SupportPrivacySafeguardsStatus {
  return {
    phase: 'V2 Phase 12.6 — Customer Data Protection',
    healthMode: SUPPORT_PRIVACY_SAFEGUARDS_HEALTH_MODE,
    deliverable: 'support_privacy_safeguards',
    selectedConnector: 'gmail',
    redactSensitiveDataInLogs: true,
    customerPrivateDataMinimized: true,
    fullRawTicketPayloadInAdminLogs: false,
    browserReturnsSafePreviewOnly: true,
    emailSendAdded: false,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    supportAutoReplyAdded: false,
  };
}

export function buildSupportPrivacySafeguardsExample(): SupportPrivacySafeguardsPreview {
  return buildSupportPrivacySafeguardsPreview({
    event: 'support_ticket_imported',
    ticketId: 'ticket_456',
    threadId: 'gmail_thread_456',
    customerEmail: 'private.customer@example.com',
    customerName: 'Private Customer',
    subject: 'Payment failed and my card 4242 4242 4242 4242 was charged twice',
    bodySnippet: 'Please help. My email is private.customer@example.com and my verification code 123456 was included by mistake.',
    category: 'payment_issue',
    sensitiveFlag: true,
    rawTicketPayload: { provider: 'gmail', omitted: true },
  });
}
