import type {
  SupportWriteScopeChecklist,
  SupportWriteScopeChecklistItem,
  SupportWriteScopeGateInput,
  SupportWriteScopeGateResult,
  SupportWriteScopePermissionPlan,
  SupportWriteScopeSafetyPlan,
  SupportWriteScopeStatus,
} from './support-write-scope.types.js';

export const SUPPORT_WRITE_SCOPE_PHASE = 'phase_13_1_write_scope_setup' as const;
export const SUPPORT_WRITE_SCOPE_HEALTH_MODE = 'v2-phase-13-1-write-scope-setup' as const;
export const SUPPORT_WRITE_SCOPE_PACKAGE = 'lifesaver-v0.7.0-phase-13-1-write-scope-setup.zip' as const;
export const SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE = 'https://www.googleapis.com/auth/gmail.send' as const;
export const SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization: bearer',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'encrypted_access_token',
  'encrypted_refresh_token',
  'raw_mime',
  'raw_email_payload_value',
];

export function buildSupportWriteScopeSafetyPlan(): SupportWriteScopeSafetyPlan {
  return {
    checklistOnly: true,
    gmailApiClientAdded: false,
    oauthRouteAdded: false,
    tokenStorageChanged: false,
    sendScopeRequestedNow: false,
    gmailSendExecutorAdded: false,
    emailSendingAdded: false,
    autoReplyAdded: false,
    externalApiCalled: false,
    rawEmailPayloadReturned: false,
    noSecretsInBrowser: true,
  };
}

export function buildSupportWriteScopePermissionPlan(): SupportWriteScopePermissionPlan {
  return {
    connector: 'gmail',
    existingReadScope: SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE,
    minimumSendScopeToAddLater: SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE,
    allowedForPhase131PlanningOnly: [SUPPORT_WRITE_SCOPE_EXISTING_READ_SCOPE],
    notRequestedInPhase131: [
      SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE,
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://mail.google.com/',
    ],
    forbiddenBroadScope: 'https://mail.google.com/',
    scopeClassification: {
      gmailSend: 'sensitive',
      gmailReadonly: 'restricted',
      gmailCompose: 'restricted',
      gmailModify: 'restricted',
      mailGoogleCom: 'restricted_and_too_broad',
    },
    oauthConsentImpact: [
      'Update Google OAuth consent screen before any production support-send testing.',
      'Explain exactly why LIFE.SAVER needs send-only permission for founder-approved support replies.',
      'Keep gmail.modify, gmail.compose, and the broad mail.google.com scope out of the first send executor lane.',
      'Production launch must keep privacy policy, data retention, and Google verification/security review planning current.',
    ],
  };
}

export function buildSupportWriteScopeChecklistItems(): SupportWriteScopeChecklistItem[] {
  return [
    {
      id: 'read_only_connector_stable',
      title: 'Confirm Phase 12 read-only support connector is stable',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'developer',
      status: 'planned',
      notes: [
        'Ticket import, classification, draft action creation, no-send safety, and permission controls must pass QA first.',
        'No send permission should be requested until read-only behavior is boring and stable.',
      ],
    },
    {
      id: 'request_minimum_send_scope_only',
      title: 'Use minimum Gmail send scope only',
      decision: 'recommended',
      requiredBeforeExecutor: true,
      owner: 'developer',
      status: 'planned',
      notes: [
        `Future executor should request ${SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE} for sending only.`,
        'Do not request gmail.modify, gmail.compose, or the broad mail.google.com scope for the first support send executor.',
      ],
    },
    {
      id: 'founder_reconsent_required',
      title: 'Require founder re-consent for send permission',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'founder',
      status: 'planned',
      notes: [
        'The product must clearly show that send permission allows LIFE.SAVER to send approved support replies on behalf of the connected mailbox.',
        'Re-consent must be explicit and separate from read-only import setup.',
      ],
    },
    {
      id: 'approved_action_only',
      title: 'Send only approved support_reply_send actions',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'developer',
      status: 'planned',
      notes: [
        'The first executor must only accept existing proposed actions that have been approved by an owner/admin.',
        'Support send executor must never execute a draft directly from the classifier or draft generator.',
      ],
    },
    {
      id: 'no_auto_send_initially',
      title: 'Keep auto-send disabled in the first write-scope lane',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'both',
      status: 'planned',
      notes: [
        'Phase 13 starts with approved manual sends only.',
        'Safe FAQ auto-send should remain a later phase after executor QA, cap rules, escalation rules, and anomaly stop behavior exist for support.',
      ],
    },
    {
      id: 'privacy_redaction_before_logs',
      title: 'Redact customer data before logs and browser-safe responses',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'developer',
      status: 'planned',
      notes: [
        'Never log raw MIME, raw ticket payloads, OAuth tokens, or full private customer data.',
        'Use Phase 12.6 support privacy safeguards in executor status, errors, and QA reports.',
      ],
    },
    {
      id: 'escalation_blocks_send',
      title: 'Block or require manual review for escalation cases',
      decision: 'required_before_real_send',
      requiredBeforeExecutor: true,
      owner: 'developer',
      status: 'planned',
      notes: [
        'Refunds, legal threats, chargebacks, angry complaints, uncertain answers, medical/sensitive content, and configured high-value customers must not silently send.',
        'Escalation rules must run again immediately before any future executor call.',
      ],
    },
    {
      id: 'attachments_deferred',
      title: 'Defer attachments, CC, and BCC in first executor',
      decision: 'deferred',
      requiredBeforeExecutor: false,
      owner: 'developer',
      status: 'blocked_until_future_phase',
      notes: [
        'Initial support send should be plain safe reply body only.',
        'Attachments, CC, and BCC add privacy and delivery risk and should be separately gated later.',
      ],
    },
  ];
}

