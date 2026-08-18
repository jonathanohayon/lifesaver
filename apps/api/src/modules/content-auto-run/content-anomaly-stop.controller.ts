import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentAnomalyStopStatus, evaluateContentAnomalyStop } from './content-anomaly-stop.model.js';
import type { ContentAnomalyEventInput } from './content-anomaly-stop.types.js';

function boolQuery(value: unknown): boolean {
  return value === 'true' || value === true;
}

function intQuery(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function sampleEvents(req: Request): ContentAnomalyEventInput[] {
  const events: ContentAnomalyEventInput[] = [];
  if (boolQuery(req.query.apiFailureEvent)) {
    events.push({
      kind: 'api_failure',
      message: 'LinkedIn API returned a safe simulated failure response during preview.',
      occurredAt: '2026-07-06T12:00:00.000Z',
      source: 'preview',
    });
  }
  if (boolQuery(req.query.platformWarningEvent)) {
    events.push({
      kind: 'platform_warning',
      message: 'Platform warning requires founder review before the lane continues.',
      occurredAt: '2026-07-06T12:05:00.000Z',
      source: 'preview',
    });
  }
  return events;
}

export function getContentAnomalyStopStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentAnomalyStopStatus()));
}

export function getContentAnomalyStopPreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(evaluateContentAnomalyStop({
      workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : 'workspace_preview',
      platform: typeof req.query.platform === 'string' ? req.query.platform : 'linkedin',
      channel: typeof req.query.channel === 'string' ? req.query.channel : 'linkedin_member_feed',
      currentTime: typeof req.query.currentTime === 'string' ? req.query.currentTime : '2026-07-06T12:10:00.000Z',
      contentAutoRunEnabled: req.query.contentAutoRunEnabled === undefined ? true : boolQuery(req.query.contentAutoRunEnabled),
      masterPauseActive: boolQuery(req.query.masterPauseActive),
      contentPauseActive: boolQuery(req.query.contentPauseActive),
      emergencySafeModeActive: boolQuery(req.query.emergencySafeModeActive),
      dailyCapExceeded: boolQuery(req.query.dailyCapExceeded),
      hourlyCapExceeded: boolQuery(req.query.hourlyCapExceeded),
      platformRateLimited: boolQuery(req.query.platformRateLimited),
      apiFailureCountLastHour: intQuery(req.query.apiFailureCountLastHour),
      publishFailureCountLastHour: intQuery(req.query.publishFailureCountLastHour),
      consecutiveFailureCount: intQuery(req.query.consecutiveFailureCount),
      platformWarningActive: boolQuery(req.query.platformWarningActive),
      tokenExpired: boolQuery(req.query.tokenExpired),
      events: sampleEvents(req),
    })));
  } catch (error) {
    return next(error);
  }
}
