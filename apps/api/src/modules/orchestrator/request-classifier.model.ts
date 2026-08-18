import type {
  RequestClassificationResult,
  RequestClassifierInput,
  RequestClassifierReport,
  RequestClassifierRoute,
  RequestClassifierRouteDefinition,
  RequestClassifierRouteScore,
  RequestClassifierSafety,
  RequestClassifierStatus,
} from './request-classifier.types.js';

export const REQUEST_CLASSIFIER_PHASE = 'phase_15_1_request_classifier' as const;
export const REQUEST_CLASSIFIER_HEALTH_MODE = 'v2-phase-15-1-request-classifier' as const;
export const REQUEST_CLASSIFIER_PACKAGE = 'lifesaver-v0.7.0-phase-15-1-request-classifier.zip' as const;

export const REQUEST_CLASSIFIER_ROUTES: RequestClassifierRoute[] = [
  'content',
  'ads',
  'support',
  'research',
  'dev',
  'metrics',
  'general_advisor',
];

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
];

const ROUTE_PRIORITY: Record<RequestClassifierRoute, number> = {
  support: 7,
  ads: 6,
  dev: 5,
  content: 4,
  metrics: 3,
  research: 2,
  general_advisor: 1,
};

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function safeJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return '';
  }
}

function containsAny(haystack: string, needles: string[]): string[] {
  return needles.filter((needle) => haystack.includes(needle.toLowerCase()));
}

