import { Router } from 'express';
import { getNotificationPreferencesController, updateNotificationPreferencesController } from './notification-preferences.controller.js';

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.get('/', getNotificationPreferencesController);
notificationPreferencesRouter.patch('/', updateNotificationPreferencesController);
