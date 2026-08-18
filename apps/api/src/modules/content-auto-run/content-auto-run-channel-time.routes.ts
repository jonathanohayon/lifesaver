import { Router } from 'express';
import { getContentAutoRunChannelTimePreview, getContentAutoRunChannelTimeStatus } from './content-auto-run-channel-time.controller.js';

export const contentAutoRunChannelTimeRouter = Router();

// Phase 11.4: read-only channel/time restrictions. Mounted behind authRequired in api-v1.ts.
contentAutoRunChannelTimeRouter.get('/channel-time/status', getContentAutoRunChannelTimeStatus);
contentAutoRunChannelTimeRouter.get('/channel-time/preview', getContentAutoRunChannelTimePreview);
