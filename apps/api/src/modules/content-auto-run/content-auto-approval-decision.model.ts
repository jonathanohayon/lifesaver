import { evaluateApprovedContentStyle } from './approved-content-style-profile.model.js';
import { calculateContentRiskScore } from './content-risk-score.model.js';
import { checkContentAutoRunDailyPostCap } from './content-auto-run-daily-cap.model.js';
import { checkContentAutoRunChannelTimeRestrictions } from './content-auto-run-channel-time.model.js';
import type {
  ContentAutoApprovalDecision,
  ContentAutoApprovalDecisionInput,
  ContentAutoApprovalDecisionRecord,
  ContentAutoApprovalDecisionStatus,
  ContentAutoApprovalGateName,
  ContentAutoApprovalGateResult,
} from './content-auto-approval-decision.types.js';

export const CONTENT_AUTO_APPROVAL_DECISION_PHASE = 'phase_11_5_auto_approval_decision' as const;
export const CONTENT_AUTO_APPROVAL_DECISION_HEALTH_MODE = 'v2-phase-11-5-auto-approval-decision' as const;
export const CONTENT_AUTO_APPROVAL_POLICY_RULE_KEY = 'content_linkedin_safe_style_auto_approval_v1' as const;

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
];

export const CONTENT_AUTO_APPROVAL_REQUIRED_GATES: ContentAutoApprovalGateName[] = [
  'policy_auto_approval_rule_matched',
  'master_pause_off',
  'content_pause_off',
  'emergency_safe_mode_off',
  'action_type_supported',
  'platform_supported',
  'style_profile_matched',
  'risk_score_eligible',
  'daily_post_cap_available',
  'channel_time_allowed',
  'media_type_allowed',
];

function normalizeString(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeHashtags(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 10);
}

function gate(
  gateName: ContentAutoApprovalGateName,
  passed: boolean,
  severity: ContentAutoApprovalGateResult['severity'],
  reason: string,
  sourceDecision?: string,
): ContentAutoApprovalGateResult {
  return {
    gate: gateName,
    passed,
    severity: passed ? 'pass' : severity,
    reason,
    ...(sourceDecision ? { sourceDecision } : {}),
  };
}

export function buildContentAutoApprovalDecisionSafety(): ContentAutoApprovalDecisionRecord['safety'] {
  return {
    decisionRecordOnly: true,
    autoApprovalDecisionCanBeReturned: true,
    autoPublishEnabled: false,
    doesNotPublish: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    doesNotMutateActionStatus: true,
    noTokenAccess: true,
    rawPayloadNotReturned: true,
    futureExecutorGateStillRequired: true,
  };
}

function decideFinal(gates: ContentAutoApprovalGateResult[]): ContentAutoApprovalDecision {
  if (gates.some((item) => !item.passed && item.severity === 'block')) return 'blocked';
  if (gates.some((item) => !item.passed && item.severity === 'ask')) return 'manual_review_required';
  return 'auto_approved';
}

function reasonForDecision(decision: ContentAutoApprovalDecision, gates: ContentAutoApprovalGateResult[]): string {
  if (decision === 'auto_approved') {
    return 'All Phase 11.5 content auto-approval gates matched. The decision record may mark this content auto_approved, but publishing is still not executed by this function.';
  }
  const failed = gates.find((item) => !item.passed);
  if (!failed) return 'Manual review required by conservative fallback.';
  return failed.reason;
}

