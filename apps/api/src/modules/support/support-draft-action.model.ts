import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ActionRiskLevel } from '../actions/actions.types.js';
import { classifySupportTicket } from './support-ticket-classifier.model.js';
import type {
  SupportDraftActionPreview,
  SupportDraftActionStatus,
  SupportDraftToActionInput,
  SupportReplyActionPayload,
} from './support-draft-action.types.js';
import type { SupportClassifierCategory } from './support-ticket-classifier.types.js';

export const SUPPORT_DRAFT_ACTION_PHASE = 'phase_12_5_draft_reply_action' as const;
export const SUPPORT_DRAFT_ACTION_HEALTH_MODE = 'v2-phase-12-5-draft-reply-action' as const;
export const SUPPORT_DRAFT_ACTION_PACKAGE = 'lifesaver-v0.7.0-phase-12-5-draft-reply-action.zip' as const;

const categoryValues = ['faq', 'shipping', 'complaint', 'refund', 'cancellation', 'payment_issue', 'sensitive', 'escalation'] as const;

const supportDraftToActionInputSchema = z.object({
  provider: z.literal('gmail').optional().default('gmail'),
  ticketId: z.string().trim().min(1).max(180),
  threadId: z.string().trim().min(1).max(240),
  customerEmail: z.string().trim().max(320).optional().nullable(),
  customerName: z.string().trim().max(180).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  draftReplyBody: z.string().trim().max(8000).optional().nullable(),
  replyBody: z.string().trim().max(8000).optional().nullable(),
  category: z.enum(categoryValues).optional().nullable(),
  confidenceScore: z.number().min(0).max(1).optional().nullable(),
  sensitiveFlag: z.boolean().optional().default(false),
  escalationRequired: z.boolean().optional().default(false),
  approvalNotes: z.string().trim().max(1200).optional().nullable(),
  sourceDraftId: z.string().trim().max(180).optional().nullable(),
  idempotencyHint: z.string().trim().max(240).optional().nullable(),
}).strict();

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
  'oauth',
  'smtp_password',
  'sendgrid_api_key',
];

function compact(value: string | null | undefined, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function requiredClean(value: string | null | undefined, max = 8000): string {
  return compact(value, max)?.replace(/…$/, '') || '';
}

function maskEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.includes('@')) return null;
  const [name, domain] = value.split('@');
  const safeName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function buildStableIdempotencyHint(input: z.infer<typeof supportDraftToActionInputSchema>, replyBody: string): string {
  const explicit = compact(input.idempotencyHint, 220);
  if (explicit) return explicit;
  const hash = createHash('sha256')
    .update(JSON.stringify({ ticketId: input.ticketId, threadId: input.threadId, sourceDraftId: input.sourceDraftId || null, replyBody }))
    .digest('hex')
    .slice(0, 24);
  return `support-reply:${input.ticketId}:${hash}`.slice(0, 240);
}

function riskForDraft(params: {
  category: SupportClassifierCategory;
  sensitiveFlag: boolean;
  escalationRequired: boolean;
  confidenceScore: number;
}): ActionRiskLevel {
  if (params.sensitiveFlag || params.category === 'sensitive' || params.escalationRequired || params.category === 'escalation') return 'critical';
  if (['refund', 'cancellation', 'payment_issue', 'complaint'].includes(params.category)) return 'high';
  if (params.confidenceScore < 0.7) return 'medium';
  return 'medium';
}

function buildIntentSummary(category: SupportClassifierCategory, subject: string | null): string {
  const subjectPart = subject ? ` for “${subject.slice(0, 90)}”` : '';
  return `Review and approve a drafted ${category.replace('_', ' ')} support reply${subjectPart}.`;
}

