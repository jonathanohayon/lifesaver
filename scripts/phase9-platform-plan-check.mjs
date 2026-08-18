import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;
const errors = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  errors.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const contractPath = 'docs/api-contracts/content-publishing-platform-plan.v0.7.0.example.json';
const contract = JSON.parse(read(contractPath));
const readme = read('README.txt');
const startHere = read('START_HERE_v0.7.0_PHASE_9_1_CHOOSE_FIRST_PLATFORM.txt');
const selectedPlan = read('docs/v2/PHASE_9_1_SELECTED_PLATFORM_PLAN_v0.7.0.txt');
const comparison = read('docs/v2/PHASE_9_1_PLATFORM_COMPARISON_v0.7.0.txt');
const healthSource = read('apps/api/src/modules/health/health.controller.ts');
const planSource = read('apps/api/src/modules/content-publishing/content-platform-plan.ts');

check('selected platform is linkedin', contract.selected_platform === 'linkedin');
check('selected label is LinkedIn', contract.selected_platform_label === 'LinkedIn');
check('manual approval required', contract.manual_approval_required_for_future_publish === true);
check('no real external writes added', contract.real_external_writes_added === false);
check('no real executor added', contract.real_executor_added === false);
check('no OAuth routes added', contract.oauth_routes_added === false);
check('no token storage added', contract.token_storage_added === false);
check('auto-run disabled', contract.auto_run_enabled === false);
check('external platform not called', contract.external_platform_called === false);
check('Phase 9 health mode is current or newer', healthSource.includes('v2-phase-9-') || healthSource.includes('v2-phase-9-1-choose-first-platform'));
check('Phase 9.1 selected platform doc exists', selectedPlan.includes('Phase 9.1') && selectedPlan.includes('LinkedIn'));
check('docs contain safety boundary', selectedPlan.includes('No real publishing') && comparison.includes('LinkedIn — SELECTED') && startHere.includes('LinkedIn API calls'));

console.log(`phase9:platform-plan:test — ${passed} passed, ${failed} failed`);
console.log(`Selected platform: ${contract.selected_platform}`);
console.log(`Real external writes added: ${contract.real_external_writes_added}`);
console.log(`Auto-run enabled: ${contract.auto_run_enabled}`);

if (!planSource.includes("selectedPlatform: 'linkedin'")) {
  errors.push('content-platform-plan.ts does not contain selectedPlatform linkedin');
  failed += 1;
}

if (errors.length > 0) {
  console.error('\nFailures:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
