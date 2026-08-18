import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`audience-reach-check failed: ${name}`);
  passed += 1;
}

const index = read('apps/web/src/index.html');
const audienceJs = read('apps/web/src/assets/js/audience-reach.js');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const health = read('apps/api/src/modules/health/health.controller.ts');
const apiRoutes = read('apps/api/src/routes/api-v1.ts');
const model = read('apps/api/src/modules/audience-reach/audience-reach.model.ts');
const controller = read('apps/api/src/modules/audience-reach/audience-reach.controller.ts');
const routes = read('apps/api/src/modules/audience-reach/audience-reach.routes.ts');
const tests = read('apps/api/src/modules/audience-reach/audience-reach-tests.ts');
const dashboardCss = read('apps/web/src/assets/css/dashboard.css');
const pkg = JSON.parse(read('package.json'));

check('root version is 0.8.1', pkg.version === '0.8.1');
check('phase-functional 0.8.1 script exists', Boolean(pkg.scripts['phase-functional:0-8-1:test']));
check('frontend version is 0.8.1', versionJs.includes("version: '0.8.1'"));
check('frontend health mode updated', versionJs.includes('v2-functional-0-8-1-audience-reach'));
check('health version updated', health.includes("version: '0.8.1'"));
check('health mode updated', health.includes("mode: 'v2-functional-0-8-1-audience-reach'"));
check('api route imports audience router', apiRoutes.includes('audienceReachRouter'));
check('api route mounts audience-reach', apiRoutes.includes("apiV1Router.use('/audience-reach'"));
check('audience module status route exists', routes.includes("audienceReachRouter.get('/status'"));
check('audience module report route exists', routes.includes("audienceReachRouter.get('/'"));
check('controller uses getLatestMetrics', controller.includes('getLatestMetrics'));
check('controller builds audience report', controller.includes('buildAudienceReachFromMetrics'));
check('model declares version', model.includes("AUDIENCE_REACH_VERSION = '0.8.1'"));
check('model declares no social connector', model.includes('socialAudienceConnectorEnabled: false'));
check('model declares no external write safety', model.includes('noExternalWrite: true'));
check('model computes from orders', model.includes('orders from latest metrics snapshot'));
check('model avoids claiming social followers', model.includes('True social followers/reach are not claimed'));
check('test covers live report', tests.includes("statusLabel, 'LIVE'"));
check('test covers pending conversion', tests.includes('pendingConversion'));
check('test covers fallback', tests.includes('fallback'));
check('homepage no longer says Static Demo Module', !index.includes('Static Demo Module'));
check('homepage no longer shows DEMO badge in audience panel', !index.includes('<span class="tag amber-tag">DEMO</span>'));
check('homepage has audienceReachStatus id', index.includes('id="audienceReachStatus"'));
check('homepage has customers metric id', index.includes('id="audienceCustomers"'));
check('homepage has reach estimate metric id', index.includes('id="audienceReachEstimate"'));
check('homepage has channels metric id', index.includes('id="audienceChannels"'));
check('homepage has conversion/engagement metric id', index.includes('id="audienceEngagement"'));
check('homepage loads audience-reach JS', index.includes('./assets/js/audience-reach.js'));
check('frontend JS fetches /api/v1/audience-reach', audienceJs.includes('/api/v1/audience-reach'));
check('frontend JS has no external social API calls', !/facebook|instagram|tiktok|linkedin|googleads|meta\.com|graph\.facebook/i.test(audienceJs));
check('frontend JS has no writes', !/method:\s*['"]POST|method:\s*['"]PATCH|method:\s*['"]DELETE/i.test(audienceJs));
check('frontend JS handles auth required', audienceJs.includes('AUTH_REQUIRED'));
check('frontend JS applies source label', audienceJs.includes('audienceReachSub'));
check('frontend JS applies safety signal', audienceJs.includes('LIFESAVER_AUDIENCE_REACH_SIGNAL'));
check('CSS has live badge', dashboardCss.includes('.ls-audience-live'));
check('CSS has derived badge', dashboardCss.includes('.ls-audience-derived'));
check('CSS has mobile audience rules', dashboardCss.includes('#audienceReachStatus'));
check('source files exist', fs.existsSync(path.join(root, 'apps/api/src/modules/audience-reach/audience-reach.types.ts')));
check('dist files exist', fs.existsSync(path.join(root, 'apps/api/dist/modules/audience-reach/audience-reach.model.js')));
check('dist tests exist', fs.existsSync(path.join(root, 'apps/api/dist/modules/audience-reach/audience-reach-tests.js')));

console.log(`audience-reach-check — ${passed} passed, 0 failed`);
