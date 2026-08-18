import type {
  SupportBulkApprovalInput,
  SupportBulkSendGuardChecks,
  SupportBulkSendGuardDecision,
  SupportBulkSendGuardInput,
  SupportBulkSendGuardResult,
  SupportBulkSendGuardStatus,
  SupportBulkSendPayloadExtraction,
} from './support-bulk-send-guard.types.js';

export const SUPPORT_BULK_SEND_GUARD_PHASE = 'phase_13_6_no_bulk_sends' as const;
export const SUPPORT_BULK_SEND_GUARD_HEALTH_MODE = 'v2-phase-13-6-no-bulk-sends' as const;
export const SUPPORT_BULK_SEND_GUARD_PACKAGE = 'lifesaver-v0.7.0-phase-13-6-no-bulk-sends.zip' as const;
export const SUPPORT_BULK_SEND_GUARD_ACTION_TYPE = 'support_reply_send' as const;
export const SUPPORT_BULK_SEND_GUARD_PROVIDER = 'gmail' as const;

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

const BULK_SIGNAL_KEYS = [
  'recipients',
  'recipient_emails',
  'recipientemails',
  'customer_emails',
  'customeremails',
  'thread_ids',
  'threadids',
  'ticket_ids',
  'ticketids',
  'message_ids',
  'messageids',
  'bulk_mode',
  'bulkmode',
  'bulk_send',
  'bulksend',
  'send_all',
  'sendall',
  'audience_segment',
  'audiencesegment',
  'audience_segment_id',
  'audiencesegmentid',
  'mailing_list',
  'mailinglist',
  'mailing_list_id',
  'mailinglistid',
  'template_send',
  'templatesend',
  'batch_send',
  'batchsend',
  'cc',
  'bcc',
  'attachments',
  'attachment',
];

type JsonObject = Record<string, unknown>;

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function safeText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function lower(value: unknown): string {
  return safeText(value)?.toLowerCase() || '';
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%,$\s,]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function present(value: unknown): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function countEmailString(value: string): number {
  const parts = value.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  return Math.max(parts.length, value.trim() ? 1 : 0);
}

function countArray(value: unknown): number | null {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && String(item).trim() !== '').length : null;
}

function maxKnownCount(...values: Array<number | null | undefined>): number {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return known.length > 0 ? Math.max(...known) : 1;
}

function getNestedValue(object: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) return object[key];
  }
  return undefined;
}

function readCountFromPayload(root: JsonObject, data: JsonObject, countKeys: string[], arrayKeys: string[], singleKey?: string): number {
  const countValue = getNestedValue(data, countKeys) ?? getNestedValue(root, countKeys);
  const directCount = finiteNumber(countValue);
  const dataArrayCounts = arrayKeys.map((key) => countArray(data[key]));
  const rootArrayCounts = arrayKeys.map((key) => countArray(root[key]));
  const singleValue = singleKey ? data[singleKey] ?? root[singleKey] : undefined;
  const singleCount = typeof singleValue === 'string' ? countEmailString(singleValue) : (present(singleValue) ? 1 : null);
  return maxKnownCount(directCount, ...dataArrayCounts, ...rootArrayCounts, singleCount);
}

function readBooleanSignal(root: JsonObject, data: JsonObject, keys: string[]): boolean {
  for (const key of keys) {
    const value = data[key] ?? root[key];
    if (value === true) return true;
    if (typeof value === 'string' && ['true', 'yes', '1', 'bulk', 'all'].includes(value.toLowerCase().trim())) return true;
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
}

function hasAnyBulkSignalKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasAnyBulkSignalKey(item));
  const object = value as JsonObject;
  for (const key of Object.keys(object)) {
    const normalized = normalizeKey(key);
    if (BULK_SIGNAL_KEYS.some((candidate) => normalizeKey(candidate) === normalized)) return true;
    if (hasAnyBulkSignalKey(object[key])) return true;
  }
  return false;
}

