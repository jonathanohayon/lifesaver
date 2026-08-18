import { z } from 'zod';
import type { ActionRiskLevel } from '../actions/actions.types.js';
import { classifySupportTicket } from './support-ticket-classifier.model.js';
import { evaluateSupportEscalationRules } from './support-escalation-rules.model.js';
import { redactSupportTextForLogs } from './support-privacy-safeguards.model.js';
import type {
  SupportActionUiActionStatus,
  SupportActionUiExample,
  SupportActionUiInput,
  SupportActionUiPreview,
  SupportActionUiStatus,
} from './support-action-ui.types.js';
import type { SupportClassifierCategory } from './support-ticket-classifier.types.js';

export const SUPPORT_ACTION_UI_PHASE = 'phase_12_9_ticket_to_action_ui' as const;
export const SUPPORT_ACTION_UI_HEALTH_MODE = 'v2-phase-12-9-ticket-to-action-ui' as const;
export const SUPPORT_ACTION_UI_PACKAGE = 'lifesaver-v0.7.0-phase-12-9-ticket-to-action-ui.zip' as const;

const categoryValues = ['faq', 'shipping', 'complaint', 'refund', 'cancellation', 'payment_issue', 'sensitive', 'escalation'] as const;
const actionStatusValues = ['proposed', 'approved', 'rejected', 'cancelled', 'executed', 'failed', 'unknown'] as const;
const riskValues = ['low', 'medium', 'high', 'critical'] as const;

const supportActionUiInputSchema = z.object({
  ticketId: z.string().trim().min(1).max(180),
  threadId: z.string().trim().max(240).optional().nullable(),
  actionId: z.string().trim().max(180).optional().nullable(),
  actionStatus: z.enum(actionStatusValues).optional().nullable(),
  customerEmail: z.string().trim().max(320).optional().nullable(),
  subject: z.string().trim().max(500).optional().nullable(),
  bodySnippet: z.string().trim().max(5000).optional().nullable(),
  suggestedReply: z.string().trim().max(8000).optional().nullable(),
  category: z.enum(categoryValues).optional().nullable(),
  confidenceScore: z.number().min(0).max(1).optional().nullable(),
  sensitiveFlag: z.boolean().optional().nullable(),
  escalationRequired: z.boolean().optional().nullable(),
  riskLevel: z.enum(riskValues).optional().nullable(),
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
  'raw_ticket_payload',
  'oauth',
  'smtp_password',
  'sendgrid_api_key',
  'gmail.send',
  'gmail.modify',
];

function compact(value: string | null | undefined, max = 800): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function maskEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.includes('@')) return null;
  const [name, domain] = value.split('@');
  if (!domain) return null;
  const safeName = name.length <= 2 ? `${name.slice(0, 1) || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function redactPreview(value: string | null | undefined, max = 900): string | null {
  const clean = compact(value, max);
  if (!clean) return null;
  return redactSupportTextForLogs(clean, max).value;
}

function riskForUi(params: {
  explicitRisk?: ActionRiskLevel | null;
  category: SupportClassifierCategory;
  sensitiveFlag: boolean;
  escalationRequired: boolean;
  confidenceScore: number;
}): ActionRiskLevel {
  if (params.explicitRisk) return params.explicitRisk;
  if (params.sensitiveFlag || ['sensitive', 'escalation'].includes(params.category)) return 'critical';
  if (['refund', 'cancellation', 'payment_issue', 'complaint'].includes(params.category)) return 'high';
  if (params.escalationRequired) return 'high';
  if (params.confidenceScore < 0.7) return 'medium';
  return 'medium';
}

function buildWarnings(params: {
  actionStatus: SupportActionUiActionStatus;
  actionId: string | null;
  sensitiveFlag: boolean;
  escalationRequired: boolean;
  category: SupportClassifierCategory;
  confidenceScore: number;
  bodyWasRedacted: boolean;
  replyWasRedacted: boolean;
}): string[] {
  const warnings: string[] = [];
  if (!params.actionId) warnings.push('No proposed action ID was supplied; approve/reject buttons stay disabled until a support_reply_send action is selected.');
  if (params.actionStatus !== 'proposed') warnings.push('This action is not proposed, so approve/reject controls are disabled in the support UI.');
  if (params.sensitiveFlag) warnings.push('Sensitive ticket: founder or owner review is required before any reply can be sent.');
  if (params.escalationRequired) warnings.push('Escalation required: do not approve until the escalation reason has been reviewed.');
  if (['refund', 'payment_issue', 'complaint', 'cancellation'].includes(params.category)) warnings.push('Business-impact ticket: confirm policy and order/account details before approval.');
  if (params.confidenceScore < 0.7) warnings.push('Low confidence classification: verify category and suggested reply manually.');
  if (params.bodyWasRedacted || params.replyWasRedacted) warnings.push('Private/sensitive patterns were redacted in the browser-safe preview.');
  return warnings;
}

function buildChecklist(category: SupportClassifierCategory, sensitiveFlag: boolean, escalationRequired: boolean): string[] {
  const checklist = [
    'Read the ticket subject and browser-safe snippet.',
    'Review the suggested reply for tone, accuracy, and customer context.',
    'Confirm the reply does not promise refunds, discounts, medical/legal advice, or shipment outcomes incorrectly.',
    'Approve only if the proposed support_reply_send action is safe; reject with a reason if it is not safe.',
  ];
  if (category === 'shipping') checklist.push('Confirm tracking/order status in the source system before approving.');
  if (['refund', 'payment_issue', 'cancellation'].includes(category)) checklist.push('Confirm store policy and payment/order data before approving.');
  if (sensitiveFlag || escalationRequired) checklist.push('Escalated or sensitive tickets should be reviewed by an owner/admin before approval.');
  return checklist;
}

export function assertSupportActionUiSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_BROWSER_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support action UI output contains forbidden fragment: ${fragment}`);
    }
  }
}

