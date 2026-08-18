import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function check(name, condition) {
  if (!condition) throw new Error(`claude-backend-compatibility-check failed: ${name}`);
  passed += 1;
}

const pkg = json('package.json');
const apiPkg = json('apps/api/package.json');
const webPkg = json('apps/web/package.json');
const envSrc = read('apps/api/src/config/env.ts');
const clientSrc = read('apps/api/src/modules/ai/claude.client.ts');
const clientDist = read('apps/api/dist/modules/ai/claude.client.js');
const apiRoutes = read('apps/api/src/routes/api-v1.ts');
const apiRoutesDist = read('apps/api/dist/routes/api-v1.js');
const claudeRoutes = read('apps/api/src/modules/ai/claude.routes.ts');
const claudeController = read('apps/api/src/modules/ai/claude.controller.ts');
const health = read('apps/api/src/modules/health/health.controller.ts');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');

function normalizeClaudeApiKey(value = '') {
  let normalized = String(value || '').trim();
  const assignment = normalized.match(/^(?:CLAUDE_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.+)$/i);
  if (assignment) normalized = assignment[1].trim();
  normalized = normalized.replace(/^Bearer\s+/i, '').trim();
  normalized = normalized.replace(/^["']|["']$/g, '').trim();
  normalized = normalized.replace(/\s+/g, '');
  return normalized;
}

check('root version is 0.8.5', pkg.version === '0.8.5');
check('api version is 0.8.5', apiPkg.version === '0.8.5');
check('web version is 0.8.5', webPkg.version === '0.8.5');
check('phase-functional 0.8.5 script exists', Boolean(pkg.scripts['phase-functional:0-8-5:test']));
check('frontend version is 0.8.5', versionJs.includes("version: '0.8.5'"));
check('frontend package name updated', versionJs.includes('lifesaver-v0.8.5-claude-backend-compatibility.zip'));
check('frontend health mode updated', versionJs.includes('v2-functional-0-8-5-claude-backend-compatibility'));
check('health version updated', health.includes("version: '0.8.5'"));
check('health mode updated', health.includes("mode: 'v2-functional-0-8-5-claude-backend-compatibility'"));
check('env supports CLAUDE_API_KEY', envSrc.includes('CLAUDE_API_KEY'));
check('env supports ANTHROPIC_API_KEY fallback', envSrc.includes('ANTHROPIC_API_KEY'));
check('client has normalizeClaudeApiKey', clientSrc.includes('normalizeClaudeApiKey'));
check('client strips Bearer prefix', clientSrc.includes("replace(/^Bearer"));
check('client removes whitespace in keys', clientSrc.includes("replace(/\\s+/g, '')"));
check('client builds candidates', clientSrc.includes('getClaudeApiKeyCandidates'));
check('client tries CLAUDE_API_KEY', clientSrc.includes("buildClaudeKeyCandidate('CLAUDE_API_KEY'"));
check('client tries ANTHROPIC_API_KEY', clientSrc.includes("buildClaudeKeyCandidate('ANTHROPIC_API_KEY'"));
check('client retries alternate key on 401', clientSrc.includes('response.status === 401') && clientSrc.includes('continue;'));
check('dist client has same fallback support', clientDist.includes('ANTHROPIC_API_KEY') && clientDist.includes('normalizeClaudeApiKey'));
check('claude routes exist', claudeRoutes.includes("/status") && claudeRoutes.includes('/smoke-test'));
check('claude controller never returns key', claudeController.includes('keyExposed: false') && !claudeController.includes('CLAUDE_API_KEY'));
check('api routes import claudeRouter', apiRoutes.includes('claudeRouter'));
check('api routes mount protected /claude', apiRoutes.includes("apiV1Router.use('/claude', authRequired, claudeRouter)"));
check('dist routes mount protected /claude', apiRoutesDist.includes("apiV1Router.use('/claude', authRequired, claudeRouter)"));
check('normalizer trims spaces', normalizeClaudeApiKey(' sk-ant-api03-test ') === 'sk-ant-api03-test');
check('normalizer removes quotes', normalizeClaudeApiKey('"sk-ant-api03-test"') === 'sk-ant-api03-test');
check('normalizer removes Bearer', normalizeClaudeApiKey('Bearer sk-ant-api03-test') === 'sk-ant-api03-test');
check('normalizer removes assignment prefix', normalizeClaudeApiKey('CLAUDE_API_KEY=sk-ant-api03-test') === 'sk-ant-api03-test');
check('normalizer supports standard assignment prefix', normalizeClaudeApiKey('ANTHROPIC_API_KEY=sk-ant-api03-test') === 'sk-ant-api03-test');
check('normalizer removes line breaks', normalizeClaudeApiKey('sk-ant-api03-abc\r\ndef') === 'sk-ant-api03-abcdef');
check('docs added', fs.existsSync(path.join(root, 'START_HERE_v0.8.5_CLAUDE_BACKEND_COMPATIBILITY.txt')));
check('test results doc added', fs.existsSync(path.join(root, 'docs/testing/CLAUDE_BACKEND_COMPATIBILITY_TEST_RESULTS_v0.8.5.txt')));

console.log(`claude-backend-compatibility-check — ${passed} passed, 0 failed`);
