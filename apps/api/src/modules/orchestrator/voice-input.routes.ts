import { Router } from 'express';
import {
  getVoiceInputExample,
  getVoiceInputReport,
  getVoiceInputStatus,
  previewVoiceInputController,
} from './voice-input.controller.js';

export const voiceInputRouter = Router();

// Phase 15.7: browser SpeechRecognition UI support only. No server-side audio capture, no transcript storage, no tool invocation, no action creation, no executor, and no auto-run.
voiceInputRouter.get('/voice-input/status', getVoiceInputStatus);
voiceInputRouter.get('/voice-input/report', getVoiceInputReport);
voiceInputRouter.get('/voice-input/example', getVoiceInputExample);
voiceInputRouter.post('/voice-input/preview', previewVoiceInputController);
