import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TOOL_ROUTING_HEALTH_MODE,
  TOOL_ROUTING_PACKAGE,
  TOOL_ROUTING_PHASE,
  assertToolRoutingSafe,
  buildToolRoutingExampleInputs,
  buildToolRoutingReport,
  buildToolRoutingRouteMap,
  buildToolRoutingSafety,
  buildToolRoutingStatus,
  previewToolRouting,
} from './tool-routing.model.js';
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

test('Phase 15.3 constants identify package and health mode', () => {
  assert.equal(TOOL_ROUTING_PHASE, 'phase_15_3_tool_routing');
  assert.equal(TOOL_ROUTING_HEALTH_MODE, 'v2-phase-15-3-tool-routing');
  assert.equal(TOOL_ROUTING_PACKAGE, 'lifesaver-v0.7.0-phase-15-3-tool-routing.zip');
});

test('safety report confirms routing-plan-only behavior', () => {
  const safety = buildToolRoutingSafety();
  assert.equal(safety.routingPlanOnly, true);
  assert.equal(safety.classifierUsedSafely, true);
  assert.equal(safety.promptRegistryUsedSafely, true);
  assert.equal(safety.noClaudeCallFromRouter, true);
  assert.equal(safety.noSpecialistExecution, true);
  assert.equal(safety.noToolInvocation, true);
  assert.equal(safety.noExternalConnectorCalled, true);
  assert.equal(safety.noActionCreated, true);
  assert.equal(safety.noActionApproved, true);
  assert.equal(safety.noExecutorCalled, true);
  assert.equal(safety.noAutoRunEnabled, true);
  assert.equal(safety.noContentPublished, true);
  assert.equal(safety.noSupportReplySent, true);
  assert.equal(safety.noAdsMutation, true);
  assert.equal(safety.noDatabaseMigrationRequired, true);
});

test('route map includes every classifier route', () => {
  const routeMap = buildToolRoutingRouteMap();
  assert.deepEqual(routeMap.map((item) => item.route).sort(), [...EXPECTED_ROUTES].sort());
  assert.equal(routeMap.every((item) => item.candidateTools.length > 0), true);
  assert.equal(routeMap.every((item) => item.selectedTool !== null), true);
  assert.equal(routeMap.every((item) => item.blockedActionsThisPhase.includes('tool invocation')), true);
});

test('content route selects content specialist draft tool without invocation', () => {
  const result = previewToolRouting({ message: 'Draft a LinkedIn post for approval.', preferredTool: 'draft_content' });
  assert.equal(result.classification.route, 'content');
  assert.equal(result.routingPlan.route, 'content');
  assert.equal(result.routingPlan.specialistKey, 'content_specialist');
  assert.equal(result.routingPlan.selectedTool?.toolName, 'draft_content');
  assert.equal(result.allowedToInvokeToolThisPhase, false);
  assert.equal(result.routingPlan.selectedTool?.canInvokeThisPhase, false);
});

test('ads route selects ads specialist toolset and blocks mutation', () => {
  const result = previewToolRouting({
    message: 'ROAS dropped. Prepare an ads budget recommendation, do not change anything.',
    context: { action_type: 'adjust_budget', platform: 'meta_marketing_api' },
    preferredTool: 'analyze_paid_media',
  });
  assert.equal(result.routingPlan.route, 'ads');
  assert.equal(result.routingPlan.specialistKey, 'ads_specialist');
  assert.equal(result.routingPlan.selectedTool?.toolName, 'analyze_paid_media');
  assert.equal(result.routingPlan.blockedActionsThisPhase.includes('budget mutation'), true);
  assert.equal(result.allowedToCallExternalConnectorThisPhase, false);
});

test('support route selects draft support reply and blocks sending', () => {
  const result = previewToolRouting({
    source: 'support_ticket',
    message: 'Customer complaint asking for refund. Draft a reply.',
    context: { ticket_category: 'refund', action_type: 'support_reply_send' },
    preferredTool: 'draft_support_reply',
  });
  assert.equal(result.routingPlan.route, 'support');
  assert.equal(result.routingPlan.specialistKey, 'support_specialist');
  assert.equal(result.routingPlan.selectedTool?.toolName, 'draft_support_reply');
  assert.equal(result.routingPlan.blockedActionsThisPhase.includes('support reply sending'), true);
});

