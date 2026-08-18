import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE,
  CONTENT_AUTO_RUN_QA_HEALTH_MODE,
  CONTENT_AUTO_RUN_QA_PHASE,
  assertContentAutoRunQaSafe,
  buildContentAutoRunQaReport,
  buildContentAutoRunQaSafety,
  buildContentAutoRunQaStatus,
} from './content-auto-run-qa.model.js';

test('Phase 11.10 constants are correct', () => {
  assert.equal(CONTENT_AUTO_RUN_QA_PHASE, 'phase_11_10_auto_run_qa');
  assert.equal(CONTENT_AUTO_RUN_QA_HEALTH_MODE, 'v2-phase-11-10-auto-run-qa');
});

test('safety flags confirm report-only behavior', () => {
  const safety = buildContentAutoRunQaSafety();
  assert.equal(safety.qaReportOnly, true);
  assert.equal(safety.doesNotPublishFromReport, true);
  assert.equal(safety.externalApiCalled, false);
  assert.equal(safety.autoRunNotEnabledByThisPhase, true);
});

test('status exposes QA scenarios and required approval phrase', () => {
  const status = buildContentAutoRunQaStatus();
  assert.equal(status.deliverable, 'safe_content_auto_run_qa');
  assert.equal(status.testedScenarios.includes('sandbox_auto_run'), true);
  assert.equal(status.testedScenarios.includes('controlled_real_auto_run'), true);
  assert.equal(status.controlledRealAutoRunApprovalPhraseRequired, CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE);
  assert.doesNotThrow(() => assertContentAutoRunQaSafe(status));
});

test('default QA report covers all required scenarios', () => {
  const report = buildContentAutoRunQaReport();
  assert.equal(report.summary.totalScenarios, 5);
  assert.equal(report.scenarios.some((item) => item.name === 'sandbox_auto_run'), true);
  assert.equal(report.scenarios.some((item) => item.name === 'rule_match'), true);
  assert.equal(report.scenarios.some((item) => item.name === 'cap_exceeded'), true);
  assert.equal(report.scenarios.some((item) => item.name === 'pause_active'), true);
  assert.equal(report.scenarios.some((item) => item.name === 'controlled_real_auto_run'), true);
  assert.doesNotThrow(() => assertContentAutoRunQaSafe(report));
});

test('sandbox auto-run scenario passes without external calls', () => {
  const scenario = buildContentAutoRunQaReport().scenarios.find((item) => item.name === 'sandbox_auto_run');
  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.equal(scenario.safety.externalApiCalled, false);
  assert.equal(scenario.safety.publishCalled, false);
});

test('rule match scenario returns auto-approved decision evidence', () => {
  const scenario = buildContentAutoRunQaReport().scenarios.find((item) => item.name === 'rule_match');
  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.equal((scenario.evidence as any).finalDecision, 'auto_approved');
});

test('cap exceeded scenario blocks as expected', () => {
  const scenario = buildContentAutoRunQaReport().scenarios.find((item) => item.name === 'cap_exceeded');
  assert.ok(scenario);
  assert.equal(scenario.status, 'blocked_as_expected');
  assert.equal((scenario.evidence as any).capExceeded, true);
});

test('pause active scenario blocks as expected', () => {
  const scenario = buildContentAutoRunQaReport().scenarios.find((item) => item.name === 'pause_active');
  assert.ok(scenario);
  assert.equal(scenario.status, 'blocked_as_expected');
  assert.equal((scenario.evidence as any).finalDecision, 'blocked');
});

test('controlled real auto-run is not executed without exact approval phrase', () => {
  const scenario = buildContentAutoRunQaReport({ controlledRealAutoRunRequested: true, explicitFounderApprovalPhrase: 'approve' }).scenarios.find((item) => item.name === 'controlled_real_auto_run');
  assert.ok(scenario);
  assert.equal(scenario.status, 'not_run');
  assert.equal((scenario.evidence as any).exactApprovalPhraseProvided, false);
  assert.equal((scenario.evidence as any).realAutoRunExecutedByReport, false);
});

test('controlled real auto-run still not executed by report even with approval phrase', () => {
  const report = buildContentAutoRunQaReport({
    controlledRealAutoRunRequested: true,
    explicitFounderApprovalPhrase: CONTENT_AUTO_RUN_QA_APPROVAL_PHRASE,
    controlledRealAutoRunExecutorEnabled: true,
  });
  const scenario = report.scenarios.find((item) => item.name === 'controlled_real_auto_run');
  assert.ok(scenario);
  assert.equal(scenario.status, 'not_run');
  assert.equal((scenario.evidence as any).exactApprovalPhraseProvided, true);
  assert.equal((scenario.evidence as any).executorFlagProvided, true);
  assert.equal(report.realAutoRunExecuted, false);
  assert.doesNotThrow(() => assertContentAutoRunQaSafe(report));
});

test('QA report marks failed when a required scenario fails', () => {
  const report = buildContentAutoRunQaReport({ ruleMatchPasses: false });
  assert.equal(report.qaStatus, 'failed');
  assert.equal(report.summary.failedScenarios, 1);
});

test('QA output does not expose raw payload or token fields', () => {
  const report = buildContentAutoRunQaReport();
  const text = JSON.stringify(report).toLowerCase();
  assert.equal(text.includes('access_token'), false);
  assert.equal(text.includes('refresh_token'), false);
  assert.equal(text.includes('payload_json'), false);
  assert.equal(text.includes('rollback_payload'), false);
});

test('safe assertion rejects secret-like content', () => {
  const report = buildContentAutoRunQaReport();
  report.finalRecommendation = 'contains access_token accidentally';
  assert.throws(() => assertContentAutoRunQaSafe(report), /forbidden fragment/);
});
