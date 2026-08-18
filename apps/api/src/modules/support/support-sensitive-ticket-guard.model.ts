import type {
  SupportSensitiveTicketGuardChecks,
  SupportSensitiveTicketGuardDecision,
  SupportSensitiveTicketGuardInput,
  SupportSensitiveTicketGuardResult,
  SupportSensitiveTicketGuardStatus,
  SupportSensitiveTicketPayloadExtraction,
  SupportSensitiveTicketTrigger,
} from './support-sensitive-ticket-guard.types.js';

export const SUPPORT_SENSITIVE_TICKET_GUARD_PHASE = 'phase_13_7_sensitive_ticket_guard' as const;
export const SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE = 'v2-phase-13-7-sensitive-ticket-guard' as const;
export const SUPPORT_SENSITIVE_TICKET_GUARD_PACKAGE = 'lifesaver-v0.7.0-phase-13-7-sensitive-ticket-guard.zip' as const;
export const SUPPORT_SENSITIVE_TICKET_GUARD_ACTION_TYPE = 'support_reply_send' as const;
export const SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER = 'gmail' as const;
export const SUPPORT_SENSITIVE_TICKET_LOW_CONFIDENCE_THRESHOLD = 0.7 as const;

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

export const SUPPORT_SENSITIVE_TICKET_ALWAYS_APPROVAL_TRIGGERS: SupportSensitiveTicketTrigger[] = [
  'refund',
  'cancellation',
  'complaint',
  'payment_issue',
  'legal_issue',
  'unknown_intent',
  'low_confidence',
  'sensitive_flag',
  'escalation_required',
  'sensitive_category',
  'escalation_category',
];