export function extractSupportBulkSendGuardInputFromPayload(payload: unknown): SupportBulkSendPayloadExtraction {
  const root = safeObject(payload);
  const data = safeObject(root.data);
  const provider = safeText(data.support_provider || root.provider || root.support_provider || 'gmail') || 'gmail';
  const actionType = safeText(root.action_type || root.actionType || data.action_type || data.actionType);

  const recipientCount = readCountFromPayload(
    root,
    data,
    ['recipient_count', 'recipientCount', 'to_count', 'toCount'],
    ['recipients', 'recipient_emails', 'recipientEmails', 'customer_emails', 'customerEmails', 'to'],
    'customer_email',
  );
  const threadCount = readCountFromPayload(root, data, ['thread_count', 'threadCount'], ['thread_ids', 'threadIds'], 'thread_id');
  const ticketCount = readCountFromPayload(root, data, ['ticket_count', 'ticketCount'], ['ticket_ids', 'ticketIds'], 'ticket_id');
  const messageCount = readCountFromPayload(root, data, ['message_count', 'messageCount'], ['message_ids', 'messageIds'], undefined);

  const hasCc = readBooleanSignal(root, data, ['cc', 'cc_emails', 'ccEmails']);
  const hasBcc = readBooleanSignal(root, data, ['bcc', 'bcc_emails', 'bccEmails']);
  const hasAttachments = readBooleanSignal(root, data, ['attachment', 'attachments', 'attachment_ids', 'attachmentIds']);
  const bulkModeRequested = readBooleanSignal(root, data, ['bulk', 'bulk_mode', 'bulkMode', 'bulk_send', 'bulkSend', 'batch_send', 'batchSend']) || hasAnyBulkSignalKey(payload) && (recipientCount > 1 || threadCount > 1 || ticketCount > 1);
  const sendAllRequested = readBooleanSignal(root, data, ['send_all', 'sendAll', 'send_to_all', 'sendToAll']);
  const audienceSegmentPresent = readBooleanSignal(root, data, ['audience_segment', 'audienceSegment', 'audience_segment_id', 'audienceSegmentId', 'mailing_list', 'mailingList', 'mailing_list_id', 'mailingListId']);
  const templateSendRequested = readBooleanSignal(root, data, ['template_send', 'templateSend', 'template_id', 'templateId', 'template_ids', 'templateIds']);

  return {
    actionType,
    provider,
    recipientCount,
    threadCount,
    ticketCount,
    messageCount,
    hasCc,
    hasBcc,
    hasAttachments,
    bulkModeRequested,
    sendAllRequested,
    audienceSegmentPresent,
    templateSendRequested,
  };
}

function normalizeInput(input: SupportBulkSendGuardInput): Required<Omit<SupportBulkSendGuardInput, 'explicitBulkApproval'>> & { explicitBulkApproval: SupportBulkApprovalInput | null } {
  return {
    actionType: safeText(input.actionType),
    provider: safeText(input.provider || SUPPORT_BULK_SEND_GUARD_PROVIDER) || SUPPORT_BULK_SEND_GUARD_PROVIDER,
    recipientCount: finiteNumber(input.recipientCount) ?? 1,
    threadCount: finiteNumber(input.threadCount) ?? 1,
    ticketCount: finiteNumber(input.ticketCount) ?? 1,
    messageCount: finiteNumber(input.messageCount) ?? 1,
    hasCc: input.hasCc === true,
    hasBcc: input.hasBcc === true,
    hasAttachments: input.hasAttachments === true,
    bulkModeRequested: input.bulkModeRequested === true,
    sendAllRequested: input.sendAllRequested === true,
    audienceSegmentPresent: input.audienceSegmentPresent === true,
    templateSendRequested: input.templateSendRequested === true,
    explicitBulkApproval: input.explicitBulkApproval || null,
  };
}