export function buildContentAutoApprovalDecisionRecord(input: ContentAutoApprovalDecisionInput): ContentAutoApprovalDecisionRecord {
  const caption = normalizeString(input.caption, '');
  const hashtags = normalizeHashtags(input.hashtags);
  const platform = normalizeString(input.platform, 'linkedin').toLowerCase();
  const channel = normalizeString(input.channel, 'linkedin_member_feed').toLowerCase();
  const actionType = normalizeString(input.actionType, 'content_publish').toLowerCase();
  const mediaType = normalizeString(input.mediaType, 'none').toLowerCase();
  const policyAutoApprovalRuleMatched = input.policyAutoApprovalRuleMatched !== false;

  const style = evaluateApprovedContentStyle({
    caption,
    hashtags,
    offerSourceAttached: input.offerSourceAttached,
    complianceNoteAttached: input.complianceNoteAttached,
  });

  const risk = calculateContentRiskScore({
    caption,
    platform,
    hashtags,
    mediaType,
    linkUrl: input.linkUrl,
    offerSourceAttached: input.offerSourceAttached,
    verifiedMetricSourceAttached: input.verifiedMetricSourceAttached,
    complianceNoteAttached: input.complianceNoteAttached,
    approvedBrandStyleMatched: style.matchesApprovedStyle,
  });

  const dailyCap = checkContentAutoRunDailyPostCap({
    workspaceId: input.workspaceId,
    platform,
    actionType,
    timezone: input.timezone,
    maxPostsPerDay: input.maxPostsPerDay,
    publishedTodayCount: input.publishedTodayCount,
    reservedTodayCount: input.reservedTodayCount,
    proposedNewPosts: input.proposedNewPosts,
  });

  const channelTime = checkContentAutoRunChannelTimeRestrictions({
    workspaceId: input.workspaceId,
    platform,
    channel,
    actionType,
    timezone: input.timezone,
    currentTime: input.currentTime,
    scheduledTime: input.scheduledTime,
    allowedPlatforms: input.allowedPlatforms,
    allowedChannels: input.allowedChannels,
    allowedWindows: input.allowedWindows,
  });

  const mediaTypeAllowed = ['none', 'link'].includes(mediaType);
  const gates: ContentAutoApprovalGateResult[] = [
    gate(
      'policy_auto_approval_rule_matched',
      policyAutoApprovalRuleMatched,
      'ask',
      policyAutoApprovalRuleMatched
        ? 'A configured content auto-approval rule matched the candidate action.'
        : 'No content auto-approval policy rule matched, so the action must stay in manual review.',
      policyAutoApprovalRuleMatched ? 'auto_approve_rule_matched' : 'no_auto_approve_rule',
    ),
    gate('master_pause_off', !input.masterPauseActive, 'block', input.masterPauseActive ? 'Master pause is active, so content auto-approval is blocked.' : 'Master pause is off.'),
    gate('content_pause_off', !input.contentPauseActive, 'block', input.contentPauseActive ? 'Content pause is active, so content auto-approval is blocked.' : 'Content pause is off.'),
    gate('emergency_safe_mode_off', !input.emergencySafeModeActive, 'block', input.emergencySafeModeActive ? 'Emergency safe mode is active, so content auto-approval is blocked.' : 'Emergency safe mode is off.'),
    gate('action_type_supported', actionType === 'content_publish', 'block', actionType === 'content_publish' ? 'Action type is content_publish.' : 'Only content_publish may enter the Phase 11.5 content auto-approval lane.'),
    gate('platform_supported', platform === 'linkedin' && channel === 'linkedin_member_feed', 'block', platform === 'linkedin' && channel === 'linkedin_member_feed' ? 'Platform and channel are the supported LinkedIn member feed lane.' : 'Only the LinkedIn member feed lane is supported for this auto-approval decision.', `${platform}:${channel}`),
    gate('style_profile_matched', style.matchesApprovedStyle, style.decision === 'blocked_by_style_profile' ? 'block' : 'ask', style.matchesApprovedStyle ? 'Caption matches the approved Phase 11.1 style profile.' : 'Caption does not fully match the approved Phase 11.1 style profile.', style.decision),
    gate('risk_score_eligible', risk.decision === 'eligible_for_future_auto_run_review', risk.decision === 'blocked_by_risk_score' ? 'block' : 'ask', risk.decision === 'eligible_for_future_auto_run_review' ? 'Content risk score is eligible for the future auto-run lane.' : 'Content risk score requires manual review or is blocked.', risk.decision),
    gate('daily_post_cap_available', dailyCap.decision === 'allowed_for_future_auto_run_review', 'block', dailyCap.decision === 'allowed_for_future_auto_run_review' ? 'Daily post cap has remaining capacity.' : 'Daily post cap check did not pass.', dailyCap.decision),
    gate('channel_time_allowed', channelTime.decision === 'allowed_for_future_auto_run_review', 'block', channelTime.decision === 'allowed_for_future_auto_run_review' ? 'Channel/time restrictions are satisfied.' : 'Channel/time restrictions did not pass.', channelTime.decision),
    gate('media_type_allowed', mediaTypeAllowed, 'block', mediaTypeAllowed ? 'Media type is allowed for the narrow text/link auto-approval lane.' : 'Only text/link content is allowed for the Phase 11.5 auto-approval decision lane.', mediaType),
  ];

  const finalDecision = decideFinal(gates);
  const reason = reasonForDecision(finalDecision, gates);
  const blockingFailures = gates.filter((item) => !item.passed && item.severity === 'block').length;
  const askFailures = gates.filter((item) => !item.passed && item.severity === 'ask').length;

  return {
    phase: CONTENT_AUTO_APPROVAL_DECISION_PHASE,
    healthMode: CONTENT_AUTO_APPROVAL_DECISION_HEALTH_MODE,
    deliverable: 'auto_approval_decision_record',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    finalDecision,
    autoApproved: finalDecision === 'auto_approved',
    autoPublishAllowedNow: false,
    decisionRecordedInDatabase: false,
    reason,
    matchedPolicyRuleKey: policyAutoApprovalRuleMatched ? CONTENT_AUTO_APPROVAL_POLICY_RULE_KEY : null,
    gates,
    gateSummary: {
      totalGates: gates.length,
      passedGates: gates.filter((item) => item.passed).length,
      failedGates: gates.filter((item) => !item.passed).length,
      blockingFailures,
      askFailures,
    },
    policyDecisionSnapshot: {
      decision: finalDecision,
      reason,
      evaluatedAt: new Date().toISOString(),
      matchedPolicyRuleKey: policyAutoApprovalRuleMatched ? CONTENT_AUTO_APPROVAL_POLICY_RULE_KEY : null,
      styleDecision: style.decision,
      riskDecision: risk.decision,
      dailyCapDecision: dailyCap.decision,
      channelTimeDecision: channelTime.decision,
      riskLevel: risk.riskLevel,
      riskScore: risk.totalScore,
    },
    safeContentSummary: {
      captionCharacters: caption.length,
      hashtagCount: hashtags.length,
      mediaType,
      hasLinkUrl: Boolean(input.linkUrl),
      scheduledTimeProvided: Boolean(input.scheduledTime),
    },
    componentResults: {
      style,
      risk,
      dailyCap,
      channelTime,
    },
    safety: buildContentAutoApprovalDecisionSafety(),
  };
}

