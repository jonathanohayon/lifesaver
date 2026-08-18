import { Router } from 'express';
import { getAudienceReachReportController, getAudienceReachStatusController } from './audience-reach.controller.js';

export const audienceReachRouter = Router();

// v0.8.4: Read-only homepage audience/conversion/reach source widget. No social connector call, action creation, executor call, auto-run, or external write.
audienceReachRouter.get('/', getAudienceReachReportController);
audienceReachRouter.get('/status', getAudienceReachStatusController);