export function buildSupportWriteScopeChecklist(): SupportWriteScopeChecklist {
  return {
    packageName: SUPPORT_WRITE_SCOPE_PACKAGE,
    version: '0.7.0',
    phase: 'V2 Phase 13.1 — Write Scope Setup',
    healthMode: SUPPORT_WRITE_SCOPE_HEALTH_MODE,
    deliverable: 'support_write_scope_checklist',
    purpose: 'Prepare the Gmail support send permission checklist after the read-only support connector is stable, without adding OAuth routes, send scopes, API clients, or email sending yet.',
    selectedConnector: 'gmail',
    currentStableMode: 'read_only_support_ticket_import',
    nextExecutorMode: 'approved_support_reply_send_only',
    permissionPlan: buildSupportWriteScopePermissionPlan(),
    methodPlan: {
      selectedMethod: 'gmail_users_messages_send',
      directSendEndpoint: 'users.messages.send',
      draftSendEndpointDeferred: 'users.drafts.send',
      messageFormat: 'rfc_2822_mime_base64url_raw_message',
      userId: 'me',
      initialReplyMode: 'threaded_reply_using_original_thread_headers',
      attachmentsAllowedInitially: false,
      ccBccAllowedInitially: false,
    },
    checklist: buildSupportWriteScopeChecklistItems(),
    hardBlocksBeforeRealSend: [
      'No founder re-consent for Gmail send scope.',
      'Action is not support_reply_send.',
      'Action is not approved.',
      'Ticket or draft is marked sensitive/escalation without explicit manual handling.',
      'Support pause or emergency safe mode is active.',
      'Requested scope is broader than gmail.send.',
      'Payload contains attachments, CC, BCC, raw MIME output, or token-like data in browser/log responses.',
    ],
    safety: buildSupportWriteScopeSafetyPlan(),
    nextStep: 'Phase 13.2 — Support send action payload and final pre-send validation.',
  };
}

export function buildSupportWriteScopeStatus(): SupportWriteScopeStatus {
  const checklist = buildSupportWriteScopeChecklist();
  return {
    phase: checklist.phase,
    healthMode: checklist.healthMode,
    deliverable: checklist.deliverable,
    selectedConnector: checklist.selectedConnector,
    checklistOnly: true,
    sendScopeRequestedNow: false,
    gmailSendExecutorAdded: false,
    emailSendingAdded: false,
    autoReplyAdded: false,
    requiredFutureScope: SUPPORT_WRITE_SCOPE_REQUIRED_SCOPE,
    nextStep: checklist.nextStep,
  };
}

export function evaluateSupportWriteScopeGates(input: SupportWriteScopeGateInput = {}): SupportWriteScopeGateResult {
  const gates: Array<[keyof SupportWriteScopeGateInput, string]> = [
    ['readOnlyConnectorStable', 'Read-only support connector QA is not confirmed stable.'],
    ['oauthConsentUpdated', 'OAuth consent screen has not been updated for the future send scope.'],
    ['founderApprovedSendScope', 'Founder has not explicitly approved Gmail send permission.'],
    ['encryptedTokenStorageReady', 'Encrypted connector token storage is not confirmed ready.'],
    ['proposedActionApprovalRequired', 'Approved proposed action gate is not confirmed.'],
    ['noAutoReply', 'Auto-reply/no-auto-send restriction is not confirmed.'],
    ['noBroadMailScope', 'Broad Gmail scope blocking is not confirmed.'],
    ['supportPrivacySafeguardsActive', 'Support privacy safeguards are not confirmed active.'],
    ['escalationRulesActive', 'Support escalation rules are not confirmed active.'],
  ];

  const missingGates = gates.filter(([key]) => input[key] !== true).map(([, message]) => message);
  const warnings: string[] = [];

  if (input.founderApprovedSendScope === true && input.oauthConsentUpdated !== true) {
    warnings.push('Founder approval without an updated OAuth consent screen is not enough for a real send executor.');
  }

  if (input.noBroadMailScope !== true) {
    warnings.push('Do not use https://mail.google.com/ for the first support send lane.');
  }

  return {
    eligibleForFutureSendExecutorBuild: missingGates.length === 0,
    riskLevel: missingGates.length === 0 ? 'low' : missingGates.length <= 2 ? 'medium' : 'blocked',
    missingGates,
    warnings,
    safeSummary: missingGates.length === 0
      ? 'All planning gates are marked ready for a future approved-only support send executor build. This phase still does not send email.'
      : 'Support write-scope setup is not ready for a real send executor. Keep the lane read-only/checklist-only.',
  };
}

export function assertSupportWriteScopeOutputSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment.toLowerCase())) {
      throw new Error(`Support write-scope output contains forbidden fragment: ${fragment}`);
    }
  }
}
