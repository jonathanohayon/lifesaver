import { Router } from 'express';
import {
  getSpecialistPromptRegistryExample,
  getSpecialistPromptRegistryRegistry,
  getSpecialistPromptRegistryReport,
  getSpecialistPromptRegistryStatus,
  previewSpecialistPromptRegistry,
} from './specialist-prompt-registry.controller.js';

export const specialistPromptRegistryRouter = Router();

// Phase 15.2: prompt/tool registry only. No specialist execution, no tool invocation, no connector call, no action creation, no auto-run.
specialistPromptRegistryRouter.get('/specialist-prompts/status', getSpecialistPromptRegistryStatus);
specialistPromptRegistryRouter.get('/specialist-prompts/report', getSpecialistPromptRegistryReport);
specialistPromptRegistryRouter.get('/specialist-prompts/registry', getSpecialistPromptRegistryRegistry);
specialistPromptRegistryRouter.get('/specialist-prompts/example', getSpecialistPromptRegistryExample);
specialistPromptRegistryRouter.post('/specialist-prompts/preview', previewSpecialistPromptRegistry);
