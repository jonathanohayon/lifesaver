import { Router } from 'express';
import { addTeamMemberController, listTeamMembersController, removeTeamMemberController, updateTeamMemberController } from './team.controller.js';

export const teamRouter = Router();

teamRouter.get('/members', listTeamMembersController);
teamRouter.post('/members', addTeamMemberController);
teamRouter.patch('/members/:membershipId', updateTeamMemberController);
teamRouter.delete('/members/:membershipId', removeTeamMemberController);
