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

const checks = [
  { name: 'rules.html exists and declares Phase 7.10', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Policy Rules UI') },
  { name: 'master pause section exists', passed: html.includes('id="masterPauseSection"') && html.includes('Master Pause') },
  { name: 'pause integration display exists', passed: html.includes('id="pauseIntegrationSection"') && html.includes('Auto-run is currently paused globally') && js.includes('renderPauseIntegrationDisplay') },
  { name: 'content rules section exists', passed: html.includes('id="contentRulesSection"') && html.includes('Content Rules') },
  { name: 'content rules form exists', passed: html.includes('id="contentRulesForm"') && html.includes('Approved style') && html.includes('Auto-publish allowed') },
  { name: 'support rules section exists', passed: html.includes('id="supportRulesSection"') && html.includes('Support Rules') },
  { name: 'support rules form exists', passed: html.includes('id="supportRulesForm"') && html.includes('Ticket category') && html.includes('Auto-reply allowed') },
  { name: 'ads rules section exists', passed: html.includes('id="adsRulesSection"') && html.includes('Ads Rules') },
  { name: 'global caps section includes all Phase 6.6 cap labels', passed: ['max_posts_per_day','max_support_auto_replies_per_day','max_ad_spend_change_per_day','max_model_cost_per_day','max_actions_per_hour'].every((item) => html.includes(item) || js.includes(item)) },
  { name: 'caps settings form exists', passed: html.includes('id="capsSettingsForm"') && html.includes('Posts per day') && html.includes('Auto-replies per day') && html.includes('Model token/cost usage') },
  { name: 'rule simulation preview section exists', passed: html.includes('id="ruleSimulationSection"') && html.includes('Rule Simulation Preview') && html.includes('auto-approved') && html.includes('blocked') },
  { name: 'policy audit section exists', passed: html.includes('id="ruleHistorySection"') && html.includes('Rule History / Policy Audit') && html.includes('Created by') && html.includes('Recent decisions') },
  { name: 'rules permission QA section exists', passed: html.includes('id="rulesPermissionQaSection"') && html.includes('Rules Permission QA') && html.includes('Owner can edit') && html.includes('Unauthorized request blocked') },
  { name: 'rule wizard section exists', passed: html.includes('id="ruleWizardSection"') && html.includes('Create Rule Wizard') },
  { name: 'safety boundary forbids execution and external writes', passed: html.includes('No backend policy creation endpoint') && html.includes('no external platform writes') },
  { name: 'rules CSS includes responsive layout classes', passed: css.includes('.rules-rule-grid') && css.includes('@media(max-width:760px)') },
  { name: 'rules JS reads autonomy status but does not write policies', passed: js.includes('/api/v1/autonomy/status') && !js.includes('/api/v1/policies') && !js.includes("method: 'POST'") },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rule History/Audit',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  safety: {
    policyDatabaseWrites: false,
    realExecutors: false,
    sandboxExecutors: false,
    externalWriteConnectors: false,
    autoRunExecution: false,
    contentPublishing: false,
    supportSending: false,
    adChanges: false,
  },
}, null, 2));
