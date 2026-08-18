import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsRestrictedAutoRunExampleInput,
  buildAdsRestrictedAutoRunPolicyReport,
  buildAdsRestrictedAutoRunPolicyStatus,
  evaluateAdsRestrictedAutoRunPolicy,
} from './ads-restricted-auto-run-policy.model.js';

export function getAdsRestrictedAutoRunPolicyStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsRestrictedAutoRunPolicyStatus()));
}

export function getAdsRestrictedAutoRunPolicyReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsRestrictedAutoRunPolicyReport()));
}

export function getAdsRestrictedAutoRunPolicyExample(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'phase_14_9_auto_run_below_threshold_later',
    healthMode: 'v2-phase-14-9-restricted-ads-auto-run-policy',
    exampleInput: buildAdsRestrictedAutoRunExampleInput(),
    exampleEvaluation: evaluateAdsRestrictedAutoRunPolicy(buildAdsRestrictedAutoRunExampleInput()),
  }));
}

export function previewAdsRestrictedAutoRunPolicy(req: Request, res: Response) {
  return res.json(ok(evaluateAdsRestrictedAutoRunPolicy(req.body)));
}
