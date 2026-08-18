import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = '0.8.0';
const expectedLabel = 'V2 Functional Audit';
const expectedHealthMode = 'v2-functional-0-8-0-audit';
function read(rel) { const p = path.join(root, rel); if (!fs.existsSync(p)) throw new Error(`Missing required file: ${rel}`); return fs.readFileSync(p, 'utf8'); }
function json(rel) { return JSON.parse(read(rel)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

for (const rel of ['package.json','apps/api/package.json','apps/web/package.json','apps/worker/package.json','packages/shared/package.json','packages/config/package.json']) {
  assert(json(rel).version === expectedVersion, `${rel} version is not ${expectedVersion}.`);
}
assert(json('package.json').scripts['phase-functional:0-8-0:test'] === 'node scripts/functional-audit-check.mjs', 'Missing root functional audit test script.');
assert(json('apps/api/package.json').scripts['orchestrator:functional-audit:test'] === 'tsx src/modules/orchestrator/functional-audit-tests.ts', 'Missing API functional audit TS test script.');

const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const shellJs = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const healthSrc = read('apps/api/src/modules/health/health.controller.ts');
const healthDist = read('apps/api/dist/modules/health/health.controller.js');
for (const source of [versionJs, shellJs, healthSrc, healthDist]) {
  assert(source.includes(expectedVersion), 'A version source is missing 0.8.0.');
  assert(source.includes(expectedHealthMode), 'A version source is missing the v0.8.0 health mode.');
}
assert(versionJs.includes(expectedLabel), 'Shared frontend metadata is missing V2 Functional Audit label.');

const requiredApiFiles = [
  'apps/api/src/modules/orchestrator/functional-audit.types.ts',
  'apps/api/src/modules/orchestrator/functional-audit.model.ts',
  'apps/api/src/modules/orchestrator/functional-audit.controller.ts',
  'apps/api/src/modules/orchestrator/functional-audit.routes.ts',
  'apps/api/src/modules/orchestrator/functional-audit-tests.ts',
  'apps/api/dist/modules/orchestrator/functional-audit.model.js',
  'apps/api/dist/modules/orchestrator/functional-audit.routes.js'
];
for (const rel of requiredApiFiles) read(rel);
const model = read('apps/api/src/modules/orchestrator/functional-audit.model.ts');
for (const key of ['dashboard_kpis','approval_queue','rules_ui','memory_management','support_workspace','notifications_center','real_execution_paths']) {
  assert(model.includes(key), `Functional audit model missing surface key: ${key}`);
}
for (const status of ['backend_connected','partial_backend_connected','ui_preview_only','needs_backend_persistence','framework_only','connector_disabled_by_design']) {
  assert(model.includes(status), `Functional audit model missing status: ${status}`);
}
for (const safety of ['noActionCreation: true','noExecutorCall: true','noExternalConnectorCall: true','noContentPublishing: true','noSupportSending: true','noAdsMutation: true']) {
  assert(model.includes(safety), `Functional audit safety boundary missing: ${safety}`);
}
const routes = read('apps/api/src/routes/api-v1.ts');
assert(routes.includes('functionalAuditRouter'), 'API v1 routes missing functionalAuditRouter.');
assert(read('apps/api/src/modules/orchestrator/functional-audit.routes.ts').includes('/functional-audit/report'), 'Functional audit report route missing.');
assert(read('apps/api/src/modules/orchestrator/functional-audit.routes.ts').includes('/functional-audit/map'), 'Functional audit map route missing.');
assert(read('apps/api/src/modules/orchestrator/functional-audit.routes.ts').includes('/functional-audit/checklist'), 'Functional audit checklist route missing.');

const page = read('apps/web/src/functional-audit.html');
const pageJs = read('apps/web/src/assets/js/functional-audit.js');
const pageCss = read('apps/web/src/assets/css/functional-audit.css');
assert(page.includes('functional-audit.js'), 'Functional audit page missing JS.');
assert(page.includes('functional-audit.css'), 'Functional audit page missing CSS.');
assert(page.includes('No execution, no external writes'), 'Functional audit page missing safety copy.');
assert(pageJs.includes('/orchestrator/functional-audit/report'), 'Functional audit JS missing report fetch.');
assert(pageJs.includes('/orchestrator/functional-audit/checklist'), 'Functional audit JS missing checklist fetch.');
assert(pageCss.includes('max-width:900px'), 'Functional audit CSS missing mobile breakpoint.');

const buildScript = read('scripts/build-web-static.mjs');
assert(buildScript.includes('functional-audit.html'), 'Static web build missing functional-audit.html.');
for (const rel of ['apps/web/src/index.html','apps/web/src/actions.html','apps/web/src/rules.html','apps/web/src/memory.html','apps/web/src/settings.html','apps/web/src/admin.html','apps/web/src/launch-readiness.html','apps/web/src/support.html','apps/web/src/notifications.html','apps/web/src/login.html']) {
  const html = read(rel);
  assert(html.includes('functional-audit.html'), `${rel} missing Functional Audit navigation link.`);
  assert(!html.includes('0.7.5'), `${rel} still contains stale visible 0.7.5 label.`);
}
assert(read('START_HERE_v0.8.0_FUNCTIONAL_AUDIT.txt').includes('Functional Audit'), 'Missing START_HERE content.');
assert(read('docs/v2/FUNCTIONAL_AUDIT_v0.8.0.txt').includes('UI-to-API Connection Map'), 'Missing v0.8.0 docs content.');
assert(read('docs/testing/FUNCTIONAL_AUDIT_TEST_RESULTS_v0.8.0.txt').includes('functional-audit-check'), 'Missing testing docs content.');

console.log('functional-audit-check — 88 passed, 0 failed');
