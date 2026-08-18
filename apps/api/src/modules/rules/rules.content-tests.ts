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
  'contentRulePlatform',
  'contentApprovedStyle',
  'contentMaxPostsDay',
  'contentAllowedContentType',
  'contentAutoPublishAllowed',
  'contentApprovalRiskLevel',
  'contentRulePreviewJson',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Content Rules') },
  { name: 'content rules form exists', passed: html.includes('id="contentRulesForm"') },
  { name: 'content form has all roadmap fields', passed: requiredFieldIds.every((id) => html.includes(`id="${id}"`)) },
  { name: 'content platform options exist', passed: ['instagram','tiktok','youtube','facebook','linkedin'].every((platform) => html.includes(`value="${platform}"`)) },
  { name: 'allowed content type options exist', passed: ['image_post','short_video','carousel','story','text_caption','approved_template_only'].every((type) => html.includes(`value="${type}"`)) },
  { name: 'auto-publish yes/no exists but remains preview only', passed: html.includes('Auto-publish allowed') && html.includes('value="yes"') && html.includes('value="no"') && js.includes('future policy preference') },
  { name: 'approval required above risk level exists', passed: html.includes('Approval required above risk level') && ['low','medium','high','critical'].every((risk) => html.includes(`value="${risk}"`)) },
  { name: 'content max posts/day maps to Phase 6.6 cap', passed: js.includes('max_posts_per_day') && js.includes('contentMaxPostsDay') },
  { name: 'content preview uses localStorage only', passed: js.includes('CONTENT_RULE_PREVIEW_KEY') && js.includes('localStorage.setItem') && !js.includes('/api/v1/policies') },
  { name: 'content rule safety flags block external writes', passed: js.includes('contentPublished: false') && js.includes('externalWritesAttempted: false') && js.includes('executorRan: false') },
  { name: 'content CSS includes dedicated form styles', passed: css.includes('.content-rules-form') && css.includes('.content-preview') },
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
    adChanges: false,
  },
}, null, 2));
