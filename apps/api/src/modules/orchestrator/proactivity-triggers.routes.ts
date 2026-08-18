import { Router } from 'express';
import {
  getProactivityTriggersExample,
  getProactivityTriggersRegistry,
  getProactivityTriggersReport,
  getProactivityTriggersStatus,
  previewProactivityTriggersController,
} from './proactivity-triggers.controller.js';

export const proactivityTriggersRouter = Router();

// Phase 15.6: proactivity trigger framework only. No scheduler enablement, no event listener, no action creation, no notification sending, no Claude call, no tool invocation, no external connector call, no executor call, no auto-run.
proactivityTriggersRouter.get('/proactivity-triggers/status', getProactivityTriggersStatus);
proactivityTriggersRouter.get('/proactivity-triggers/report', getProactivityTriggersReport);
proactivityTriggersRouter.get('/proactivity-triggers/registry', getProactivityTriggersRegistry);
proactivityTriggersRouter.get('/proactivity-triggers/example', getProactivityTriggersExample);
proactivityTriggersRouter.post('/proactivity-triggers/preview', previewProactivityTriggersController);