export function assertSupportDraftActionSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_BROWSER_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support draft action output contains forbidden fragment: ${fragment}`);
    }
  }
}

export function buildSupportDraftActionPreview(input: unknown): SupportDraftActionPreview {
  const parsed = supportDraftToActionInputSchema.parse(input) as SupportDraftToActionInput & z.infer<typeof supportDraftToActionInputSchema>;
  const replyBody = requiredClean(parsed.draftReplyBody || parsed.replyBody, 8000);
  if (!replyBody) {
    throw new Error('Support draft action requires draftReplyBody or replyBody.');
  }

  const classifier = classifySupportTicket({
    ticketId: parsed.ticketId,
    customerEmail: parsed.customerEmail,
    subject: parsed.subject,
    bodySnippet: replyBody,
    threadId: parsed.threadId,
    sensitiveFlag: parsed.sensitiveFlag,
  });

  const category = (parsed.category || classifier.category) as SupportClassifierCategory;
  const confidenceScore = typeof parsed.confidenceScore === 'number' ? Number(parsed.confidenceScore.toFixed(2)) : classifier.confidence;
  const sensitiveFlag = parsed.sensitiveFlag === true || classifier.sensitiveFlag || category === 'sensitive';
  const escalationRequired = parsed.escalationRequired === true || classifier.escalationRequired || category === 'escalation' || sensitiveFlag;
  const subject = compact(parsed.subject, 180);
  const title = `Approve support reply: ${subject || parsed.ticketId}`.slice(0, 180);
  const description = `Drafted Gmail support reply for ticket ${parsed.ticketId}. Approval required before any reply can be sent.`;
  const riskLevel = riskForDraft({ category, sensitiveFlag, escalationRequired, confidenceScore });
  const idempotencyHint = buildStableIdempotencyHint(parsed, replyBody);

  const payload: SupportReplyActionPayload = {
    action_type: 'support_reply_send',
    schema_version: 'support_reply_send.v1',
    source: 'support_draft_to_action',
    intent_summary: buildIntentSummary(category, subject),
    idempotency_hint: idempotencyHint,
    data: {
      support_provider: parsed.provider || 'gmail',
      ticket_id: parsed.ticketId,
      thread_id: parsed.threadId,
      reply_body: replyBody,
      ...(compact(parsed.customerEmail, 320) ? { customer_email: compact(parsed.customerEmail, 320) as string } : {}),
      ...(compact(parsed.customerName, 180) ? { customer_name: compact(parsed.customerName, 180) as string } : {}),
      ...(subject ? { subject } : {}),
      category,
      confidence_score: confidenceScore,
      sensitive_flag: sensitiveFlag,
      escalation_required: escalationRequired,
      ...(compact(parsed.approvalNotes, 800) ? { approval_notes: compact(parsed.approvalNotes, 800) as string } : {}),
      ...(compact(parsed.sourceDraftId, 180) ? { source_draft_id: compact(parsed.sourceDraftId, 180) as string } : {}),
      send_email_enabled: false,
      external_api_called: false,
      auto_reply_enabled: false,
    },
  };

  const warnings: string[] = [];
  if (sensitiveFlag) warnings.push('Sensitive ticket: founder review is required before any support reply can be sent.');
  if (escalationRequired) warnings.push('Escalation required: this draft should be reviewed by an owner/admin.');
  if (confidenceScore < 0.7) warnings.push('Low confidence classification: keep manual review required.');

  const preview: SupportDraftActionPreview = {
    valid: true,
    decision: sensitiveFlag || escalationRequired ? 'manual_review_required' : 'proposed_action_ready',
    title,
    description,
    riskLevel,
    actionType: 'support_reply_send',
    approvalRequired: true,
    policyDecision: 'ask',
    payload,
    browserSafePreview: {
      provider: parsed.provider || 'gmail',
      ticketId: parsed.ticketId,
      threadId: parsed.threadId,
      customerEmailHint: maskEmail(parsed.customerEmail),
      subjectPreview: subject,
      replyBodyPreview: compact(replyBody, 700) || '',
      category,
      confidenceScore,
      sensitiveFlag,
      escalationRequired,
      sourceDraftId: compact(parsed.sourceDraftId, 180),
    },
    safety: {
      createsProposedActionOnly: true,
      emailSent: false,
      gmailApiCalled: false,
      externalWriteEnabled: false,
      autoReplyEnabled: false,
      rawProviderPayloadReturned: false,
    },
    warnings,
  };

  assertSupportDraftActionSafe({ ...preview, payload: { ...preview.payload, data: { ...preview.payload.data, reply_body: '[REDACTED_PREVIEW_CHECK]' } } });
  return preview;
}

export function buildSupportDraftActionStatus(): SupportDraftActionStatus {
  return {
    phase: 'V2 Phase 12.5 — Draft Reply Action',
    healthMode: SUPPORT_DRAFT_ACTION_HEALTH_MODE,
    deliverable: 'support_draft_to_action_flow',
    selectedConnector: 'gmail',
    supportReplyActionType: 'support_reply_send',
    draftToActionAdded: true,
    createsProposedAction: true,
    emailSendAdded: false,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    supportAutoReplyAdded: false,
    rawProviderPayloadReturned: false,
    approvalRequired: true,
  };
}

export function buildSupportDraftActionExample(): SupportDraftActionPreview {
  return buildSupportDraftActionPreview({
    ticketId: 'ticket_123',
    threadId: 'gmail_thread_123',
    customerEmail: 'customer@example.com',
    subject: 'Where is my order?',
    draftReplyBody: 'Hello, thank you for reaching out. I can help with the order status. Please review the tracking details in your account, and I will keep an eye on the shipment as well.',
    category: 'shipping',
    confidenceScore: 0.86,
    sensitiveFlag: false,
    escalationRequired: false,
    sourceDraftId: 'draft_support_123',
    approvalNotes: 'Founder should confirm tracking details before sending.',
  });
}
