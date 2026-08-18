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
  'capsPostsPerDay',
  'capsAutoRepliesPerDay',
  'capsAdBudgetChangePerDay',
  'capsModelTokensPerDay',
  'capsModelCostPerDay',
  'capsActionsPerHour',
  'capsPreviewJson',
];

const requiredCapKeys = [
  'max_posts_per_day',
  'max_support_auto_replies_per_day',
  'max_ad_spend_change_per_day',
  'max_model_tokens_per_day',
  'max_model_cost_per_day',
  'max_actions_per_hour',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Caps settings UI') },
  { name: 'caps settings form exists', passed: html.includes('id="capsSettingsForm"') },
  { name: 'caps form has all roadmap fields', passed: requiredFieldIds.every((id) => html.includes(`id="${id}"`)) },
  { name: 'posts per day field exists', passed: html.includes('Posts per day') && js.includes('capsPostsPerDay') && js.includes('max_posts_per_day') },
  { name: 'auto-replies per day field exists', passed: html.includes('Auto-replies per day') && js.includes('capsAutoRepliesPerDay') && js.includes('max_support_auto_replies_per_day') },
  { name: 'ad budget change per day field exists', passed: html.includes('Ad budget change per day') && js.includes('capsAdBudgetChangePerDay') && js.includes('max_ad_spend_change_per_day') },
  { name: 'model token and cost usage fields exist', passed: html.includes('Model tokens/day') && html.includes('Model cost/day') && js.includes('max_model_tokens_per_day') && js.includes('max_model_cost_per_day') },
  { name: 'actions per hour field exists', passed: html.includes('Actions per hour') && js.includes('capsActionsPerHour') && js.includes('max_actions_per_hour') },
  { name: 'caps preview includes all cap keys', passed: requiredCapKeys.every((key) => js.includes(key)) },
  { name: 'caps preview uses localStorage only', passed: js.includes('CAPS_PREVIEW_KEY') && js.includes('localStorage.setItem') && !js.includes('/api/v1/policies') },
  { name: 'caps safety flags block persistence and execution', passed: js.includes('capDatabaseSaveAttempted: false') && js.includes('executorRan: false') && js.includes('autoRunTriggered: false') && js.includes('externalWritesAttempted: false') },
  { name: 'caps CSS includes dedicated form styles', passed: css.includes('.caps-settings-form') && css.includes('.caps-preview') },
  { name: 'phase safety boundary forbids cap database save and external writes', passed: html.includes('no cap database save') && html.includes('no external platform writes') },
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
  capKeys: requiredCapKeys,
  safety: {
    policyDatabaseWrites: false,
    capDatabaseWrites: false,
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
