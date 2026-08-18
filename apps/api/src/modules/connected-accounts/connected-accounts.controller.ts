import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  connectTripleWhale,
  getTripleWhaleConnectionStatus,
  removeTripleWhaleConnection,
} from './connected-accounts.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole: string };
}

export async function getTripleWhaleStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const status = await getTripleWhaleConnectionStatus(payload.workspaceId);
    res.json(ok(status));
  } catch (error) {
    next(error);
  }
}

export async function connectTripleWhaleController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const status = await connectTripleWhale(payload.workspaceId, payload.userId, payload.workspaceRole, req.body);
    res.json(ok({
      ...status,
      message: 'Customer-owned Triple Whale API key stored encrypted for this workspace. Raw key was not returned to the browser.',
    }));
  } catch (error) {
    next(error);
  }
}

export async function disconnectTripleWhaleController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const status = await removeTripleWhaleConnection(payload.workspaceId, payload.userId, payload.workspaceRole);
    res.json(ok({
      ...status,
      message: 'Customer-owned Triple Whale connection disconnected for this workspace. Stored encrypted key removed.',
    }));
  } catch (error) {
    next(error);
  }
}
