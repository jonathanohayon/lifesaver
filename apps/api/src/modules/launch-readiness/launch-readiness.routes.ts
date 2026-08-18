import { Router } from 'express';
import { getLaunchReadinessController } from './launch-readiness.controller.js';

export const launchReadinessRouter = Router();
launchReadinessRouter.get('/', getLaunchReadinessController);
