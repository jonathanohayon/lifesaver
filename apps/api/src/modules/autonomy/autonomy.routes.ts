import { Router } from 'express';
import { getAutonomyStatusController, pauseAutonomyController, resumeAutonomyController } from './autonomy.controller.js';

export const autonomyRouter = Router();

// Phase 5.4/5.6: read-only, workspace-scoped autonomy status.
autonomyRouter.get('/status', getAutonomyStatusController);

// Phase 5.4/5.6: owner/admin-only internal pause update. This does not execute, queue, publish, send, or spend.
autonomyRouter.post('/pause', pauseAutonomyController);

// Phase 5.4/5.6: owner/admin-only internal resume update. This only changes pause flags; it does not execute waiting actions.
autonomyRouter.post('/resume', resumeAutonomyController);
