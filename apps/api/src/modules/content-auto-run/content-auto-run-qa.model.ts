import { buildContentAutoApprovalDecisionRecord } from './content-auto-approval-decision.model.js';
import { checkContentAutoRunDailyPostCap } from './content-auto-run-daily-cap.model.js';
import { validateContentBeforePublish } from './content-final-publish-validator.model.js';
import type {
  ContentAutoRunQaReport,
  ContentAutoRunQaReportInput,
  ContentAutoRunQaSafety,
  ContentAutoRunQaScenario,
  ContentAutoRunQaStatus,
} from './content-auto-run-qa.types.js';

export const CONTENT_AUTO_RUN_QA_PHASE = 'phase_11_10_auto_run_qa' as const;
export const CONTENT_AUTO_RUN_QA_HEALTH_MODE = 'v2-phase-11-10-auto-run-qa' as const;
export const CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE = 'I APPROVE ONE CONTROLLED CONTENT AUTO-RUN TEST' as const;

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

const safeCaption = 'A calm founder update: today we are reviewing operational signals carefully, staying practical, and only publishing content that matches the approved brand voice.';

function scenarioSafety(): ContentAutoRunQaScenario['safety'] {
  return {
    externalApiCalled: false,
    publishCalled: false,
    databaseWritten: false,
    tokenAccessed: false,
    rawPayloadReturned: false,
  };
}

function buildScenario(args: Omit<ContentAutoRunQaScenario, 'safety'>): ContentAutoRunQaScenario {
  return {
    ...args,
    safety: scenarioSafety(),
  };
}

export function buildContentAutoRunQaSafety(): ContentAutoRunQaSafety {
  return {
    qaReportOnly: true,
    sandboxOnlyByDefault: true,
    controlledRealAutoRunRequiresExplicitApproval: true,
    doesNotPublishFromReport: true,
    externalApiCalled: false,
    noDatabaseWrites: true,
    noActionStatusMutation: true,
    noTokenDecryption: true,
    rawTokenNotReturned: true,
    rawPayloadNotReturned: true,
    rollbackPayloadNotReturned: true,
    autoRunNotEnabledByThisPhase: true,
  };
}

function safeAutoApprovalInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'qa_workspace',
    actionId: 'qa_action_auto_run',
    actionType: 'content_publish',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    caption: safeCaption,
    hashtags: ['#Ecommerce', '#FounderOps'],
    mediaType: 'link',
    linkUrl: 'https://lifesaveragent.com',
    policyAutoApprovalRuleMatched: true,
    masterPauseActive: false,
    contentPauseActive: false,
    emergencySafeModeActive: false,
    timezone: 'UTC',
    currentTime: '2026-07-07T12:00:00.000Z',
    scheduledTime: '2026-07-07T12:00:00.000Z',
    maxPostsPerDay: 3,
    publishedTodayCount: 0,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
    allowedPlatforms: ['linkedin'],
    allowedChannels: ['linkedin_member_feed'],
    allowedWindows: [{ days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], startTime: '09:00', endTime: '18:00' }],
    offerSourceAttached: false,
    verifiedMetricSourceAttached: true,
    complianceNoteAttached: false,
    ...overrides,
  };
}

function buildSandboxAutoRunScenario(input: ContentAutoRunQaReportInput): ContentAutoRunQaScenario {
  const finalValidation = validateContentBeforePublish({
    ...safeAutoApprovalInput(),
    ruleStillEnabled: true,
    tokenConnected: true,
    tokenExpiresAt: '2026-07-08T12:00:00.000Z',
    tokenHasRequiredScope: true,
  } as any);
  const passed = input.sandboxExecutorPasses !== false && finalValidation.readyForExecutorHandoff === true;

  return buildScenario({
    name: 'sandbox_auto_run',
    status: passed ? 'passed' : 'failed',
    passed,
    expected: 'A sandbox-only auto-run candidate passes all decision and final validation gates without calling LinkedIn.',
    actual: passed ? 'Sandbox candidate passed final validation. No external API was called.' : 'Sandbox candidate did not pass final validation.',
    reason: passed
      ? 'The safe candidate is ready for a future executor handoff preview only; this QA report does not publish.'
      : finalValidation.reason,
    evidence: {
      finalValidatorDecision: finalValidation.decision,
      readyForExecutorHandoff: finalValidation.readyForExecutorHandoff,
      externalApiCalled: finalValidation.externalApiCalled,
      publishCalled: finalValidation.publishCalled,
      gateSummary: finalValidation.gateSummary,
    },
  });
}

