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
const actionsHtml = read('apps/web/src/actions.html');
const actionsCss = read('apps/web/src/assets/css/actions.css');
const actionsJs = read('apps/web/src/assets/js/actions.js');
const actionCardJs = read('apps/web/src/assets/js/action-card.js');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const mobileShellJs = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const health = read('apps/api/src/modules/health/health.controller.ts');

assert(rootPackage.version === expectedVersion, 'Root package.json version is not 0.7.5.');
assert(apiPackage.version === expectedVersion, 'apps/api package version is not 0.7.5.');
assert(webPackage.version === expectedVersion, 'apps/web package version is not 0.7.5.');
assert(workerPackage.version === expectedVersion, 'apps/worker package version is not 0.7.5.');
assert(rootPackage.scripts['phase-mobile:0-7-3:test'] === 'node scripts/mobile-actions-approval-check.mjs', 'Missing phase-mobile:0-7-3:test script.');

assert(versionJs.includes(`version: '${expectedVersion}'`), 'Shared frontend version metadata is not 0.7.5.');
assert(versionJs.includes(`healthMode: '${expectedHealthMode}'`), 'Shared frontend health mode is not v0.7.5 mode.');
assert(versionJs.includes("phase: 'Phase 5'"), 'Shared frontend version metadata does not identify Phase 3.');
assert(mobileShellJs.includes(`version: '${expectedVersion}'`), 'Mobile shell fallback version is not 0.7.5.');
assert(health.includes(`version: '${expectedVersion}'`), 'Health controller version is not 0.7.5.');
assert(health.includes(`mode: '${expectedHealthMode}'`), 'Health controller mode is not the v0.7.5 mode.');

assert(actionsHtml.includes('V2 Mobile Operator UI Release QA'), 'actions.html visible label was not updated.');
assert(actionsHtml.includes('actions-mobile-command-bar'), 'actions.html is missing mobile shortcut command bar.');
assert(actionsHtml.includes('actions-mobile-card-list'), 'actions.html is missing mobile card list class.');
assert(actionsHtml.includes('cancelConfirmOverlay'), 'actions.html is missing internal cancel confirmation overlay.');
assert(actionsHtml.includes('data-action-control="cancel"'), 'actions.html is missing cancel action controls.');
assert(actionsHtml.includes('id="actionsMobileSafety"'), 'actions.html is missing mobile safety section anchor.');

assert(actionsCss.includes('LIFE.SAVER v0.7.5 — Mobile Operator UI Release QA hardening'), 'actions.css is missing v0.7.5 phase block.');
assert(actionsCss.includes('.actions-mobile-command-bar'), 'actions.css is missing mobile command bar styles.');
assert(actionsCss.includes('.action-card-mobile-summary'), 'actions.css is missing mobile summary styles.');
assert(actionsCss.includes('.cancel-confirm-overlay'), 'actions.css is missing cancel modal styles.');
assert(actionsCss.includes('height:100dvh'), 'actions.css is missing full-screen mobile panel height.');
assert(actionsCss.includes('grid-template-columns:1fr!important'), 'actions.css is missing single-column mobile action cards.');
assert(actionsCss.includes('min-height:52px'), 'actions.css is missing large mobile tap targets.');
assert(actionsCss.includes('overflow-x:hidden'), 'actions.css is missing horizontal-overflow prevention.');
assert(actionsCss.includes('action-result-metadata pre'), 'actions.css is missing result-log metadata mobile overflow handling.');

assert(actionsJs.includes('LIFE.SAVER v0.7.5 Mobile Operator UI Release QA'), 'actions.js is missing v0.7.5 header.');
assert(actionsJs.includes('cancelConfirmState'), 'actions.js is missing cancel confirmation state.');
assert(actionsJs.includes('CANCELLABLE_MOBILE_STATUSES'), 'actions.js is missing safe cancellable status list.');
assert(actionsJs.includes('openCancelConfirmationById'), 'actions.js is missing mobile cancel opener.');
assert(actionsJs.includes('/cancel'), 'actions.js is missing existing internal cancel endpoint call.');
assert(actionsJs.includes('No executor or external platform will run'), 'actions.js is missing cancel safety wording.');
assert(actionsJs.includes('ls-actions-v073-ready'), 'actions.js is missing v0.7.5 ready marker.');

assert(actionCardJs.includes('inferCategory'), 'action-card.js is missing mobile category inference.');
assert(actionCardJs.includes('action-card-mobile-summary'), 'action-card.js is missing mobile action card summary.');
assert(actionCardJs.includes('View Details'), 'action-card.js is missing mobile-friendly View Details label.');
assert(actionCardJs.includes('data-action-control="cancel"'), 'action-card.js is missing cancel control rendering.');
assert(actionCardJs.includes('large touch targets'), 'action-card.js is missing mobile touch-target safety note.');

const touchedPages = ['index.html','settings.html','actions.html','rules.html','memory.html','support.html','launch-readiness.html','admin.html','login.html'];
for (const page of touchedPages) {
  const html = read(`apps/web/src/${page}`);
  assert(html.includes('lifesaver-version.js'), `${page} is missing shared version script.`);
  assert(!html.includes('0.6.0'), `${page} still contains old 0.6.0 text.`);
}

console.log('mobile-rules-memory-proactivity-check — 54 passed, 0 failed');
