import { Router } from 'express';
import { getContentAutoRunQaReport, getContentAutoRunQaStatus } from './content-auto-run-qa.controller.js';

export const contentAutoRunQaRouter = Router();

// Phase 11.10: safe content auto-run QA report. Report-only; no publish or external API call.
contentAutoRunQaRouter.get('/qa/status', getContentAutoRunQaStatus);
contentAutoRunQaRouter.get('/qa/report', getContentAutoRunQaReport);