function buildChecks(input: SupportBulkSendGuardInput): SupportBulkSendGuardChecks {
  const normalized = normalizeInput(input);
  const approval = normalized.explicitBulkApproval;
  const approvalLimit = finiteNumber(approval?.maxRecipientCount);
  const recipientCount = finiteNumber(normalized.recipientCount) ?? 1;
  const threadCount = finiteNumber(normalized.threadCount) ?? 1;
  const ticketCount = finiteNumber(normalized.ticketCount) ?? 1;
  const messageCount = finiteNumber(normalized.messageCount) ?? 1;

  const singleRecipientOnly = recipientCount === 1;
  const singleThreadOnly = threadCount === 1;
  const singleTicketOnly = ticketCount === 1;
  const singleMessageOnly = messageCount <= 1;
  const noCc = normalized.hasCc !== true;
  const noBcc = normalized.hasBcc !== true;
  const noAttachments = normalized.hasAttachments !== true;
  const noBulkMode = normalized.bulkModeRequested !== true;
  const noSendAll = normalized.sendAllRequested !== true;
  const noAudienceSegment = normalized.audienceSegmentPresent !== true;
  const noTemplateBatchSend = normalized.templateSendRequested !== true;

  return {
    actionTypeIsSupportReplySend: lower(normalized.actionType) === SUPPORT_BULK_SEND_GUARD_ACTION_TYPE,
    providerIsGmail: lower(normalized.provider) === SUPPORT_BULK_SEND_GUARD_PROVIDER,
    recipientCountKnown: recipientCount >= 1,
    singleRecipientOnly,
    singleThreadOnly,
    singleTicketOnly,
    singleMessageOnly,
    noCc,
    noBcc,
    noAttachments,
    noBulkMode,
    noSendAll,
    noAudienceSegment,
    noTemplateBatchSend,
    bulkSendDetected: !singleRecipientOnly || !singleThreadOnly || !singleTicketOnly || !singleMessageOnly || !noCc || !noBcc || !noAttachments || !noBulkMode || !noSendAll || !noAudienceSegment || !noTemplateBatchSend,
    explicitBulkApprovalPresent: Boolean(approval),
    explicitBulkApprovalActorPresent: present(approval?.approvedByUserId),
    explicitBulkApprovalTimestampPresent: present(approval?.approvedAt),
    explicitBulkApprovalScopeValid: lower(approval?.approvalScope) === 'bulk_support_send',
    explicitBulkApprovalLimitCoversRecipients: approvalLimit !== null && recipientCount <= approvalLimit,
    currentPhaseSupportsBulkSend: false,
  };
}

