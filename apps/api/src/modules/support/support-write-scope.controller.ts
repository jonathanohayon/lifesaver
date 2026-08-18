import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  assertSupportWriteScopeOutputSafe,
  buildSupportWriteScopeChecklist,
  buildSupportWriteScopeStatus,
  evaluateSupportWriteScopeGates,
} from './support-write-scope.model.js';
import type { SupportWriteScopeGateInput } from './support-write-scope.types.js';

export function getSupportWriteScopeStatus(_req: Request, res: Response) {
  const status = buildSupportWriteScopeStatus();
  assertSupportWriteScopeOutputSafe(status);
  return res.json(ok(status));
}

export function getSupportWriteScopeChecklist(_req: Request, res: Response) {
  const checklist = buildSupportWriteScopeChecklist();
  assertSupportWriteScopeOutputSafe(checklist);
  return res.json(ok(checklist));
}

export function previewSupportWriteScopeGates(req: Request, res: Response) {
  const result = evaluateSupportWriteScopeGates((req.body ?? {}) as SupportWriteScopeGateInput);
  assertSupportWriteScopeOutputSafe(result);
  return res.json(ok(result));
}
