import { Router } from 'express';
import {
  getToolRoutingExample,
  getToolRoutingMap,
  getToolRoutingReport,
  getToolRoutingStatus,
  previewToolRoutingController,
} from './tool-routing.controller.js';

export const toolRoutingRouter = Router();

// Phase 15.3: unified routing plan only. No tool invocation, no connector call, no action creation, no execution, no auto-run.
toolRoutingRouter.get('/tool-routing/status', getToolRoutingStatus);
toolRoutingRouter.get('/tool-routing/report', getToolRoutingReport);
toolRoutingRouter.get('/tool-routing/map', getToolRoutingMap);
toolRoutingRouter.get('/tool-routing/example', getToolRoutingExample);
toolRoutingRouter.post('/tool-routing/preview', previewToolRoutingController);
