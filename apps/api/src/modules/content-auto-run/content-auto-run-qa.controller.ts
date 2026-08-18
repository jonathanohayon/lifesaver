import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentAutoRunQaReport, buildContentAutoRunQaStatus } from './content-auto-run-qa.model.js';

function boolQuery(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return undefined;
}

export function getContentAutoRunQaStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentAutoRunQaStatus()));
}

export function getContentAutoRunQaReport(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildContentAutoRunQaReport({
      explicitFounderApprovalPhrase: typeof req.query.approvalPhrase === 'string' ? req.query.approvalPhrase : null,
      controlledRealAutoRunRequested: boolQuery(req.query.controlledRealAutoRunRequested),
      controlledRealAutoRunExecutorEnabled: boolQuery(req.query.controlledRealAutoRunExecutorEnabled),
      sandboxExecutorPasses: boolQuery(req.query.sandboxExecutorPasses),
      ruleMatchPasses: boolQuery(req.query.ruleMatchPasses),
      capExceededPasses: boolQuery(req.query.capExceededPasses),
      pauseActivePasses: boolQuery(req.query.pauseActivePasses),
    })));
  } catch (error) {
    return next(error);
  }
}
