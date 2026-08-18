import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  getFunctionalAuditChecklist,
  getFunctionalAuditExample,
  getFunctionalAuditMap,
  getFunctionalAuditReport,
  getFunctionalAuditStatus,
  previewFunctionalAudit,
} from './functional-audit.model.js';

export function getFunctionalAuditStatusController(_req: Request, res: Response) {
  return res.json(ok(getFunctionalAuditStatus()));
}

export function getFunctionalAuditReportController(_req: Request, res: Response) {
  return res.json(ok(getFunctionalAuditReport()));
}

export function getFunctionalAuditMapController(_req: Request, res: Response) {
  return res.json(ok(getFunctionalAuditMap()));
}

export function getFunctionalAuditChecklistController(_req: Request, res: Response) {
  return res.json(ok(getFunctionalAuditChecklist()));
}

export function getFunctionalAuditExampleController(_req: Request, res: Response) {
  return res.json(ok(getFunctionalAuditExample()));
}

export function previewFunctionalAuditController(req: Request, res: Response) {
  return res.json(ok(previewFunctionalAudit(req.body ?? {})));
}
