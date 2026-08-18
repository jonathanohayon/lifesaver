import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildProactivityTriggerExamples,
  buildProactivityTriggerReport,
  buildProactivityTriggerStatus,
  PROACTIVITY_TRIGGER_DEFINITIONS,
  previewProactivityTrigger,
} from './proactivity-triggers.model.js';

export function getProactivityTriggersStatus(_req: Request, res: Response) {
  return res.json(ok(buildProactivityTriggerStatus()));
}

export function getProactivityTriggersReport(_req: Request, res: Response) {
  return res.json(ok(buildProactivityTriggerReport()));
}

export function getProactivityTriggersRegistry(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'V2 Phase 15.6 — Proactive Triggers',
    healthMode: 'v2-phase-15-6-proactive-triggers',
    deliverable: 'proactivity_trigger_framework',
    definitions: PROACTIVITY_TRIGGER_DEFINITIONS,
    actionCreationEnabled: false,
    notificationSendingEnabled: false,
    executorEnabled: false,
    autoRunEnabled: false,
  }));
}

export function getProactivityTriggersExample(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'V2 Phase 15.6 — Proactive Triggers',
    healthMode: 'v2-phase-15-6-proactive-triggers',
    examples: buildProactivityTriggerExamples(),
  }));
}

export function previewProactivityTriggersController(req: Request, res: Response) {
  return res.json(ok(previewProactivityTrigger(req.body)));
}
