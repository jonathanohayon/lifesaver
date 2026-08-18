export type ContentAutoRunQaScenarioName =
  | 'sandbox_auto_run'
  | 'rule_match'
  | 'cap_exceeded'
  | 'pause_active'
  | 'controlled_real_auto_run';

export type ContentAutoRunQaScenarioStatus = 'passed' | 'blocked_as_expected' | 'not_run' | 'failed';

export type ContentAutoRunQaSafety = {
  qaReportOnly: true;
  sandboxOnlyByDefault: true;
  controlledRealAutoRunRequiresExplicitApproval: true;
  doesNotPublishFromReport: true;
  externalApiCalled: false;
  noDatabaseWrites: true;
  noActionStatusMutation: true;
  noTokenDecryption: true;
  rawTokenNotReturned: true;
  rawPayloadNotReturned: true;
  rollbackPayloadNotReturned: true;
  autoRunNotEnabledByThisPhase: true;
};

export type ContentAutoRunQaScenario = {
  name: ContentAutoRunQaScenarioName;
  status: ContentAutoRunQaScenarioStatus;
  passed: boolean;
  expected: string;
  actual: string;
  reason: string;
  safety: {
    externalApiCalled: false;
    publishCalled: false;
    databaseWritten: false;
    tokenAccessed: false;
    rawPayloadReturned: false;
  };
  evidence: Record<string, unknown>;
};

export type ContentAutoRunQaReportInput = {
  explicitFounderApprovalPhrase?: string | null;
  controlledRealAutoRunRequested?: boolean;
  controlledRealAutoRunExecutorEnabled?: boolean;
  sandboxExecutorPasses?: boolean;
  ruleMatchPasses?: boolean;
  capExceededPasses?: boolean;
  pauseActivePasses?: boolean;
};

export type ContentAutoRunQaReport = {
  phase: 'phase_11_10_auto_run_qa';
  healthMode: 'v2-phase-11-10-auto-run-qa';
  deliverable: 'safe_content_auto_run_qa';
  platform: 'linkedin';
  channel: 'linkedin_member_feed';
  actionType: 'content_publish';
  qaStatus: 'passed' | 'partial' | 'failed';
  realAutoRunExecuted: false;
  controlledRealAutoRunApprovalPhraseRequired: 'I APPROVE ONE CONTROLLED CONTENT AUTO-RUN TEST';
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    blockedAsExpectedScenarios: number;
    notRunScenarios: number;
    failedScenarios: number;
  };
  scenarios: ContentAutoRunQaScenario[];
  finalRecommendation: string;
  nextStepBeforeAnyRealAutoRun: string[];
  safety: ContentAutoRunQaSafety;
};

export type ContentAutoRunQaStatus = {
  phase: ContentAutoRunQaReport['phase'];
  healthMode: ContentAutoRunQaReport['healthMode'];
  enabled: true;
  deliverable: ContentAutoRunQaReport['deliverable'];
  testedScenarios: ContentAutoRunQaScenarioName[];
  controlledRealAutoRunApprovalPhraseRequired: ContentAutoRunQaReport['controlledRealAutoRunApprovalPhraseRequired'];
  safety: ContentAutoRunQaSafety;
};
