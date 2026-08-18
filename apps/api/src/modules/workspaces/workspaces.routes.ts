import { Router } from 'express';
import { currentWorkspaceController, listWorkspacesController } from './workspaces.controller.js';

export const workspacesRouter = Router();

workspacesRouter.get('/', listWorkspacesController);
workspacesRouter.get('/current', currentWorkspaceController);
