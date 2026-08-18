import {
  REQUEST_CLASSIFIER_ROUTES,
  assertRequestClassifierSafe,
  buildRequestClassifierExampleInputs,
  classifyLifeSaverRequest,
} from './request-classifier.model.js';
import type { RequestClassifierRoute } from './request-classifier.types.js';
import {
  assertSpecialistPromptRegistrySafe,
  previewSpecialistPromptPack,
} from './specialist-prompt-registry.model.js';
import type { SpecialistToolRegistryEntry } from './specialist-prompt-registry.types.js';
import type {
  ToolRoutingCandidateTool,
  ToolRoutingInput,
  ToolRoutingPlan,
  ToolRoutingPreviewResult,
  ToolRoutingReport,
  ToolRoutingSafety,
  ToolRoutingStatus,
} from './tool-routing.types.js';

export const TOOL_ROUTING_PHASE = 'phase_15_3_tool_routing' as const;
export const TOOL_ROUTING_HEALTH_MODE = 'v2-phase-15-3-tool-routing' as const;
export const TOOL_ROUTING_PACKAGE = 'lifesaver-v0.7.0-phase-15-3-tool-routing.zip' as const;

const SPECIALIST_ROUTES = ['content', 'ads', 'support', 'research', 'dev'] as const;

const FORBIDDEN_OUTPUT_FRAGMENTS = [
  'client_secret=',
  'client_secret:',
  'refresh_token=',
  'refresh_token:',
  'authorization: bearer',
  'bearer ',
  'raw_token',
  'access_token',
  'private_key',
  'claude_api_key',
  'triple_whale_api_key',
  'provider_raw_response',
  'raw_provider_payload',
  'raw_mime',
  'base64mime',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeRoutingInput(input: unknown): ToolRoutingInput {
  if (!isPlainObject(input)) return {};
  const typed = input as ToolRoutingInput;
  return {
    message: typeof typed.message === 'string' ? typed.message : typeof typed.founderRequest === 'string' ? typed.founderRequest : undefined,
    source: typed.source,
    event_type: typeof typed.event_type === 'string' ? typed.event_type : undefined,
    context: typed.context && typeof typed.context === 'object' && !Array.isArray(typed.context) ? typed.context : undefined,
    force: typed.force === true,
    preferredRoute: typed.preferredRoute,
    preferredTool: typeof typed.preferredTool === 'string' ? typed.preferredTool : undefined,
    founderRequest: typeof typed.founderRequest === 'string' ? typed.founderRequest : undefined,
    dryRun: typed.dryRun !== false,
  };
}

function isSpecialistRoute(route: RequestClassifierRoute): route is typeof SPECIALIST_ROUTES[number] {
  return SPECIALIST_ROUTES.includes(route as typeof SPECIALIST_ROUTES[number]);
}

function mapSpecialistTool(tool: SpecialistToolRegistryEntry): ToolRoutingCandidateTool {
  return {
    toolName: tool.toolName,
    label: tool.label,
    route: tool.route,
    handlerKind: 'specialist_prompt_pack',
    availabilityThisPhase: tool.availabilityThisPhase === 'future_proposed_action_only' ? 'future_proposed_action_only' : 'candidate_only_no_invocation',
    description: tool.description,
    canInvokeThisPhase: false,
    canCallExternalConnectorThisPhase: false,
    canCreateActionThisPhase: false,
    canApproveActionThisPhase: false,
    canExecuteActionThisPhase: false,
    requiresApprovalGateBeforeFutureUse: tool.requiresFutureApprovalGate,
    safetyNotes: tool.safetyNotes,
  };
}

function buildMetricsTools(): ToolRoutingCandidateTool[] {
  return [
    {
      toolName: 'get_business_metrics',
      label: 'Get business metrics',
      route: 'metrics',
      handlerKind: 'metrics_read_only_toolset',
      availabilityThisPhase: 'read_only_candidate_no_invocation',
      description: 'Read verified stored Triple Whale metrics context for future KPI explanation.',
      canInvokeThisPhase: false,
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresApprovalGateBeforeFutureUse: false,
      safetyNotes: ['Routing only in Phase 15.3.', 'Do not fetch raw Triple Whale payload from the router.', 'Never invent metrics.'],
    },
    {
      toolName: 'daily_brief_context',
      label: 'Daily Brief context',
      route: 'metrics',
      handlerKind: 'metrics_read_only_toolset',
      availabilityThisPhase: 'read_only_candidate_no_invocation',
      description: 'Candidate context for future Daily Brief explanation from stored metrics.',
      canInvokeThisPhase: false,
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresApprovalGateBeforeFutureUse: false,
      safetyNotes: ['Routing only.', 'Brief generation remains existing controlled service path.'],
    },
    {
      toolName: 'weekly_summary_context',
      label: 'Weekly Summary context',
      route: 'metrics',
      handlerKind: 'metrics_read_only_toolset',
      availabilityThisPhase: 'read_only_candidate_no_invocation',
      description: 'Candidate context for future Weekly Summary explanation from stored metrics.',
      canInvokeThisPhase: false,
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresApprovalGateBeforeFutureUse: false,
      safetyNotes: ['Routing only.', 'No direct Triple Whale API call from tool routing.'],
    },
  ];
}

function buildGeneralAdvisorTools(): ToolRoutingCandidateTool[] {
  return [
    {
      toolName: 'general_advisor_response',
      label: 'General advisor response',
      route: 'general_advisor',
      handlerKind: 'general_advisor_front_voice',
      availabilityThisPhase: 'candidate_only_no_invocation',
      description: 'Use the single LIFE.SAVER voice for broad founder prioritization or clarification.',
      canInvokeThisPhase: false,
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresApprovalGateBeforeFutureUse: false,
      safetyNotes: ['Routing only.', 'Ask for clarification when no safe specialist/toolset is obvious.'],
    },
  ];
}

function selectTool(candidateTools: ToolRoutingCandidateTool[], preferredTool?: string): { selectedTool: ToolRoutingCandidateTool | null; selectionReason: string } {
  const normalizedPreferredTool = cleanString(preferredTool);
  if (normalizedPreferredTool) {
    const matched = candidateTools.find((tool) => tool.toolName.toLowerCase() === normalizedPreferredTool);
    if (matched) return { selectedTool: matched, selectionReason: `Matched preferredTool=${matched.toolName}; this remains a non-invoked candidate in Phase 15.3.` };
    return { selectedTool: candidateTools[0] || null, selectionReason: `preferredTool was not available for this route, so the safest default candidate was selected without invocation.` };
  }
  const promptOnly = candidateTools.find((tool) => tool.availabilityThisPhase === 'candidate_only_no_invocation' || tool.availabilityThisPhase === 'read_only_candidate_no_invocation');
  return { selectedTool: promptOnly || candidateTools[0] || null, selectionReason: 'Selected the safest candidate tool for routing context only; no tool was invoked.' };
}

function gatesForRoute(route: RequestClassifierRoute): string[] {
  switch (route) {
    case 'content': return ['manual approval for real publishing', 'content pause check', 'policy/cap checks', 'result logs', 'rollback/unpublish plan where supported'];
    case 'ads': return ['manual approval for every ad action', 'ads hard caps', 'before/after snapshot', 'master pause/ads pause/emergency safe mode', 'rollback plan', 'no duplicate execution'];
    case 'support': return ['manual approval evidence', 'thread association', 'bulk-send guard', 'sensitive-ticket guard', 'send result logs', 'follow-up rollback policy'];
    case 'research': return ['source quality review', 'privacy review', 'manual approval for future external research jobs', 'audit trail'];
    case 'dev': return ['non-destructive migration rule', 'secret checks', 'build/tests', 'rollback plan', 'explicit approval for production writes'];
    case 'metrics': return ['verified stored metrics only', 'raw payload separation', 'no metric fabrication', 'no external write'];
    case 'general_advisor': return ['clarify if uncertain', 'do not execute hidden actions', 'route again if a specialist signal appears'];
  }
}

function blockedForRoute(route: RequestClassifierRoute): string[] {
  const common = ['tool invocation', 'external connector call', 'action creation', 'action approval', 'executor call', 'auto-run'];
  switch (route) {
    case 'content': return [...common, 'content publishing'];
    case 'ads': return [...common, 'campaign pause', 'ad set pause', 'budget mutation', 'campaign re-enable'];
    case 'support': return [...common, 'support reply sending', 'bulk send', 'auto-reply'];
    case 'research': return [...common, 'external scraping job', 'scheduled proactive research job'];
    case 'dev': return [...common, 'destructive migration', 'secret exposure', 'production write'];
    case 'metrics': return [...common, 'raw Triple Whale key exposure', 'unverified metrics'];
    case 'general_advisor': return [...common, 'hidden specialist execution'];
  }
}

function buildRoutePlan(route: RequestClassifierRoute, preferredTool?: string): { specialistPreview: ToolRoutingPreviewResult['specialistPreview']; routingPlan: ToolRoutingPlan; issues: string[] } {
  if (isSpecialistRoute(route)) {
    const specialistPreview = previewSpecialistPromptPack({ route });
    const candidateTools = specialistPreview.toolCandidates.map(mapSpecialistTool);
    const { selectedTool, selectionReason } = selectTool(candidateTools, preferredTool);
    return {
      specialistPreview,
      issues: specialistPreview.issues,
      routingPlan: {
        route,
        routeLabel: specialistPreview.label || route,
        handlerKind: 'specialist_prompt_pack',
        specialistKey: specialistPreview.specialistKey || 'general_advisor',
        specialistPromptPack: specialistPreview.promptPack,
        candidateTools,
        selectedTool,
        selectionReason,
        requiredSafetyGates: gatesForRoute(route),
        blockedActionsThisPhase: blockedForRoute(route),
        safeNextStep: `Route to ${specialistPreview.label || route} context and candidate toolset only. Phase 15.3 does not invoke tools or create actions.`,
      },
    };
  }

  const candidateTools = route === 'metrics' ? buildMetricsTools() : buildGeneralAdvisorTools();
  const { selectedTool, selectionReason } = selectTool(candidateTools, preferredTool);
  return {
    specialistPreview: null,
    issues: [],
    routingPlan: {
      route,
      routeLabel: route === 'metrics' ? 'Metrics' : 'General advisor',
      handlerKind: route === 'metrics' ? 'metrics_read_only_toolset' : 'general_advisor_front_voice',
      specialistKey: route === 'metrics' ? 'metrics_front_voice' : 'general_advisor',
      specialistPromptPack: null,
      candidateTools,
      selectedTool,
      selectionReason,
      requiredSafetyGates: gatesForRoute(route),
      blockedActionsThisPhase: blockedForRoute(route),
      safeNextStep: route === 'metrics'
        ? 'Route to verified metrics context only. Do not call Triple Whale directly or invent metrics from the router.'
        : 'Answer through the single LIFE.SAVER advisor voice or ask for clarification before specialist routing.',
    },
  };
}

export function buildToolRoutingSafety(): ToolRoutingSafety {
  return {
    routingPlanOnly: true,
    classifierUsedSafely: true,
    promptRegistryUsedSafely: true,
    noClaudeCallFromRouter: true,
    noSpecialistExecution: true,
    noToolInvocation: true,
    noExternalConnectorCalled: true,
    noActionCreated: true,
    noActionApproved: true,
    noExecutorCalled: true,
    noAutoRunEnabled: true,
    noContentPublished: true,
    noSupportReplySent: true,
    noAdsMutation: true,
    noDatabaseMigrationRequired: true,
    noRawSecretsReturned: true,
  };
}

export function previewToolRouting(input: unknown): ToolRoutingPreviewResult {
  const normalized = normalizeRoutingInput(input);
  const classification = classifyLifeSaverRequest(normalized);
  const warnings = [...classification.warnings];
  const issues = [...classification.issues];
  if (normalized.force === true) warnings.push('force=true was ignored by unified routing. It cannot invoke tools, call connectors, create actions, approve actions, execute actions, or auto-run.');

  let route = classification.route;
  if (normalized.preferredRoute && REQUEST_CLASSIFIER_ROUTES.includes(normalized.preferredRoute)) {
    if (normalized.preferredRoute !== classification.route) warnings.push(`preferredRoute=${normalized.preferredRoute} overrode classifier route=${classification.route} for preview routing only.`);
    route = normalized.preferredRoute;
  }

  const { specialistPreview, routingPlan, issues: routingIssues } = buildRoutePlan(route, normalized.preferredTool);
  issues.push(...routingIssues);
  const result: ToolRoutingPreviewResult = {
    version: '0.7.0',
    phase: TOOL_ROUTING_PHASE,
    healthMode: TOOL_ROUTING_HEALTH_MODE,
    deliverable: 'unified_orchestrator_routing',
    unifiedRoutingOnly: true,
    founderStillHears: 'LIFE.SAVER',
    classification,
    specialistPreview,
    routingPlan,
    warnings,
    issues,
    allowedToExecuteSpecialistThisPhase: false,
    allowedToInvokeToolThisPhase: false,
    allowedToCallExternalConnectorThisPhase: false,
    allowedToCreateActionThisPhase: false,
    allowedToApproveActionThisPhase: false,
    allowedToExecuteActionThisPhase: false,
    allowedToAutoRunThisPhase: false,
    safety: buildToolRoutingSafety(),
  };
  assertToolRoutingSafe(result);
  return result;
}

export function buildToolRoutingExampleInputs(): Record<RequestClassifierRoute, ToolRoutingInput> {
  const classifierExamples = buildRequestClassifierExampleInputs();
  return {
    content: { ...classifierExamples.content, preferredTool: 'draft_content' },
    ads: { ...classifierExamples.ads, preferredTool: 'analyze_paid_media' },
    support: { ...classifierExamples.support, preferredTool: 'draft_support_reply' },
    research: { ...classifierExamples.research, preferredTool: 'research_task' },
    dev: { ...classifierExamples.dev, preferredTool: 'dev_task' },
    metrics: { ...classifierExamples.metrics, preferredTool: 'get_business_metrics' },
    general_advisor: { ...classifierExamples.general_advisor, preferredTool: 'general_advisor_response' },
  };
}

export function buildToolRoutingRouteMap(): ToolRoutingPlan[] {
  const examples = buildToolRoutingExampleInputs();
  return REQUEST_CLASSIFIER_ROUTES.map((route) => previewToolRouting({ ...examples[route], preferredRoute: route }).routingPlan);
}

export function buildToolRoutingReport(): ToolRoutingReport {
  const exampleInputs = buildToolRoutingExampleInputs();
  const examplePreviews = Object.fromEntries(
    REQUEST_CLASSIFIER_ROUTES.map((route) => [route, previewToolRouting(exampleInputs[route])]),
  ) as Record<RequestClassifierRoute, ToolRoutingPreviewResult>;
  return {
    version: '0.7.0',
    phase: TOOL_ROUTING_PHASE,
    healthMode: TOOL_ROUTING_HEALTH_MODE,
    deliverable: 'unified_orchestrator_routing',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 15.3 combines the Phase 15.1 request classifier with the Phase 15.2 specialist prompt/tool registry to produce a unified routing plan. It selects a safe candidate specialist/toolset, but does not execute specialists, invoke tools, call connectors, create actions, approve actions, execute actions, or auto-run anything.',
    routeMap: buildToolRoutingRouteMap(),
    examplePreviews,
    safety: buildToolRoutingSafety(),
    nextStep: 'Phase 15.4 — Memory Table',
  };
}

export function buildToolRoutingStatus(): ToolRoutingStatus {
  return {
    phase: 'V2 Phase 15.3 — Tool Routing',
    healthMode: TOOL_ROUTING_HEALTH_MODE,
    deliverable: 'unified_orchestrator_routing',
    routes: REQUEST_CLASSIFIER_ROUTES,
    unifiedRoutingOnly: true,
    specialistExecutionEnabled: false,
    toolInvocationEnabled: false,
    externalConnectorCalled: false,
    realWorldActionCreated: false,
    actionAutoApproved: false,
    autoRunEnabled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 15.4 — Memory Table',
  };
}

export function assertToolRoutingSafe(value: unknown): void {
  assertRequestClassifierSafe(value);
  assertSpecialistPromptRegistrySafe(value);
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Tool routing output contains forbidden fragment: ${fragment}`);
    }
  }
}