export function buildSupportActionUiPreview(input: unknown): SupportActionUiPreview {
  const parsed = supportActionUiInputSchema.parse(input) as SupportActionUiInput & z.infer<typeof supportActionUiInputSchema>;
  const bodySnippet = compact(parsed.bodySnippet, 2200) || '';
  const classifier = classifySupportTicket({
    ticketId: parsed.ticketId,
    customerEmail: parsed.customerEmail,
    subject: parsed.subject,
    bodySnippet,
    threadId: parsed.threadId,
    sensitiveFlag: parsed.sensitiveFlag === true,
  });
  const escalation = evaluateSupportEscalationRules({
    ticketId: parsed.ticketId,
    customerEmail: parsed.customerEmail,
    subject: parsed.subject,
    bodySnippet,
    category: parsed.category || classifier.category,
    sensitiveFlag: parsed.sensitiveFlag === true || classifier.sensitiveFlag,
    classifierConfidence: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : classifier.confidence,
  });

  const category = (parsed.category || classifier.category) as SupportClassifierCategory;
  const confidenceScore = typeof parsed.confidenceScore === 'number' ? Number(parsed.confidenceScore.toFixed(2)) : classifier.confidence;
  const sensitiveFlag = parsed.sensitiveFlag === true || classifier.sensitiveFlag || category === 'sensitive';
  const escalationRequired = parsed.escalationRequired === true || escalation.escalationRequired === true || classifier.escalationRequired || category === 'escalation' || sensitiveFlag;
  const riskLevel = riskForUi({ explicitRisk: parsed.riskLevel, category, sensitiveFlag, escalationRequired, confidenceScore });
  const actionId = compact(parsed.actionId, 180);
  const actionStatus = (parsed.actionStatus || 'unknown') as SupportActionUiActionStatus;
  const approveEnabled = Boolean(actionId) && actionStatus === 'proposed';
  const rejectEnabled = Boolean(actionId) && actionStatus === 'proposed';
  const subjectPreview = redactPreview(parsed.subject, 220);
  const bodySnippetPreview = redactPreview(parsed.bodySnippet, 900);
  const suggestedReplyPreview = redactPreview(parsed.suggestedReply, 1200);
  const bodyWasRedacted = Boolean(bodySnippetPreview && compact(parsed.bodySnippet, 900) !== bodySnippetPreview);
  const replyWasRedacted = Boolean(suggestedReplyPreview && compact(parsed.suggestedReply, 1200) !== suggestedReplyPreview);

  const preview: SupportActionUiPreview = {
    valid: true,
    phase: 'V2 Phase 12.9 — Ticket-to-Action UI',
    deliverable: 'support_action_ui',
    selectedConnector: 'gmail',
    actionType: 'support_reply_send',
    ticket: {
      ticketId: parsed.ticketId,
      threadId: compact(parsed.threadId, 240),
      customerEmailHint: maskEmail(parsed.customerEmail),
      subjectPreview,
      bodySnippetPreview,
      category,
      confidenceScore,
      sensitiveFlag,
      escalationRequired,
    },
    suggestedReplyPreview,
    riskLevel,
    policyDecision: 'ask',
    approvalRequired: true,
    reviewControls: {
      actionId,
      actionStatus,
      approveEnabled,
      rejectEnabled,
      approveEndpoint: approveEnabled ? `/api/v1/actions/${encodeURIComponent(actionId as string)}/approve` : null,
      rejectEndpoint: rejectEnabled ? `/api/v1/actions/${encodeURIComponent(actionId as string)}/reject` : null,
      approveRequiresConfirmation: true,
      rejectRequiresReason: true,
      opensExistingApprovalQueue: true,
      canSendEmail: false,
      canExecuteSupportSend: false,
    },
    founderReviewChecklist: buildChecklist(category, sensitiveFlag, escalationRequired),
    warnings: buildWarnings({
      actionStatus,
      actionId,
      sensitiveFlag,
      escalationRequired,
      category,
      confidenceScore,
      bodyWasRedacted,
      replyWasRedacted,
    }),
    safety: {
      browserSafeOnly: true,
      usesExistingInternalApprovalEndpoints: true,
      approveRejectCanExecuteAction: false,
      emailSent: false,
      gmailApiCalled: false,
      supportSendExecutorAdded: false,
      supportAutoReplyAdded: false,
      rawProviderPayloadReturned: false,
      rawTicketPayloadReturned: false,
    },
  };

  assertSupportActionUiSafe(preview);
  return preview;
}

