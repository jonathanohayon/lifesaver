import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { addTeamMember, changeTeamMemberRole, listTeamMembers, removeTeamMember } from './team.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole: string };
}

export async function listTeamMembersController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const data = await listTeamMembers(current.workspaceId, current.userId);
    return res.json(ok(data));
  } catch (error) {
    return next(error);
  }
}

export async function addTeamMemberController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const data = await addTeamMember(current.workspaceId, current.userId, req.body);
    return res.json(ok({ ...data, message: 'Team member added to this workspace. Invite email sending is not enabled yet in v0.5.3.' }));
  } catch (error) {
    return next(error);
  }
}

export async function updateTeamMemberController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const data = await changeTeamMemberRole(current.workspaceId, current.userId, String(req.params.membershipId), req.body);
    return res.json(ok({ ...data, message: 'Team member role updated safely.' }));
  } catch (error) {
    return next(error);
  }
}

export async function removeTeamMemberController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const data = await removeTeamMember(current.workspaceId, current.userId, String(req.params.membershipId));
    return res.json(ok({ ...data, message: 'Team member removed from this workspace.' }));
  } catch (error) {
    return next(error);
  }
}
