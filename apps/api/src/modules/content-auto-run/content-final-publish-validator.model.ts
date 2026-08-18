import { buildContentAutoApprovalDecisionRecord } from './content-auto-approval-decision.model.js';
import type {
  ContentFinalPublishValidationGateName,
  ContentFinalPublishValidationGateResult,
  ContentFinalPublishValidationResult,
  ContentFinalPublishValidationStatus,
  ContentFinalPublishValidatorInput,
} from './content-final-publish-validator.types.js';

export const CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE = 'phase_11_6_pre_publish_final_validation' as const;
export const CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE = 'v2-phase-11-6-pre-publish-final-validation' as const;
export const CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE = 'w_member_social' as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'access_token',
  'refresh_token',
  'authorization',
  'client_secret',
  'database_url',
  'app_encryption_key',
  'worker_shared_secret',
  'payload_json',
  'raw_payload',
  'rollback_payload',
  'encrypted_',
  'bearer ',
];

export const CONTENT_FINAL_PUBLISH_REQUIRED_GATES: ContentFinalPublishValidationGateName[] = [
  'auto_approval_decision_auto_approved',
  'rule_still_enabled',
  'master_pause_off',
  'content_pause_off',
  'emergency_safe_mode_off',
  'token_connected',
  'token_not_expired',
  'required_scope_present',
  'cap_not_exceeded',
  'content_safe',
  'channel_time_allowed',
  'platform_supported',
  'media_type_allowed',
];

function gate(
  gateName: ContentFinalPublishValidationGateName,
  passed: boolean,
  reasonWhenPassed: string,
  reasonWhenFailed: string,
  sourceDecision?: string,
): ContentFinalPublishValidationGateResult {
  return {
    gate: gateName,
    passed,
    reason: passed ? reasonWhenPassed : reasonWhenFailed,
    ...(sourceDecision ? { sourceDecision } : {}),
  };
}

