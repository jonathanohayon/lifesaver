import type {
  VoiceInputPreviewInput,
  VoiceInputPreviewResult,
  VoiceInputReport,
  VoiceInputSafety,
  VoiceInputStatus,
  VoiceInputSupportStatus,
} from './voice-input.types.js';

export const VOICE_INPUT_PHASE = 'phase_15_7_voice_input' as const;
export const VOICE_INPUT_HEALTH_MODE = 'v2-phase-15-7-voice-input' as const;
export const VOICE_INPUT_PACKAGE = 'lifesaver-v0.7.0-phase-15-7-voice-input.zip' as const;

export const VOICE_INPUT_SAFETY: VoiceInputSafety = {
  browserSpeechRecognitionOnly: true,
  textFallbackKept: true,
  noServerSideAudioCapture: true,
  noAudioStored: true,
  noTranscriptStoredByVoiceModule: true,
  noAutomaticSubmissionWithoutUserStop: true,
  noClaudeCallFromVoiceModule: true,
  noOrchestratorExecutionFromVoiceModule: true,
  noToolInvocation: true,
  noExternalConnectorCalled: true,
  noActionCreated: true,
  noExecutorCalled: true,
  noAutoRun: true,
  noDatabaseMigrationRequired: true,
};

const SECRET_LIKE_PATTERNS = [
  /api[_\s-]?key/i,
  /access[_\s-]?token/i,
  /refresh[_\s-]?token/i,
  /client[_\s-]?secret/i,
  /authorization:\s*bearer/i,
  /database[_\s-]?url/i,
  /claude[_\s-]?api[_\s-]?key/i,
  /triple\s*whale\s*key/i,
  /password\s*[:=]/i,
];

function normalizeTranscript(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function normalizeSupportStatus(value: unknown): VoiceInputSupportStatus {
  if (value === 'supported' || value === 'unsupported' || value === 'unknown') return value;
  return 'unknown';
}

export function buildVoiceInputStatus(): VoiceInputStatus {
  return {
    phase: 'V2 Phase 15.7 — Voice Input',
    healthMode: VOICE_INPUT_HEALTH_MODE,
    deliverable: 'voice_input_ui',
    browserSpeechRecognitionAdded: true,
    speakCommandSupported: true,
    convertToTextSupported: true,
    submitToChatOrchestratorSupported: true,
    textFallbackKept: true,
    serverSideAudioCaptureEnabled: false,
    audioStorageEnabled: false,
    voiceAutoRunEnabled: false,
    actionCreationEnabled: false,
    executorEnabled: false,
    nextStep: 'Phase 15.8 — Daily Action Digest',
  };
}

export function previewVoiceInput(input: VoiceInputPreviewInput = {}): VoiceInputPreviewResult {
  const transcript = normalizeTranscript(input.transcript || input.interim_transcript);
  const support = normalizeSupportStatus(input.browser_support);
  const issues: string[] = [];
  const warnings: string[] = [];
  const uiGuidance: string[] = [
    'Use the microphone button to start browser SpeechRecognition where supported.',
    'Transcript is placed into the normal chat text input before submission.',
    'The existing typed input remains the fallback on every browser.',
  ];

  if (!transcript) issues.push('Transcript is empty. Nothing should be submitted.');
  if (support === 'unsupported') issues.push('Browser SpeechRecognition is not supported. Keep text fallback active.');
  if (input.master_pause_active) warnings.push('Master pause is active. Voice input may still fill text, but no execution or autonomy is allowed.');
  if (input.emergency_safe_mode) warnings.push('Emergency safe mode is active. Voice input remains UI-only and must not trigger execution.');
  if (input.force) warnings.push('force=true is ignored by the voice input module.');
  if (SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(transcript))) warnings.push('Transcript appears to mention secret-like data. Do not store or log raw secrets.');

  let decision: VoiceInputPreviewResult['decision'] = 'ready_for_text_submission';
  if (!transcript) decision = 'blocked_empty_transcript';
  else if (support === 'unsupported') decision = 'blocked_unsupported_browser';
  else if (input.emergency_safe_mode) decision = 'blocked_by_safety_gate';

  return {
    phase: 'V2 Phase 15.7 — Voice Input',
    healthMode: VOICE_INPUT_HEALTH_MODE,
    deliverable: 'voice_input_ui',
    decision,
    normalizedTranscript: transcript,
    transcriptLength: transcript.length,
    wouldPopulateTextInput: Boolean(transcript),
    wouldSubmitToChatOrchestrator: decision === 'ready_for_text_submission' && input.user_confirmed_submit === true,
    textFallbackAvailable: true,
    issues,
    warnings,
    uiGuidance,
    safety: VOICE_INPUT_SAFETY,
  };
}

export function buildVoiceInputExample(): VoiceInputPreviewResult {
  return previewVoiceInput({
    transcript: 'LIFE.SAVER, check revenue and tell me if ROAS softened today.',
    browser_support: 'supported',
    user_confirmed_submit: true,
  });
}

export function buildVoiceInputReport(): VoiceInputReport {
  return {
    phase: 'V2 Phase 15.7 — Voice Input',
    healthMode: VOICE_INPUT_HEALTH_MODE,
    deliverable: 'voice_input_ui',
    purpose: 'Add a safe browser SpeechRecognition UI so the founder can speak a command, convert it to text, and submit it through the existing chat/orchestrator path while keeping typed fallback.',
    frontendFiles: [
      'apps/web/src/index.html',
      'apps/web/src/assets/js/voice-input.js',
      'apps/web/src/assets/css/voice-input.css',
    ],
    backendFiles: [
      'apps/api/src/modules/orchestrator/voice-input.types.ts',
      'apps/api/src/modules/orchestrator/voice-input.model.ts',
      'apps/api/src/modules/orchestrator/voice-input.controller.ts',
      'apps/api/src/modules/orchestrator/voice-input.routes.ts',
      'apps/api/src/modules/orchestrator/voice-input-tests.ts',
    ],
    apiEndpoints: [
      'GET /api/v1/orchestrator/voice-input/status',
      'GET /api/v1/orchestrator/voice-input/report',
      'GET /api/v1/orchestrator/voice-input/example',
      'POST /api/v1/orchestrator/voice-input/preview',
    ],
    supportedFlow: [
      'Founder clicks/taps microphone.',
      'Browser asks for microphone permission.',
      'Browser SpeechRecognition converts speech to text locally through browser capability.',
      'Transcript fills the existing chat input.',
      'Founder can edit the text before sending.',
      'Send uses the existing safe chat/orchestrator path.',
    ],
    browserSupportNotes: [
      'Uses window.SpeechRecognition or window.webkitSpeechRecognition.',
      'Unsupported browsers show the typed input fallback.',
      'No server-side audio upload is introduced.',
    ],
    safetyRules: [
      'No server-side audio capture.',
      'No audio storage.',
      'No transcript persistence in this module.',
      'No direct Claude call from the voice input module.',
      'No tool invocation from the voice input module.',
      'No action creation or executor call from voice input.',
      'Text fallback stays available.',
    ],
    examplePreview: buildVoiceInputExample(),
    safety: VOICE_INPUT_SAFETY,
    nextStep: 'Phase 15.8 — Daily Action Digest',
  };
}
