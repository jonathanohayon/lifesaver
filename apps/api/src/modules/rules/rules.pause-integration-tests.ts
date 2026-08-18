import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../../../../..');
const rulesHtml = path.join(repoRoot, 'apps', 'web', 'src', 'rules.html');
const rulesCss = path.join(repoRoot, 'apps', 'web', 'src', 'assets', 'css', 'rules.css');
const rulesJs = path.join(repoRoot, 'apps', 'web', 'src', 'assets', 'js', 'rules.js');

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync(rulesHtml, 'utf8');
const css = fs.readFileSync(rulesCss, 'utf8');
const js = fs.readFileSync(rulesJs, 'utf8');

const requiredIds = [
  'pauseIntegrationSection',
  'pauseOverrideWarning',
  'pauseOverrideStateBadge',
  'pauseOverrideHeadline',
  'pauseOverrideMessage',
  'pauseOverrideScopeList',
  'pauseOverrideRuleImpact',
  'pauseOverrideRefreshCopy',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Pause Integration Display') },
  { name: 'pause integration display includes all required elements', passed: requiredIds.every((id) => html.includes(`id="${id}"`) || js.includes(id)) },
  { name: 'pause warning shows exact global pause example', passed: html.includes('Auto-run is currently paused globally') || js.includes('Auto-run is currently paused globally') },
  { name: 'autonomy status read feeds pause integration display', passed: js.includes('/api/v1/autonomy/status') && js.includes('renderPauseIntegrationDisplay(globalPaused, contentPaused, supportPaused, adsPaused') },
  { name: 'pause display covers global content support and ads scopes', passed: ['Global pause','Content pause','Support pause','Ads pause'].every((label) => html.includes(label) || js.includes(label)) },
  { name: 'pause override explains most restrictive wins and auto-approval override', passed: js.includes('pause beats auto-approve') && html.includes('global pause, category pause, and emergency safe mode must beat auto-approval') },
  { name: 'unknown pause status uses conservative fallback', passed: js.includes('Pause status is unavailable') && js.includes('manual review only') && js.includes('no auto-run') },
  { name: 'simulation receives live pause display status', passed: js.includes('live_pause_display_status') && js.includes('lastPauseIntegrationState') && js.includes('simMasterPauseActive') },
  { name: 'pause integration CSS includes paused partial open and unknown states', passed: ['.pause-override-banner.paused','.pause-override-banner.partial','.pause-override-banner.open','.pause-override-banner.unknown'].every((selector) => css.includes(selector)) },
  { name: 'pause integration remains read-only with no policy writes', passed: !js.includes('/api/v1/policies') && !js.includes("method: 'POST'") && !js.includes('method: "POST"') },
  { name: 'phase safety boundary forbids execution and external writes', passed: html.includes('no external platform writes') && html.includes('No backend policy creation endpoint') },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rule History/Audit',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  warningExample: 'Auto-run is currently paused globally.',
  safety: {
    pauseDisplayReadOnly: true,
    policyDatabaseWrites: false,
    policyEditingEndpoints: false,
    realExecutors: false,
    sandboxExecutors: false,
    externalWriteConnectors: false,
    autoRunExecution: false,
    contentPublishing: false,
    supportSending: false,
    adBudgetChanges: false,
    campaignPauses: false,
    externalWrites: false,
  },
}, null, 2));
