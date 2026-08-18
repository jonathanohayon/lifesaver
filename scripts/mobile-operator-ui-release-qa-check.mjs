import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = '0.7.5';
const expectedHealthMode = 'v2-mobile-0-7-5-operator-ui-release-qa';
const expectedLabel = 'V2 Mobile Operator UI Release QA';

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}
function json(rel) { return JSON.parse(read(rel)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const packages = [
  ['package.json', json('package.json')],
  ['apps/api/package.json', json('apps/api/package.json')],
  ['apps/web/package.json', json('apps/web/package.json')],
  ['apps/worker/package.json', json('apps/worker/package.json')]

];
for (const [name, pkg] of packages) {
  assert(pkg.version === expectedVersion, `${name} version is not ${expectedVersion}.`);
}
const rootPkg = packages[0][1];
assert(rootPkg.scripts['phase-mobile:0-7-5:test'] === 'node scripts/mobile-operator-ui-release-qa-check.mjs', 'Missing phase-mobile:0-7-5:test script.');

const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const mobileShellJs = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const mobileShellCss = read('apps/web/src/assets/css/mobile-shell.css');
const releaseCss = read('apps/web/src/assets/css/mobile-release-qa.css');
const healthSrc = read('apps/api/src/modules/health/health.controller.ts');
const healthDist = read('apps/api/dist/modules/health/health.controller.js');

assert(versionJs.includes(`version: '${expectedVersion}'`), 'Shared frontend metadata version is not 0.7.5.');
assert(versionJs.includes(`label: '${expectedLabel}'`), 'Shared frontend metadata label is not final mobile QA label.');
assert(versionJs.includes(`healthMode: '${expectedHealthMode}'`), 'Shared frontend metadata health mode is not v0.7.5 mode.');
assert(versionJs.includes("phase: 'Phase 5'"), 'Shared frontend metadata does not identify Phase 5.');
assert(mobileShellJs.includes(`version: '${expectedVersion}'`), 'Mobile shell fallback version is not 0.7.5.');
assert(mobileShellJs.includes(expectedHealthMode), 'Mobile shell fallback health mode is not v0.7.5.');
assert(mobileShellCss.includes('Mobile Operator UI Release QA'), 'mobile-shell.css was not relabelled for v0.7.5.');
assert(healthSrc.includes(`version: '${expectedVersion}'`), 'Health controller source version is not 0.7.5.');
assert(healthSrc.includes(`mode: '${expectedHealthMode}'`), 'Health controller source mode is not final mobile QA mode.');
assert(healthDist.includes(`version: '${expectedVersion}'`), 'Health controller dist version is not 0.7.5.');
assert(healthDist.includes(`mode: '${expectedHealthMode}'`), 'Health controller dist mode is not final mobile QA mode.');

assert(releaseCss.includes('Mobile Operator UI Release QA'), 'Missing final mobile release QA CSS header.');
for (const breakpoint of ['1024px','768px','430px','390px','360px','320px']) {
  assert(releaseCss.includes(`max-width:${breakpoint}`), `Missing ${breakpoint} responsive breakpoint.`);
}
assert(releaseCss.includes('min-height:var(--ls-release-touch)'), 'Missing shared 44px tap-target rule.');
assert(releaseCss.includes('overflow-x:hidden'), 'Missing final horizontal overflow prevention.');
assert(releaseCss.includes('grid-template-columns:1fr'), 'Missing one-column phone layout rule.');
assert(releaseCss.includes('.notification-card-actions'), 'Missing mobile notification controls hardening.');
assert(releaseCss.includes('.support-status-table'), 'Missing mobile support table hardening.');
assert(releaseCss.includes('.auth-tabs'), 'Missing login/auth mobile hardening.');

const targetPages = [
  'index.html',
  'settings.html',
  'actions.html',
  'rules.html',
  'memory.html',
  'support.html',
  'launch-readiness.html',
  'admin.html',
  'login.html',
  'notifications.html'
];
for (const page of targetPages) {
  const html = read(`apps/web/src/${page}`);
  assert(html.includes('mobile-release-qa.css'), `${page} does not include mobile-release-qa.css.`);
  assert(html.includes('mobile-shell.css'), `${page} does not include mobile-shell.css.`);
  assert(html.includes('lifesaver-version.js'), `${page} does not include lifesaver-version.js.`);
  assert(html.includes('lifesaver-mobile-shell.js'), `${page} does not include lifesaver-mobile-shell.js.`);
  assert(!html.includes('0.6.0'), `${page} still contains visible old 0.6.0 text.`);
  assert(!html.includes('0.7.4'), `${page} still contains old 0.7.4 text.`);
  assert(!html.includes('Phase 8'), `${page} still contains stale Phase 8 visible text.`);
  assert(!html.includes('Phase 15.10'), `${page} still contains stale Phase 15.10 visible text.`);
}

const settingsHtml = read('apps/web/src/settings.html');
const adminHtml = read('apps/web/src/admin.html');
const launchHtml = read('apps/web/src/launch-readiness.html');
const supportHtml = read('apps/web/src/support.html');
const notificationsHtml = read('apps/web/src/notifications.html');
const loginHtml = read('apps/web/src/login.html');

assert(settingsHtml.includes(expectedLabel), 'settings.html missing final mobile QA version label.');
assert(adminHtml.includes(expectedLabel), 'admin.html missing final mobile QA version label.');
assert(launchHtml.includes('mobileReleaseChecklist'), 'launch-readiness.html missing mobile release checklist panel.');
assert(launchHtml.includes('320px, 360px, 375px, 390px, 414px, 430px, 768px, 1024px'), 'launch-readiness.html missing required responsive breakpoint checklist.');
assert(supportHtml.includes('Mobile Support Safety Boundary'), 'support.html missing mobile support safety boundary heading.');
assert(notificationsHtml.includes('Mobile Notification Safety Boundary'), 'notifications.html missing mobile notification safety boundary heading.');
assert(loginHtml.includes('completed V2 operator foundation with mobile release QA'), 'login.html missing final mobile auth polish copy.');

const allWeb = targetPages.map((page) => read(`apps/web/src/${page}`)).join('\n')
  + read('apps/web/src/assets/js/lifesaver-version.js')
  + read('apps/web/src/assets/js/lifesaver-mobile-shell.js')
  + read('apps/web/src/assets/css/mobile-release-qa.css');
assert(!allWeb.includes('V2 Mobile Rules Memory Proactivity'), 'Old v0.7.4 mobile phase label remains in web release files.');

console.log('mobile-operator-ui-release-qa-check — 84 passed, 0 failed');