test('research and dev routes resolve to their specialist toolsets', () => {
  const research = previewToolRouting({ message: 'Research competitor offers.', preferredTool: 'research_task' });
  const dev = previewToolRouting({ message: 'Debug the Render API deployment.', preferredTool: 'dev_task' });
  assert.equal(research.routingPlan.route, 'research');
  assert.equal(research.routingPlan.specialistKey, 'research_specialist');
  assert.equal(research.routingPlan.selectedTool?.toolName, 'research_task');
  assert.equal(dev.routingPlan.route, 'dev');
  assert.equal(dev.routingPlan.specialistKey, 'dev_specialist');
  assert.equal(dev.routingPlan.selectedTool?.toolName, 'dev_task');
});

test('metrics route uses read-only front-voice toolset, not a specialist prompt pack', () => {
  const result = previewToolRouting({
    source: 'metrics_event',
    message: 'Summarize revenue, orders, AOV, ROAS, and ad spend.',
    preferredTool: 'get_business_metrics',
  });
  assert.equal(result.routingPlan.route, 'metrics');
  assert.equal(result.routingPlan.handlerKind, 'metrics_read_only_toolset');
  assert.equal(result.routingPlan.specialistKey, 'metrics_front_voice');
  assert.equal(result.specialistPreview, null);
  assert.equal(result.routingPlan.selectedTool?.toolName, 'get_business_metrics');
  assert.equal(result.routingPlan.selectedTool?.canInvokeThisPhase, false);
});

test('general advisor fallback uses LIFE.SAVER front voice', () => {
  const result = previewToolRouting({ message: 'Good morning. What should I focus on first?' });
  assert.equal(result.routingPlan.route, 'general_advisor');
  assert.equal(result.routingPlan.handlerKind, 'general_advisor_front_voice');
  assert.equal(result.routingPlan.specialistKey, 'general_advisor');
  assert.equal(result.founderStillHears, 'LIFE.SAVER');
});

test('preferred route may override classifier only for preview routing', () => {
  const result = previewToolRouting({
    message: 'Good morning. What should I focus on first?',
    preferredRoute: 'ads',
    preferredTool: 'ad_budget_adjust',
  });
  assert.equal(result.classification.route, 'general_advisor');
  assert.equal(result.routingPlan.route, 'ads');
  assert.equal(result.routingPlan.selectedTool?.toolName, 'ad_budget_adjust');
  assert.ok(result.warnings.some((warning) => warning.includes('preferredRoute=ads')));
  assert.equal(result.allowedToCreateActionThisPhase, false);
});

test('force=true is ignored and cannot enable tools, connectors, actions, or auto-run', () => {
  const result = previewToolRouting({ message: 'Force pause this campaign now.', force: true, preferredTool: 'ad_budget_adjust' });
  assert.equal(result.routingPlan.route, 'ads');
  assert.equal(result.allowedToInvokeToolThisPhase, false);
  assert.equal(result.allowedToCallExternalConnectorThisPhase, false);
  assert.equal(result.allowedToCreateActionThisPhase, false);
  assert.equal(result.allowedToExecuteActionThisPhase, false);
  assert.equal(result.allowedToAutoRunThisPhase, false);
  assert.match(result.warnings.join(' '), /force=true/);
});

test('example inputs evaluate into every route and stay safe', () => {
  const examples = buildToolRoutingExampleInputs();
  for (const route of EXPECTED_ROUTES) {
    const result = previewToolRouting(examples[route]);
    assert.equal(result.routingPlan.route, route);
    assert.doesNotThrow(() => assertToolRoutingSafe(result));
  }
});

test('report includes route map, examples, safety, and next step', () => {
  const report = buildToolRoutingReport();
  assert.equal(report.healthMode, TOOL_ROUTING_HEALTH_MODE);
  assert.equal(report.nextStep, 'Phase 15.4 — Memory Table');
  assert.deepEqual(Object.keys(report.examplePreviews).sort(), [...EXPECTED_ROUTES].sort());
  assert.equal(report.safety.noToolInvocation, true);
  assert.equal(report.safety.noExternalConnectorCalled, true);
  assert.doesNotThrow(() => assertToolRoutingSafe(report));
});

test('status is concise and safe', () => {
  const status = buildToolRoutingStatus();
  assert.equal(status.healthMode, TOOL_ROUTING_HEALTH_MODE);
  assert.equal(status.deliverable, 'unified_orchestrator_routing');
  assert.equal(status.specialistExecutionEnabled, false);
  assert.equal(status.toolInvocationEnabled, false);
  assert.equal(status.externalConnectorCalled, false);
  assert.equal(status.autoRunEnabled, false);
  assert.equal(status.nextStep, 'Phase 15.4 — Memory Table');
  assert.doesNotThrow(() => assertToolRoutingSafe(status));
});

test('safe assertion rejects secret-like output', () => {
  assert.throws(() => assertToolRoutingSafe({ raw: 'access_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertToolRoutingSafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
