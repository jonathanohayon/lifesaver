import { Router } from 'express';
import {
  getMemoryUiExample,
  getMemoryUiReport,
  getMemoryUiStatus,
  previewMemoryUiOperationController,
} from './memory-ui.controller.js';

export const memoryUiRouter = Router();

// Phase 15.5: founder-visible memory management UI preview. No backend persistence, no Claude memory injection, no tool invocation, no external connector call, no action creation, no execution, no auto-run.
memoryUiRouter.get('/memory-ui/status', getMemoryUiStatus);
memoryUiRouter.get('/memory-ui/report', getMemoryUiReport);
memoryUiRouter.get('/memory-ui/example', getMemoryUiExample);
memoryUiRouter.post('/memory-ui/preview', previewMemoryUiOperationController);
