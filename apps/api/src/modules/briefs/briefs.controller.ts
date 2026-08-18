import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { generateDailyBrief, generateWeeklySummary, getLatestDailyBrief, getLatestWeeklySummary } from './briefs.service.js';

export async function getBrief(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getLatestDailyBrief(auth?.workspaceId, auth?.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function getWeekly(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getLatestWeeklySummary(auth?.workspaceId, auth?.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function generateBriefController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await generateDailyBrief(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function generateWeeklyController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await generateWeeklySummary(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