function confidenceFor(score: number, issueCount: number): RequestClassificationResult['confidence'] {
  if (issueCount > 0) return 'low';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

export function buildRequestClassifierRouteDefinitions(): RequestClassifierRouteDefinition[] {
  return [
    {
      route: 'content',
      label: 'Content',
      specialistKey: 'content_specialist',
      purpose: 'Classifies requests about posts, captions, campaigns, creative drafts, publishing plans, and brand content review.',
      examples: ['Draft an Instagram caption for tomorrow.', 'Review this LinkedIn post before approval.', 'Create content ideas for the weekend.'],
      signalKeywords: ['post', 'caption', 'creative', 'content', 'publish', 'instagram', 'linkedin', 'tiktok', 'facebook', 'hashtags', 'reel', 'video script'],
      safeAllowedOutputsThisPhase: ['classification result', 'specialist route suggestion', 'safe next-step label'],
      forbiddenThisPhase: ['content publishing', 'content auto-run', 'external social API call', 'action execution'],
    },
    {
      route: 'ads',
      label: 'Ads',
      specialistKey: 'ads_specialist',
      purpose: 'Classifies requests about ad budgets, campaign/ad set status, paid media diagnostics, caps, rollback, and ads executor planning.',
      examples: ['Pause this ad set.', 'Should we adjust the campaign budget?', 'ROAS dropped; prepare an ads review.'],
      signalKeywords: ['adset', 'ad set', 'campaign', 'budget', 'meta ads', 'google ads', 'paid media', 'cpc', 'cpa', 'roas drop', 'pause campaign', 'adjust budget'],
      safeAllowedOutputsThisPhase: ['classification result', 'ads specialist suggestion', 'manual-review route label'],
      forbiddenThisPhase: ['budget mutation', 'campaign pause', 'ad set pause', 'provider API call', 'ads auto-run'],
    },
    {
      route: 'support',
      label: 'Support',
      specialistKey: 'support_specialist',
      purpose: 'Classifies requests and events related to customer tickets, support replies, Gmail/helpdesk threads, refunds, complaints, and escalations.',
      examples: ['Draft a reply to this refund ticket.', 'Classify this customer complaint.', 'Review the Gmail support thread.'],
      signalKeywords: ['support', 'ticket', 'reply', 'customer email', 'gmail', 'helpdesk', 'refund', 'cancellation', 'complaint', 'chargeback', 'thread'],
      safeAllowedOutputsThisPhase: ['classification result', 'support specialist suggestion', 'manual-review route label'],
      forbiddenThisPhase: ['send support reply', 'bulk send', 'auto-reply', 'external Gmail/helpdesk send'],
    },
    {
      route: 'research',
      label: 'Research',
      specialistKey: 'research_specialist',
      purpose: 'Classifies requests about market research, competitor research, product research, investigation, and strategic analysis.',
      examples: ['Research competitor offers.', 'Investigate why this product category is trending.', 'Find ideas for retention.'],
      signalKeywords: ['research', 'investigate', 'competitor', 'market', 'benchmark', 'trend', 'study', 'find', 'compare', 'analysis'],
      safeAllowedOutputsThisPhase: ['classification result', 'research specialist suggestion'],
      forbiddenThisPhase: ['external scraping job', 'scheduled proactive job', 'unapproved connector call'],
    },
    {
      route: 'dev',
      label: 'Dev',
      specialistKey: 'dev_specialist',
      purpose: 'Classifies engineering requests about bugs, deployments, GitHub, Render, Supabase, APIs, migrations, workers, and code changes.',
      examples: ['Debug the Render deployment.', 'Fix this TypeScript API error.', 'Prepare a database migration plan.'],
      signalKeywords: ['bug', 'code', 'deploy', 'github', 'render', 'supabase', 'postgres', 'database', 'api', 'worker', 'typescript', 'migration'],
      safeAllowedOutputsThisPhase: ['classification result', 'dev specialist suggestion'],
      forbiddenThisPhase: ['destructive migration', 'secret exposure', 'production write without approval'],
    },
    {
      route: 'metrics',
      label: 'Metrics',
      specialistKey: 'metrics_specialist',
      purpose: 'Classifies requests about Triple Whale metrics, KPIs, revenue, orders, AOV, ROAS, paid media spend, Daily Briefs, and Weekly Summaries.',
      examples: ['Summarize today’s revenue and ROAS.', 'Generate a Daily Brief.', 'What changed in orders this week?'],
      signalKeywords: ['metrics', 'revenue', 'orders', 'aov', 'roas', 'ad spend', 'triple whale', 'daily brief', 'weekly summary', 'kpi', 'dashboard'],
      safeAllowedOutputsThisPhase: ['classification result', 'metrics specialist suggestion'],
      forbiddenThisPhase: ['unverified metric fabrication', 'raw Triple Whale key exposure', 'external write'],
    },
    {
      route: 'general_advisor',
      label: 'General advisor',
      specialistKey: 'general_advisor',
      purpose: 'Fallback route for broad founder advice, prioritization, general strategy, and requests with no strong specialist signal.',
      examples: ['What should I focus on today?', 'Give me calm founder advice.', 'Help me decide next steps.'],
      signalKeywords: ['advice', 'strategy', 'prioritize', 'what should i do', 'next step', 'plan', 'general', 'help me decide'],
      safeAllowedOutputsThisPhase: ['classification result', 'general advisor fallback suggestion'],
      forbiddenThisPhase: ['autonomous execution', 'external write', 'hidden specialist action'],
    },
  ];
}

export function buildRequestClassifierSafety(): RequestClassifierSafety {
  return {
    classifierOnly: true,
    noSpecialistExecution: true,
    noToolRoutingExecution: true,
    noExternalConnectorCalled: true,
    noRealWorldActionCreated: true,
    noActionAutoApproved: true,
    noAutoRunEnabled: true,
    noContentPublished: true,
    noSupportReplySent: true,
    noAdsMutation: true,
    noDatabaseMigrationRequired: true,
    noRawSecretsReturned: true,
  };
}

function routeDefinitionsByRoute(): Record<RequestClassifierRoute, RequestClassifierRouteDefinition> {
  return Object.fromEntries(buildRequestClassifierRouteDefinitions().map((item) => [item.route, item])) as Record<RequestClassifierRoute, RequestClassifierRouteDefinition>;
}

function buildTextForScoring(input: RequestClassifierInput): string {
  return [
    cleanText(input.message),
    cleanText(input.event_type),
    cleanText(input.source),
    cleanText(input.context?.action_type),
    cleanText(input.context?.event_type),
    cleanText(input.context?.page),
    cleanText(input.context?.platform),
    cleanText(input.context?.channel),
    cleanText(input.context?.ticket_category),
    Array.isArray(input.context?.metric_names) ? input.context?.metric_names.join(' ').toLowerCase() : '',
    safeJson(input.context?.payload_preview),
  ].filter(Boolean).join(' | ');
}

function scoreRoute(route: RequestClassifierRoute, text: string, input: RequestClassifierInput): RequestClassifierRouteScore {
  const definition = routeDefinitionsByRoute()[route];
  const matchedSignals = containsAny(text, definition.signalKeywords);
  let score = matchedSignals.length;

  const actionType = cleanText(input.context?.action_type || input.event_type);
  const source = input.source || 'unknown';

  if (route === 'support' && source === 'support_ticket') score += 3;
  if (route === 'metrics' && source === 'metrics_event') score += 3;
  if (route === 'ads' && actionType.includes('ad_')) score += 3;
  if (route === 'ads' && ['pause_campaign', 'pause_adset', 'adjust_budget', 'restore_budget', 'reenable_campaign'].some((item) => actionType.includes(item))) score += 4;
  if (route === 'content' && actionType.includes('content')) score += 3;
  if (route === 'support' && actionType.includes('support_reply')) score += 4;
  if (route === 'dev' && actionType.includes('dev')) score += 3;
  if (route === 'research' && actionType.includes('research')) score += 3;

  // Prevent KPI-only questions containing “ad spend” or “ROAS” from being routed to ads unless an ads-control signal also exists.
  if (route === 'ads') {
    const controlSignals = containsAny(text, ['budget', 'campaign', 'adset', 'ad set', 'pause', 'adjust', 'meta ads', 'google ads', 'paid media']);
    const metricsOnlySignals = containsAny(text, ['revenue', 'orders', 'aov', 'metrics', 'dashboard', 'daily brief', 'weekly summary', 'kpi']);
    if (controlSignals.length === 0 && metricsOnlySignals.length > 0) score = Math.max(0, score - 2);
  }

  return {
    route,
    score,
    matchedSignals: uniq(matchedSignals),
  };
}

function chooseBestRoute(scores: RequestClassifierRouteScore[]): RequestClassifierRouteScore {
  const positive = scores.filter((item) => item.score > 0);
  if (positive.length === 0) {
    return { route: 'general_advisor', score: 1, matchedSignals: ['fallback'] };
  }
  return [...positive].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return ROUTE_PRIORITY[b.route] - ROUTE_PRIORITY[a.route];
  })[0];
}

