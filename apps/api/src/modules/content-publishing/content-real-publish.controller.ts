import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { listSafeContentPublishResultLogs } from './content-real-publish.repository.js';
import { buildContentPublishResultTrackingSummary } from './content-publish-result-logs.js';
import { buildContentPublishCapsStatusSummary } from './content-publish-caps.js';
import { buildControlledLiveTestReport, buildControlledLiveTestStatusSummary } from './content-controlled-live-test.js';
import { buildContentPublishRollbackSafetySummary, parseContentPublishRollbackBody, rollbackManualApprovedLinkedInContentPublish } from './content-publish-rollback.js';
import {
  buildRealPublishExecutorSafetySummary,
  executeManualApprovedLinkedInContentPublish,
  parseRealPublishExecutionBody,
} from './content-real-publish.executor.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getContentRealPublishExecutorStatusController(_req: Request, res: Response) {
  return res.json(ok(buildRealPublishExecutorSafetySummary()));
}

export function getContentPublishCapsStatusController(_req: Request, res: Response) {
  return res.json(ok(buildContentPublishCapsStatusSummary()));
}

export function getContentControlledLiveTestStatusController(_req: Request, res: Response) {
  return res.json(ok(buildControlledLiveTestStatusSummary()));
}

export async function getContentControlledLiveTestReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = String(req.params.id || '').trim();
    const report = await buildControlledLiveTestReport({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
    });

    return res.json(ok(report));
  } catch (error) {
    return next(error);
  }
}

export function getContentPublishRollbackStatusController(_req: Request, res: Response) {
  return res.json(ok(buildContentPublishRollbackSafetySummary()));
}

export async function rollbackContentPublishActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const body = parseContentPublishRollbackBody(req.body);
    const result = await rollbackManualApprovedLinkedInContentPublish({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId: String(req.params.id || '').trim(),
      reason: body.reason,
      force: body.force,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function getContentPublishResultLogsController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = String(req.params.id || '').trim();
    const limit = Number(req.query.limit || 20);
    const logs = await listSafeContentPublishResultLogs({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    return res.json(ok({
      summary: buildContentPublishResultTrackingSummary(),
      actionId,
      count: logs.length,
      logs,
      safety: {
        rawTokenReturned: false,
        rawResponseBodyReturned: false,
        rollbackPayloadReturned: false,
      },
    }));
  } catch (error) {
    return next(error);
  }
}

export async function executeContentPublishActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const body = parseRealPublishExecutionBody(req.body);
    const result = await executeManualApprovedLinkedInContentPublish({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId: String(req.params.id || '').trim(),
      force: body.force,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
