import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../common/utils/api-response.js';
import { AppError } from '../../common/errors/AppError.js';
import { verifyAuthToken } from '../auth/token.js';
import { env } from '../../config/env.js';
import { getLifesaverChatReply } from './chat.service.js';

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).optional().default([]),
});

function getOptionalAuth(req: Request) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch (_error) {
    if (env.CHAT_REQUIRE_AUTH) {
      throw new AppError(401, 'INVALID_TOKEN', 'Session expired or invalid. Please log in again.');
    }
    return null;
  }
}

export async function postChat(req: Request, res: Response) {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Message is required and must be valid text.');
  }

  const auth = getOptionalAuth(req);
  if (env.CHAT_REQUIRE_AUTH && !auth) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in to use LIFE.SAVER chat.');
  }

  const reply = await getLifesaverChatReply({
    message: parsed.data.message,
    history: parsed.data.history,
    workspaceId: auth?.workspaceId,
    userId: auth?.userId,
  });

  return res.json(ok(reply));
}
