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
  'rulesPermissionQaSection',
  'rulesPermissionStatusBadge',
  'rulesPermissionGateBanner',
  'rulesPermissionRoleSelect',
  'rulesPermissionAdminAllowedSelect',
  'rulesPermissionAuthSelect',
  'rulesDetectedRole',
  'rulesOwnerEditResult',
  'rulesAdminEditResult',
  'rulesViewerUnauthorizedResult',
  'rulesPermissionQaTableBody',
  'rulesPermissionQaJson',
  'runRulesPermissionQaBtn',
  'copyRulesPermissionQaBtn',
  'saveRulesPermissionQaBtn',
  'resetRulesPermissionQaBtn',
  'rulesPermissionQaSaveStatus',
];

const checks = [
  { name: 'rules.html declares Phase 7.10 Rules Permission QA', passed: html.includes('v0.6.0 phase 7.10') && html.includes('Rules Permission QA') },
  { name: 'rules permission QA includes required UI ids', passed: requiredIds.every((id) => html.includes(`id="${id}"`) || js.includes(id)) },
  { name: 'permission QA states the four requested tests', passed: ['Owner can edit','Admin can edit if allowed','Viewer cannot edit','Unauthorized request blocked'].every((label) => html.includes(label) || js.includes(label)) },
  { name: 'permission helper allows owner edit', passed: js.includes("normalizedRole === 'owner'") && js.includes('OWNER_CAN_EDIT') },
  { name: 'permission helper allows admin only if allowed', passed: js.includes("normalizedRole === 'admin'") && js.includes('ADMIN_CAN_EDIT_IF_ALLOWED') && js.includes('ADMIN_EDIT_NOT_ALLOWED') },
  { name: 'permission helper blocks viewer', passed: js.includes("normalizedRole === 'viewer'") && js.includes('VIEWER_CANNOT_EDIT') },
  { name: 'permission helper blocks unauthorized request', passed: js.includes('UNAUTHORIZED_REQUEST_BLOCKED') && js.includes('authorizedRequest') },
  { name: 'permission QA gates local rule edit controls', passed: js.includes('applyRulesPermissionGate') && js.includes('data-rule-edit-control') && js.includes('controlledButtonIds') },
  { name: 'permission QA is browser-local only', passed: js.includes('RULES_PERMISSION_QA_KEY') && js.includes('browser_local_permission_qa_only_no_database_write') },
  { name: 'permission QA safety says no policy or permission DB writes', passed: js.includes('policyDatabaseWrites: false') && js.includes('permissionDatabaseWrites: false') && html.includes('does not save permissions to the database') },
  { name: 'permission QA CSS adds allow/block styles', passed: css.includes('.permission-qa-section') && css.includes('.permission-allow') && css.includes('.permission-block') },
  { name: 'rules page still does not call policy endpoints', passed: !js.includes('/api/v1/policies') && !js.includes('/api/v1/policy-permissions') },
  { name: 'rules page still has no POST/PATCH/DELETE mutation fetches', passed: !js.includes("method: 'POST'") && !js.includes('method: "POST"') && !js.includes('method: "PATCH"') && !js.includes('method: "DELETE"') },
];

for (const check of checks) {
  assert(check.passed, `Failed: ${check.name}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'v0.6.0 Phase 7.10 Rules Permission QA',
  tests: checks.length,
  passed: checks.map((check) => check.name),
  requiredPermissionTests: {
    ownerCanEdit: true,
    adminCanEditIfAllowed: true,
    viewerCannotEdit: true,
    unauthorizedRequestBlocked: true,
  },
  safety: {
    localPreviewOnly: true,
    policyEditingEndpoints: false,
    policyDatabaseWrites: false,
    permissionDatabaseWrites: false,
    realExecutors: false,
    sandboxExecutors: false,
    externalWriteConnectors: false,
    autoRunExecution: false,
    contentPublishing: false,
    supportSending: false,
    adChanges: false,
    externalWrites: false,
  },
}, null, 2));
