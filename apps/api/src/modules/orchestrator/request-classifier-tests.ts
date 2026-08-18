import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REQUEST_CLASSIFIER_HEALTH_MODE,
  REQUEST_CLASSIFIER_PACKAGE,
  REQUEST_CLASSIFIER_PHASE,
  REQUEST_CLASSIFIER_ROUTES,
  assertRequestClassifierSafe,
  buildRequestClassifierExampleInputs,
  buildRequestClassifierReport,
  buildRequestClassifierRouteDefinitions,
  buildRequestClassifierSafety,
  buildRequestClassifierStatus,
  classifyLifeSaverRequest,
} from './request-classifier.model.js';
import type { RequestClassifierRoute } from './request-classifier.types.js';

const EXPECTED_ROUTES: RequestClassifierRoute[] = [
  'content',
  'ads',
  'support',
  'research',
  'dev',
  'metrics',
  'general_advisor',
];

test('Phase 15.1 constants identify package and health mode', () => {
  assert.equal(REQUEST_CLASSIFIER_PHASE, 'phase_15_1_request_classifier');
  assert.equal(REQUEST_CLASSIFIER_HEALTH_MODE, 'v2-phase-15-1-request-classifier');
  assert.equal(REQUEST_CLASSIFIER_PACKAGE, 'lifesaver-v0.7.0-phase-15-1-request-classifier.zip');
});

test('classifier route registry includes exactly the roadmap routes', () => {
  assert.deepEqual([...REQUEST_CLASSIFIER_ROUTES].sort(), [...EXPECTED_ROUTES].sort());
});

test('route definitions exist for each specialist route', () => {
  const definitions = buildRequestClassifierRouteDefinitions();
  assert.equal(definitions.length, EXPECTED_ROUTES.length);
  assert.deepEqual(definitions.map((item) => item.route).sort(), [...EXPECTED_ROUTES].sort());
  assert.equal(definitions.every((item) => item.specialistKey.length > 0), true);
  assert.equal(definitions.every((item) => item.forbiddenThisPhase.length > 0), true);
});

test('safety report confirms classifier-only behavior', () => {
  const safety = buildRequestClassifierSafety();
  assert.equal(safety.classifierOnly, true);
  assert.equal(safety.noSpecialistExecution, true);
  assert.equal(safety.noToolRoutingExecution, true);
  assert.equal(safety.noExternalConnectorCalled, true);
  assert.equal(safety.noRealWorldActionCreated, true);
  assert.equal(safety.noActionAutoApproved, true);
  assert.equal(safety.noAutoRunEnabled, true);
  assert.equal(safety.noContentPublished, true);
  assert.equal(safety.noSupportReplySent, true);
  assert.equal(safety.noAdsMutation, true);
  assert.equal(safety.noDatabaseMigrationRequired, true);
});

test('content request classifies to content route', () => {
  const result = classifyLifeSaverRequest({ message: 'Draft an Instagram caption and keep the post in review.' });
  assert.equal(result.route, 'content');
  assert.equal(result.specialistKey, 'content_specialist');
  assert.equal(result.allowedToExecuteActionThisPhase, false);
});

test('ads control request classifies to ads route', () => {
  const result = classifyLifeSaverRequest({
    source: 'user_chat',
    message: 'ROAS dropped, prepare an ad set budget adjustment proposal.',
    context: { action_type: 'adjust_budget', platform: 'meta_marketing_api' },
  });
  assert.equal(result.route, 'ads');
  assert.equal(result.specialistKey, 'ads_specialist');
  assert.equal(result.allowedToCallExternalConnectorThisPhase, false);
});

test('support ticket classifies to support route', () => {
  const result = classifyLifeSaverRequest({
    source: 'support_ticket',
    message: 'Customer complaint asking for refund. Draft a reply for approval.',
    context: { action_type: 'support_reply_send', ticket_category: 'refund' },
  });
  assert.equal(result.route, 'support');
  assert.equal(result.specialistKey, 'support_specialist');
});

test('research request classifies to research route', () => {
  const result = classifyLifeSaverRequest({ message: 'Research competitor pricing and market trends.' });
  assert.equal(result.route, 'research');
});

test('dev request classifies to dev route', () => {
  const result = classifyLifeSaverRequest({ message: 'Debug the Render deploy and TypeScript API error.' });
  assert.equal(result.route, 'dev');
});

test('metrics request classifies to metrics route instead of ads when it is KPI-only', () => {
  const result = classifyLifeSaverRequest({
    source: 'metrics_event',
    message: 'Summarize revenue, orders, AOV, ROAS, and ad spend for the Daily Brief.',
  });
  assert.equal(result.route, 'metrics');
});

test('fallback request classifies to general advisor', () => {
  const result = classifyLifeSaverRequest({ message: 'Good morning. What should I focus on first today?' });
  assert.equal(result.route, 'general_advisor');
});

test('force=true is ignored and cannot enable execution', () => {
  const result = classifyLifeSaverRequest({ message: 'Force pause this campaign now.', force: true });
  assert.equal(result.route, 'ads');
  assert.equal(result.allowedToExecuteActionThisPhase, false);
  assert.equal(result.allowedToAutoRunThisPhase, false);
  assert.match(result.warnings.join(' '), /force=true/);
});

test('example inputs evaluate into every route', () => {
  const exampleInputs = buildRequestClassifierExampleInputs();
  for (const route of EXPECTED_ROUTES) {
    const result = classifyLifeSaverRequest(exampleInputs[route]);
    assert.equal(result.route, route);
    assert.doesNotThrow(() => assertRequestClassifierSafe(result));
  }
});

test('report includes all routes and next step', () => {
  const report = buildRequestClassifierReport();
  assert.equal(report.healthMode, REQUEST_CLASSIFIER_HEALTH_MODE);
  assert.equal(report.nextStep, 'Phase 15.2 — Specialist Prompt Packs');
  assert.deepEqual(Object.keys(report.exampleEvaluations).sort(), [...EXPECTED_ROUTES].sort());
  assert.equal(report.safety.noExternalConnectorCalled, true);
  assert.doesNotThrow(() => assertRequestClassifierSafe(report));
});

test('status is concise and safe', () => {
  const status = buildRequestClassifierStatus();
  assert.equal(status.healthMode, REQUEST_CLASSIFIER_HEALTH_MODE);
  assert.equal(status.deliverable, 'request_classification_service');
  assert.equal(status.specialistExecutionEnabled, false);
  assert.equal(status.toolRoutingExecutionEnabled, false);
  assert.equal(status.externalConnectorCalled, false);
  assert.equal(status.autoRunEnabled, false);
  assert.doesNotThrow(() => assertRequestClassifierSafe(status));
});

test('invalid or empty input fails closed to general advisor with low confidence', () => {
  const result = classifyLifeSaverRequest({});
  assert.equal(result.route, 'general_advisor');
  assert.equal(result.confidence, 'low');
  assert.ok(result.issues.some((issue) => issue.includes('No message')));
});

test('safe assertion rejects secret-like output', () => {
  assert.throws(() => assertRequestClassifierSafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertRequestClassifierSafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
