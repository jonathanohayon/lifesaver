import { Router } from 'express';
import {
  getMemorySchemaExample,
  getMemorySchemaReport,
  getMemorySchemaSchema,
  getMemorySchemaStatus,
  previewMemorySchemaController,
} from './memory-schema.controller.js';

export const memorySchemaRouter = Router();

// Phase 15.4: memory schema only. No UI, no automatic capture, no Claude prompt injection, no tool invocation, no action creation, no execution, no auto-run.
memorySchemaRouter.get('/memory-schema/status', getMemorySchemaStatus);
memorySchemaRouter.get('/memory-schema/report', getMemorySchemaReport);
memorySchemaRouter.get('/memory-schema/schema', getMemorySchemaSchema);
memorySchemaRouter.get('/memory-schema/example', getMemorySchemaExample);
memorySchemaRouter.post('/memory-schema/preview', previewMemorySchemaController);
