import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildDailyActionDigestExample,
  buildDailyActionDigestReport,
  buildDailyActionDigestStatus,
  previewDailyActionDigest,
} from './daily-action-digest.model.js';

export function getDailyActionDigestStatus(_req: Request, res: Response) {
  return res.json(ok(buildDailyActionDigestStatus()));
}

export function getDailyActionDigestReport(_req: Request, res: Response) {
  return res.json(ok(buildDailyActionDigestReport()));
}

export function getDailyActionDigestExample(_req: Request, res: Response) {
  return res.json(ok(buildDailyActionDigestExample()));
}

export function previewDailyActionDigestController(req: Request, res: Response) {
  return res.json(ok(previewDailyActionDigest(req.body)));
}