function decide(checks: SupportBulkSendGuardChecks): {
  allowedToContinue: boolean;
  decision: SupportBulkSendGuardDecision;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!checks.actionTypeIsSupportReplySend) blockers.push('Only support_reply_send actions can enter the support bulk send guard.');
  if (!checks.providerIsGmail) blockers.push('Phase 13.6 support bulk send guard supports Gmail only.');
  if (!checks.recipientCountKnown) blockers.push('Recipient count must be known before any support send can continue.');
  if (!checks.singleRecipientOnly) blockers.push('Bulk guard requires one recipient only in the current support send executor lane.');
  if (!checks.singleThreadOnly) blockers.push('Bulk guard requires one thread only in the current support send executor lane.');
  if (!checks.singleTicketOnly) blockers.push('Bulk guard requires one ticket only in the current support send executor lane.');
  if (!checks.singleMessageOnly) blockers.push('Bulk guard requires one outgoing message only in the current support send executor lane.');
  if (!checks.noCc || !checks.noBcc) blockers.push('CC/BCC is not supported in the current support send executor lane.');
  if (!checks.noAttachments) blockers.push('Attachments are not supported in the current support send executor lane.');
  if (!checks.noBulkMode || !checks.noSendAll || !checks.noAudienceSegment || !checks.noTemplateBatchSend) blockers.push('Bulk, send-all, audience-segment, and template-batch sends are blocked.');

  if (checks.bulkSendDetected && !checks.explicitBulkApprovalPresent) {
    blockers.push('Explicit bulk-send approval is required before any future bulk support send lane could be considered.');
    return { allowedToContinue: false, decision: 'blocked_bulk_send_requires_explicit_approval', blockers, warnings };
  }

  if (checks.bulkSendDetected && checks.explicitBulkApprovalPresent && (!checks.explicitBulkApprovalActorPresent || !checks.explicitBulkApprovalTimestampPresent || !checks.explicitBulkApprovalScopeValid || !checks.explicitBulkApprovalLimitCoversRecipients)) {
    blockers.push('Explicit bulk-send approval must include actor, timestamp, bulk_support_send scope, and a recipient limit covering the requested send.');
    return { allowedToContinue: false, decision: 'blocked_bulk_approval_scope_invalid', blockers, warnings };
  }

  if (checks.bulkSendDetected && checks.explicitBulkApprovalPresent) {
    blockers.push('Even with explicit bulk approval metadata, the current Phase 13.6 executor remains single-recipient only. A later separate bulk-send design would be required.');
    return { allowedToContinue: false, decision: 'blocked_bulk_send_not_supported_this_phase', blockers, warnings };
  }

  if (!checks.actionTypeIsSupportReplySend) return { allowedToContinue: false, decision: 'blocked_unsupported_action_type', blockers, warnings };
  if (!checks.providerIsGmail) return { allowedToContinue: false, decision: 'blocked_unsupported_provider', blockers, warnings };
  if (!checks.singleThreadOnly || !checks.singleTicketOnly) return { allowedToContinue: false, decision: 'blocked_missing_single_thread_binding', blockers, warnings };
  if (blockers.length > 0) return { allowedToContinue: false, decision: 'blocked_bulk_send_requires_explicit_approval', blockers, warnings };

  warnings.push('Single-recipient support reply may continue to the later manual approval, pause, thread association, credential, and Gmail send gates. This guard does not send email.');
  return { allowedToContinue: true, decision: 'single_recipient_send_allowed_to_continue', blockers, warnings };
}

export function evaluateSupportBulkSendGuard(input: SupportBulkSendGuardInput = {}): SupportBulkSendGuardResult {
  const normalized = normalizeInput(input);
  const checks = buildChecks(input);
  const decision = decide(checks);

  const result: SupportBulkSendGuardResult = {
    version: '0.7.0',
    phase: SUPPORT_BULK_SEND_GUARD_PHASE,
    healthMode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
    deliverable: 'bulk_send_guard',
    selectedConnector: SUPPORT_BULK_SEND_GUARD_PROVIDER,
    actionType: safeText(normalized.actionType),
    provider: safeText(normalized.provider) || SUPPORT_BULK_SEND_GUARD_PROVIDER,
    allowedToContinue: decision.allowedToContinue,
    bulkSendDetected: checks.bulkSendDetected,
    explicitBulkApprovalRequired: checks.bulkSendDetected,
    explicitBulkApprovalPresent: checks.explicitBulkApprovalPresent,
    decision: decision.decision,
    checks,
    counts: {
      recipientCount: finiteNumber(normalized.recipientCount),
      threadCount: finiteNumber(normalized.threadCount),
      ticketCount: finiteNumber(normalized.ticketCount),
      messageCount: finiteNumber(normalized.messageCount),
    },
    blockers: decision.blockers,
    warnings: decision.warnings,
    safeSummary: decision.allowedToContinue
      ? 'Bulk send guard passed because this is a single-recipient, single-thread, single-ticket support reply. Later executor gates must still pass before any Gmail call.'
      : 'Bulk send guard blocked this request because LIFE.SAVER does not allow bulk support sending in the current executor lane.',
    safety: {
      guardOnly: true,
      emailSent: false,
      gmailApiCalled: false,
      bulkSendSupportedThisPhase: false,
      currentExecutorSingleRecipientOnly: true,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
      note: 'Phase 13.6 adds a central bulk-send guard. Current Gmail support send remains one approved reply to one recipient in one imported thread only. Bulk sends, CC/BCC, attachments, send-all, template batches, and audience-segment sends are blocked and do not call Gmail.',
    },
  };

  assertSupportBulkSendGuardOutputSafe(result);
  return result;
}

