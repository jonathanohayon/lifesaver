import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  disconnectLinkedInConnector,
  getLinkedInConnectorStatus,
} from './content-connector-credentials.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole: string };
}

export async function getLinkedInConnectorStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const status = await getLinkedInConnectorStatus(payload.workspaceId);
    res.json(ok({
      ...status,
      message: 'LinkedIn connector status returned safely. Raw OAuth tokens were not returned.',
    }));
  } catch (error) {
    next(error);
  }
}

export async function disconnectLinkedInConnectorController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const status = await disconnectLinkedInConnector(payload.workspaceId, payload.userId);
    res.json(ok({
      ...status,
      message: 'LinkedIn connector disconnected. Stored encrypted tokens were removed if a connection existed.',
    }));
  } catch (error) {
    next(error);
  }
}
