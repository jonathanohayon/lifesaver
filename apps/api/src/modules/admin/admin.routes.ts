import { Router } from 'express';
import { getAdminOverviewController, adminOperationsLogController } from './admin.controller.js';

export const adminRouter = Router();

adminRouter.get('/overview', getAdminOverviewController);

adminRouter.get('/operations-log', adminOperationsLogController);
