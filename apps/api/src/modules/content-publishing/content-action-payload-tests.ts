import { z } from 'zod';
import {
  buildContentPublishPayloadPreview,
  contentActionPayloadModel,
  contentPublishPayloadSchema,
  findForbiddenPayloadKeys,
  parseContentPublishPayload,
} from './content-action-payload.js';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function expectThrows(name: string, fn: () => unknown, expectedText: string): void {
  try {
    fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.includes(expectedText)) {
      throw new Error(`${name} threw, but not with expected text. Expected: ${expectedText}. Actual: ${text}`);
    }
    return;
  }
  throw new Error(`${name} should have thrown.`);
}

const validPayload = {
  platform: 'linkedin',
  account_id: 'urn:li:person:abc123XYZ',
  caption: 'Certainly, sir. A calm weekly performance note for the founder.',
  media_url: 'https://cdn.example.com/lifesaver/preview-image.png',
  media_type: 'image',
  link_url: 'https://lifesaveragent.com',
  hashtags: ['#Ecommerce', 'Founder Ops', 'AI_Strategy', '#ecommerce'],
  scheduled_time: '2026-07-10T09:30:00.000Z',
  approval_notes: 'Founder must review the caption and link before any future publish executor can run.',
  source_draft_id: '00000000-0000-4000-8000-000000000123',
  idempotency_hint: 'linkedin-member-demo-post-2026-07-10',
};

