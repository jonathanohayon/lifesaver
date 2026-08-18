import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentAutoRunDailyCapStatus, checkContentAutoRunDailyPostCap } from './content-auto-run-daily-cap.model.js';

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getContentAutoRunDailyCapStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentAutoRunDailyCapStatus()));
}

export function getContentAutoRunDailyCapPreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(checkContentAutoRunDailyPostCap({
      platform: typeof req.query.platform === 'string' ? req.query.platform : 'linkedin',
      actionType: typeof req.query.actionType === 'string' ? req.query.actionType : 'content_publish',
      timezone: typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC',
      maxPostsPerDay: parseNumber(req.query.maxPostsPerDay),
      publishedTodayCount: parseNumber(req.query.publishedTodayCount),
      reservedTodayCount: parseNumber(req.query.reservedTodayCount),
      proposedNewPosts: parseNumber(req.query.proposedNewPosts),
    })));
  } catch (error) {
    return next(error);
  }
}