function normalizeInput(input: unknown): { normalized: RequestClassifierInput; issues: string[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { normalized: {}, issues: ['Classifier input must be an object.'] };
  }
  const typed = input as RequestClassifierInput;
  return {
    normalized: {
      message: typeof typed.message === 'string' ? typed.message : undefined,
      source: typed.source,
      event_type: typeof typed.event_type === 'string' ? typed.event_type : undefined,
      context: typed.context && typeof typed.context === 'object' && !Array.isArray(typed.context) ? typed.context : undefined,
      force: typed.force === true,
    },
    issues: [],
  };
}

function safeNextStepFor(route: RequestClassifierRoute): string {
  switch (route) {
    case 'content': return 'Route to the future content specialist prompt pack for drafting/review only; do not publish from this classifier.';
    case 'ads': return 'Route to the future ads specialist prompt pack for analysis/planning only; do not mutate campaigns or budgets from this classifier.';
    case 'support': return 'Route to the future support specialist prompt pack for draft/review only; do not send a reply from this classifier.';
    case 'research': return 'Route to the future research specialist prompt pack for analysis planning only; do not start external jobs from this classifier.';
    case 'dev': return 'Route to the future dev specialist prompt pack for implementation planning only; do not run destructive migrations from this classifier.';
    case 'metrics': return 'Route to the future metrics specialist prompt pack for verified KPI explanation only; never invent metrics.';
    case 'general_advisor': return 'Use the LIFE.SAVER general advisor voice and ask for clarification when needed.';
  }
}

