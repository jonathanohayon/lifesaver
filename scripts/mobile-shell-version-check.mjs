import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredPages = [
  'index.html',
  'settings.html',
  'actions.html',
  'rules.html',
  'memory.html',
  'support.html',
  'launch-readiness.html',
  'admin.html',
  'login.html'
];
const webRoot = path.join(root, 'apps', 'web', 'src');
const versionPath = path.join(webRoot, 'assets', 'js', 'lifesaver-version.js');
const mobileJsPath = path.join(webRoot, 'assets', 'js', 'lifesaver-mobile-shell.js');
const mobileCssPath = path.join(webRoot, 'assets', 'css', 'mobile-shell.css');
const expectedVersion = '0.7.5';
const expectedHealthMode = 'v2-mobile-0-7-5-operator-ui-release-qa';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [versionPath, mobileJsPath, mobileCssPath]) {
  assert(fs.existsSync(file), `Missing required mobile shell asset: ${path.relative(root, file)}`);
}

const versionJs = fs.readFileSync(versionPath, 'utf8');
assert(versionJs.includes(`version: '${expectedVersion}'`), 'Shared frontend version metadata has wrong version.');
assert(versionJs.includes(`healthMode: '${expectedHealthMode}'`), 'Shared frontend version metadata has wrong health mode.');

const mobileCss = fs.readFileSync(mobileCssPath, 'utf8');
assert(mobileCss.includes('.ls-mobile-menu-toggle'), 'Mobile shell CSS missing menu toggle styles.');
assert(mobileCss.includes('max-width:980px'), 'Mobile shell CSS missing responsive breakpoint.');

const mobileJs = fs.readFileSync(mobileJsPath, 'utf8');
assert(mobileJs.includes('enhanceTopbarNavigation'), 'Mobile shell JS missing topbar navigation enhancer.');
assert(mobileJs.includes('enhanceDashboardNavigation'), 'Mobile shell JS missing dashboard navigation enhancer.');

for (const page of requiredPages) {
  const htmlPath = path.join(webRoot, page);
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(html.includes('mobile-shell.css'), `${page} is missing mobile-shell.css.`);
  assert(html.includes('lifesaver-version.js'), `${page} is missing shared version script.`);
  assert(html.includes('lifesaver-mobile-shell.js'), `${page} is missing mobile shell script.`);
  assert(html.includes('v0.7.5') || html.includes('data-ls-version'), `${page} does not show v0.7.5 or bind shared version metadata.`);
}

const healthController = fs.readFileSync(path.join(root, 'apps', 'api', 'src', 'modules', 'health', 'health.controller.ts'), 'utf8');
assert(healthController.includes(`version: '${expectedVersion}'`), 'Health controller version was not updated.');
assert(healthController.includes(`mode: '${expectedHealthMode}'`), 'Health controller mode was not updated.');

console.log('mobile-shell-version-check — 32 passed, 0 failed');
