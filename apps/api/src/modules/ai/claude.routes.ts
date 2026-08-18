import { Router } from 'express';
import { getClaudeStatusController, postClaudeSmokeTestController } from './claude.controller.js';

export const claudeRouter = Router();

// v0.8.5: Protected Claude diagnostics. Never returns the API key or secrets.
claudeRouter.get('/status', getClaudeStatusController);
claudeRouter.post('/smoke-test', postClaudeSmokeTestController);
