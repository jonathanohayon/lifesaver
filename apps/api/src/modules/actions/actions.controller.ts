import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { approveActionForCurrentWorkspace, cancelActionForCurrentWorkspace, getActionDetailForCurrentWorkspace, getActionsModuleStatus, listActionsForCurrentWorkspace, rejectActionForCurrentWorkspace } from './actions.service.js';
import { executeContentPublishActionController as executeLinkedInContentPublishController, getContentControlledLiveTestReportController, getContentControlledLiveTestStatusController, getContentPublishCapsStatusController, getContentPublishResultLogsController, getContentPublishRollbackStatusController, getContentRealPublishExecutorStatusController, rollbackContentPublishActionController as rollbackLinkedInContentPublishController } from '../content-publishing/content-real-publish.controller.js';
import { parseActionIdParam, parseActionListFilters, parseApproveActionBody, parseRejectActionBody, parseCancelActionBody } from './actions.validation.js';
import { executeSupportReplySendActionController } from '../support/support-send-executor.controller.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getActionsModuleStatusController(_req: Request, res: Response) {
  return res.json(ok(getActionsModuleStatus()));
}

export async function listActionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const filters = parseActionListFilters(req.query);
    const result = await listActionsForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      filters,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function getActionDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = parseActionIdParam(req.params);
    const result = await getActionDetailForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function approveActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = parseActionIdParam(req.params);
    const body = parseApproveActionBody(req.body);
    const result = await approveActionForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
      approvalNote: body.approvalNote,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function rejectActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = parseActionIdParam(req.params);
    const body = parseRejectActionBody(req.body);
    const result = await rejectActionForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
      rejectionReason: body.rejectionReason,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


export async function cancelActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const actionId = parseActionIdParam(req.params);
    const body = parseCancelActionBody(req.body);
    const result = await cancelActionForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId,
      cancelReason: body.cancelReason,
    });

    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}


// Phase 9.6: manual-approved LinkedIn content publish executor endpoint.
// Kept in the actions module path because it executes a specific approved action.
export { executeLinkedInContentPublishController, executeSupportReplySendActionController, getContentControlledLiveTestReportController, getContentControlledLiveTestStatusController, getContentPublishCapsStatusController, getContentPublishResultLogsController, getContentPublishRollbackStatusController, getContentRealPublishExecutorStatusController, rollbackLinkedInContentPublishController };
