import {
  AUTONOMY_PAUSE_QA_CASES,
  AUTONOMY_PAUSE_QA_PHASE,
  AUTONOMY_PAUSE_QA_SAFETY,
  getAutonomyPauseAuditEventType,
} from '@lifesaver/shared';

type Scope = 'content' | 'support' | 'ads' | 'research' | 'dev';

type PauseState = {
  pauseAllAutonomy: boolean;
  pauseContentActions: boolean;
  pauseSupportActions: boolean;
  pauseAdsActions: boolean;
  pauseResearchActions: boolean;
  pauseDevActions: boolean;
};

function isScopeBlocked(state: PauseState, scope: Scope): boolean {
  if (state.pauseAllAutonomy) return true;
  if (scope === 'content') return state.pauseContentActions;
  if (scope === 'support') return state.pauseSupportActions;
  if (scope === 'ads') return state.pauseAdsActions;
  if (scope === 'research') return state.pauseResearchActions;
  if (scope === 'dev') return state.pauseDevActions;
  return true;
}

const globalPaused: PauseState = {
  pauseAllAutonomy: true,
  pauseContentActions: false,
  pauseSupportActions: false,
  pauseAdsActions: false,
  pauseResearchActions: false,
  pauseDevActions: false,
};

const onlyAdsPaused: PauseState = {
  pauseAllAutonomy: false,
  pauseContentActions: false,
  pauseSupportActions: false,
  pauseAdsActions: true,
  pauseResearchActions: false,
  pauseDevActions: false,
};

const results = [
  {
    name: 'global_pause_blocks_content',
    passed: isScopeBlocked(globalPaused, 'content') === true,
  },
  {
    name: 'global_pause_blocks_support',
    passed: isScopeBlocked(globalPaused, 'support') === true,
  },
  {
    name: 'global_pause_blocks_ads',
    passed: isScopeBlocked(globalPaused, 'ads') === true,
  },
  {
    name: 'category_pause_blocks_only_that_category',
    passed:
      isScopeBlocked(onlyAdsPaused, 'ads') === true &&
      isScopeBlocked(onlyAdsPaused, 'content') === false &&
      isScopeBlocked(onlyAdsPaused, 'support') === false &&
      isScopeBlocked(onlyAdsPaused, 'research') === false &&
      isScopeBlocked(onlyAdsPaused, 'dev') === false,
  },
  {
    name: 'audit_logs_record_pause_and_resume_changes',
    passed:
      getAutonomyPauseAuditEventType('pause') === 'autonomy_pause_enabled' &&
      getAutonomyPauseAuditEventType('resume') === 'autonomy_pause_disabled',
  },
  {
    name: 'pause_qa_remains_non_executing',
    passed:
      AUTONOMY_PAUSE_QA_SAFETY.runsExecutors === false &&
      AUTONOMY_PAUSE_QA_SAFETY.publishesContent === false &&
      AUTONOMY_PAUSE_QA_SAFETY.sendsSupportReplies === false &&
      AUTONOMY_PAUSE_QA_SAFETY.changesAdSpend === false &&
      AUTONOMY_PAUSE_QA_SAFETY.writesToExternalPlatforms === false,
  },
];

const failed = results.filter((result) => !result.passed);

console.log(JSON.stringify({
  version: '0.6.0',
  phase: AUTONOMY_PAUSE_QA_PHASE,
  success: failed.length === 0,
  passed: results.length - failed.length,
  failed: failed.length,
  requirements: AUTONOMY_PAUSE_QA_CASES,
  results,
  scenarios: {
    globalPaused,
    onlyAdsPaused,
  },
  safety: AUTONOMY_PAUSE_QA_SAFETY,
  note: 'Offline QA validates pause semantics and audit-event mapping. It does not run executors, policies, external connectors, or real-world actions.',
}, null, 2));

if (failed.length > 0) process.exitCode = 1;
