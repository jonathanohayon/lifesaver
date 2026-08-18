import { Router } from 'express';
import { getCustomerSettingsController, updateWorkspaceProfileController } from './customer-settings.controller.js';

export const customerSettingsRouter = Router();

customerSettingsRouter.get('/', getCustomerSettingsController);
customerSettingsRouter.patch('/workspace-profile', updateWorkspaceProfileController);
