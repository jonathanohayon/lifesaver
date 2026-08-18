import { Router } from 'express';
import { getSecurityStatusController } from './security.controller.js';

export const securityRouter = Router();
securityRouter.get('/status', getSecurityStatusController);
