import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildSupportReadonlyImportStatus } from './support-readonly-import.model.js';
import { importReadOnlySupportTickets, listRecentSafeSupportTickets, previewReadOnlySupportImport } from './support-readonly-import.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getSupportReadonlyImportStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportReadonlyImportStatus()));
}

export function previewSupportReadonlyImportController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewReadOnlySupportImport(req.body)));
  } catch (error) {
    return next(error);
  }
}

export async function importSupportReadonlyTicketsController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const result = await importReadOnlySupportTickets({ workspaceId: current.workspaceId, userId: current.userId, input: req.body });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function listSupportReadonlyTicketsController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listRecentSafeSupportTickets(current.workspaceId, limit);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
