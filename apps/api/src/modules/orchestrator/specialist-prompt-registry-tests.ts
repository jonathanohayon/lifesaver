import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPECIALIST_PROMPT_KEYS,
  SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
  SPECIALIST_PROMPT_REGISTRY_PACKAGE,
  SPECIALIST_PROMPT_REGISTRY_PHASE,
  SPECIALIST_PROMPT_ROUTES,
  assertSpecialistPromptRegistrySafe,
  buildSpecialistPromptExampleInputs,
  buildSpecialistPromptPacks,
  buildSpecialistPromptRegistryReport,
  buildSpecialistPromptRegistrySafety,
  buildSpecialistPromptRegistryStatus,
  buildSpecialistToolRegistry,
  previewSpecialistPromptPack,
} from './specialist-prompt-registry.model.js';
import type { SpecialistPromptKey, SpecialistPromptRoute } from './specialist-prompt-registry.types.js';

const EXPECTED_KEYS: SpecialistPromptKey[] = [
  'content_specialist',
  'ads_specialist',
  'support_specialist',
  'research_specialist',
  'dev_specialist',
];

const EXPECTED_ROUTES: SpecialistPromptRoute[] = [
  'content',
  'ads',
  'support',
  'research',
  'dev',
];

test('Phase 15.2 constants identify package and health mode', () => {
  assert.equal(SPECIALIST_PROMPT_REGISTRY_PHASE, 'phase_15_2_specialist_prompt_packs');
  assert.equal(SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE, 'v2-phase-15-2-specialist-prompt-packs');
  assert.equal(SPECIALIST_PROMPT_REGISTRY_PACKAGE, 'lifesaver-v0.7.0-phase-15-2-specialist-prompt-packs.zip');
});

test('specialist registry includes exactly the roadmap specialists', () => {
  assert.deepEqual([...SPECIALIST_PROMPT_KEYS].sort(), [...EXPECTED_KEYS].sort());
  assert.deepEqual([...SPECIALIST_PROMPT_ROUTES].sort(), [...EXPECTED_ROUTES].sort());
});

test('prompt packs preserve one LIFE.SAVER founder voice', () => {
  const packs = buildSpecialistPromptPacks();
  assert.equal(packs.length, EXPECTED_KEYS.length);
  for (const pack of packs) {
    assert.equal(pack.founderFacingVoice, 'life_saver_butler_voice');
    assert.match(pack.systemPrompt, /single LIFE\.SAVER/i);
    assert.ok(pack.forbiddenOutputsThisPhase.length > 0);
    assert.ok(pack.requiredSafetyGates.length > 0);
  }
});

test('tool registry is non-executing and approval-aware', () => {
  const tools = buildSpecialistToolRegistry();
  assert.ok(tools.length >= EXPECTED_KEYS.length);
  assert.equal(tools.every((tool) => tool.canCallExternalConnectorThisPhase === false), true);
  assert.equal(tools.every((tool) => tool.canCreateActionThisPhase === false), true);
  assert.equal(tools.every((tool) => tool.canApproveActionThisPhase === false), true);
  assert.equal(tools.every((tool) => tool.canExecuteActionThisPhase === false), true);
  assert.ok(tools.some((tool) => tool.availabilityThisPhase === 'future_proposed_action_only'));
});

test('safety report confirms registry-only behavior', () => {
  const safety = buildSpecialistPromptRegistrySafety();
  assert.equal(safety.promptRegistryOnly, true);
  assert.equal(safety.noClaudeCallFromRegistry, true);
  assert.equal(safety.noSpecialistExecution, true);
  assert.equal(safety.noToolInvocation, true);
  assert.equal(safety.noExternalConnectorCalled, true);
  assert.equal(safety.noActionCreated, true);
  assert.equal(safety.noAutoRunEnabled, true);
  assert.equal(safety.noContentPublished, true);
  assert.equal(safety.noSupportReplySent, true);
  assert.equal(safety.noAdsMutation, true);
  assert.equal(safety.oneLifeSaverVoicePreserved, true);
  assert.equal(safety.noDatabaseMigrationRequired, true);
});