export function buildSupportActionUiStatus(): SupportActionUiStatus {
  return {
    phase: 'V2 Phase 12.9 — Ticket-to-Action UI',
    healthMode: SUPPORT_ACTION_UI_HEALTH_MODE,
    deliverable: 'support_action_ui',
    selectedConnector: 'gmail',
    ticketReviewUiAdded: true,
    suggestedReplyReviewAdded: true,
    approveRejectControlsAdded: true,
    usesExistingInternalApprovalEndpoints: true,
    approvalRequiresConfirmation: true,
    rejectionRequiresReason: true,
    supportSendExecutorAdded: false,
    gmailApiClientAdded: false,
    gmailExternalApiCalled: false,
    emailSendAdded: false,
    supportAutoReplyAdded: false,
    rawProviderPayloadReturned: false,
  };
}

export function buildSupportActionUiExample(): SupportActionUiExample {
  return {
    proposedShippingReply: buildSupportActionUiPreview({
      ticketId: 'ticket_ship_123',
      threadId: 'gmail_thread_ship_123',
      actionId: 'action_support_reply_123',
      actionStatus: 'proposed',
      customerEmail: 'customer@example.com',
      subject: 'Where is my order?',
      bodySnippet: 'Hi, my order has not arrived yet. Can you please check the tracking?',
      suggestedReply: 'Hello, thanks for reaching out. I can help check your order status and tracking details. I will review the shipment information and follow up with the latest update.',
      category: 'shipping',
      confidenceScore: 0.88,
      sensitiveFlag: false,
      escalationRequired: false,
      riskLevel: 'medium',
    }),
    sensitiveEscalationReply: buildSupportActionUiPreview({
      ticketId: 'ticket_sensitive_777',
      threadId: 'gmail_thread_sensitive_777',
      actionId: 'action_support_reply_777',
      actionStatus: 'proposed',
      customerEmail: 'private.customer@example.com',
      subject: 'Chargeback and legal complaint',
      bodySnippet: 'I will file a chargeback and contact my lawyer if this is not fixed. My card number is 4111111111111111.',
      suggestedReply: 'Hello, I am sorry for the frustration. I have escalated this to our team for review so we can handle it carefully.',
      category: 'escalation',
      confidenceScore: 0.61,
      sensitiveFlag: true,
      escalationRequired: true,
      riskLevel: 'critical',
    }),
    approvedReadOnlyState: buildSupportActionUiPreview({
      ticketId: 'ticket_done_456',
      threadId: 'gmail_thread_done_456',
      actionId: 'action_support_reply_456',
      actionStatus: 'approved',
      customerEmail: 'buyer@example.com',
      subject: 'FAQ about delivery time',
      bodySnippet: 'How long does delivery usually take?',
      suggestedReply: 'Hello, delivery timing depends on location and carrier. Please check your tracking link for the most accurate estimate.',
      category: 'faq',
      confidenceScore: 0.9,
      sensitiveFlag: false,
      escalationRequired: false,
      riskLevel: 'medium',
    }),
  };
}
