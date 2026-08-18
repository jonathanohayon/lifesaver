import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
  buildSpecialistPromptExampleInputs,
  buildSpecialistPromptPacks,
  buildSpecialistPromptRegistryReport,
  buildSpecialistPromptRegistryStatus,
  buildSpecialistToolRegistry,
  previewSpecialistPromptPack,
} from './specialist-prompt-registry.model.js';

export function getSpecialistPromptRegistryStatus(_req: Request, res: Response) {
  return res.json(ok(buildSpecialistPromptRegistryStatus()));
}

export function getSpecialistPromptRegistryReport(_req: Request, res: Response) {
  return res.json(ok(buildSpecialistPromptRegistryReport()));
}

export function getSpecialistPromptRegistryRegistry(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'phase_15_2_specialist_prompt_packs',
    healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
    promptPacks: buildSpecialistPromptPacks(),
    toolRegistry: buildSpecialistToolRegistry(),
  }));
}

export function getSpecialistPromptRegistryExample(_req: Request, res: Response) {
  const exampleInputs = buildSpecialistPromptExampleInputs();
  return res.json(ok({
    phase: 'phase_15_2_specialist_prompt_packs',
    healthMode: SPECIALIST_PROMPT_REGISTRY_HEALTH_MODE,
    exampleInputs,
    examplePreviews: Object.fromEntries(Object.entries(exampleInputs).map(([key, input]) => [key, previewSpecialistPromptPack(input)])),
  }));
}

export function previewSpecialistPromptRegistry(req: Request, res: Response) {
  return res.json(ok(previewSpecialistPromptPack(req.body)));
}
