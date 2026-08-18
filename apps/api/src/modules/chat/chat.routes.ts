import { Router } from 'express';
import { postChat } from './chat.controller.js';

export const chatRouter = Router();
chatRouter.post('/', postChat);
