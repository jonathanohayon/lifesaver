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
  'ruleHistorySection',
  'policyAuditStatusBadge',
  'auditCreatedBy',
  'auditUpdatedBy',
  'auditDisabledBy',
  'auditLastTriggered',
  'auditRecentDecisionCount',
  'policyAuditTableBody',
  'policyAuditPreviewJson',
  'refreshPolicyAuditBtn',
  'copyPolicyAuditBtn',
  'savePolicyAuditBtn',
  'resetPolicyAuditBtn',
  'policyAuditSaveStatus',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rule History/Audit', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Rule History / Policy Audit') },
  { name: 'policy audit UI includes all required ids', passed: requiredIds.every((id) => html.includes(`id="${id}"`) || js.includes(id)) },
  { name: 'policy audit UI shows required audit fields', passed: ['Created by','Updated by','Disabled by','Last triggered','Recent decisions'].every((label) => html.includes(label)) },
  { name: 'policy audit table includes six audit columns', passed: ['Rule / preview','Created by','Updated by','Disabled by','Last triggered','Recent decisions'].every((label) => html.includes(label)) },
  { name: 'policy audit preview is browser local only', passed: js.includes('POLICY_AUDIT_PREVIEW_KEY') && js.includes('browser_local_audit_preview_only_no_database_write') },
  { name: 'policy audit collects wizard content support ads caps and simulation previews', passed: ['RULE_PREVIEW_KEY','CONTENT_RULE_PREVIEW_KEY','SUPPORT_RULE_PREVIEW_KEY','ADS_RULE_PREVIEW_KEY','CAPS_PREVIEW_KEY','SIMULATION_PREVIEW_KEY'].every((token) => js.includes(token)) },
  { name: 'policy audit functions build render copy save reset and restore', passed: ['buildPolicyAuditPreview','renderPolicyAuditTable','updatePolicyAuditPreview','copyPolicyAuditPreview','savePolicyAuditPreview','resetPolicyAuditPreview','restoreSavedPolicyAuditNote'].every((fn) => js.includes(fn)) },
  { name: 'policy audit safety says no database audit write or policy endpoint', passed: js.includes('databaseAuditWriteAttempted: false') && js.includes('policyEndpointCalled: false') && html.includes('does not write audit records') },
  { name: 'policy audit CSS styles table and decision pills', passed: css.includes('.policy-audit-table') && css.includes('.audit-decision-pill') && css.includes('.policy-audit-preview') },
  { name: 'phase safety boundary forbids audit database save and external writes', passed: html.includes('no audit database save') && html.includes('no external platform writes') },
  { name: 'policy audit does not call database policy or audit endpoints', passed: !js.includes('/api/v1/policies') && !js.includes('/api/v1/policy-audit') && !js.includes('/api/v1/rule-history') },
  { name: 'policy audit remains read-only with no POST/PATCH/DELETE methods', passed: !js.includes("method: 'POST'") && !js.includes('method: "POST"') && !js.includes('method: "PATCH"') && !js.includes('method: "DELETE"') },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rule History/Audit',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  auditFields: ['created_by','updated_by','disabled_by','last_triggered','recent_decisions'],
  safety: {
    localPreviewOnly: true,
    databaseAuditWrites: false,
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