function buildRuleMatchScenario(input: ContentAutoRunQaReportInput): ContentAutoRunQaScenario {
  const decision = buildContentAutoApprovalDecisionRecord(safeAutoApprovalInput() as any);
  const passed = input.ruleMatchPasses !== false && decision.finalDecision === 'auto_approved';
  return buildScenario({
    name: 'rule_match',
    status: passed ? 'passed' : 'failed',
    passed,
    expected: 'All content auto-approval rules match and the decision record returns auto_approved.',
    actual: `Decision record returned ${decision.finalDecision}.`,
    reason: decision.reason,
    evidence: {
      finalDecision: decision.finalDecision,
      autoApproved: decision.autoApproved,
      matchedPolicyRuleKey: decision.matchedPolicyRuleKey,
      gateSummary: decision.gateSummary,
      riskScore: decision.policyDecisionSnapshot.riskScore,
      riskLevel: decision.policyDecisionSnapshot.riskLevel,
    },
  });
}

function buildCapExceededScenario(input: ContentAutoRunQaReportInput): ContentAutoRunQaScenario {
  const cap = checkContentAutoRunDailyPostCap({
    workspaceId: 'qa_workspace',
    platform: 'linkedin',
    actionType: 'content_publish',
    timezone: 'UTC',
    maxPostsPerDay: 1,
    publishedTodayCount: 1,
    reservedTodayCount: 0,
    proposedNewPosts: 1,
  });
  const passed = input.capExceededPasses !== false && cap.decision === 'blocked_daily_cap_exceeded';
  return buildScenario({
    name: 'cap_exceeded',
    status: passed ? 'blocked_as_expected' : 'failed',
    passed,
    expected: 'When the daily cap is exceeded, future auto-run is blocked before publishing.',
    actual: `Daily cap decision returned ${cap.decision}.`,
    reason: cap.reason,
    evidence: {
      decision: cap.decision,
      capExceeded: cap.capExceeded,
      maxPostsPerDay: cap.maxPostsPerDay,
      publishedTodayCount: cap.publishedTodayCount,
      projectedTotalToday: cap.projectedTotalToday,
      remainingToday: cap.remainingToday,
    },
  });
}

function buildPauseActiveScenario(input: ContentAutoRunQaReportInput): ContentAutoRunQaScenario {
  const decision = buildContentAutoApprovalDecisionRecord(safeAutoApprovalInput({ contentPauseActive: true }) as any);
  const passed = input.pauseActivePasses !== false && decision.finalDecision === 'blocked';
  return buildScenario({
    name: 'pause_active',
    status: passed ? 'blocked_as_expected' : 'failed',
    passed,
    expected: 'When content pause is active, the auto-approval decision blocks the lane.',
    actual: `Decision record returned ${decision.finalDecision}.`,
    reason: decision.reason,
    evidence: {
      finalDecision: decision.finalDecision,
      contentPauseGate: decision.gates.find((gate) => gate.gate === 'content_pause_off'),
      gateSummary: decision.gateSummary,
    },
  });
}

