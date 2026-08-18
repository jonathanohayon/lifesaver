import { Router } from 'express';
import { databaseStatusController } from './database.controller.js';

export const databaseRouter = Router();

databaseRouter.get('/status', databaseStatusController);
