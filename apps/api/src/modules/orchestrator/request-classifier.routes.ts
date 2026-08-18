import { Router } from 'express';
import {
  getRequestClassifierExample,
  getRequestClassifierReport,
  getRequestClassifierStatus,
  previewRequestClassifier,
} from './request-classifier.controller.js';

export const requestClassifierRouter = Router();

// Phase 15.1: deterministic classifier only. No specialist execution, no tool routing execution, no external connector call, no action creation, no auto-run.
requestClassifierRouter.get('/request-classifier/status', getRequestClassifierStatus);
requestClassifierRouter.get('/request-classifier/report', getRequestClassifierReport);
requestClassifierRouter.get('/request-classifier/example', getRequestClassifierExample);
requestClassifierRouter.post('/request-classifier/preview', previewRequestClassifier);
