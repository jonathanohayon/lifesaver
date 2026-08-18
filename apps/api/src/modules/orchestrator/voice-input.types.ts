export type VoiceInputHealthMode = 'v2-phase-15-7-voice-input';

export type VoiceInputSupportStatus = 'supported' | 'unsupported' | 'unknown';
export type VoiceInputDecision = 'ready_for_text_submission' | 'blocked_empty_transcript' | 'blocked_unsupported_browser' | 'blocked_by_safety_gate';

export interface VoiceInputSafety {
  browserSpeechRecognitionOnly: true;
  textFallbackKept: true;
  noServerSideAudioCapture: true;
  noAudioStored: true;
  noTranscriptStoredByVoiceModule: true;
  noAutomaticSubmissionWithoutUserStop: true;
  noClaudeCallFromVoiceModule: true;
  noOrchestratorExecutionFromVoiceModule: true;
  noToolInvocation: true;
  noExternalConnectorCalled: true;
  noActionCreated: true;
  noExecutorCalled: true;
  noAutoRun: true;
  noDatabaseMigrationRequired: true;
}

export interface VoiceInputPreviewInput {
  transcript?: string;
  interim_transcript?: string;
  browser_support?: VoiceInputSupportStatus | string;
  user_confirmed_submit?: boolean;
  master_pause_active?: boolean;
  emergency_safe_mode?: boolean;
  force?: boolean;
}

export interface VoiceInputPreviewResult {
  phase: 'V2 Phase 15.7 — Voice Input';
  healthMode: VoiceInputHealthMode;
  deliverable: 'voice_input_ui';
  decision: VoiceInputDecision;
  normalizedTranscript: string;
  transcriptLength: number;
  wouldPopulateTextInput: boolean;
  wouldSubmitToChatOrchestrator: boolean;
  textFallbackAvailable: true;
  issues: string[];
  warnings: string[];
  uiGuidance: string[];
  safety: VoiceInputSafety;
}

export interface VoiceInputStatus {
  phase: 'V2 Phase 15.7 — Voice Input';
  healthMode: VoiceInputHealthMode;
  deliverable: 'voice_input_ui';
  browserSpeechRecognitionAdded: true;
  speakCommandSupported: true;
  convertToTextSupported: true;
  submitToChatOrchestratorSupported: true;
  textFallbackKept: true;
  serverSideAudioCaptureEnabled: false;
  audioStorageEnabled: false;
  voiceAutoRunEnabled: false;
  actionCreationEnabled: false;
  executorEnabled: false;
  nextStep: 'Phase 15.8 — Daily Action Digest';
}

export interface VoiceInputReport {
  phase: 'V2 Phase 15.7 — Voice Input';
  healthMode: VoiceInputHealthMode;
  deliverable: 'voice_input_ui';
  purpose: string;
  frontendFiles: string[];
  backendFiles: string[];
  apiEndpoints: string[];
  supportedFlow: string[];
  browserSupportNotes: string[];
  safetyRules: string[];
  examplePreview: VoiceInputPreviewResult;
  safety: VoiceInputSafety;
  nextStep: 'Phase 15.8 — Daily Action Digest';
}
