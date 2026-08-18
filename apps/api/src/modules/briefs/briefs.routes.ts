import { Router } from 'express';
import { authRequired } from '../../common/middleware/auth-required.js';
import { generateBriefController, generateWeeklyController, getBrief, getWeekly } from './briefs.controller.js';

export const briefRouter = Router();
export const weeklyRouter = Router();

briefRouter.get('/', getBrief);
briefRouter.post('/generate', authRequired, generateBriefController);

weeklyRouter.get('/', getWeekly);
weeklyRouter.post('/generate', authRequired, generateWeeklyController);
