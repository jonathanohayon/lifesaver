import { Router } from 'express';
import { getSecureApprovalLinksPreview, getSecureApprovalLinksStatus } from './notification-secure-approval-links.controller.js';

export const notificationSecureApprovalLinksRouter = Router();

// Phase 10.9: secure link behavior only. Routes are mounted behind authRequired in api-v1.ts.
// Links open the authenticated app action detail screen and never approve/execute from email.
notificationSecureApprovalLinksRouter.get('/secure-approval-links/status', getSecureApprovalLinksStatus);
notificationSecureApprovalLinksRouter.get('/secure-approval-links/preview', getSecureApprovalLinksPreview);
