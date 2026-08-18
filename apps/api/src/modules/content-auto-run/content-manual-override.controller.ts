import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { pauseAutonomyForCurrentWorkspace } from '../autonomy/autonomy.service.js';
import {
  buildContentManualOverrideDisableResult,
  buildContentManualOverridePreview,
  buildContentManualOverrideStatus,
} from './content-manual-override.model.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

function boolQuery(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return undefined;
}

function bodyReason(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const reason = (value as { reason?: unknown }).reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 700) : null;
}

export function getContentManualOverrideStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentManualOverrideStatus()));
}

export function getContentManualOverridePreview(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildContentManualOverridePreview({
      contentAutoRunEnabled: boolQuery(req.query.contentAutoRunEnabled),
      pauseContentActions: boolQuery(req.query.pauseContentActions),
      pauseAllAutonomy: boolQuery(req.query.pauseAllAutonomy),
      emergencySafeModeActive: boolQuery(req.query.emergencySafeModeActive),
      reason: typeof req.query.reason === 'string' ? req.query.reason : null,
    })));
  } catch (error) {
    return next(error);
  }
}

export async function disableContentAutoRunManualOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const reason = bodyReason(req.body) || 'Founder manual override: disable content auto-run immediately.';
    const autonomyUpdate = await pauseAutonomyForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      scope: 'content',
      reason,
    });

    return res.json(ok(buildContentManualOverrideDisableResult({
      workspaceId: current.workspaceId,
      actorUserId: current.userId,
      reason,
      autonomyUpdate,
    })));
  } catch (error) {
    return next(error);
  }
}
