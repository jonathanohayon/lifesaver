import type {
  SupportRollbackPolicyDecision,
  SupportRollbackPolicyEvaluation,
  SupportRollbackPolicyInput,
  SupportRollbackPolicyResultStatus,
  SupportRollbackPolicyStatus,
  SupportRollbackReason,
} from './support-rollback-policy.types.js';

export const SUPPORT_ROLLBACK_POLICY_PHASE = 'phase_13_9_follow_up_rollback_handling' as const;
export const SUPPORT_ROLLBACK_POLICY_HEALTH_MODE = 'v2-phase-13-9-follow-up-rollback-handling' as const;
export const SUPPORT_ROLLBACK_POLICY_PACKAGE = 'lifesaver-v0.7.0-phase-13-9-follow-up-rollback-handling.zip' as const;
export const SUPPORT_ROLLBACK_POLICY_DELIVERABLE = 'support_rollback_policy' as const;
export const SUPPORT_ROLLBACK_POLICY_PROVIDER = 'gmail' as const;

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
  'bearer ',
];

type JsonObject = Record<string, unknown>;

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function cleanText(value: unknown, max = 700): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function safeId(value: unknown, max = 240): string | null {
  const clean = cleanText(value, max);
  if (!clean) return null;
  if (/access[_-]?token|refresh[_-]?token|bearer\s+/i.test(clean)) return null;
  return clean;
}

function safeIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
  }
  return null;
}

