import { z } from 'zod';
import {
  buildContentMediaAssetHandlingFlow,
  buildContentMediaAssetPreview,
  contentMediaAssetHandlingModel,
  contentMediaAssetMetadataSchema,
  CONTENT_MEDIA_ASSET_LIMITS,
  CONTENT_MEDIA_STORAGE_FLOW,
  findForbiddenMediaAssetKeys,
  parseContentMediaAssetMetadata,
  sanitizeMediaFileName,
} from './content-media-assets.js';

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

const validImage = {
  platform: 'linkedin',
  asset_kind: 'image',
  original_file_name: 'founder-performance-preview.png',
  mime_type: 'image/png',
  size_bytes: 1_200_000,
  checksum_sha256: 'a'.repeat(64),
  image: {
    width_pixels: 1200,
    height_pixels: 628,
    alt_text: 'LIFE.SAVER founder performance preview chart.',
  },
};

const validVideo = {
  platform: 'linkedin',
  asset_kind: 'video',
  original_file_name: 'weekly-brief-preview.mp4',
  mime_type: 'video/mp4',
  size_bytes: 12_000_000,
  checksum_sha256: 'b'.repeat(64),
  video: {
    duration_seconds: 18,
    width_pixels: 1920,
    height_pixels: 1080,
    thumbnail_required: false,
    captions_required: false,
  },
};

