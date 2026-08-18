import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentFinalPublishValidationStatus, validateContentBeforePublish } from './content-final-publish-validator.model.js';
import type { ContentAutoRunAllowedWindow } from './content-auto-run-channel-time.types.js';

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

export function getContentFinalPublishValidationStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentFinalPublishValidationStatus()));
}

export function getContentFinalPublishValidationPreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(validateContentBeforePublish({
      caption: typeof req.query.caption === 'string'
        ? req.query.caption
        : 'A calm founder update: today we are sharing a practical ecommerce workflow improvement, focused on clearer decisions, safer systems, and better operating rhythm.',
      platform: typeof req.query.platform === 'string' ? req.query.platform : 'linkedin',
      channel: typeof req.query.channel === 'string' ? req.query.channel : 'linkedin_member_feed',
      actionType: typeof req.query.actionType === 'string' ? req.query.actionType : 'content_publish',
      mediaType: typeof req.query.mediaType === 'string' ? req.query.mediaType : 'none',
      linkUrl: typeof req.query.linkUrl === 'string' ? req.query.linkUrl : undefined,
      hashtags: parseList(req.query.hashtags),
      timezone: typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC',
      currentTime: typeof req.query.currentTime === 'string' ? req.query.currentTime : undefined,
      scheduledTime: typeof req.query.scheduledTime === 'string' ? req.query.scheduledTime : undefined,
      maxPostsPerDay: parseNumber(req.query.maxPostsPerDay),
      publishedTodayCount: parseNumber(req.query.publishedTodayCount),
      reservedTodayCount: parseNumber(req.query.reservedTodayCount),
      proposedNewPosts: parseNumber(req.query.proposedNewPosts),
      allowedPlatforms: parseList(req.query.allowedPlatforms),
      allowedChannels: parseList(req.query.allowedChannels),
      allowedWindows: parseAllowedWindows(req),
      policyAutoApprovalRuleMatched: parseBoolean(req.query.policyAutoApprovalRuleMatched),
      masterPauseActive: parseBoolean(req.query.masterPauseActive),
      contentPauseActive: parseBoolean(req.query.contentPauseActive),
      emergencySafeModeActive: parseBoolean(req.query.emergencySafeModeActive),
      ruleStillEnabled: parseBoolean(req.query.ruleStillEnabled),
      tokenConnected: parseBoolean(req.query.tokenConnected) ?? true,
      tokenExpiresAt: typeof req.query.tokenExpiresAt === 'string' ? req.query.tokenExpiresAt : '2099-01-01T00:00:00.000Z',
      tokenHasRequiredScope: parseBoolean(req.query.tokenHasRequiredScope) ?? true,
      requiredScope: typeof req.query.requiredScope === 'string' ? req.query.requiredScope : undefined,
      offerSourceAttached: parseBoolean(req.query.offerSourceAttached),
      verifiedMetricSourceAttached: parseBoolean(req.query.verifiedMetricSourceAttached),
      complianceNoteAttached: parseBoolean(req.query.complianceNoteAttached),
    }))); 
  } catch (error) {
    return next(error);
  }
}
