import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildVoiceInputExample,
  buildVoiceInputReport,
  buildVoiceInputStatus,
  previewVoiceInput,
} from './voice-input.model.js';

export function getVoiceInputStatus(_req: Request, res: Response) {
  return res.json(ok(buildVoiceInputStatus()));
}

export function getVoiceInputReport(_req: Request, res: Response) {
  return res.json(ok(buildVoiceInputReport()));
}

export function getVoiceInputExample(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'V2 Phase 15.7 — Voice Input',
    healthMode: 'v2-phase-15-7-voice-input',
    example: buildVoiceInputExample(),
  }));
}

export function previewVoiceInputController(req: Request, res: Response) {
  return res.json(ok(previewVoiceInput(req.body)));
}