export function classifyLifeSaverRequest(input: unknown): RequestClassificationResult {
  const { normalized, issues } = normalizeInput(input);
  const warnings: string[] = [];
  const text = buildTextForScoring(normalized);
  if (normalized.force) warnings.push('force=true was ignored. Classification cannot execute tools, auto-run actions, or bypass safety gates.');
  if (!text.trim()) issues.push('No message, event_type, source, or context signals were supplied; using general advisor fallback.');

  const routeScores = REQUEST_CLASSIFIER_ROUTES.map((route) => scoreRoute(route, text, normalized));
  const best = chooseBestRoute(routeScores);
  const definition = routeDefinitionsByRoute()[best.route];
  const reasons = best.route === 'general_advisor' && best.matchedSignals.includes('fallback')
    ? ['No strong specialist signal was found, so LIFE.SAVER should answer through the calm general advisor route.']
    : [`Matched ${definition.label} route from signals: ${best.matchedSignals.join(', ') || 'context weighting'}.`];

  return {
    version: '0.7.0',
    phase: REQUEST_CLASSIFIER_PHASE,
    healthMode: REQUEST_CLASSIFIER_HEALTH_MODE,
    deliverable: 'request_classification_service',
    classificationOnly: true,
    route: best.route,
    routeLabel: definition.label,
    specialistKey: definition.specialistKey,
    confidence: confidenceFor(best.score, issues.length),
    score: best.score,
    matchedSignals: best.matchedSignals,
    reasons,
    warnings,
    issues,
    routeScores: routeScores.sort((a, b) => b.score - a.score),
    safeNextStep: safeNextStepFor(best.route),
    allowedToExecuteActionThisPhase: false,
    allowedToCallExternalConnectorThisPhase: false,
    allowedToAutoRunThisPhase: false,
    safeToolingBoundary: [
      'Phase 15.1 classifies only; it does not invoke specialist prompts yet.',
      'No external connector call is allowed from the classifier.',
      'No action row is created by the classifier.',
      'No action is approved, executed, or auto-run by the classifier.',
      'Future specialist routing must still obey approval, policies, pause, caps, result logs, and permissions.',
    ],
  };
}

export function buildRequestClassifierExampleInputs(): Record<RequestClassifierRoute, RequestClassifierInput> {
  return {
    content: { source: 'user_chat', message: 'Draft a LinkedIn post about this week’s ecommerce wins and keep it in review.' },
    ads: { source: 'user_chat', message: 'ROAS dropped. Prepare an ads review and check whether an ad set budget change should be proposed.', context: { action_type: 'adjust_budget', platform: 'meta_marketing_api' } },
    support: { source: 'support_ticket', message: 'Customer is asking for a refund. Draft a careful support reply for approval.', context: { ticket_category: 'refund', action_type: 'support_reply_send' } },
    research: { source: 'user_chat', message: 'Research competitor retention offers and summarize ideas we can safely consider.' },
    dev: { source: 'user_chat', message: 'Debug the Render deployment and check the API health endpoint.' },
    metrics: { source: 'metrics_event', message: 'Summarize revenue, orders, AOV, ROAS, and paid media spend for the Daily Brief.', context: { metric_names: ['revenue', 'orders', 'aov', 'roas', 'ad_spend'] } },
    general_advisor: { source: 'user_chat', message: 'Good morning. What should I focus on first today?' },
  };
}

export function buildRequestClassifierReport(): RequestClassifierReport {
  const exampleInputs = buildRequestClassifierExampleInputs();
  const exampleEvaluations = Object.fromEntries(
    REQUEST_CLASSIFIER_ROUTES.map((route) => [route, classifyLifeSaverRequest(exampleInputs[route])]),
  ) as Record<RequestClassifierRoute, RequestClassificationResult>;

  return {
    version: '0.7.0',
    phase: REQUEST_CLASSIFIER_PHASE,
    healthMode: REQUEST_CLASSIFIER_HEALTH_MODE,
    deliverable: 'request_classification_service',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 15.1 adds a deterministic request classifier that routes LIFE.SAVER requests/events to Content, Ads, Support, Research, Dev, Metrics, or General advisor. It is classifier-only and does not execute specialists, tools, connectors, or actions.',
    routeDefinitions: buildRequestClassifierRouteDefinitions(),
    exampleInputs,
    exampleEvaluations,
    safety: buildRequestClassifierSafety(),
    nextStep: 'Phase 15.2 — Specialist Prompt Packs',
  };
}

export function buildRequestClassifierStatus(): RequestClassifierStatus {
  return {
    phase: 'V2 Phase 15.1 — Request Classifier',
    healthMode: REQUEST_CLASSIFIER_HEALTH_MODE,
    deliverable: 'request_classification_service',
    routes: REQUEST_CLASSIFIER_ROUTES,
    classifierOnly: true,
    specialistExecutionEnabled: false,
    toolRoutingExecutionEnabled: false,
    externalConnectorCalled: false,
    realWorldActionCreated: false,
    actionAutoApproved: false,
    autoRunEnabled: false,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 15.2 — Specialist Prompt Packs',
  };
}

export function assertRequestClassifierSafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Request classifier output contains forbidden fragment: ${fragment}`);
    }
  }
}
