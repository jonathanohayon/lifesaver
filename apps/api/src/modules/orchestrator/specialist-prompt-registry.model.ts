import type {
  SpecialistPromptKey,
  SpecialistPromptPack,
  SpecialistPromptPreviewInput,
  SpecialistPromptPreviewResult,
  SpecialistPromptRegistryReport,
  SpecialistPromptRegistrySafety,
  SpecialistPromptRegistryStatus,
  SpecialistPromptRoute,
  SpecialistToolRegistryEntry,
} from './specialist-prompt-registry.types.js';

export const SPECIALIST_PROMPT_REGISTRY_PHASE = 'phase_15_2_specialist_prompt_packs' as const;
export const SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE = 'v2-phase-15-2-specialist-prompt-packs' as const;
export const SPECIALIST_PROMPT_REGISTRY_PACKAGE = 'lifesaver-v0.7.0-phase-15-2-specialist-prompt-packs.zip' as const;

export const SPECIALIST_PROMPT_KEYS: SpecialistPromptKey[] = [
  'content_specialist',
  'ads_specialist',
  'support_specialist',
  'research_specialist',
  'dev_specialist',
];

export const SPECIALIST_PROMPT_ROUTES: SpecialistPromptRoute[] = [
  'content',
  'ads',
  'support',
  'research',
  'dev',
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
  'raw_mime',
  'base64mime',
];