function maskEmail(value: unknown): string | null {
  const clean = cleanText(value, 320);
  if (!clean || !clean.includes('@')) return null;
  const [name, domain] = clean.split('@');
  const safeName = name.length <= 2 ? `${name.slice(0, 1) || '*'}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

function normalizeResultStatus(value: unknown): SupportRollbackPolicyResultStatus {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'success' || clean === 'executed' || clean === 'sent') return 'success';
  if (clean === 'failed' || clean === 'error') return 'failed';
  if (clean === 'blocked' || clean === 'skipped') return 'blocked';
  return 'unknown';
}

function normalizeReason(value: unknown): SupportRollbackReason {
  const clean = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const known: SupportRollbackReason[] = [
    'wrong_information',
    'wrong_customer',
    'tone_issue',
    'missing_context',
    'sent_by_mistake',
    'escalation_after_send',
    'api_failed',
    'customer_unhappy',
    'legal_sensitive',
    'refund_or_payment',
    'generic_correction',
    'unknown',
  ];
  return known.includes(clean as SupportRollbackReason) ? clean as SupportRollbackReason : 'unknown';
}

function normalizeCategory(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isSensitiveCategory(category: string): boolean {
  return ['refund', 'cancellation', 'complaint', 'payment_issue', 'chargeback', 'legal', 'legal_issue', 'sensitive', 'escalation', 'unknown'].includes(category);
}

function extractNestedResult(input: SupportRollbackPolicyInput): JsonObject {
  const log = safeObject(input.supportSendResultLog);
  const actionResult = safeObject(log.actionResult);
  const metadata = safeObject(actionResult.metadataJson || log.metadataJson);
  return {
    resultStatus: input.resultStatus || log.resultStatus || actionResult.resultStatus,
    externalMessageId: input.externalMessageId || log.externalMessageId || actionResult.externalId || metadata.external_message_id,
    externalThreadId: input.externalThreadId || log.externalThreadId || metadata.external_thread_id,
    sentAt: input.sentAt || log.sentAt || metadata.sent_at,
    failureReason: input.failureReason || log.failureReason || actionResult.errorMessage || metadata.failure_reason,
    ticketId: input.ticketId || log.ticketId || metadata.ticket_id,
  };
}

function buildFollowUpPreview(params: {
  decision: SupportRollbackPolicyDecision;
  correctionText: string | null;
  issueReason: SupportRollbackReason;
}): string | null {
  if (params.decision === 'draft_apology_follow_up') {
    const correction = params.correctionText || 'I am reviewing the correct details and will follow up with the accurate information shortly';
    return `Hello — I’m sorry for the confusion in my previous message. ${correction}. Please disregard the earlier wording where it was unclear or inaccurate.`;
  }
  if (params.decision === 'draft_correction_follow_up') {
    const correction = params.correctionText || 'I need to correct one detail from my previous message';
    return `Hello — I wanted to follow up with a correction: ${correction}. Thank you for your patience while we make sure this is handled correctly.`;
  }
  if (params.decision === 'retry_or_human_review') {
    return null;
  }
  return null;
}

function chooseDecision(params: {
  resultStatus: SupportRollbackPolicyResultStatus;
  issueReason: SupportRollbackReason;
  category: string;
  confidenceScore: number | null;
  correctionText: string | null;
}): { decision: SupportRollbackPolicyDecision; reason: string } {
  if (params.resultStatus === 'failed') {
    return {
      decision: 'retry_or_human_review',
      reason: 'The support send was not confirmed as sent, so there is no customer-visible email to undo. Queue human review before retrying as a new manual action.',
    };
  }
  if (params.resultStatus === 'blocked') {
    return {
      decision: 'mark_for_human_review',
      reason: 'The support send was blocked. No rollback email should be sent; mark the ticket for human review.',
    };
  }

  const sensitiveReason = ['wrong_customer', 'sent_by_mistake', 'escalation_after_send', 'customer_unhappy', 'legal_sensitive', 'refund_or_payment'].includes(params.issueReason);
  const lowConfidence = params.confidenceScore !== null && params.confidenceScore < 0.75;

  if (params.resultStatus === 'success' && (sensitiveReason || isSensitiveCategory(params.category) || lowConfidence)) {
    return {
      decision: 'draft_apology_follow_up',
      reason: 'A customer-visible support reply was sent and the issue is sensitive or low-confidence. Draft an apology/follow-up and mark for human review; do not attempt to unsend.',
    };
  }

  if (params.resultStatus === 'success' && (params.correctionText || ['wrong_information', 'tone_issue', 'missing_context', 'generic_correction'].includes(params.issueReason))) {
    return {
      decision: 'draft_correction_follow_up',
      reason: 'A customer-visible support reply was sent and needs correction. Draft a correction/follow-up for manual approval; do not attempt to unsend.',
    };
  }

  if (params.resultStatus === 'success') {
    return {
      decision: 'mark_for_human_review',
      reason: 'A support reply was sent, but no specific correction was provided. Mark for human review before any follow-up.',
    };
  }

  return {
    decision: 'mark_for_human_review',
    reason: 'The support send state is unclear. Mark for human review and do not attempt rollback or follow-up sending automatically.',
  };
}

export function evaluateSupportRollbackPolicy(input: SupportRollbackPolicyInput = {}): SupportRollbackPolicyEvaluation {
  const nested = extractNestedResult(input);
  const provider = SUPPORT_ROLLBACK_POLICY_PROVIDER;
  const resultStatus = normalizeResultStatus(nested.resultStatus);
  const externalMessageId = safeId(nested.externalMessageId);
  const externalThreadId = safeId(nested.externalThreadId);
  const sentAt = safeIso(nested.sentAt);
  const ticketId = safeId(nested.ticketId || input.ticketId);
  const category = normalizeCategory(input.ticketCategory || safeObject(input.supportSendResultLog).ticketCategory || 'unknown');
  const confidenceScore = safeNumber(input.confidenceScore);
  const issueReason = normalizeReason(input.issueReason);
  const correctionText = cleanText(input.correctionText, 500);
  const customerEmailHint = maskEmail(input.customerEmail);
  const { decision, reason } = chooseDecision({ resultStatus, issueReason, category, confidenceScore, correctionText });

  const followUpBodyPreview = buildFollowUpPreview({ decision, correctionText, issueReason });
  const draftCorrection = decision === 'draft_correction_follow_up';
  const draftApologyFollowUp = decision === 'draft_apology_follow_up';
  const retryAsNewManualAction = decision === 'retry_or_human_review';
  const markForHumanReview = decision !== 'no_customer_follow_up_needed';

  const humanReviewReason = cleanText(input.failureReason || nested.failureReason, 360)
    || reason
    || 'Support rollback handling requires human review because email cannot be truly undone.';

  const evaluation: SupportRollbackPolicyEvaluation = {
    version: '0.7.0',
    phase: SUPPORT_ROLLBACK_POLICY_PHASE,
    healthMode: SUPPORT_ROLLBACK_POLICY_HEALTH_MODE,
    deliverable: SUPPORT_ROLLBACK_POLICY_DELIVERABLE,
    provider,
    actionType: 'support_reply_send',
    decision,
    reason,
    canUndoEmail: false,
    allowedRollbackMeanings: ['draft_correction', 'draft_apology_follow_up', 'mark_for_human_review'],
    checks: {
      providerIsGmail: provider === SUPPORT_ROLLBACK_POLICY_PROVIDER,
      emailUndoSupported: false,
      externalMessageIdKnown: Boolean(externalMessageId),
      threadIdKnown: Boolean(externalThreadId),
      sentTimestampKnown: Boolean(sentAt),
      resultStatusKnown: resultStatus !== 'unknown',
      customerVisibleSendConfirmed: resultStatus === 'success',
      correctionDraftRecommended: draftCorrection,
      apologyFollowUpRecommended: draftApologyFollowUp,
      humanReviewRequired: markForHumanReview,
      rawTokenReturned: false,
      rawMimeReturned: false,
      rawProviderPayloadReturned: false,
      rawTicketPayloadReturned: false,
    },
    recoveryPlan: {
      trueRollbackAvailable: false,
      undoOrUnsendAttempted: false,
      draftCorrection,
      draftApologyFollowUp,
      markForHumanReview,
      retryAsNewManualAction,
      createActionNow: false,
      sendNow: false,
      requiresManualApprovalBeforeAnyFollowUpSend: true,
      followUpBodyPreview,
      humanReviewReason,
    },
    futureActionPreview: followUpBodyPreview || retryAsNewManualAction ? {
      actionType: 'support_reply_send',
      provider,
      threadId: externalThreadId,
      ticketId,
      customerEmailHint,
      replyBodyPreview: followUpBodyPreview,
      approvalRequired: true,
      autoSendAllowed: false,
      createdNow: false,
      sentNow: false,
    } : null,
    safety: {
      policyOnly: true,
      noGmailApiCall: true,
      noEmailSent: true,
      noUnsendAttempted: true,
      noMessageDeleteAttempted: true,
      autoSendEnabled: false,
      bulkSendEnabled: false,
      manualApprovalRequiredForFollowUp: true,
      rawTokenReturned: false,
      rawMimeReturned: false,
      providerPayloadReturned: false,
      rawTicketPayloadReturned: false,
      note: 'Phase 13.9 does not undo Gmail messages. It defines safe support rollback handling as correction/follow-up drafting and human review only. Any future follow-up send must become a new manually approved support_reply_send action.',
    },
  };

  assertSupportRollbackPolicyOutputSafe(evaluation);
  return evaluation;
}

export function buildSupportRollbackPolicyStatus(): SupportRollbackPolicyStatus {
  return {
    phase: 'V2 Phase 13.9 — Follow-Up/Rollback Handling',
    healthMode: SUPPORT_ROLLBACK_POLICY_HEALTH_MODE,
    deliverable: SUPPORT_ROLLBACK_POLICY_DELIVERABLE,
    provider: SUPPORT_ROLLBACK_POLICY_PROVIDER,
    actionType: 'support_reply_send',
    emailUndoSupported: false,
    rollbackMeansDraftCorrection: true,
    rollbackMeansDraftApologyFollowUp: true,
    rollbackMeansMarkForHumanReview: true,
    previewCallsGmail: false,
    previewSendsEmail: false,
    previewDeletesEmail: false,
    createsActionAutomatically: false,
    manualApprovalRequiredForFollowUp: true,
    autoSendEnabled: false,
    bulkSendEnabled: false,
    noDatabaseMigrationRequired: true,
    rawTokenReturnedToBrowser: false,
    rawMimeReturnedToBrowser: false,
    providerPayloadReturnedToBrowser: false,
    rawTicketPayloadReturnedToBrowser: false,
    nextStep: 'Phase 13.10 — Support Send QA',
  };
}

export function buildSupportRollbackPolicyExample() {
  const correctionExample = evaluateSupportRollbackPolicy({
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_123',
    externalThreadId: 'gmail_thread_123',
    sentAt: '2026-07-08T12:45:00.000Z',
    ticketId: 'ticket_123',
    ticketCategory: 'faq',
    confidenceScore: 0.92,
    issueReason: 'wrong_information',
    correctionText: 'Your order is still being reviewed; the previous delivery estimate was too early',
    customerEmail: 'customer@example.com',
  });

  const apologyExample = evaluateSupportRollbackPolicy({
    resultStatus: 'success',
    externalMessageId: 'gmail_msg_124',
    externalThreadId: 'gmail_thread_124',
    sentAt: '2026-07-08T13:00:00.000Z',
    ticketId: 'ticket_124',
    ticketCategory: 'refund',
    confidenceScore: 0.64,
    issueReason: 'refund_or_payment',
    customerEmail: 'customer2@example.com',
  });

  const failedExample = evaluateSupportRollbackPolicy({
    resultStatus: 'failed',
    externalThreadId: 'gmail_thread_125',
    ticketId: 'ticket_125',
    issueReason: 'api_failed',
    failureReason: 'Gmail API returned 403; no send success was confirmed.',
  });

  return {
    status: buildSupportRollbackPolicyStatus(),
    correctionExample,
    apologyExample,
    failedExample,
    safety: {
      exampleCallsGmail: false,
      exampleSendsEmail: false,
      exampleDeletesEmail: false,
      trueUndoSupported: false,
      providerPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function previewSupportRollbackPolicy(input: unknown) {
  return {
    previewOnly: true,
    evaluation: evaluateSupportRollbackPolicy(safeObject(input) as SupportRollbackPolicyInput),
    safety: {
      previewCallsGmail: false,
      previewSendsEmail: false,
      previewDeletesEmail: false,
      createsActionAutomatically: false,
      manualApprovalRequiredForFollowUp: true,
      providerPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function assertSupportRollbackPolicyOutputSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support rollback policy output contains forbidden fragment: ${fragment}`);
    }
  }
}
