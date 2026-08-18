import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildSelectedSupportConnectorPlan, buildSupportConnectorPlanStatus } from './support-connector-plan.model.js';

export function getSupportConnectorPlanStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportConnectorPlanStatus()));
}

export function getSupportConnectorPlan(_req: Request, res: Response) {
  return res.json(ok(buildSelectedSupportConnectorPlan()));
}
