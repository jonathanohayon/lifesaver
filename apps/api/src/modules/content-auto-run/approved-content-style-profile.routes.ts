import { Router } from 'express';
import {
  getApprovedContentStylePreview,
  getApprovedContentStyleProfile,
  getApprovedContentStyleStatus,
} from './approved-content-style-profile.controller.js';

export const approvedContentStyleProfileRouter = Router();

// Phase 11.1: read-only approved content style profile. Mounted behind authRequired in api-v1.ts.
approvedContentStyleProfileRouter.get('/approved-style/status', getApprovedContentStyleStatus);
approvedContentStyleProfileRouter.get('/approved-style/profile', getApprovedContentStyleProfile);
approvedContentStyleProfileRouter.get('/approved-style/preview', getApprovedContentStylePreview);
