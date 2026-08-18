import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  REQUEST_CLASSIFIER_HEALTH_MODE,
  buildRequestClassifierExampleInputs,
  buildRequestClassifierReport,
  buildRequestClassifierStatus,
  classifyLifeSaverRequest,
} from './request-classifier.model.js';

export function getRequestClassifierStatus(_req: Request, res: Response) {
  return res.json(ok(buildRequestClassifierStatus()));
}

export function getRequestClassifierReport(_req: Request, res: Response) {
  return res.json(ok(buildRequestClassifierReport()));
}

export function getRequestClassifierExample(_req: Request, res: Response) {
  const exampleInputs = buildRequestClassifierExampleInputs();
  return res.json(ok({
    phase: 'phase_15_1_request_classifier',
    healthMode: REQUEST_CLASSIFIER_HEALTH_MODE,
    exampleInputs,
    exampleEvaluations: Object.fromEntries(Object.entries(exampleInputs).map(([key, input]) => [key, classifyLifeSaverRequest(input)])),
  }));
}

export function previewRequestClassifier(req: Request, res: Response) {
  return res.json(ok(classifyLifeSaverRequest(req.body)));
}