test('preview resolves each roadmap route to the correct specialist prompt pack', () => {
  const routeToKey: Record<SpecialistPromptRoute, SpecialistPromptKey> = {
    content: 'content_specialist',
    ads: 'ads_specialist',
    support: 'support_specialist',
    research: 'research_specialist',
    dev: 'dev_specialist',
  };
  for (const route of EXPECTED_ROUTES) {
    const result = previewSpecialistPromptPack({ route, founderRequest: `Preview ${route}` });
    assert.equal(result.matched, true);
    assert.equal(result.route, route);
    assert.equal(result.specialistKey, routeToKey[route]);
    assert.equal(result.founderStillHears, 'LIFE.SAVER');
    assert.equal(result.allowedToInvokeToolThisPhase, false);
    assert.equal(result.allowedToExecuteSpecialistThisPhase, false);
    assert.equal(result.allowedToCallExternalConnectorThisPhase, false);
    assert.doesNotThrow(() => assertSpecialistPromptRegistrySafe(result));
  }
});

test('preview resolves explicit specialist key', () => {
  const result = previewSpecialistPromptPack({ specialistKey: 'ads_specialist', founderRequest: 'Prepare an ads review only.' });
  assert.equal(result.matched, true);
  assert.equal(result.route, 'ads');
  assert.equal(result.specialistKey, 'ads_specialist');
  assert.ok(result.toolCandidates.some((tool) => tool.toolName === 'ad_budget_adjust'));
});

test('metrics and general advisor are not Phase 15.2 specialist packs', () => {
  const metrics = previewSpecialistPromptPack({ route: 'metrics', founderRequest: 'Summarize revenue.' });
  assert.equal(metrics.matched, false);
  assert.ok(metrics.issues.some((issue) => issue.includes('Metrics/general advisor')));

  const general = previewSpecialistPromptPack({ route: 'general_advisor', founderRequest: 'Good morning.' });
  assert.equal(general.matched, false);
  assert.ok(general.issues.some((issue) => issue.includes('Metrics/general advisor')));
});

test('force=true is ignored and cannot enable routing execution', () => {
  const result = previewSpecialistPromptPack({ route: 'support', founderRequest: 'Force send this reply.', force: true });
  assert.equal(result.specialistKey, 'support_specialist');
  assert.equal(result.allowedToInvokeToolThisPhase, false);
  assert.equal(result.allowedToCreateActionThisPhase, false);
  assert.equal(result.allowedToAutoRunThisPhase, false);
  assert.match(result.warnings.join(' '), /force=true/);
});

test('example inputs cover every specialist', () => {
  const exampleInputs = buildSpecialistPromptExampleInputs();
  assert.deepEqual(Object.keys(exampleInputs).sort(), [...EXPECTED_KEYS].sort());
  for (const key of EXPECTED_KEYS) {
    const result = previewSpecialistPromptPack(exampleInputs[key]);
    assert.equal(result.specialistKey, key);
    assert.doesNotThrow(() => assertSpecialistPromptRegistrySafe(result));
  }
});

test('report includes prompt packs, tool registry, safety, and next step', () => {
  const report = buildSpecialistPromptRegistryReport();
  assert.equal(report.healthMode, SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE);
  assert.equal(report.nextStep, 'Phase 15.3 — Tool Routing');
  assert.deepEqual(report.promptPacks.map((item) => item.specialistKey).sort(), [...EXPECTED_KEYS].sort());
  assert.equal(report.safety.noExternalConnectorCalled, true);
  assert.equal(report.safety.oneLifeSaverVoicePreserved, true);
  assert.doesNotThrow(() => assertSpecialistPromptRegistrySafe(report));
});

test('status is concise and safe', () => {
  const status = buildSpecialistPromptRegistryStatus();
  assert.equal(status.healthMode, SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE);
  assert.equal(status.deliverable, 'specialist_prompt_tool_registry');
  assert.equal(status.specialistExecutionEnabled, false);
  assert.equal(status.toolInvocationEnabled, false);
  assert.equal(status.externalConnectorCalled, false);
  assert.equal(status.autoRunEnabled, false);
  assert.equal(status.oneLifeSaverVoicePreserved, true);
  assert.doesNotThrow(() => assertSpecialistPromptRegistrySafe(status));
});

test('invalid input fails closed without a matched specialist', () => {
  const result = previewSpecialistPromptPack({});
  assert.equal(result.matched, false);
  assert.equal(result.specialistKey, null);
  assert.equal(result.allowedToInvokeToolThisPhase, false);
  assert.ok(result.issues.some((issue) => issue.includes('No supported specialistKey')));
});

test('safe assertion rejects secret-like output', () => {
  assert.throws(() => assertSpecialistPromptRegistrySafe({ raw: 'refresh_token: secret' }), /forbidden fragment/);
  assert.throws(() => assertSpecialistPromptRegistrySafe({ raw_provider_payload: { id: 'x' } }), /forbidden fragment/);
});
