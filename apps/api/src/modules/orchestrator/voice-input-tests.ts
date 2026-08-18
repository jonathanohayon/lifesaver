import assert from 'node:assert/strict';
import {
  VOICE_INPUT_HEALTH_MODE,
  buildVoiceInputReport,
  buildVoiceInputStatus,
  previewVoiceInput,
} from './voice-input.model.js';

function run() {
  const status = buildVoiceInputStatus();
  assert.equal(VOICE_INPUT_HEALTH_MODE, 'v2-phase-15-7-voice-input');
  assert.equal(status.healthMode, 'v2-phase-15-7-voice-input');
  assert.equal(status.browserSpeechRecognitionAdded, true);
  assert.equal(status.textFallbackKept, true);
  assert.equal(status.serverSideAudioCaptureEnabled, false);
  assert.equal(status.audioStorageEnabled, false);
  assert.equal(status.actionCreationEnabled, false);
  assert.equal(status.executorEnabled, false);
  assert.equal(status.voiceAutoRunEnabled, false);

  const ready = previewVoiceInput({ transcript: 'Check revenue please', browser_support: 'supported', user_confirmed_submit: true });
  assert.equal(ready.decision, 'ready_for_text_submission');
  assert.equal(ready.wouldPopulateTextInput, true);
  assert.equal(ready.wouldSubmitToChatOrchestrator, true);
  assert.equal(ready.safety.noServerSideAudioCapture, true);
  assert.equal(ready.safety.noToolInvocation, true);
  assert.equal(ready.safety.noActionCreated, true);

  const empty = previewVoiceInput({ transcript: '   ', browser_support: 'supported' });
  assert.equal(empty.decision, 'blocked_empty_transcript');
  assert.equal(empty.wouldSubmitToChatOrchestrator, false);

  const unsupported = previewVoiceInput({ transcript: 'Check ads', browser_support: 'unsupported', user_confirmed_submit: true });
  assert.equal(unsupported.decision, 'blocked_unsupported_browser');
  assert.equal(unsupported.textFallbackAvailable, true);

  const emergency = previewVoiceInput({ transcript: 'Send all emails now', browser_support: 'supported', user_confirmed_submit: true, emergency_safe_mode: true, force: true });
  assert.equal(emergency.decision, 'blocked_by_safety_gate');
  assert.equal(emergency.wouldSubmitToChatOrchestrator, false);
  assert.ok(emergency.warnings.some((w) => w.includes('force=true')));

  const secretLike = previewVoiceInput({ transcript: 'My API key is abc123', browser_support: 'supported' });
  assert.ok(secretLike.warnings.some((w) => w.includes('secret-like')));

  const report = buildVoiceInputReport();
  assert.equal(report.deliverable, 'voice_input_ui');
  assert.ok(report.frontendFiles.includes('apps/web/src/assets/js/voice-input.js'));
  assert.ok(report.safetyRules.some((rule) => rule.includes('No server-side audio capture')));
  assert.equal(report.nextStep, 'Phase 15.8 — Daily Action Digest');

  console.log('Phase 15.7 voice input tests passed.');
}

run();
