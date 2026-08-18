import { Router } from 'express';
import { getApprovalDeepLinkPreview, getApprovalDeepLinkStatus } from './notification-deep-links.controller.js';

export const notificationDeepLinksRouter = Router();

// Phase 10.4: secure deep-link generation only. Routes are mounted behind authRequired in api-v1.ts.
notificationDeepLinksRouter.get('/deep-links/status', getApprovalDeepLinkStatus);
notificationDeepLinksRouter.get('/deep-links/preview', getApprovalDeepLinkPreview);
