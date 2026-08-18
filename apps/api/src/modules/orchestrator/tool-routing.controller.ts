import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  TOOL_ROUTING_HEALTH_MODE,
  buildToolRoutingExampleInputs,
  buildToolRoutingReport,
  buildToolRoutingRouteMap,
  buildToolRoutingStatus,
  previewToolRouting,
} from './tool-routing.model.js';

export function getToolRoutingStatus(_req: Request, res: Response) {
  return res.json(ok(buildToolRoutingStatus()));
}

export function getToolRoutingReport(_req: Request, res: Response) {
  return res.json(ok(buildToolRoutingReport()));
}

export function getToolRoutingMap(_req: Request, res: Response) {
  return res.json(ok({
    phase: 'phase_15_3_tool_routing',
    healthMode: TOOL_ROUTING_HEALTH_MODE,
    routeMap: buildToolRoutingRouteMap(),
  }));
}

export function getToolRoutingExample(_req: Request, res: Response) {
  const exampleInputs = buildToolRoutingExampleInputs();
  return res.json(ok({
    phase: 'phase_15_3_tool_routing',
    healthMode: TOOL_ROUTING_HEALTH_MODE,
    exampleInputs,
    examplePreviews: Object.fromEntries(Object.entries(exampleInputs).map(([key, input]) => [key, previewToolRouting(input)])),
  }));
}

export function previewToolRoutingController(req: Request, res: Response) {
  return res.json(ok(previewToolRouting(req.body)));
}
