import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  ADS_SAFETY_QA_HEALTH_MODE,
  buildAdsSafetyQaExampleInput,
  buildAdsSafetyQaReport,
  buildAdsSafetyQaStatus,
  evaluateAdsSafetyQa,
} from './ads-safety-qa.model.js';

export function getAdsSafetyQaStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsSafetyQaStatus()));
}

export function getAdsSafetyQaReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsSafetyQaReport()));
}

export function getAdsSafetyQaExample(_req: Request, res: Response) {
  const exampleInput = buildAdsSafetyQaExampleInput();
  return res.json(ok({
    phase: 'phase_14_10_ads_safety_qa',
    healthMode: ADS_SAFETY_QA_HEALTH_MODE,
    exampleInput,
    exampleEvaluation: evaluateAdsSafetyQa(exampleInput),
  }));
}

export function previewAdsSafetyQa(req: Request, res: Response) {
  return res.json(ok(evaluateAdsSafetyQa(req.body)));
}
