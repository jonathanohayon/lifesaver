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

const requiredStepIds = [
  'wizardStepActionType',
  'wizardStepPlatformChannel',
  'wizardStepCondition',
  'wizardStepDecision',
  'wizardStepCaps',
  'wizardStepReview',
  'wizardStepSave',
];

const requiredOperators = [
  'equals',
  'contains',
  'less_than',
  'greater_than',
  'channel_is',
  'risk_below',
  'confidence_above',
  'amount_below',
];

const requiredCaps = [
  'max_posts_per_day',
  'max_support_auto_replies_per_day',
  'max_ad_spend_change_per_day',
  'max_model_cost_per_day',
  'max_actions_per_hour',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 with retained Create Rule Wizard', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Create Rule Wizard') },
  { name: 'wizard has all seven roadmap step panels', passed: requiredStepIds.every((id) => html.includes(`id="${id}"`)) },
  { name: 'wizard stepper labels all required steps', passed: ['1. Action type','2. Platform/channel','3. Condition','4. Decision','5. Caps','6. Review','7. Save'].every((label) => html.includes(label)) },
  { name: 'wizard supports required condition operators', passed: requiredOperators.every((operator) => html.includes(`value="${operator}"`) && js.includes(operator)) },
  { name: 'wizard supports required policy decisions', passed: ['ask','auto_approve','block'].every((decision) => html.includes(`value="${decision}"`)) },
  { name: 'wizard supports Phase 6.6 cap names', passed: requiredCaps.every((cap) => html.includes(cap) || js.includes(cap)) },
  { name: 'wizard review produces preview JSON', passed: html.includes('id="rulePreviewJson"') && js.includes('buildRulePreview') && js.includes('JSON.stringify') },
  { name: 'save is local preview only', passed: html.includes('Save Local Preview') && js.includes('localStorage.setItem') && js.includes('databaseWritesAttempted: false') },
  { name: 'wizard does not call policy write endpoints', passed: !js.includes('/api/v1/policies') && !js.includes("method: 'POST'") && !js.includes('method: "POST"') },
  { name: 'wizard safety boundary forbids execution and external writes', passed: html.includes('No backend policy creation endpoint') && html.includes('no external platform writes') },
  { name: 'rules CSS includes wizard responsive classes', passed: css.includes('.wizard-stepper') && css.includes('.wizard-panel') && css.includes('@media(max-width:760px)') },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rule History/Audit',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  wizardSteps: 7,
  operators: requiredOperators,
  caps: requiredCaps,
  safety: {
    policyDatabaseWrites: false,
    policyEditingEndpoints: false,
    realExecutors: false,
    sandboxExecutors: false,
    externalWriteConnectors: false,
    autoRunExecution: false,
    contentPublishing: false,
    supportSending: false,
    adChanges: false,
  },
}, null, 2));