const ROUTE_TO_SPECIALIST: Record<SpecialistPromptRoute, SpecialistPromptKey> = {
  content: 'content_specialist',
  ads: 'ads_specialist',
  support: 'support_specialist',
  research: 'research_specialist',
  dev: 'dev_specialist',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeSpecialistKey(value: unknown): SpecialistPromptKey | null {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toLowerCase();
  return SPECIALIST_PROMPT_KEYS.includes(normalized as SpecialistPromptKey) ? normalized as SpecialistPromptKey : null;
}

function normalizeRoute(value: unknown): SpecialistPromptRoute | null {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toLowerCase();
  return SPECIALIST_PROMPT_ROUTES.includes(normalized as SpecialistPromptRoute) ? normalized as SpecialistPromptRoute : null;
}

function packFor(key: SpecialistPromptKey): SpecialistPromptPack {
  const pack = buildSpecialistPromptPacks().find((item) => item.specialistKey === key);
  if (!pack) throw new Error(`Missing specialist prompt pack: ${key}`);
  return pack;
}

function toolsFor(key: SpecialistPromptKey): SpecialistToolRegistryEntry[] {
  return buildSpecialistToolRegistry().filter((item) => item.specialistKey === key);
}

export function buildSpecialistPromptRegistrySafety(): SpecialistPromptRegistrySafety {
  return {
    promptRegistryOnly: true,
    noClaudeCallFromRegistry: true,
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
    oneLifeSaverVoicePreserved: true,
    noDatabaseMigrationRequired: true,
    noRawSecretsReturned: true,
  };
}

export function buildSpecialistPromptPacks(): SpecialistPromptPack[] {
  const sharedVoiceRules = [
    'The founder hears one LIFE.SAVER voice, not separate named bots.',
    'Use the calm, polished British-butler tone while keeping technical/business accuracy first.',
    'Explain recommendations clearly and ask for approval before any real-world action path.',
    'Do not claim a platform action happened unless an executor result confirms it.',
  ];

  return [
    {
      specialistKey: 'content_specialist',
      route: 'content',
      label: 'Content specialist',
      purpose: 'Plan, review, and draft ecommerce content while preserving brand voice and approval-first safety.',
      founderFacingVoice: 'life_saver_butler_voice',
      specialistInternalRole: 'Content strategist and brand-safe drafting specialist behind the single LIFE.SAVER voice.',
      systemPrompt: 'You are the LIFE.SAVER content specialist operating behind the single LIFE.SAVER founder voice. Draft, review, and improve content. Keep all publish/send behavior approval-first and never call social platform APIs from a prompt pack.',
      responseStyleRules: [...sharedVoiceRules, 'Content recommendations should include platform, objective, draft angle, risk notes, and approval status.'],
      requiredContext: ['brand voice', 'platform/channel', 'campaign objective', 'risk level', 'approval status', 'content draft or brief'],
      allowedOutputsThisPhase: ['draft outline', 'caption draft', 'content review notes', 'approval recommendation', 'proposed action planning notes'],
      forbiddenOutputsThisPhase: ['publishing content', 'calling LinkedIn/Meta/TikTok APIs', 'creating an executed action', 'bypassing approval', 'auto-run publishing'],
      requiredSafetyGates: ['manual approval for real publishing', 'content pause check', 'master pause check', 'policy/cap checks', 'result logs after any future executor'],
      escalationTriggers: ['regulated claim', 'unsupported guarantee', 'discount/compliance concern', 'high-risk platform content', 'missing media ownership proof'],
    },
    {
      specialistKey: 'ads_specialist',
      route: 'ads',
      label: 'Ads specialist',
      purpose: 'Analyze paid media, prepare safe ads recommendations, and plan future budget/control actions with hard caps.',
      founderFacingVoice: 'life_saver_butler_voice',
      specialistInternalRole: 'Ads analyst and risk controller behind the single LIFE.SAVER voice.',
      systemPrompt: 'You are the LIFE.SAVER ads specialist operating behind the single LIFE.SAVER founder voice. Analyze paid media and prepare safe recommendations. Never mutate campaigns, budgets, or ad sets from a prompt pack.',
      responseStyleRules: [...sharedVoiceRules, 'Ads recommendations must separate Triple Whale read-only metrics from direct ad-platform control actions.'],
      requiredContext: ['platform', 'account/campaign/adset identifiers', 'current budget', 'proposed budget', 'ROAS/ad spend context', 'hard caps', 'approval status'],
      allowedOutputsThisPhase: ['ads analysis', 'budget-change proposal', 'risk notes', 'cap-check explanation', 'rollback planning notes'],
      forbiddenOutputsThisPhase: ['changing budget', 'pausing campaign/adset', 're-enabling campaign/adset', 'calling Meta/Google Ads APIs', 'ads auto-run'],
      requiredSafetyGates: ['manual approval first', 'ads hard caps', 'before/after snapshot', 'master pause/ads pause/emergency safe mode', 'rollback plan', 'result logs'],
      escalationTriggers: ['hard cap exceeded', 'critical spend change', 'missing snapshot', 'provider warning', 'unverified platform account', 'possible duplicate execution'],
    },
    {
      specialistKey: 'support_specialist',
      route: 'support',
      label: 'Support specialist',
      purpose: 'Classify tickets, draft replies, protect customer data, and keep support sending approval-gated.',
      founderFacingVoice: 'life_saver_butler_voice',
      specialistInternalRole: 'Support quality and customer-care specialist behind the single LIFE.SAVER voice.',
      systemPrompt: 'You are the LIFE.SAVER support specialist operating behind the single LIFE.SAVER founder voice. Draft careful support replies and identify risks. Never send email/helpdesk replies from a prompt pack.',
      responseStyleRules: [...sharedVoiceRules, 'Support replies should be empathetic, accurate, thread-safe, and privacy-minimizing.'],
      requiredContext: ['ticket category', 'thread id', 'customer-safe summary', 'confidence score', 'sensitive flag', 'approval status'],
      allowedOutputsThisPhase: ['support draft', 'ticket classification notes', 'sensitive-ticket warning', 'thread-safety checklist', 'follow-up draft plan'],
      forbiddenOutputsThisPhase: ['sending support reply', 'bulk sends', 'auto-reply execution', 'raw ticket payload exposure', 'raw Gmail MIME/token exposure'],
      requiredSafetyGates: ['manual approval evidence', 'thread association', 'bulk-send guard', 'sensitive-ticket guard', 'send result logs', 'rollback/follow-up policy'],
      escalationTriggers: ['refund', 'cancellation', 'complaint', 'payment issue', 'legal issue', 'unknown intent', 'low confidence', 'medical/sensitive content'],
    },
    {
      specialistKey: 'research_specialist',
      route: 'research',
      label: 'Research specialist',
      purpose: 'Prepare market, competitor, product, and strategy research plans without starting external jobs automatically.',
      founderFacingVoice: 'life_saver_butler_voice',
      specialistInternalRole: 'Research analyst and strategic investigation specialist behind the single LIFE.SAVER voice.',
      systemPrompt: 'You are the LIFE.SAVER research specialist operating behind the single LIFE.SAVER founder voice. Plan and summarize research safely. Do not start external scraping, connector, or scheduled research jobs from a prompt pack.',
      responseStyleRules: [...sharedVoiceRules, 'Research output should distinguish verified facts, assumptions, and recommended next checks.'],
      requiredContext: ['research question', 'target market/product/competitor', 'known constraints', 'source requirements', 'decision being supported'],
      allowedOutputsThisPhase: ['research plan', 'hypothesis list', 'source checklist', 'decision memo outline', 'safe investigation steps'],
      forbiddenOutputsThisPhase: ['unapproved external scraping', 'scheduled proactive jobs', 'connector calls', 'claiming findings without sources', 'writing to external systems'],
      requiredSafetyGates: ['source quality checks', 'privacy review', 'manual approval for connector jobs', 'audit trail for future proactive work'],
      escalationTriggers: ['legal/compliance research', 'medical/financial claims', 'customer personal data', 'unclear source reliability', 'high-cost research request'],
    },
    {
      specialistKey: 'dev_specialist',
      route: 'dev',
      label: 'Dev specialist',
      purpose: 'Plan engineering changes, debug deployments, and protect production systems while mentoring a beginner-friendly workflow.',
      founderFacingVoice: 'life_saver_butler_voice',
      specialistInternalRole: 'Senior full-stack engineering specialist behind the single LIFE.SAVER voice.',
      systemPrompt: 'You are the LIFE.SAVER dev specialist operating behind the single LIFE.SAVER founder voice. Provide practical implementation plans, file-level guidance, security notes, and tests. Do not run destructive migrations or expose secrets.',
      responseStyleRules: [...sharedVoiceRules, 'Developer guidance must include what, why, files, code scope, tests, security notes, and common mistakes.'],
      requiredContext: ['package/version', 'affected files', 'environment', 'logs/errors', 'migration status', 'deployment target'],
      allowedOutputsThisPhase: ['implementation plan', 'code review notes', 'safe migration plan', 'test plan', 'deployment checklist'],
      forbiddenOutputsThisPhase: ['destructive migration without explicit approval', 'secret exposure', 'production write without approval', 'npm audit fix --force suggestion', 'removing working logic casually'],
      requiredSafetyGates: ['non-destructive migrations', 'env/secret checks', 'build/tests before deploy', 'rollback plan', 'Render/live URL checks'],
      escalationTriggers: ['production outage', 'database migration', 'secret leakage risk', 'auth/CORS changes', 'payment/ads/support executor risk'],
    },
  ];
}

export function buildSpecialistToolRegistry(): SpecialistToolRegistryEntry[] {
  return [
    {
      specialistKey: 'content_specialist',
      route: 'content',
      toolName: 'draft_content',
      label: 'Draft content',
      description: 'Prepare content drafts and review notes only.',
      availabilityThisPhase: 'allowed_prompt_context_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['Drafting only.', 'Publishing remains executor/approval gated.'],
    },
    {
      specialistKey: 'content_specialist',
      route: 'content',
      toolName: 'content_publish',
      label: 'Future content publish action',
      description: 'Future proposed action/executor lane for approved publishing.',
      availabilityThisPhase: 'future_proposed_action_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['Prompt pack cannot publish.', 'Manual approval and result logs required.'],
    },
    {
      specialistKey: 'ads_specialist',
      route: 'ads',
      toolName: 'analyze_paid_media',
      label: 'Analyze paid media',
      description: 'Explain ads metrics and prepare recommendations without provider mutation.',
      availabilityThisPhase: 'allowed_prompt_context_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: false,
      safetyNotes: ['Triple Whale remains read-only.', 'Direct ad platforms are not called.'],
    },
    {
      specialistKey: 'ads_specialist',
      route: 'ads',
      toolName: 'ad_budget_adjust',
      label: 'Future ad budget adjust action',
      description: 'Future proposed action/executor lane for budget changes.',
      availabilityThisPhase: 'future_proposed_action_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['No budget mutation from prompts.', 'Hard caps, snapshots, rollback, and manual approval required.'],
    },
    {
      specialistKey: 'support_specialist',
      route: 'support',
      toolName: 'draft_support_reply',
      label: 'Draft support reply',
      description: 'Prepare support replies for review only.',
      availabilityThisPhase: 'allowed_prompt_context_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['Drafting only.', 'No Gmail/helpdesk send from prompt registry.'],
    },
    {
      specialistKey: 'support_specialist',
      route: 'support',
      toolName: 'support_reply_send',
      label: 'Future support send action',
      description: 'Future proposed action/executor lane for approved support sending.',
      availabilityThisPhase: 'future_proposed_action_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['Prompt registry cannot send.', 'Thread association, bulk guard, sensitive guard, and result logs required.'],
    },
    {
      specialistKey: 'research_specialist',
      route: 'research',
      toolName: 'research_task',
      label: 'Research planning',
      description: 'Prepare research plans and safe investigation steps.',
      availabilityThisPhase: 'allowed_prompt_context_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['No external scraping or scheduled job from prompt registry.', 'Future external research jobs require approval/audit.'],
    },
    {
      specialistKey: 'dev_specialist',
      route: 'dev',
      toolName: 'dev_task',
      label: 'Development planning',
      description: 'Prepare file-level implementation, debugging, and deployment guidance.',
      availabilityThisPhase: 'allowed_prompt_context_only',
      canCallExternalConnectorThisPhase: false,
      canCreateActionThisPhase: false,
      canApproveActionThisPhase: false,
      canExecuteActionThisPhase: false,
      requiresFutureApprovalGate: true,
      safetyNotes: ['No destructive migrations.', 'No secret exposure.', 'No production write without explicit approval.'],
    },
  ];
}

export function buildSpecialistPromptExampleInputs(): Record<SpecialistPromptKey, SpecialistPromptPreviewInput> {
  return {
    content_specialist: { route: 'content', founderRequest: 'Draft a LinkedIn post for this week and keep it approval-first.' },
    ads_specialist: { route: 'ads', founderRequest: 'ROAS dropped. Prepare an ads budget recommendation, but do not change anything.', context: { action_type: 'adjust_budget' } },
    support_specialist: { route: 'support', founderRequest: 'Draft a reply to this refund ticket for approval.', context: { ticket_category: 'refund' } },
    research_specialist: { route: 'research', founderRequest: 'Research competitor retention offers and prepare a safe summary plan.' },
    dev_specialist: { route: 'dev', founderRequest: 'Plan the next package safely and tell me exact files and tests.' },
  };
}

function resolveSpecialist(input: SpecialistPromptPreviewInput): { key: SpecialistPromptKey | null; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (input.force === true) warnings.push('force=true was ignored. Prompt packs cannot execute specialists, invoke tools, call connectors, create actions, or bypass approval.');

  const explicitKey = normalizeSpecialistKey(input.specialistKey);
  if (explicitKey) return { key: explicitKey, issues, warnings };

  const route = normalizeRoute(input.route);
  if (route) return { key: ROUTE_TO_SPECIALIST[route], issues, warnings };

  if (isNonEmptyString(input.route) && ['metrics', 'general_advisor'].includes(input.route.trim().toLowerCase())) {
    issues.push('Phase 15.2 defines specialist prompt packs for content, ads, support, research, and dev only. Metrics/general advisor remain LIFE.SAVER front-voice routes for now.');
    return { key: null, issues, warnings };
  }

  issues.push('No supported specialistKey or route was supplied. Use content, ads, support, research, or dev.');
  return { key: null, issues, warnings };
}

export function previewSpecialistPromptPack(input: unknown): SpecialistPromptPreviewResult {
  const typed = isPlainObject(input) ? input as unknown as SpecialistPromptPreviewInput : {};
  const { key, issues, warnings } = resolveSpecialist(typed);
  const safety = buildSpecialistPromptRegistrySafety();

  if (!key) {
    return {
      version: '0.7.0',
      phase: SPECIALIST_PROMPT_REGISTRY_PHASE,
      healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
      deliverable: 'specialist_prompt_tool_registry',
      promptRegistryOnly: true,
      matched: false,
      specialistKey: null,
      route: null,
      label: null,
      founderStillHears: 'LIFE.SAVER',
      voiceBoundary: 'The founder still hears the single LIFE.SAVER voice. No specialist is executed by this registry.',
      promptPack: null,
      toolCandidates: [],
      safeNextStep: 'Ask for a supported route or let Phase 15.1 classify the request first.',
      warnings,
      issues,
      allowedToExecuteSpecialistThisPhase: false,
      allowedToInvokeToolThisPhase: false,
      allowedToCallExternalConnectorThisPhase: false,
      allowedToCreateActionThisPhase: false,
      allowedToAutoRunThisPhase: false,
      safety,
    };
  }

  const promptPack = packFor(key);
  const toolCandidates = toolsFor(key);
  return {
    version: '0.7.0',
    phase: SPECIALIST_PROMPT_REGISTRY_PHASE,
    healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
    deliverable: 'specialist_prompt_tool_registry',
    promptRegistryOnly: true,
    matched: true,
    specialistKey: promptPack.specialistKey,
    route: promptPack.route,
    label: promptPack.label,
    founderStillHears: 'LIFE.SAVER',
    voiceBoundary: 'The specialist prompt pack is internal routing context only. The founder-facing response stays in the single LIFE.SAVER butler voice.',
    promptPack,
    toolCandidates,
    safeNextStep: `Use ${promptPack.label} prompt context for planning/drafting only. Phase 15.3 must add safe tool routing before any tool can be invoked.`,
    warnings,
    issues,
    allowedToExecuteSpecialistThisPhase: false,
    allowedToInvokeToolThisPhase: false,
    allowedToCallExternalConnectorThisPhase: false,
    allowedToCreateActionThisPhase: false,
    allowedToAutoRunThisPhase: false,
    safety,
  };
}

export function buildSpecialistPromptRegistryReport(): SpecialistPromptRegistryReport {
  const exampleInputs = buildSpecialistPromptExampleInputs();
  return {
    version: '0.7.0',
    phase: SPECIALIST_PROMPT_REGISTRY_PHASE,
    healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
    deliverable: 'specialist_prompt_tool_registry',
    generatedAt: new Date().toISOString(),
    executiveSummary: 'Phase 15.2 defines internal specialist prompt packs and a safe tool registry for Content, Ads, Support, Research, and Dev. The founder still hears one LIFE.SAVER voice. This registry does not execute specialists, invoke tools, call connectors, create actions, approve actions, or auto-run anything.',
    promptPacks: buildSpecialistPromptPacks(),
    toolRegistry: buildSpecialistToolRegistry(),
    examplePreviews: Object.fromEntries(
      SPECIALIST_PROMPT_KEYS.map((key) => [key, previewSpecialistPromptPack(exampleInputs[key])]),
    ) as Record<SpecialistPromptKey, SpecialistPromptPreviewResult>,
    safety: buildSpecialistPromptRegistrySafety(),
    nextStep: 'Phase 15.3 — Tool Routing',
  };
}

export function buildSpecialistPromptRegistryStatus(): SpecialistPromptRegistryStatus {
  return {
    phase: 'V2 Phase 15.2 — Specialist Prompt Packs',
    healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
    deliverable: 'specialist_prompt_tool_registry',
    specialists: SPECIALIST_PROMPT_KEYS,
    routes: SPECIALIST_PROMPT_ROUTES,
    promptRegistryOnly: true,
    specialistExecutionEnabled: false,
    toolInvocationEnabled: false,
    externalConnectorCalled: false,
    realWorldActionCreated: false,
    autoRunEnabled: false,
    oneLifeSaverVoicePreserved: true,
    noDatabaseMigrationRequired: true,
    nextStep: 'Phase 15.3 — Tool Routing',
  };
}

export function assertSpecialistPromptRegistrySafe(value: unknown): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const fragment of FORBIDDEN_OUTPUT_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Specialist prompt registry output contains forbidden fragment: ${fragment}`);
    }
  }
}
