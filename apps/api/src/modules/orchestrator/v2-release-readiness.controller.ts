import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  getV2ReleaseReadinessExample,
  getV2ReleaseReadinessReport,
  getV2ReleaseReadinessStatus,
  previewV2ReleaseReadiness,
  V2_RELEASE_CHECKS,
} from './v2-release-readiness.model.js';

export function getV2ReleaseReadinessStatusController(_req: Request, res: Response) {
  return res.json(ok(getV2ReleaseReadinessStatus()));
}

export function getV2ReleaseReadinessReportController(_req: Request, res: Response) {
  return res.json(ok(getV2ReleaseReadinessReport()));
}

export function getV2ReleaseReadinessChecklistController(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'V2 Phase 15.10 — V2 Release Readiness',
    healthMode: 'v2-phase-15-10-v2-release-readiness',
    deliverable: 'v2_operator_release_checklist',
    checks: V2_RELEASE_CHECKS,
  }));
}

export function getV2ReleaseReadinessExampleController(_req: Request, res: Response) {
  return res.json(ok(getV2ReleaseReadinessExample()));
}

export function previewV2ReleaseReadinessController(req: Request, res: Response) {
  return res.json(ok(previewV2ReleaseReadiness(req.body ?? {})));
}
