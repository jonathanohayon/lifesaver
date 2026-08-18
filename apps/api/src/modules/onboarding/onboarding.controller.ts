import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getOnboardingStatus, refreshComputedOnboardingStatus } from './onboarding.service.js';

export async function getOnboardingStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getOnboardingStatus(auth.workspaceId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function refreshOnboardingStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await refreshComputedOnboardingStatus(auth.workspaceId, auth.userId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