export function evaluateSupportBulkSendGuardFromPayload(payload: unknown, explicitBulkApproval?: SupportBulkApprovalInput | null): SupportBulkSendGuardResult {
  const extracted = extractSupportBulkSendGuardInputFromPayload(payload);
  return evaluateSupportBulkSendGuard({ ...extracted, explicitBulkApproval: explicitBulkApproval || null });
}

export function previewSupportBulkSendGuard(input: SupportBulkSendGuardInput = {}) {
  const result = evaluateSupportBulkSendGuard(input);
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

export function buildSupportBulkSendGuardStatus(): SupportBulkSendGuardStatus {
  return {
    phase: 'V2 Phase 13.6 — No Bulk Sends',
    healthMode: SUPPORT_BULK_SEND_GUARD_HEALTH_MODE,
    deliverable: 'bulk_send_guard',
    selectedConnector: SUPPORT_BULK_SEND_GUARD_PROVIDER,
    actionType: SUPPORT_BULK_SEND_GUARD_ACTION_TYPE,
    singleRecipientExecutorOnly: true,
    bulkSendSupportedThisPhase: false,
    explicitBulkApprovalRequiredForFutureBulkSends: true,
    executorMustCheckBulkGuard: true,
    previewCallsGmail: false,
    previewSendsEmail: false,
    rawProviderPayloadReturned: false,
    rawTokenReturned: false,
    rawMimeReturned: false,
    nextStep: 'Phase 13.7 — Sensitive Ticket Guard',
  };
}

export function buildSupportBulkSendGuardExample() {
  const singleInput: SupportBulkSendGuardInput = {
    actionType: 'support_reply_send',
    provider: 'gmail',
    recipientCount: 1,
    threadCount: 1,
    ticketCount: 1,
    messageCount: 1,
    hasCc: false,
    hasBcc: false,
    hasAttachments: false,
    bulkModeRequested: false,
  };

  const bulkInput: SupportBulkSendGuardInput = {
    actionType: 'support_reply_send',
    provider: 'gmail',
    recipientCount: 25,
    threadCount: 25,
    ticketCount: 25,
    messageCount: 25,
    bulkModeRequested: true,
  };

  return {
    status: buildSupportBulkSendGuardStatus(),
    singleRecipientAllowedToContinue: evaluateSupportBulkSendGuard(singleInput),
    bulkBlockedWithoutExplicitApproval: evaluateSupportBulkSendGuard(bulkInput),
    bulkStillBlockedThisPhaseEvenWithExplicitApproval: evaluateSupportBulkSendGuard({
      ...bulkInput,
      explicitBulkApproval: {
        approvalId: 'bulk_approval_future_example',
        approvedByUserId: 'founder_user_123',
        approvedAt: '2026-07-08T10:00:00.000Z',
        approvalScope: 'bulk_support_send',
        maxRecipientCount: 25,
        reason: 'Future example only. Current phase still blocks bulk sending.',
      },
    }),
    safety: {
      exampleSendsEmail: false,
      gmailApiCalled: false,
      bulkSendSupportedThisPhase: false,
      rawProviderPayloadReturned: false,
      rawTokenReturned: false,
      rawMimeReturned: false,
    },
  };
}

export function assertSupportBulkSendGuardOutputSafe(output: unknown): void {
  const serialized = JSON.stringify(output).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(fragment)) {
      throw new Error(`Support bulk send guard output contains forbidden fragment: ${fragment}`);
    }
  }
}
