import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = '0.7.5';
const expectedHealthMode = 'v2-mobile-0-7-5-operator-ui-release-qa';

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rootPackage = JSON.parse(read('package.json'));
const apiPackage = JSON.parse(read('apps/api/package.json'));
const webPackage = JSON.parse(read('apps/web/package.json'));
const workerPackage = JSON.parse(read('apps/worker/package.json'));
const rulesHtml = read('apps/web/src/rules.html');
const rulesCss = read('apps/web/src/assets/css/rules.css');
const rulesJs = read('apps/web/src/assets/js/rules.js');
const memoryHtml = read('apps/web/src/memory.html');
const memoryCss = read('apps/web/src/assets/css/memory.css');
const memoryJs = read('apps/web/src/assets/js/memory.js');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const mobileShellJs = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const health = read('apps/api/src/modules/health/health.controller.ts');

assert(rootPackage.version === expectedVersion, 'Root package.json version is not 0.7.5.');
assert(apiPackage.version === expectedVersion, 'apps/api package version is not 0.7.5.');
assert(webPackage.version === expectedVersion, 'apps/web package version is not 0.7.5.');
assert(workerPackage.version === expectedVersion, 'apps/worker package version is not 0.7.5.');
assert(rootPackage.scripts['phase-mobile:0-7-4:test'] === 'node scripts/mobile-rules-memory-proactivity-check.mjs', 'Missing phase-mobile:0-7-4:test script.');

assert(versionJs.includes(`version: '${expectedVersion}'`), 'Shared frontend version metadata is not 0.7.5.');
assert(versionJs.includes(`healthMode: '${expectedHealthMode}'`), 'Shared frontend health mode is not v0.7.5 mode.');
assert(versionJs.includes("phase: 'Phase 5'"), 'Shared frontend version metadata does not identify Phase 4.');
assert(mobileShellJs.includes(`version: '${expectedVersion}'`), 'Mobile shell fallback version is not 0.7.5.');
assert(health.includes(`version: '${expectedVersion}'`), 'Health controller version is not 0.7.5.');
assert(health.includes(`mode: '${expectedHealthMode}'`), 'Health controller mode is not the v0.7.5 mode.');

assert(rulesHtml.includes('proactivityTriggerSection'), 'rules.html is missing proactive trigger registry section.');
assert(rulesHtml.includes('Master Pause'), 'rules.html missing Master Pause section.');
assert(rulesHtml.includes('Content Rules'), 'rules.html missing Content Rules section.');
assert(rulesHtml.includes('Support Rules'), 'rules.html missing Support Rules section.');
assert(rulesHtml.includes('Ads Rules'), 'rules.html missing Ads Rules section.');
assert(rulesHtml.includes('Global Caps'), 'rules.html missing Global Caps section.');
assert(rulesHtml.includes('Rule Simulation'), 'rules.html missing Rule Simulation section.');
assert(rulesHtml.includes('Policy Audit'), 'rules.html missing Policy Audit section.');
assert(rulesHtml.includes('Rules Permission QA'), 'rules.html missing Permission QA section.');
assert(rulesHtml.includes('Framework only') || rulesHtml.includes('FRAMEWORK ONLY'), 'rules.html missing proactivity framework-only safety copy.');

assert(rulesCss.includes('Mobile Operator UI Release QA hardening'), 'rules.css missing v0.7.5 phase block.');
assert(rulesCss.includes('.rules-mobile-accordion-toggle'), 'rules.css missing mobile accordion toggle styles.');
assert(rulesCss.includes('.rules-mobile-section-nav'), 'rules.css missing mobile section navigation styles.');
assert(rulesCss.includes('.proactivity-mobile-grid'), 'rules.css missing proactivity mobile grid styles.');
assert(rulesCss.includes('grid-template-columns:1fr'), 'rules.css missing mobile single-column behavior.');
assert(rulesCss.includes('min-height:44px'), 'rules.css missing mobile tap target rule.');
assert(rulesCss.includes('overflow-x:hidden'), 'rules.css missing horizontal overflow prevention.');

assert(rulesJs.includes('setupRulesMobileAccordions'), 'rules.js missing mobile accordion initializer.');
assert(rulesJs.includes('ensureRulesMobileSectionNav'), 'rules.js missing mobile section shortcut navigation.');
assert(rulesJs.includes('PROACTIVITY_REGISTRY_FALLBACK'), 'rules.js missing proactivity registry fallback.');
assert(rulesJs.includes('loadProactivityRegistry'), 'rules.js missing proactivity registry loader.');
assert(rulesJs.includes('/api/v1/orchestrator/proactivity-triggers/registry'), 'rules.js missing proactivity registry endpoint.');
assert(rulesJs.includes('actionCreated: false'), 'rules.js missing proactivity no-action safety flag.');
assert(rulesJs.includes('autoRunEnabled: false'), 'rules.js missing proactivity no-auto-run safety flag.');

assert(memoryHtml.includes('v0.7.5 mobile-ready'), 'memory.html missing v0.7.5 mobile-ready label.');
assert(memoryHtml.includes('memory-mobile-helper'), 'memory.html missing mobile helper copy.');
assert(memoryCss.includes('Mobile memory cards and touch controls'), 'memory.css missing v0.7.5 mobile memory block.');
assert(memoryCss.includes('.memory-card-actions .btn'), 'memory.css missing memory card button touch styles.');
assert(memoryCss.includes('min-height:44px'), 'memory.css missing memory tap target sizing.');
assert(memoryCss.includes('grid-template-columns:1fr'), 'memory.css missing one-column memory card behavior.');
assert(memoryJs.includes('memory-card-actions'), 'memory.js missing memory card actions rendering.');
assert(memoryJs.includes('Approve'), 'memory.js missing approve memory action.');
assert(memoryJs.includes('Disable'), 'memory.js missing disable memory action.');
assert(memoryJs.includes('Delete'), 'memory.js missing delete memory action.');

const touchedPages = ['index.html','settings.html','actions.html','rules.html','memory.html','support.html','launch-readiness.html','admin.html','login.html'];
for (const page of touchedPages) {
  const html = read(`apps/web/src/${page}`);
  assert(html.includes('lifesaver-version.js'), `${page} is missing shared version script.`);
  assert(!html.includes('0.6.0'), `${page} still contains old 0.6.0 text.`);
  assert(!html.includes('0.7.3'), `${page} still contains old 0.7.3 visible text.`);
}

console.log('mobile-rules-memory-proactivity-check — 62 passed, 0 failed');
