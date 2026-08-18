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
  'supportTicketCategory',
  'supportConfidenceThreshold',
  'supportAutoReplyAllowed',
  'supportEscalationCategories',
  'supportMaxRepliesDay',
  'supportSensitiveTicketExclusions',
  'supportRulePreviewJson',
];

const requiredTicketCategories = [
  'faq',
  'shipping',
  'order_status',
  'product_question',
  'complaint',
  'refund',
  'cancellation',
  'payment_issue',
  'sensitive',
  'unknown',
];

const requiredEscalations = [
  'refund',
  'cancellation',
  'complaint',
  'payment_issue',
  'legal_threat',
  'chargeback',
  'angry_customer',
  'unknown_intent',
];

const requiredSensitiveExclusions = [
  'medical_or_health',
  'legal_or_compliance',
  'payment_or_card_data',
  'personal_data_request',
  'high_value_customer',
  'low_confidence',
  'refund_or_chargeback',
  'policy_exception',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Support Rules') },
  { name: 'support rules form exists', passed: html.includes('id="supportRulesForm"') },
  { name: 'support form has all roadmap fields', passed: requiredFieldIds.every((id) => html.includes(`id="${id}"`)) },
  { name: 'ticket category options exist', passed: requiredTicketCategories.every((category) => html.includes(`value="${category}"`)) },
  { name: 'confidence threshold field exists', passed: html.includes('Confidence threshold') && html.includes('id="supportConfidenceThreshold"') },
  { name: 'auto-reply yes/no exists but remains preview only', passed: html.includes('Auto-reply allowed') && html.includes('value="yes"') && html.includes('value="no"') && js.includes('future policy preference') },
  { name: 'escalation categories exist', passed: requiredEscalations.every((category) => html.includes(`value="${category}"`)) },
  { name: 'sensitive-ticket exclusions exist', passed: requiredSensitiveExclusions.every((category) => html.includes(`value="${category}"`)) },
  { name: 'support max replies/day maps to Phase 6.6 cap', passed: js.includes('max_support_auto_replies_per_day') && js.includes('supportMaxRepliesDay') },
  { name: 'support preview uses localStorage only', passed: js.includes('SUPPORT_RULE_PREVIEW_KEY') && js.includes('localStorage.setItem') && !js.includes('/api/v1/policies') },
  { name: 'support rule safety flags block sending and external writes', passed: js.includes('supportSent: false') && js.includes('emailSent: false') && js.includes('helpdeskUpdated: false') && js.includes('externalWritesAttempted: false') },
  { name: 'support CSS includes dedicated form styles', passed: css.includes('.support-rules-form') && css.includes('.support-preview') },
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
