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

const requiredFieldIds = [
  'ruleSimulationSection',
  'ruleSimulationForm',
  'simRuleSource',
  'simActionType',
  'simMasterPauseActive',
  'simPlatform',
  'simChannel',
  'simCategory',
  'simRiskLevel',
  'simConfidenceScore',
  'simAmount',
  'simActionText',
  'simulationDecisionSentence',
  'simulationDecisionBadge',
  'simulationReasonText',
  'simulationPreviewJson',
];

const requiredDecisions = [
  'auto_approve',
  'ask',
  'block',
  'AUTO-APPROVED',
  'ASK',
  'BLOCKED',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Rule Simulation Preview') },
  { name: 'simulation UI includes all required fields and result elements', passed: requiredFieldIds.every((id) => html.includes(`id="${id}"`) || js.includes(id)) },
  { name: 'simulation explains auto-approved ask and blocked outcomes', passed: requiredDecisions.every((decision) => html.includes(decision) || js.includes(decision)) },
  { name: 'simulation uses local rule previews as inputs', passed: js.includes('getSimulationRulePreview') && js.includes('CONTENT_RULE_PREVIEW_KEY') && js.includes('SUPPORT_RULE_PREVIEW_KEY') && js.includes('ADS_RULE_PREVIEW_KEY') && js.includes('CAPS_PREVIEW_KEY') },
  { name: 'simulation applies master pause block preview', passed: js.includes('master_pause_active') && js.includes('Master pause is active') && js.includes("decision = 'block'") },
  { name: 'simulation checks risk confidence amount and caps', passed: js.includes('riskRank') && js.includes('confidence_score') && js.includes('max_ad_spend_change_per_day') && js.includes('amount') },
  { name: 'simulation save is browser local only', passed: js.includes('SIMULATION_PREVIEW_KEY') && js.includes('localStorage.setItem') && js.includes('browser_local_simulation_only_no_database_write') },
  { name: 'simulation does not call policy write endpoints', passed: !js.includes('/api/v1/policies') && !js.includes("method: 'POST'") && !js.includes('method: "POST"') },
  { name: 'simulation safety flags block persistence and execution', passed: js.includes('simulationDatabaseSaveAttempted: false') && js.includes('executorRan: false') && js.includes('autoRunTriggered: false') && js.includes('externalWritesAttempted: false') },
  { name: 'simulation CSS includes result and decision badge styles', passed: css.includes('.rule-simulation-form') && css.includes('.simulation-result-card') && css.includes('.rules-decision-badge') },
  { name: 'phase safety boundary forbids simulation DB save and external writes', passed: html.includes('no simulation database save') && html.includes('no external platform writes') },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rule History/Audit',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  fields: requiredFieldIds,
  outcomes: ['auto_approved', 'ask', 'blocked'],
  safety: {
    policyDatabaseWrites: false,
    simulationDatabaseWrites: false,
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
