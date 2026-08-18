import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildCostAnomalyExample,
  buildCostAnomalyReport,
  buildCostAnomalyStatus,
  previewCostAnomalyHardening,
} from './cost-anomaly-hardening.model.js';

export function getCostAnomalyStatus(_req: Request, res: Response) {
  return res.json(ok(buildCostAnomalyStatus()));
}

export function getCostAnomalyReport(_req: Request, res: Response) {
  return res.json(ok(buildCostAnomalyReport()));
}

export function getCostAnomalyExample(_req: Request, res: Response) {
  return res.json(ok(buildCostAnomalyExample()));
}

export function previewCostAnomalyController(req: Request, res: Response) {
  return res.json(ok(previewCostAnomalyHardening(req.body)));
}