const checks: Array<[string, () => void]> = [
  ['phase 9.4 model is selected', () => assert(contentActionPayloadModel.phase === 'v0.7.0_phase_9_4', 'Phase must be v0.7.0_phase_9_4.')],
  ['health mode updated', () => assert(contentActionPayloadModel.healthMode === 'v2-phase-9-4-content-action-payload', 'Health mode mismatch.')],
  ['selected platform remains linkedin', () => assert(contentActionPayloadModel.selectedPlatform === 'linkedin', 'Selected platform must remain LinkedIn.')],
  ['action type is content_publish', () => assert(contentActionPayloadModel.actionType === 'content_publish', 'Action type must be content_publish.')],
  ['manual approval remains required', () => assert(contentActionPayloadModel.manualApprovalRequired === true, 'Manual approval must remain required.')],
  ['real publishing is not enabled', () => assert(contentActionPayloadModel.realPublishingEnabled === false, 'Real publishing must remain disabled.')],
  ['executor is not added', () => assert(contentActionPayloadModel.executorAdded === false, 'Real executor must not be added in Phase 9.4.')],
  ['external API is not called', () => assert(contentActionPayloadModel.externalApiCalled === false, 'External API must not be called.')],
  ['auto-run is disabled', () => assert(contentActionPayloadModel.autoRunEnabled === false, 'Auto-run must remain disabled.')],
  ['valid payload parses', () => {
    const payload = parseContentPublishPayload(validPayload);
    assert(payload.platform === 'linkedin', 'Platform should be linkedin.');
    assert(payload.action_type === 'content_publish', 'Action type should default to content_publish.');
    assert(payload.schema_version === 'content_publish_payload.v0.7.0.phase_9_4', 'Schema version mismatch.');
  }],
  ['required fields are enforced', () => {
    expectThrows('missing caption', () => parseContentPublishPayload({ ...validPayload, caption: '' }), 'caption');
    expectThrows('missing account id', () => parseContentPublishPayload({ ...validPayload, account_id: '' }), 'account_id');
  }],
  ['platform must be linkedin', () => {
    expectThrows('wrong platform', () => parseContentPublishPayload({ ...validPayload, platform: 'instagram' }), 'Invalid literal value');
  }],
  ['hashtags normalize and deduplicate', () => {
    const payload = parseContentPublishPayload(validPayload);
    assert(payload.hashtags.includes('#ecommerce'), 'Hashtags should normalize to lowercase with #.');
    assert(payload.hashtags.includes('#founderops'), 'Spaces should be removed in hashtags.');
    assert(payload.hashtags.filter((tag) => tag === '#ecommerce').length === 1, 'Duplicate hashtags should be removed.');
  }],
  ['scheduled time normalizes to ISO', () => {
    const payload = parseContentPublishPayload(validPayload);
    assert(payload.scheduled_time === '2026-07-10T09:30:00.000Z', 'Scheduled time should normalize to ISO.');
  }],
  ['approval notes normalize', () => {
    const payload = parseContentPublishPayload({ ...validPayload, approval_notes: '   Review final wording.   ' });
    assert(payload.approval_notes === 'Review final wording.', 'Approval notes should be trimmed.');
  }],
  ['media url must use https', () => {
    expectThrows('http media url', () => parseContentPublishPayload({ ...validPayload, media_url: 'http://cdn.example.com/image.png' }), 'Invalid input');
  }],
  ['image media requires media url', () => {
    expectThrows('image without media', () => parseContentPublishPayload({ ...validPayload, media_url: null, media_type: 'image' }), 'media_url is required');
  }],
  ['media type none cannot include media url', () => {
    expectThrows('none with media url', () => parseContentPublishPayload({ ...validPayload, media_type: 'none' }), 'media_type must not be none');
  }],
  ['link media requires link or media url', () => {
    expectThrows('link without urls', () => parseContentPublishPayload({ ...validPayload, media_type: 'link', media_url: null, link_url: null }), 'link_url or media_url');
  }],
  ['secret-like keys are blocked before validation', () => {
    const forbidden = findForbiddenPayloadKeys({ data: { access_token: 'abc' }, metadata: { apiKey: 'abc' } });
    assert(forbidden.includes('$.data.access_token'), 'access_token key should be detected.');
    assert(forbidden.includes('$.metadata.apiKey'), 'apiKey key should be detected.');
    expectThrows('secret fields', () => parseContentPublishPayload({ ...validPayload, access_token: 'should-not-exist' }), 'secret/token fields');
  }],
  ['account id cannot be token material', () => {
    expectThrows('token account id', () => parseContentPublishPayload({ ...validPayload, account_id: 'bearer-token-value' }), 'not token material');
  }],
  ['preview redacts account id', () => {
    const preview = buildContentPublishPayloadPreview(validPayload);
    const serialized = JSON.stringify(preview);
    assert(!serialized.includes('urn:li:person:abc123XYZ'), 'Preview must not include full account id.');
    assert(preview.account_id_hint === 'linkedin_member_urn_present', 'Preview should show only a safe account hint.');
  }],
  ['preview does not include raw payload', () => {
    const preview = buildContentPublishPayloadPreview(validPayload);
    const safety = preview.safety as Record<string, unknown>;
    assert(safety.raw_payload_in_browser_preview === false, 'Preview should not expose raw payload.');
    assert(safety.browser_receives_token === false, 'Browser must not receive token.');
  }],
  ['payload safety flags cannot allow publishing', () => {
    expectThrows('publish flag true', () => contentPublishPayloadSchema.parse({ ...validPayload, safety: { manual_approval_required: true, real_publish_allowed_by_payload: true, auto_run_allowed_by_payload: false, external_api_call_allowed_by_payload: false } }), 'Invalid literal value');
  }],
  ['payload output confirms no external API call', () => {
    const payload = parseContentPublishPayload(validPayload);
    assert(payload.browser_receives_token === false, 'Browser token flag must be false.');
    assert(payload.publish_ready === false, 'Payload alone must not mark publish_ready.');
    assert(payload.executor_enabled === false, 'Executor enabled flag must be false.');
    assert(payload.external_api_called === false, 'External API called flag must be false.');
  }],
  ['zod schema rejects unknown fields', () => {
    try {
      contentPublishPayloadSchema.parse({ ...validPayload, extra_field: 'not allowed' });
    } catch (error) {
      assert(error instanceof z.ZodError, 'Unknown field should throw a ZodError.');
      return;
    }
    throw new Error('Unknown fields should be rejected.');
  }],
];

let passed = 0;
const failures: string[] = [];
for (const [name, fn] of checks) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`✗ ${name}: ${message}`);
  }
}

if (failures.length) {
  console.error(`phase9:content-payload:test — ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`phase9:content-payload:test — ${passed} passed, 0 failed`);
console.log('Selected platform: linkedin');
console.log('Payload schema: content_publish_payload.v0.7.0.phase_9_4');
console.log('Real external writes added: false');
console.log('Auto-run enabled: false');
