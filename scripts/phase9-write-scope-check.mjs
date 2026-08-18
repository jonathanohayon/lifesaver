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

const contractPath = 'docs/api-contracts/content-publishing-write-scope-checklist.v0.7.0.example.json';
const contract = JSON.parse(read(contractPath));
const readme = read('README.txt');
const startHere = read('START_HERE_v0.7.0_PHASE_9_2_WRITE_SCOPE_PLANNING.txt');
const checklist = read('docs/v2/PHASE_9_2_LINKEDIN_WRITE_SCOPE_CHECKLIST_v0.7.0.txt');
const oauthPlan = read('docs/v2/PHASE_9_2_LINKEDIN_OAUTH_APP_REVIEW_TOKEN_PLAN_v0.7.0.txt');
const healthSource = read('apps/api/src/modules/health/health.controller.ts');
const scopeSource = read('apps/api/src/modules/content-publishing/content-write-scope-plan.ts');

check('selected platform is linkedin', contract.selected_platform === 'linkedin');
check('required write scope is w_member_social', contract.required_write_scope === 'w_member_social');
check('oauth flow is 3-legged authorization code', contract.oauth_flow === 'linkedin_3_legged_authorization_code');
check('app review/developer portal access is tracked', contract.app_review_or_portal_access_required === true);
check('token expiry plan stores expires_at', contract.token_expiry_plan.store_expires_at_from_expires_in === true);
check('programmatic refresh is not assumed', contract.token_expiry_plan.programmatic_refresh_tokens_assumed_available === false);
check('member posting future allowed', contract.publishing_permissions.member_posting_allowed_future === true);
check('organization posting not first lane', contract.publishing_permissions.organization_posting_allowed_future === false);
check('sponsored content not allowed first lane', contract.publishing_permissions.sponsored_content_allowed_future === false);
check('media upload not added', contract.media_upload_limitations.media_upload_added_this_phase === false);
check('initial executor text/link only', contract.media_upload_limitations.initial_executor_should_be_text_link_only === true);
check('image constraints captured', contract.media_upload_limitations.known_image_pixel_limit_less_than === 36152320 && contract.media_upload_limitations.gif_max_frames === 250);
check('no real executor added', contract.real_executor_added === false);
check('no real external writes added', contract.real_external_writes_added === false);
check('no OAuth routes added', contract.oauth_routes_added === false);
check('no token storage added', contract.token_storage_added === false);
check('auto-run disabled', contract.auto_run_enabled === false);
check('Phase 9 health mode is current or newer', healthSource.includes('v2-phase-9-'));

check('Phase 9.2 source docs remain available', startHere.includes('PHASE 9.2') && checklist.includes('Phase 9.2'));
check('docs include OAuth/app/token/media sections', checklist.includes('REQUIRED OAUTH FLOW') && checklist.includes('APP REVIEW') && checklist.includes('TOKEN EXPIRY') && checklist.includes('MEDIA UPLOAD LIMITATIONS'));
check('oauth plan blocks browser token exposure', oauthPlan.includes('Never store token in localStorage') && oauthPlan.includes('Never send token back to frontend'));
check('typescript plan mirrors required scope', scopeSource.includes("requiredWriteScope: 'w_member_social'"));

console.log(`phase9:write-scope:test — ${passed} passed, ${failed} failed`);
console.log(`Selected platform: ${contract.selected_platform}`);
console.log(`Required write scope: ${contract.required_write_scope}`);
console.log(`Real external writes added: ${contract.real_external_writes_added}`);
console.log(`Auto-run enabled: ${contract.auto_run_enabled}`);

if (errors.length > 0) {
  console.error('\nFailures:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