function buildControlledRealAutoRunScenario(input: ContentAutoRunQaReportInput): ContentAutoRunQaScenario {
  const phraseProvided = String(input.explicitFounderApprovalPhrase || '').trim() === CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE;
  const requested = input.controlledRealAutoRunRequested === true;
  const executorEnabled = input.controlledRealAutoRunExecutorEnabled === true;
  const wouldBeAllowed = requested && phraseProvided && executorEnabled;

  return buildScenario({
    name: 'controlled_real_auto_run',
    status: wouldBeAllowed ? 'not_run' : 'not_run',
    passed: true,
    expected: 'One controlled real auto-run may only be attempted outside this QA report after explicit approval, valid credentials, feature flags, final validation, and live operator confirmation.',
    actual: wouldBeAllowed
      ? 'Approval preconditions appear present, but this QA endpoint still does not execute real auto-run.'
      : 'Controlled real auto-run was not requested with the exact approval phrase and enabled executor flag, so no real run is attempted.',
    reason: 'This report never publishes. It documents whether the controlled real-test preconditions are present, then requires a separate live operator step.',
    evidence: {
      requested,
      exactApprovalPhraseProvided: phraseProvided,
      executorFlagProvided: executorEnabled,
      realAutoRunExecutedByReport: false,
      requiredApprovalPhrase: CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE,
    },
  });
}

function summarize(scenarios: ContentAutoRunQaScenario[]): ContentAutoRunQaReport['summary'] {
  return {
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((item) => item.status === 'passed').length,
    blockedAsExpectedScenarios: scenarios.filter((item) => item.status === 'blocked_as_expected').length,
    notRunScenarios: scenarios.filter((item) => item.status === 'not_run').length,
    failedScenarios: scenarios.filter((item) => item.status === 'failed').length,
  };
}

export function buildContentAutoRunQaReport(input: ContentAutoRunQaReportInput = {}): ContentAutoRunQaReport {
  const scenarios = [
    buildSandboxAutoRunScenario(input),
    buildRuleMatchScenario(input),
    buildCapExceededScenario(input),
    buildPauseActiveScenario(input),
    buildControlledRealAutoRunScenario(input),
  ];
  const summary = summarize(scenarios);
  const qaStatus: ContentAutoRunQaReport['qaStatus'] = summary.failedScenarios > 0 ? 'failed' : summary.notRunScenarios > 0 ? 'partial' : 'passed';

  return {
    phase: CONTENT_AUTO_RUN_QA_PHASE,
    healthMode: CONTENT_AUTO_RUN_QA_HEALTH_MODE,
    deliverable: 'safe_content_auto_run_qa',
    platform: 'linkedin',
    channel: 'linkedin_member_feed',
    actionType: 'content_publish',
    qaStatus,
    realAutoRunExecuted: false,
    controlledRealAutoRunApprovalPhraseRequired: CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE,
    summary,
    scenarios,
    finalRecommendation: summary.failedScenarios === 0
      ? 'Phase 11.10 QA passed safely. Keep the lane disabled by default until a separate controlled live auto-run is explicitly approved and supervised.'
      : 'Do not proceed to any controlled real auto-run until failed QA scenarios are fixed and retested.',
    nextStepBeforeAnyRealAutoRun: [
      'Confirm founder/client approval in writing using the exact required phrase.',
      'Confirm master pause, content pause, emergency safe mode, caps, token, rule, and final validator gates in the live environment.',
      'Enable any real executor flag only temporarily for the one approved test.',
      'Watch logs during the test and disable the lane immediately afterwards.',
    ],
    safety: buildContentAutoRunQaSafety(),
  };
}

export function buildContentAutoRunQaStatus(): ContentAutoRunQaStatus {
  return {
    phase: CONTENT_AUTO_RUN_QA_PHASE,
    healthMode: CONTENT_AUTO_RUN_QA_HEALTH_MODE,
    enabled: true,
    deliverable: 'safe_content_auto_run_qa',
    testedScenarios: ['sandbox_auto_run', 'rule_match', 'cap_exceeded', 'pause_active', 'controlled_real_auto_run'],
    controlledRealAutoRunApprovalPhraseRequired: CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE,
    safety: buildContentAutoRunQaSafety(),
  };
}

export function assertContentAutoRunQaSafe(report: ContentAutoRunQaReport | ContentAutoRunQaStatus): void {
  const safety = report.safety;
  if (!safety.qaReportOnly || !safety.doesNotPublishFromReport || safety.externalApiCalled || !safety.noDatabaseWrites || !safety.autoRunNotEnabledByThisPhase) {
    throw new Error('Content auto-run QA safety flags are invalid.');
  }
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Content auto-run QA output contains forbidden fragment: ${forbidden}`);
    }
  }
}
