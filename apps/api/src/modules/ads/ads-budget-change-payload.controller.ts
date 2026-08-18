import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsBudgetChangePayloadSchemaReport,
  buildAdsBudgetChangePayloadStatus,
  validateAdsBudgetChangePayload,
} from './ads-budget-change-payload.model.js';

export function getAdsBudgetChangePayloadStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsBudgetChangePayloadStatus()));
}

export function getAdsBudgetChangePayloadSchema(_req: Request, res: Response) {
  return res.json(ok(buildAdsBudgetChangePayloadSchemaReport()));
}

export function getAdsBudgetChangePayloadExample(_req: Request, res: Response) {
  const report = buildAdsBudgetChangePayloadSchemaReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    examplePayload: report.examplePayload,
    validationPreview: validateAdsBudgetChangePayload(report.examplePayload),
    safety: report.safety,
  }));
}

export function previewAdsBudgetChangePayload(req: Request, res: Response) {
  return res.json(ok(validateAdsBudgetChangePayload(req.body)));
}
