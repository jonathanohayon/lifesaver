import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`audience-mapping-guidance-check failed: ${name}`);
  passed += 1;
}

const index = read('apps/web/src/index.html');
const mainJs = read('apps/web/src/assets/js/main.js');
const audienceJs = read('apps/web/src/assets/js/audience-reach.js');
const versionJs = read('apps/web/src/assets/js/lifesaver-version.js');
const mobileShell = read('apps/web/src/assets/js/lifesaver-mobile-shell.js');
const dashboardCss = read('apps/web/src/assets/css/dashboard.css');
const health = read('apps/api/src/modules/health/health.controller.ts');
const model = read('apps/api/src/modules/audience-reach/audience-reach.model.ts');
const types = read('apps/api/src/modules/audience-reach/audience-reach.types.ts');
const tests = read('apps/api/src/modules/audience-reach/audience-reach-tests.ts');
const pkg = JSON.parse(read('package.json'));
const apiPkg = JSON.parse(read('apps/api/package.json'));

check('root version is 0.8.2', pkg.version === '0.8.2');
check('api version is 0.8.2', apiPkg.version === '0.8.2');
check('phase-functional 0.8.2 script exists', Boolean(pkg.scripts['phase-functional:0-8-2:test']));
check('frontend version is 0.8.2', versionJs.includes("version: '0.8.2'"));
check('mobile shell fallback version is 0.8.2', mobileShell.includes("version: '0.8.2'"));
check('frontend health mode updated', versionJs.includes('v2-functional-0-8-2-audience-mapping-guidance'));
check('health version updated', health.includes("version: '0.8.2'"));
check('health mode updated', health.includes("mode: 'v2-functional-0-8-2-audience-mapping-guidance'"));
check('model version updated', model.includes("AUDIENCE_REACH_VERSION = '0.8.2'"));
check('model health mode updated', model.includes('v2-functional-0-8-2-audience-mapping-guidance'));
check('model returns Needs Mapping for unmapped values', model.includes("return 'Needs Mapping'"));
check('model includes real value requirements', model.includes('buildRealValueRequirements'));
check('model explains conversion mapping requirement', model.includes('conversion-rate metric/path'));
check('model explains formula', model.includes('orders ÷ (conversionRate / 100)'));
check('model keeps social connector future-only', model.includes('future social connector'));
check('types include guidance on metrics', types.includes('guidance: string'));
check('types include realValueRequirements', types.includes('realValueRequirements'));
check('tests expect Needs Mapping', tests.includes("'Needs Mapping'"));
check('tests expect Awaiting Data', tests.includes("'Awaiting Data'"));
check('homepage includes mapping note element', index.includes('audienceMappingNote'));
check('homepage no longer says Split Pending', !index.includes('Split Pending'));
check('homepage uses Attribution Needs Mapping', index.includes('Attribution Needs Mapping'));
check('homepage attribution value says Needs Mapping', index.includes('metricStreamAttribution">Needs Mapping'));
check('dashboard metrics loader uses Needs Mapping for conversion', mainJs.includes("'Needs Mapping'"));
check('dashboard metrics loader no longer writes attribution Pending', !mainJs.includes("metricStreamAttribution', 'Pending'"));
check('audience JS writes mapping guidance note', audienceJs.includes('realValueRequirements'));
check('audience JS fallback uses Awaiting Data', audienceJs.includes('Awaiting Data'));
check('audience JS fallback uses Needs Mapping', audienceJs.includes('Needs Mapping'));
check('audience JS has no external social API calls', !/facebook|instagram|tiktok|linkedin|googleads|meta\.com|graph\.facebook/i.test(audienceJs));
check('audience JS has no writes', !/method:\s*['"]POST|method:\s*['"]PATCH|method:\s*['"]DELETE/i.test(audienceJs));
check('CSS includes mapping guidance note', dashboardCss.includes('.ls-audience-note'));
check('source model exists', fs.existsSync(path.join(root, 'apps/api/src/modules/audience-reach/audience-reach.model.ts')));
check('dist model exists', fs.existsSync(path.join(root, 'apps/api/dist/modules/audience-reach/audience-reach.model.js')));
check('dist tests exist', fs.existsSync(path.join(root, 'apps/api/dist/modules/audience-reach/audience-reach-tests.js')));
check('README current phase updated', read('README.txt').includes('v0.8.2'));
check('CHANGELOG current phase updated', read('CHANGELOG.txt').includes('v0.8.2'));

console.log(`audience-mapping-guidance-check — ${passed} passed, 0 failed`);
