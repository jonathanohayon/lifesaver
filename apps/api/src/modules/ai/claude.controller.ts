import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { createClaudeMessage, getClaudeRuntimeStatus } from './claude.client.js';

export function getClaudeStatusController(_req: Request, res: Response) {
  return res.json(ok(getClaudeRuntimeStatus()));
}

export async function postClaudeSmokeTestController(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createClaudeMessage({
      system: 'You are a connection test for LIFE.SAVER. Reply briefly and do not request tools.',
      messages: [{ role: 'user', content: 'Reply with exactly: LIFE.SAVER Claude connected.' }],
    });

    return res.json(ok({
      connected: true,
      reply: result.reply,
      model: result.model,
      stopReason: result.stopReason || null,
      requestId: result.requestId || null,
      usage: result.usage || null,
      safety: {
        serverSideOnly: true,
        keyExposed: false,
        externalWrites: false,
        actionExecution: false,
      },
    }));
  } catch (error) {
    return next(error);
  }
}
