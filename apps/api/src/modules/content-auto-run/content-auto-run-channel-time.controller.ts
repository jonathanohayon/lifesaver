import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentAutoRunChannelTimeStatus, checkContentAutoRunChannelTimeRestrictions } from './content-auto-run-channel-time.model.js';
import type { ContentAutoRunAllowedWindow } from './content-auto-run-channel-time.types.js';

function parseList(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseAllowedWindows(req: Request): ContentAutoRunAllowedWindow[] | undefined {
  const startTime = typeof req.query.startTime === 'string' ? req.query.startTime : undefined;
  const endTime = typeof req.query.endTime === 'string' ? req.query.endTime : undefined;
  if (!startTime || !endTime) return undefined;
  return [{
    label: typeof req.query.windowLabel === 'string' ? req.query.windowLabel : 'preview_window',
    startTime,
    endTime,
    days: parseList(req.query.days) as ContentAutoRunAllowedWindow['days'],
  }];
}

export function getContentAutoRunChannelTimeStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentAutoRunChannelTimeStatus()));
}

export function getContentAutoRunChannelTimePreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(checkContentAutoRunChannelTimeRestrictions({
      platform: typeof req.query.platform === 'string' ? req.query.platform : 'linkedin',
      channel: typeof req.query.channel === 'string' ? req.query.channel : 'linkedin_member_feed',
      actionType: typeof req.query.actionType === 'string' ? req.query.actionType : 'content_publish',
      timezone: typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC',
      currentTime: typeof req.query.currentTime === 'string' ? req.query.currentTime : undefined,
      scheduledTime: typeof req.query.scheduledTime === 'string' ? req.query.scheduledTime : undefined,
      allowedPlatforms: parseList(req.query.allowedPlatforms),
      allowedChannels: parseList(req.query.allowedChannels),
      allowedWindows: parseAllowedWindows(req),
    })));
  } catch (error) {
    return next(error);
  }
}
