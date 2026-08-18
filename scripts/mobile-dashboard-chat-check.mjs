import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const webRoot = path.join(root, 'apps', 'web', 'src');
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

const index = read('apps/web/src/index.html');
const dashboardCss = read('apps/web/src/assets/css/dashboard.css');
const dashboardJs = read('apps/web/src/assets/js/dashboard.js');
const voiceCss = read('apps/web/src/assets/css/voice-input.css');
const voiceJs = read('apps/web/src/assets/js/voice-input.js');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const mobileShellJs = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const health = read('apps/api/src/modules/health/health.controller.ts');
const rootPackage = JSON.parse(read('package.json'));

assert(rootPackage.version === expectedVersion, 'Root package.json version is not 0.7.5.');
assert(rootPackage.scripts['phase-mobile:0-7-2:test'] === 'node scripts/mobile-dashboard-chat-check.mjs', 'Missing phase-mobile:0-7-2:test script.');
assert(versionJs.includes(`version: '${expectedVersion}'`), 'Shared frontend version is not 0.7.5.');
assert(versionJs.includes(`healthMode: '${expectedHealthMode}'`), 'Shared frontend health mode is not the v0.7.5 mode.');
assert(mobileShellJs.includes(`version: '${expectedVersion}'`), 'Mobile shell fallback version is not 0.7.5.');
assert(health.includes(`version: '${expectedVersion}'`), 'Health controller version is not 0.7.5.');
assert(health.includes(`mode: '${expectedHealthMode}'`), 'Health controller mode is not the v0.7.5 mode.');

assert(index.includes('./assets/css/dashboard.css'), 'index.html does not load dashboard.css.');
assert(index.includes('./assets/js/dashboard.js'), 'index.html does not load dashboard.js.');
assert(index.includes('data-ls-version>0.7.5') || index.includes('data-ls-version'), 'index.html does not bind the shared version label.');

assert(dashboardCss.includes('Mobile Operator UI Release QA'), 'dashboard.css is missing the phase label.');
assert(dashboardCss.includes('@media (max-width:680px)'), 'dashboard.css is missing phone breakpoint.');
assert(dashboardCss.includes('@media (min-width:681px) and (max-width:1180px)'), 'dashboard.css is missing tablet breakpoint.');
assert(dashboardCss.includes('.ls-dashboard-mobile-jumpbar'), 'dashboard.css is missing mobile quick navigation styles.');
assert(dashboardCss.includes('grid-template-columns:1fr'), 'dashboard.css is missing single-column mobile layout.');
assert(dashboardCss.includes('repeat(2,minmax(0,1fr))'), 'dashboard.css is missing two-column tablet/mobile card behavior.');
assert(dashboardCss.includes('overflow-x:hidden'), 'dashboard.css is missing horizontal-overflow prevention.');
assert(dashboardCss.includes('min-height:var(--ls-dashboard-touch)'), 'dashboard.css is missing large touch target rules.');

assert(dashboardJs.includes('buildMobileJumpbar'), 'dashboard.js is missing the mobile jumpbar builder.');
assert(dashboardJs.includes('ls-dashboard-chat'), 'dashboard.js is missing chat target binding.');
assert(dashboardJs.includes('ls-dashboard-kpis'), 'dashboard.js is missing KPI target binding.');
assert(dashboardJs.includes('ls-dashboard-weekly'), 'dashboard.js is missing weekly summary target binding.');
assert(dashboardJs.includes('ls-dashboard-v072-ready'), 'dashboard.js is missing v0.7.5 ready marker.');
assert(dashboardJs.includes('does not change API, policy, executor, or action behavior'), 'dashboard.js is missing safety note.');

assert(voiceCss.includes('v0.7.5 mobile voice/chat hardening'), 'voice-input.css is missing v0.7.5 mobile hardening block.');
assert(voiceCss.includes('.voice-mic-btn,.voice-submit-btn'), 'voice-input.css is missing tap-friendly voice buttons.');
assert(voiceCss.includes('min-height:46px'), 'voice-input.css is missing mobile tap height for voice buttons.');
assert(voiceJs.includes('Text fallback remains active'), 'voice-input.js must preserve text fallback messaging.');

const htmlFiles = ['index.html','settings.html','actions.html','rules.html','memory.html','support.html','launch-readiness.html','admin.html','login.html'];
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(webRoot, file), 'utf8');
  assert(html.includes('lifesaver-version.js'), `${file} is missing shared version script.`);
  assert(!html.includes('0.6.0'), `${file} still contains old 0.6.0 visible version text.`);
}

console.log('mobile-rules-memory-proactivity-check — 46 passed, 0 failed');