export function buildContentAutoApprovalDecisionStatus(): ContentAutoApprovalDecisionStatus {
  return {
    phase: CONTENT_AUTO_APPROVAL_DECISION_PHASE,
    healthMode: CONTENT_AUTO_APPROVAL_DECISION_HEALTH_MODE,
    enabled: true,
    deliverable: 'auto_approval_decision_record',
    supportedPlatform: 'linkedin',
    supportedChannel: 'linkedin_member_feed',
    supportedActionType: 'content_publish',
    requiredGateNames: [...CONTENT_AUTO_APPROVAL_REQUIRED_GATES],
    safety: buildContentAutoApprovalDecisionSafety(),
  };
}

export function assertContentAutoApprovalDecisionSafe(record: ContentAutoApprovalDecisionRecord): void {
  const serialized = JSON.stringify(record).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content auto-approval decision output contains forbidden fragment: ${forbidden}`);
    }
  }

  if (!record.safety.decisionRecordOnly || !record.safety.autoApprovalDecisionCanBeReturned || record.safety.autoPublishEnabled || !record.safety.doesNotPublish || record.safety.externalApiCalled || !record.safety.noDatabaseWrites || !record.safety.doesNotMutateActionStatus || !record.safety.noTokenAccess || !record.safety.rawPayloadNotReturned || record.autoPublishAllowedNow || record.decisionRecordedInDatabase) {
    throw new Error('Content auto-approval decision safety flags are invalid for Phase 11.5.');
  }

  if (record.finalDecision === 'auto_approved' && record.gates.some((item) => !item.passed)) {
    throw new Error('Auto-approved decision must not be returned unless every gate passes.');
  }
}
