import { Router } from 'express';
import { approveActionController, cancelActionController, executeLinkedInContentPublishController, executeSupportReplySendActionController, getActionDetailController, getActionsModuleStatusController, getContentControlledLiveTestReportController, getContentControlledLiveTestStatusController, getContentPublishCapsStatusController, getContentPublishResultLogsController, getContentPublishRollbackStatusController, getContentRealPublishExecutorStatusController, rollbackLinkedInContentPublishController, listActionsController, rejectActionController } from './actions.controller.js';

export const actionsRouter = Router();

// Phase 3.1/3.2/3.3: safe module status endpoint.
actionsRouter.get('/module-status', getActionsModuleStatusController);

// Phase 9.6: real LinkedIn content publish executor safety/status summary.
// This endpoint is read-only and never publishes.
actionsRouter.get('/content-publish-executor/status', getContentRealPublishExecutorStatusController);

// Phase 9.8: content publish cap enforcement status summary.
// This endpoint is read-only and never publishes.
actionsRouter.get('/content-publish-caps/status', getContentPublishCapsStatusController);

// Phase 9.9: content publish rollback/unpublish status summary.
// This endpoint is read-only and never deletes/unpublishes.
actionsRouter.get('/content-publish-rollback/status', getContentPublishRollbackStatusController);

// Phase 9.10: controlled live test status summary.
// This endpoint is read-only and never publishes or deletes.
actionsRouter.get('/content-live-test/status', getContentControlledLiveTestStatusController);


// Phase 3.2: workspace-scoped, read-only, summary-only action list endpoint.
// This endpoint does not expose payload_json and cannot approve/reject/cancel/execute actions.
actionsRouter.get('/', listActionsController);

// Phase 3.5: workspace-scoped, role-gated internal approval endpoint.
// This endpoint only changes internal action status to approved and logs an event; it does not queue or execute.
actionsRouter.post('/:id/approve', approveActionController);

// Phase 3.6: workspace-scoped, role-gated internal rejection endpoint.
// This endpoint only changes internal action status to rejected and logs an event; it does not queue or execute.
actionsRouter.post('/:id/reject', rejectActionController);

// Phase 3.7/3.8: workspace-scoped, role-guarded internal cancellation endpoint.
// This endpoint only changes internal action status to cancelled and logs an event; it does not queue, execute, or rollback.
actionsRouter.post('/:id/cancel', cancelActionController);


// Phase 9.7: content publish result tracking endpoint.
// This endpoint returns safe result logs only: post ID, permalink when available, published time, safe platform response summary, and failed error.
actionsRouter.get('/:id/content-publish-result-logs', getContentPublishResultLogsController);

// Phase 9.6: manual-approved LinkedIn content publish execution endpoint.
// This endpoint checks manual approval, master/content pause, caps, and LinkedIn token validity before any external call.
actionsRouter.post('/:id/execute-content-publish', executeLinkedInContentPublishController);

// Phase 9.9: manual rollback/unpublish endpoint for one executed LinkedIn content action.
// This is default-off and performs single-post DELETE only after owner/admin manual request and safe result verification.
actionsRouter.post('/:id/rollback-content-publish', rollbackLinkedInContentPublishController);

// Phase 9.10: first controlled live test report endpoint.
// This only reads safe action/result logs and cannot publish, delete, schedule, or auto-run.
actionsRouter.get('/:id/content-live-test-report', getContentControlledLiveTestReportController);

// Phase 13.2: manual-approved Gmail support reply send endpoint.
// This endpoint checks approval, master/support pause, emergency safe mode, and send token/scope before one external Gmail send call.
actionsRouter.post('/:id/execute-support-reply-send', executeSupportReplySendActionController);



// Phase 3.3: workspace-scoped, read-only action detail endpoint.
// This endpoint returns a safe payload preview, status history, and result summaries only.
actionsRouter.get('/:id', getActionDetailController);