function normalizeString(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isExpired(expiresAt: string | null | undefined, nowValue: string | undefined): boolean {
  const expires = parseDate(expiresAt);
  if (!expires) return true;
  const now = parseDate(nowValue) || new Date();
  return expires.getTime() <= now.getTime();
}

export function buildContentFinalPublishValidationSafety(): ContentFinalPublishValidationResult['safety'] {
  return {
    validatorOnly: true,
    doesNotPublish: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    noActionStatusMutation: true,
    noTokenDecryption: true,
    rawTokenNotReturned: true,
    rawPayloadNotReturned: true,
    finalGateBeforeAnyFutureExecutor: true,
  };
}

function reasonForFinalValidation(gates: ContentFinalPublishValidationGateResult[]): string {
  const failed = gates.find((item) => !item.passed);
  if (!failed) {
    return 'All Phase 11.6 final pre-publish validation gates passed. The candidate may be handed to a future executor, but this validator does not publish.';
  }
  return failed.reason;
}

export function validateContentBeforePublish(input: ContentFinalPublishValidatorInput): ContentFinalPublishValidationResult {
  const requiredScope = normalizeString(input.requiredScope, CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE);
  const tokenConnected = input.tokenConnected === true;
  const tokenExpiresAt = input.tokenExpiresAt || null;
  const tokenExpired = isExpired(tokenExpiresAt, input.currentTime);
  const requiredScopePresent = input.tokenHasRequiredScope === true;
  const ruleStillEnabled = input.ruleStillEnabled !== false;
  const platform = normalizeString(input.platform, 'linkedin').toLowerCase();
  const channel = normalizeString(input.channel, 'linkedin_member_feed').toLowerCase();
  const actionType = normalizeString(input.actionType, 'content_publish').toLowerCase();
  const mediaType = normalizeString(input.mediaType, 'none').toLowerCase();

  const autoApproval = buildContentAutoApprovalDecisionRecord({
    ...input,
    platform,
    channel,
    actionType,
    mediaType,
  });

  const gates: ContentFinalPublishValidationGateResult[] = [
    gate(
      'auto_approval_decision_auto_approved',
      autoApproval.finalDecision === 'auto_approved',
      'Auto-approval decision is auto_approved and all Phase 11.5 gates passed.',
      'Auto-approval decision did not pass, so final publish validation is blocked.',
      autoApproval.finalDecision,
    ),
    gate(
      'rule_still_enabled',
      ruleStillEnabled,
      'The matched content auto-approval rule is still enabled.',
      'The matched content auto-approval rule is disabled or unavailable.',
      ruleStillEnabled ? 'rule_enabled' : 'rule_disabled',
    ),
    gate('master_pause_off', !input.masterPauseActive, 'Master pause is off.', 'Master pause is active.'),
    gate('content_pause_off', !input.contentPauseActive, 'Content pause is off.', 'Content pause is active.'),
    gate('emergency_safe_mode_off', !input.emergencySafeModeActive, 'Emergency safe mode is off.', 'Emergency safe mode is active.'),
    gate('token_connected', tokenConnected, 'LinkedIn connector status says a token is connected.', 'LinkedIn connector status says no token is connected.'),
    gate('token_not_expired', !tokenExpired, 'LinkedIn token expiry metadata is valid for this check.', 'LinkedIn token expiry metadata is missing, invalid, or expired.'),
    gate('required_scope_present', requiredScopePresent, `LinkedIn connector metadata includes ${requiredScope}.`, `LinkedIn connector metadata does not include ${requiredScope}.`, requiredScope),
    gate(
      'cap_not_exceeded',
      autoApproval.policyDecisionSnapshot.dailyCapDecision === 'allowed_for_future_auto_run_review',
      'Daily post cap is still available.',
      'Daily post cap is exceeded or invalid.',
      autoApproval.policyDecisionSnapshot.dailyCapDecision,
    ),
    gate(
      'content_safe',
      autoApproval.policyDecisionSnapshot.riskDecision === 'eligible_for_future_auto_run_review' && autoApproval.policyDecisionSnapshot.styleDecision === 'style_match',
      'Content style and risk checks remain safe for the narrow lane.',
      'Content style or risk checks require manual review or blocking.',
      `${autoApproval.policyDecisionSnapshot.styleDecision}:${autoApproval.policyDecisionSnapshot.riskDecision}`,
    ),
    gate(
      'channel_time_allowed',
      autoApproval.policyDecisionSnapshot.channelTimeDecision === 'allowed_for_future_auto_run_review',
      'Channel and time restrictions are still satisfied.',
      'Channel or time restrictions are not satisfied.',
      autoApproval.policyDecisionSnapshot.channelTimeDecision,
    ),
    gate(
      'platform_supported',
      platform === 'linkedin' && channel === 'linkedin_member_feed' && actionType === 'content_publish',
      'The platform/channel/action lane is the supported LinkedIn member feed content_publish lane.',
      'Only LinkedIn member feed content_publish is supported by the Phase 11.6 validator.',
      `${platform}:${channel}:${actionType}`,
    ),
    gate(
      'media_type_allowed',
      ['none', 'link'].includes(mediaType),
      'Media type is still allowed for the narrow text/link lane.',
      'Only text/link content may pass the Phase 11.6 final validator.',
      mediaType,
    ),
  ];

  const failedGates = gates.filter((item) => !item.passed).length;
  const readyForExecutorHandoff = failedGates === 0;

  return {
    phase: CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE,
    healthMode: CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE,
    deliverable: 'final_publish_validator',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    decision: readyForExecutorHandoff ? 'ready_for_executor_handoff' : 'blocked_before_publish',
    readyForExecutorHandoff,
    autoPublishExecuted: false,
    publishCalled: false,
    externalApiCalled: false,
    reason: reasonForFinalValidation(gates),
    requiredScope,
    tokenStatusSummary: {
      tokenConnected,
      tokenExpiresAt,
      tokenExpired,
      requiredScopePresent,
      rawTokenReturned: false,
    },
    gates,
    gateSummary: {
      totalGates: gates.length,
      passedGates: gates.filter((item) => item.passed).length,
      failedGates,
    },
    autoApprovalDecisionSnapshot: {
      finalDecision: autoApproval.finalDecision,
      matchedPolicyRuleKey: autoApproval.matchedPolicyRuleKey,
      riskLevel: autoApproval.policyDecisionSnapshot.riskLevel,
      riskScore: autoApproval.policyDecisionSnapshot.riskScore,
      dailyCapDecision: autoApproval.policyDecisionSnapshot.dailyCapDecision,
      channelTimeDecision: autoApproval.policyDecisionSnapshot.channelTimeDecision,
    },
    safety: buildContentFinalPublishValidationSafety(),
  };
}

export function buildContentFinalPublishValidationStatus(): ContentFinalPublishValidationStatus {
  return {
    phase: CONTENT_FINAL_PUBLISH_VALIDATOR_PHASE,
    healthMode: CONTENT_FINAL_PUBLISH_VALIDATOR_HEALTH_MODE,
    enabled: true,
    deliverable: 'final_publish_validator',
    supportedPlatform: 'linkedin',
    supportedChannel: 'linkedin_member_feed',
    supportedActionType: 'content_publish',
    requiredScope: CONTENT_FINAL_PUBLISH_REQUIRED_SCOPE,
    requiredGateNames: [...CONTENT_FINAL_PUBLISH_REQUIRED_GATES],
    safety: buildContentFinalPublishValidationSafety(),
  };
}

export function assertContentFinalPublishValidationSafe(result: ContentFinalPublishValidationResult): void {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Final publish validator output contains forbidden fragment: ${forbidden}`);
    }
  }

  if (!result.safety.validatorOnly || !result.safety.doesNotPublish || result.safety.externalApiCalled || !result.safety.noDatabaseWrites || !result.safety.noActionStatusMutation || !result.safety.noTokenDecryption || !result.safety.rawTokenNotReturned || !result.safety.rawPayloadNotReturned || result.publishCalled || result.autoPublishExecuted || result.externalApiCalled) {
    throw new Error('Final publish validator safety flags are invalid for Phase 11.6.');
  }

  if (result.readyForExecutorHandoff && result.gates.some((item) => !item.passed)) {
    throw new Error('Final publish validator cannot be ready when any gate failed.');
  }
}