type JsonObject = Record<string, unknown>;

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function safeText(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function lower(value: unknown): string {
  return safeText(value)?.toLowerCase() || '';
}

function bool(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return ['true', 'yes', '1', 'y'].includes(value.trim().toLowerCase());
  return false;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%,$\s,]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function hasDate(value: unknown): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function categoryMatches(category: string, values: string[]): boolean {
  const normalized = category.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return values.includes(normalized);
}

function collectText(input: SupportSensitiveTicketGuardInput): string {
  return [input.category, input.subject, input.bodySnippet, input.replyBody, input.approvalNotes, input.riskLevel]
    .map((value) => safeText(value, 8000))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function confidence(input: SupportSensitiveTicketGuardInput): number | null {
  const value = finiteNumber(input.confidenceScore);
  if (value === null) return null;
  if (value > 1 && value <= 100) return value / 100;
  return value;
}

function threshold(input: SupportSensitiveTicketGuardInput): number {
  const value = finiteNumber(input.lowConfidenceThreshold);
  if (value === null || value <= 0 || value > 1) return SUPPORT_SENSITIVE_TICKET_LOW_CONFIDENCE_THRESHOLD;
  return value;
}

function buildTriggers(checks: SupportSensitiveTicketGuardChecks): SupportSensitiveTicketTrigger[] {
  const triggers: SupportSensitiveTicketTrigger[] = [];
  if (checks.refundDetected) triggers.push('refund');
  if (checks.cancellationDetected) triggers.push('cancellation');
  if (checks.complaintDetected) triggers.push('complaint');
  if (checks.paymentIssueDetected) triggers.push('payment_issue');
  if (checks.legalIssueDetected) triggers.push('legal_issue');
  if (checks.unknownIntentDetected) triggers.push('unknown_intent');
  if (checks.lowConfidenceDetected) triggers.push('low_confidence');
  if (checks.sensitiveFlagDetected) triggers.push('sensitive_flag');
  if (checks.escalationRequiredDetected) triggers.push('escalation_required');
  if (checks.sensitiveCategoryDetected) triggers.push('sensitive_category');
  if (checks.escalationCategoryDetected) triggers.push('escalation_category');
  return triggers;
}

function buildChecks(input: SupportSensitiveTicketGuardInput): SupportSensitiveTicketGuardChecks {
  const category = lower(input.category);
  const text = collectText(input);
  const score = confidence(input);
  const minConfidence = threshold(input);

  const refundDetected = categoryMatches(category, ['refund', 'refund_request']) || includesAny(text, [/\brefund\b/, /\breturn my money\b/, /\bmoney back\b/, /\breimburse(?:ment)?\b/]);
  const cancellationDetected = categoryMatches(category, ['cancellation', 'cancel']) || includesAny(text, [/\bcancel(?:lation)?\b/, /\bstop my order\b/, /\bcancel my order\b/]);
  const complaintDetected = categoryMatches(category, ['complaint']) || includesAny(text, [/\bcomplaint\b/, /\bangry\b/, /\bfurious\b/, /\bupset\b/, /\bterrible\b/, /\bworst\b/, /\bscam\b/]);
  const paymentIssueDetected = categoryMatches(category, ['payment_issue', 'payment', 'chargeback']) || includesAny(text, [/\bpayment issue\b/, /\bchargeback\b/, /\bcharge back\b/, /\bdispute(?:d)? charge\b/, /\bunauthori[sz]ed charge\b/, /\bcard charged\b/]);
  const legalIssueDetected = categoryMatches(category, ['legal_issue', 'legal']) || includesAny(text, [/\blegal\b/, /\blawyer\b/, /\battorney\b/, /\blawsuit\b/, /\bsue you\b/, /\bcourt\b/, /\blegal notice\b/, /\bcease and desist\b/]);
  const unknownIntentDetected = categoryMatches(category, ['unknown', 'unknown_intent', 'unclear', 'other']) || includesAny(text, [/\bunknown intent\b/, /\bunclear intent\b/, /\bnot sure\b/, /\bunsure\b/, /\bunknown\b/, /\bneed to check\b/]);
  const lowConfidenceDetected = score !== null && score > 0 && score < minConfidence;
  const sensitiveFlagDetected = bool(input.sensitiveFlag);
  const escalationRequiredDetected = bool(input.escalationRequired);
  const sensitiveCategoryDetected = categoryMatches(category, ['sensitive']);
  const escalationCategoryDetected = categoryMatches(category, ['escalation']);
  const sensitiveTicketDetected = refundDetected
    || cancellationDetected
    || complaintDetected
    || paymentIssueDetected
    || legalIssueDetected
    || unknownIntentDetected
    || lowConfidenceDetected
    || sensitiveFlagDetected
    || escalationRequiredDetected
    || sensitiveCategoryDetected
    || escalationCategoryDetected;

  return {
    actionTypeIsSupportReplySend: lower(input.actionType) === SUPPORT_SENSITIVE_TICKET_GUARD_ACTION_TYPE,
    providerIsGmail: lower(input.provider || SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER) === SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
    refundDetected,
    cancellationDetected,
    complaintDetected,
    paymentIssueDetected,
    legalIssueDetected,
    unknownIntentDetected,
    lowConfidenceDetected,
    sensitiveFlagDetected,
    escalationRequiredDetected,
    sensitiveCategoryDetected,
    escalationCategoryDetected,
    sensitiveTicketDetected,
    manualApprovalConfirmed: bool(input.manualApprovalConfirmed),
    approvalActorPresent: Boolean(safeText(input.approvalEventActorUserId)),
    approvalEventPresent: Boolean(safeText(input.approvalEventId)),
    approvedAtPresent: hasDate(input.approvedAt),
    autoSendRequested: bool(input.autoSendRequested),
    forceBypassRequested: bool(input.forceRequested),
  };
}

function decide(checks: SupportSensitiveTicketGuardChecks): {
  allowedToContinue: boolean;
  decision: SupportSensitiveTicketGuardDecision;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.actionTypeIsSupportReplySend) blockers.push('Only support_reply_send actions can use the support sensitive ticket guard.');
  if (!checks.providerIsGmail) blockers.push('Phase 13.7 sensitive ticket guard supports the Gmail support connector only.');
  if (checks.forceBypassRequested) warnings.push('Force requests do not bypass sensitive-ticket approval requirements.');

  if (checks.sensitiveTicketDetected) {
    warnings.push('Sensitive-ticket triggers require founder/admin manual approval before any support reply may be sent.');
  }

  if (checks.sensitiveTicketDetected && checks.autoSendRequested) {
    blockers.push('Sensitive tickets cannot use auto-send. Manual approval is required for refund, cancellation, complaint, payment, legal, unknown intent, low-confidence, sensitive, and escalation cases.');
    return { allowedToContinue: false, decision: 'blocked_auto_send_for_sensitive_ticket', blockers, warnings };
  }

  if (checks.lowConfidenceDetected && !checks.manualApprovalConfirmed) {
    blockers.push('Low-confidence support replies require founder/admin manual approval before send.');
    return { allowedToContinue: false, decision: 'blocked_low_confidence_requires_manual_approval', blockers, warnings };
  }

  if (checks.sensitiveTicketDetected && !checks.manualApprovalConfirmed) {
    blockers.push('Sensitive support ticket requires founder/admin manual approval before send.');
    return { allowedToContinue: false, decision: 'blocked_sensitive_ticket_requires_manual_approval', blockers, warnings };
  }

  if (!checks.actionTypeIsSupportReplySend) return { allowedToContinue: false, decision: 'blocked_unsupported_action_type', blockers, warnings };
  if (!checks.providerIsGmail) return { allowedToContinue: false, decision: 'blocked_unsupported_provider', blockers, warnings };

  if (checks.sensitiveTicketDetected) {
    if (!checks.approvalActorPresent || !checks.approvalEventPresent || !checks.approvedAtPresent) {
      blockers.push('Sensitive ticket manual approval must include actor, approval event, and approved_at timestamp before execution can continue.');
      return { allowedToContinue: false, decision: 'blocked_sensitive_ticket_requires_manual_approval', blockers, warnings };
    }
    warnings.push('Sensitive ticket is allowed to continue only because manual approval is confirmed. Later pause, thread, bulk, credential, and executor gates still apply.');
    return { allowedToContinue: true, decision: 'sensitive_ticket_manual_approval_confirmed', blockers, warnings };
  }

  warnings.push('No sensitive-ticket trigger matched. Later manual approval, pause, thread, bulk, credential, and executor gates still apply.');
  return { allowedToContinue: true, decision: 'non_sensitive_ticket_allowed_to_continue', blockers, warnings };
}

export function extractSupportSensitiveTicketGuardInputFromPayload(payload: unknown): SupportSensitiveTicketPayloadExtraction {
  const root = safeObject(payload);
  const data = safeObject(root.data);
  return {
    actionType: safeText(root.action_type || root.actionType || data.action_type || data.actionType),
    provider: safeText(data.support_provider || root.provider || root.support_provider || SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER) || SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
    category: safeText(data.category || root.category),
    confidenceScore: finiteNumber(data.confidence_score ?? data.confidenceScore ?? root.confidence_score ?? root.confidenceScore),
    sensitiveFlag: bool(data.sensitive_flag ?? data.sensitiveFlag ?? root.sensitive_flag ?? root.sensitiveFlag),
    escalationRequired: bool(data.escalation_required ?? data.escalationRequired ?? root.escalation_required ?? root.escalationRequired),
    riskLevel: safeText(data.risk_level || data.riskLevel || root.risk_level || root.riskLevel),
    subject: safeText(data.subject || root.subject),
    bodySnippet: safeText(data.body_snippet || data.bodySnippet || root.body_snippet || root.bodySnippet),
    replyBody: safeText(data.reply_body || data.replyBody || root.reply_body || root.replyBody, 8000),
    approvalNotes: safeText(data.approval_notes || data.approvalNotes || root.approval_notes || root.approvalNotes, 1200),
    autoSendRequested: bool(data.auto_reply_enabled ?? data.autoReplyEnabled ?? data.auto_send_requested ?? data.autoSendRequested ?? root.auto_reply_enabled ?? root.autoSendRequested),
  };
}

export function evaluateSupportSensitiveTicketGuard(input: SupportSensitiveTicketGuardInput = {}): SupportSensitiveTicketGuardResult {
  const checks = buildChecks(input);
  const decision = decide(checks);
  const triggers = buildTriggers(checks);
  const score = confidence(input);
  const minConfidence = threshold(input);

  const result: SupportSensitiveTicketGuardResult = {
    version: '0.7.0',
    phase: SUPPORT_SENSITIVE_TICKET_GUARD_PHASE,
    healthMode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
    deliverable: 'sensitive_ticket_protection',
    selectedConnector: SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
    actionType: safeText(input.actionType),
    provider: safeText(input.provider || SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER) || SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
    category: safeText(input.category),
    confidenceScore: score,
    lowConfidenceThreshold: minConfidence,
    sensitiveTicketDetected: checks.sensitiveTicketDetected,
    manualApprovalRequired: checks.sensitiveTicketDetected,
    allowedToContinue: decision.allowedToContinue,
    decision: decision.decision,
    triggers,
    checks,
    blockers: decision.blockers,
    warnings: decision.warnings,
    safeSummary: decision.allowedToContinue
      ? 'Sensitive ticket guard passed for the current manual-approval-first executor lane. No email is sent by this guard.'
      : 'Sensitive ticket guard blocked this support send path until required founder/admin manual approval is present and auto-send is off.',
    safety: {
      guardOnly: true,
      emailSent: false,
      gmailApiCalled: false,
      autoSendAllowed: false,
      forceBypassAllowed: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
      note: 'Phase 13.7 adds sensitive ticket protection. Refund, cancellation, complaint, payment issue, legal issue, unknown intent, low-confidence, sensitive, and escalation tickets require founder/admin manual approval. The guard does not call Gmail, does not send email, and does not allow force bypass or auto-send.',
    },
  };

  assertSupportSensitiveTicketGuardOutputSafe(result);
  return result;
}

export function evaluateSupportSensitiveTicketGuardFromPayload(
  payload: unknown,
  context: Pick<SupportSensitiveTicketGuardInput, 'manualApprovalConfirmed' | 'approvalEventActorUserId' | 'approvalEventId' | 'approvedAt' | 'forceRequested' | 'autoSendRequested'> = {},
): SupportSensitiveTicketGuardResult {
  const extracted = extractSupportSensitiveTicketGuardInputFromPayload(payload);
  return evaluateSupportSensitiveTicketGuard({ ...extracted, ...context });
}

export function previewSupportSensitiveTicketGuard(input: SupportSensitiveTicketGuardInput = {}) {
  const result = evaluateSupportSensitiveTicketGuard(input);
  return {
    ...result,
    previewOnly: true,
    safety: {
      ...result.safety,
      guardOnly: true,
      emailSent: false,
      gmailApiCalled: false,
    },
  };
}

export function buildSupportSensitiveTicketGuardStatus(): SupportSensitiveTicketGuardStatus {
  return {
    phase: 'V2 Phase 13.7 — Sensitive Ticket Guard',
    healthMode: SUPPORT_SENSITIVE_TICKET_GUARD_HEALTH_MODE,
    deliverable: 'sensitive_ticket_protection',
    selectedConnector: SUPPORT_SENSITIVE_TICKET_GUARD_PROVIDER,
    actionType: SUPPORT_SENSITIVE_TICKET_GUARD_ACTION_TYPE,
    guardOnly: true,
    alwaysRequireApprovalFor: SUPPORT_SENSITIVE_TICKET_ALWAYS_APPROVAL_TRIGGERS,
    defaultLowConfidenceThreshold: SUPPORT_SENSITIVE_TICKET_LOW_CONFIDENCE_THRESHOLD,
    executorMustCheckSensitiveTicketGuard: true,
    autoSendBlockedForSensitiveTickets: true,
    forceBypassAllowed: false,
    previewCallsGmail: false,
    previewSendsEmail: false,
    rawProviderPayloadReturned: false,
    rawTokenReturned: false,
    rawMimeReturned: false,
    nextStep: 'Phase 13.8 — Send Result Logs',
  };
}

export function buildSupportSensitiveTicketGuardExample() {
  const safeShipping: SupportSensitiveTicketGuardInput = {
    actionType: 'support_reply_send',
    provider: 'gmail',
    category: 'shipping',
    confidenceScore: 0.88,
    sensitiveFlag: false,
    escalationRequired: false,
    subject: 'Where is my order?',
    manualApprovalConfirmed: false,
    autoSendRequested: false,
  };

  const sensitiveRefund: SupportSensitiveTicketGuardInput = {
    actionType: 'support_reply_send',
    provider: 'gmail',
    category: 'refund',
    confidenceScore: 0.91,
    sensitiveFlag: false,
    escalationRequired: false,
    subject: 'I want a refund',
    manualApprovalConfirmed: false,
    autoSendRequested: false,
  };

  return {
    status: buildSupportSensitiveTicketGuardStatus(),
    nonSensitiveTicketAllowedToContinue: evaluateSupportSensitiveTicketGuard(safeShipping),
    sensitiveTicketBlockedUntilManualApproval: evaluateSupportSensitiveTicketGuard(sensitiveRefund),
    sensitiveTicketAllowedAfterManualApproval: evaluateSupportSensitiveTicketGuard({
      ...sensitiveRefund,
      manualApprovalConfirmed: true,
      approvalEventActorUserId: 'founder_user_123',
      approvalEventId: 'action_event_approval_123',
      approvedAt: '2026-07-08T10:00:00.000Z',
    }),
    lowConfidenceBlockedUntilManualApproval: evaluateSupportSensitiveTicketGuard({
      ...safeShipping,
      category: 'faq',
      confidenceScore: 0.41,
    }),
    safety: {
      exampleSendsEmail: false,
      gmailApiCalled: false,
      autoSendAllowed: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function assertSupportSensitiveTicketGuardOutputSafe(output: unknown): void {
  const serialized = JSON.stringify(output).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support sensitive ticket guard output contains forbidden fragment: ${fragment}`);
    }
  }
}