const checks: Array<[string, () => void]> = [
  ['phase 9.5 model is selected', () => assert(contentMediaAssetHandlingModel.phase === 'v0.7.0_phase_9_5', 'Phase must be v0.7.0_phase_9_5.')],
  ['health mode updated', () => assert(contentMediaAssetHandlingModel.healthMode === 'v2-phase-9-5-media-asset-handling', 'Health mode mismatch.')],
  ['selected platform remains linkedin', () => assert(contentMediaAssetHandlingModel.selectedPlatform === 'linkedin', 'Selected platform must remain LinkedIn.')],
  ['upload flow is defined', () => assert(contentMediaAssetHandlingModel.uploadFlowDefined === true, 'Upload flow must be defined.')],
  ['storage plan is defined', () => assert(contentMediaAssetHandlingModel.storagePlanDefined === true, 'Storage plan must be defined.')],
  ['validation rules are defined', () => assert(contentMediaAssetHandlingModel.validationRulesDefined === true, 'Validation rules must be defined.')],
  ['file size limits are defined', () => assert(contentMediaAssetHandlingModel.fileSizeLimitsDefined === true, 'File size limits must be defined.')],
  ['mime checks are defined', () => assert(contentMediaAssetHandlingModel.mimeChecksDefined === true, 'MIME checks must be defined.')],
  ['preview contract is defined', () => assert(contentMediaAssetHandlingModel.previewContractDefined === true, 'Preview contract must be defined.')],
  ['no media upload endpoint added', () => assert(contentMediaAssetHandlingModel.mediaUploadEndpointAdded === false, 'Phase 9.5 must not add upload endpoint yet.')],
  ['no storage implementation added', () => assert(contentMediaAssetHandlingModel.storageImplementationAdded === false, 'Phase 9.5 must not add storage implementation yet.')],
  ['no LinkedIn media upload added', () => assert(contentMediaAssetHandlingModel.linkedInMediaUploadAdded === false, 'LinkedIn media upload must not be added.')],
  ['no LinkedIn post executor added', () => assert(contentMediaAssetHandlingModel.linkedInPostExecutorAdded === false, 'LinkedIn post executor must not be added.')],
  ['external API is not called', () => assert(contentMediaAssetHandlingModel.externalApiCalled === false, 'External API must not be called.')],
  ['auto-run remains disabled', () => assert(contentMediaAssetHandlingModel.autoRunEnabled === false, 'Auto-run must remain disabled.')],
  ['manual approval remains required', () => assert(contentMediaAssetHandlingModel.manualApprovalRequired === true, 'Manual approval must remain required.')],
  ['image limits include LinkedIn pixel cap', () => assert(CONTENT_MEDIA_ASSET_LIMITS.image.maxPixelCount === 36_152_320, 'Image pixel cap mismatch.')],
  ['image MIME values are limited', () => assert(CONTENT_MEDIA_ASSET_LIMITS.image.allowedMimeTypes.includes('image/png'), 'PNG should be supported.')],
  ['video limits are conservative', () => assert(CONTENT_MEDIA_ASSET_LIMITS.video.maxBytes === 500 * 1024 * 1024, 'Video max bytes should be 500MB.')],
  ['video MIME values are limited to mp4', () => assert(CONTENT_MEDIA_ASSET_LIMITS.video.allowedMimeTypes.length === 1 && CONTENT_MEDIA_ASSET_LIMITS.video.allowedMimeTypes[0] === 'video/mp4', 'Video MIME should only be video/mp4.')],
  ['storage flow is private', () => assert(CONTENT_MEDIA_STORAGE_FLOW.visibility === 'private', 'Storage must be private.')],
  ['preview URL is short lived', () => assert(CONTENT_MEDIA_STORAGE_FLOW.previewUrlType === 'short_lived_signed_url', 'Preview must use signed URL.')],
  ['browser receives no permanent URL', () => assert(CONTENT_MEDIA_STORAGE_FLOW.browserReceivesPermanentStorageUrl === false, 'Browser must not receive permanent storage URL.')],
  ['browser receives no LinkedIn upload URL', () => assert(CONTENT_MEDIA_STORAGE_FLOW.browserReceivesLinkedInUploadUrl === false, 'Browser must not receive LinkedIn upload URL.')],
  ['valid image parses', () => {
    const asset = parseContentMediaAssetMetadata(validImage);
    assert(asset.asset_kind === 'image', 'Asset kind should be image.');
    assert(asset.linkedInUploadApi === 'images_api', 'Image should map to Images API.');
    assert(asset.linkedInUrnRequiredBeforePost === 'urn:li:image:{id}', 'Image URN requirement mismatch.');
    assert(asset.linkedIn_upload_enabled === false, 'LinkedIn upload must be disabled now.');
  }],
  ['valid video parses', () => {
    const asset = parseContentMediaAssetMetadata(validVideo);
    assert(asset.asset_kind === 'video', 'Asset kind should be video.');
    assert(asset.linkedInUploadApi === 'videos_api', 'Video should map to Videos API.');
    assert(asset.linkedInUrnRequiredBeforePost === 'urn:li:video:{id}', 'Video URN requirement mismatch.');
  }],
  ['file name sanitizes spaces', () => assert(sanitizeMediaFileName('weekly brief preview.png') === 'weekly-brief-preview.png', 'Spaces should become hyphens.')],
  ['path separators are blocked', () => expectThrows('path separator', () => sanitizeMediaFileName('../secret.png'), 'path separators')],
  ['unsupported file name characters are blocked', () => expectThrows('bad filename', () => sanitizeMediaFileName('preview<script>.png'), 'unsupported characters')],
  ['wrong image MIME is rejected', () => expectThrows('wrong image mime', () => parseContentMediaAssetMetadata({ ...validImage, mime_type: 'application/pdf' }), 'Image MIME type')],
  ['wrong image extension is rejected', () => expectThrows('wrong image extension', () => parseContentMediaAssetMetadata({ ...validImage, original_file_name: 'preview.webp' }), 'Image file extension')],
  ['oversized image is rejected', () => expectThrows('oversized image', () => parseContentMediaAssetMetadata({ ...validImage, size_bytes: 25 * 1024 * 1024 }), '20MB')],
  ['oversized image pixels are rejected', () => expectThrows('oversized pixels', () => parseContentMediaAssetMetadata({ ...validImage, image: { width_pixels: 10_000, height_pixels: 10_000 } }), 'pixel count')],
  ['oversized GIF frame count is rejected', () => expectThrows('gif frames', () => parseContentMediaAssetMetadata({ ...validImage, original_file_name: 'preview.gif', mime_type: 'image/gif', image: { width_pixels: 500, height_pixels: 500, gif_frame_count: 251 } }), 'GIF frame')],
  ['wrong video MIME is rejected', () => expectThrows('wrong video mime', () => parseContentMediaAssetMetadata({ ...validVideo, mime_type: 'video/quicktime' }), 'Video MIME type')],
  ['wrong video extension is rejected', () => expectThrows('wrong video extension', () => parseContentMediaAssetMetadata({ ...validVideo, original_file_name: 'clip.mov' }), 'Video file extension')],
  ['video below minimum size is rejected', () => expectThrows('small video', () => parseContentMediaAssetMetadata({ ...validVideo, size_bytes: 10_000 }), 'minimum size')],
  ['video above 500MB safety cap is rejected', () => expectThrows('large video', () => parseContentMediaAssetMetadata({ ...validVideo, size_bytes: 501 * 1024 * 1024 }), '500MB')],
  ['video below duration is rejected', () => expectThrows('short video', () => parseContentMediaAssetMetadata({ ...validVideo, video: { duration_seconds: 2 } }), 'minimum duration')],
  ['video above duration is rejected', () => expectThrows('long video', () => parseContentMediaAssetMetadata({ ...validVideo, video: { duration_seconds: 31 * 60 } }), 'maximum duration')],
  ['image cannot include video metadata', () => expectThrows('image video metadata', () => parseContentMediaAssetMetadata({ ...validImage, video: { duration_seconds: 10 } }), 'must not include video metadata')],
  ['video cannot include image metadata', () => expectThrows('video image metadata', () => parseContentMediaAssetMetadata({ ...validVideo, image: { width_pixels: 100, height_pixels: 100 } }), 'must not include image metadata')],
  ['metadata secret-like keys are blocked', () => {
    const forbidden = findForbiddenMediaAssetKeys({ metadata: { access_token: 'abc' }, upload: { upload_url: 'abc' } });
    assert(forbidden.includes('$.metadata.access_token'), 'access_token should be detected.');
    assert(forbidden.includes('$.upload.upload_url'), 'upload_url should be detected.');
    expectThrows('secret metadata', () => parseContentMediaAssetMetadata({ ...validImage, access_token: 'abc' }), 'secret/upload/token fields');
  }],
  ['preview is browser safe', () => {
    const preview = buildContentMediaAssetPreview(validImage);
    const serialized = JSON.stringify(preview);
    assert(!serialized.includes('a'.repeat(64)), 'Preview must not include checksum.');
    const storage = preview.storage as Record<string, unknown>;
    assert(storage.object_key_exposed_to_browser === false, 'Object key must not be exposed to browser.');
  }],
  ['preview confirms no external API call', () => {
    const preview = buildContentMediaAssetPreview(validVideo);
    const linkedin = preview.linkedin as Record<string, unknown>;
    assert(linkedin.linkedIn_upload_enabled_now === false, 'LinkedIn upload should be disabled now.');
    assert(linkedin.external_api_called === false, 'External API called flag should be false.');
  }],
  ['image flow includes future LinkedIn Images API', () => {
    const flow = buildContentMediaAssetHandlingFlow('image');
    const linkedInFutureUpload = flow.linkedInFutureUpload as Record<string, unknown>;
    assert(linkedInFutureUpload.api === 'Images API', 'Image flow should refer to Images API.');
    assert(Array.isArray(flow.steps), 'Flow should include steps.');
  }],
  ['video flow includes future LinkedIn Videos API', () => {
    const flow = buildContentMediaAssetHandlingFlow('video');
    const linkedInFutureUpload = flow.linkedInFutureUpload as Record<string, unknown>;
    assert(linkedInFutureUpload.api === 'Videos API', 'Video flow should refer to Videos API.');
    assert(linkedInFutureUpload.multipartUploadExpected === true, 'Video flow should expect multipart upload.');
  }],
  ['schema rejects unknown fields', () => {
    try {
      contentMediaAssetMetadataSchema.parse({ ...validImage, extra_field: 'not allowed' });
    } catch (error) {
      assert(error instanceof z.ZodError, 'Unknown field should throw a ZodError.');
      return;
    }
    throw new Error('Unknown fields should be rejected.');
  }],
  ['payload safety flags cannot enable upload', () => {
    expectThrows('upload flag true', () => contentMediaAssetMetadataSchema.parse({ ...validImage, safety: { manual_approval_required: true, media_upload_to_linkedin_allowed_by_payload: true, real_publish_allowed_by_payload: false, auto_run_allowed_by_payload: false, external_api_call_allowed_by_payload: false } }), 'Invalid literal value');
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
  console.error(`phase9:media-assets:test — ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`phase9:media-assets:test — ${passed} passed, 0 failed`);
console.log('Selected platform: linkedin');
console.log('Media asset flow: upload/storage/validation/limits/MIME/preview defined');
console.log('Real external writes added: false');
console.log('LinkedIn media upload added: false');
console.log('Auto-run enabled: false');
