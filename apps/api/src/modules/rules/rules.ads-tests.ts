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
  'adsRulePlatform',
  'adsCampaignScope',
  'adsMaxDailyBudgetChange',
  'adsMaxPercentageChange',
  'adsAlwaysAskAboveThreshold',
  'adsPauseRules',
  'adsRulePreviewJson',
];

const requiredPlatforms = [
  'meta_ads',
  'google_ads',
  'tiktok_ads',
  'snapchat_ads',
  'pinterest_ads',
  'microsoft_ads',
  'internal_preview',
];

const requiredPauseRules = [
  'roas_below_threshold',
  'spend_above_cap',
  'tracking_anomaly',
  'creative_rejected',
  'landing_page_error',
  'manual_review_required',
  'unknown_performance_issue',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Ads Rules') },
  { name: 'ads rules form exists', passed: html.includes('id="adsRulesForm"') },
  { name: 'ads form has all roadmap fields', passed: requiredFieldIds.every((id) => html.includes(`id="${id}"`)) },
  { name: 'ad platform options exist', passed: requiredPlatforms.every((platform) => html.includes(`value="${platform}"`)) },
  { name: 'campaign scope options exist', passed: ['single_campaign','single_adset','campaign_group','account_review_only','named_safe_campaigns_only'].every((scope) => html.includes(`value="${scope}"`)) },
  { name: 'budget and percentage caps exist', passed: html.includes('Max daily budget change') && html.includes('Max percentage change') && js.includes('max_ad_spend_change_per_day') },
  { name: 'always ask threshold exists', passed: html.includes('Always ask above threshold') && js.includes('adsAlwaysAskAboveThreshold') && js.includes('amount_below') },
  { name: 'pause rules options exist', passed: requiredPauseRules.every((rule) => html.includes(`value="${rule}"`)) },
  { name: 'ads preview uses localStorage only', passed: js.includes('ADS_RULE_PREVIEW_KEY') && js.includes('localStorage.setItem') && !js.includes('/api/v1/policies') },
  { name: 'ads rule safety flags block ad execution and external writes', passed: js.includes('adBudgetChanged: false') && js.includes('campaignPaused: false') && js.includes('adConnectorAdded: false') && js.includes('externalWritesAttempted: false') },
  { name: 'ads CSS includes dedicated form styles', passed: css.includes('.ads-rules-form') && css.includes('.ads-preview') },
  { name: 'phase safety boundary forbids ad changes', passed: html.includes('no ad budget update') && html.includes('no campaign pause') && html.includes('no external platform writes') },
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
  safety: {
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
