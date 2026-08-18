import { z } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import type { TeamMember, TeamMembersResponse, TeamPermissions } from './team.types.js';
import {
  addWorkspaceMember,
  countActiveOwners,
  createInvitedUser,
  findUserLiteByEmail,
  getActiveMembership,
  getMembershipById,
  listWorkspaceTeamMembers,
  markMembershipRemoved,
  recordTeamEvent,
  updateMembershipRole,
  type MembershipRow,
} from './team.repository.js';

const MANAGE_ROLES = new Set(['owner', 'admin']);
const INVITABLE_ROLES = new Set(['admin', 'member', 'viewer']);
const EDITABLE_ROLES = new Set(['admin', 'member', 'viewer']);

const addMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().max(120).optional().nullable(),
  role: z.enum(['admin', 'member', 'viewer']).default('viewer'),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for team member management.');
  }
}

function roleCapabilities(role: string) {
  const normalized = String(role || '').toLowerCase();
  return {
    canManageWorkspaceSettings: ['owner', 'admin'].includes(normalized),
    canManageTripleWhaleConnection: ['owner', 'admin'].includes(normalized),
    canApproveDrafts: ['owner', 'admin', 'member'].includes(normalized),
    readOnlyAccess: normalized === 'viewer',
  };
}

function serializeMember(row: MembershipRow): TeamMember {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.user_email,
    fullName: row.user_full_name,
    userStatus: row.user_status,
    workspaceRole: row.role,
    membershipStatus: row.membership_status,
    joinedAt: row.joined_at ? row.joined_at.toISOString() : new Date().toISOString(),
    ...roleCapabilities(row.role),
  };
}

function permissionsFor(role: string): TeamPermissions {
  const normalized = String(role || '').toLowerCase();
  const canManage = MANAGE_ROLES.has(normalized);
  return {
    currentUserRole: normalized,
    canViewTeam: true,
    canManageTeam: canManage,
    canInvite: canManage,
    canChangeRoles: canManage,
    canRemoveMembers: canManage,
    protectedRoles: ['owner'],
    safetyNote: 'v0.5.3 team management is workspace-scoped. It does not send invite emails yet and does not grant access to other customer workspaces.',
  };
}

async function requireActiveMembership(workspaceId: string, userId: string): Promise<MembershipRow> {
  const membership = await getActiveMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user is not an active member of the requested workspace.');
  }
  return membership;
}

function assertCanManageTeam(role: string) {
  if (!MANAGE_ROLES.has(String(role || '').toLowerCase())) {
    throw new AppError(403, 'INSUFFICIENT_WORKSPACE_PERMISSION', 'Only workspace owners/admins can manage team members in v0.5.3.');
  }
}

async function responseFor(workspaceId: string, currentUserId: string): Promise<TeamMembersResponse> {
  const currentMembership = await requireActiveMembership(workspaceId, currentUserId);
  const members = (await listWorkspaceTeamMembers(workspaceId)).map(serializeMember);
  return {
    version: '0.5.3',
    safetyMode: 'read_advise_draft_only',
    workspaceId,
    permissions: permissionsFor(currentMembership.role),
    members,
  };
}

export async function listTeamMembers(workspaceId: string, currentUserId: string): Promise<TeamMembersResponse> {
  assertDatabaseReady();
  return responseFor(workspaceId, currentUserId);
}

export async function addTeamMember(workspaceId: string, currentUserId: string, input: unknown): Promise<TeamMembersResponse> {
  assertDatabaseReady();
  const actor = await requireActiveMembership(workspaceId, currentUserId);
  assertCanManageTeam(actor.role);

  const parsed = addMemberSchema.parse(input);
  const role = parsed.role;
  if (!INVITABLE_ROLES.has(role)) {
    throw new AppError(400, 'INVALID_TEAM_ROLE', 'Allowed v0.5.3 invite roles are admin, member, or viewer. Owner transfer is not enabled yet.');
  }

  const email = parsed.email.toLowerCase().trim();
  let user = await findUserLiteByEmail(email);
  let createdPlaceholder = false;
  if (!user) {
    user = await createInvitedUser(email, parsed.fullName?.trim() || null);
    createdPlaceholder = true;
  }

  await addWorkspaceMember({ workspaceId, userId: user.id, role });
  await recordTeamEvent({
    workspaceId,
    userId: currentUserId,
    eventType: 'workspace_team_member_added',
    message: `Workspace team member ${email} was added as ${role}.`,
    metadata: { addedUserId: user.id, email, role, createdPlaceholder, invitedEmailNotSent: true },
  });

  return responseFor(workspaceId, currentUserId);
}

export async function changeTeamMemberRole(workspaceId: string, currentUserId: string, membershipId: string, input: unknown): Promise<TeamMembersResponse> {
  assertDatabaseReady();
  const actor = await requireActiveMembership(workspaceId, currentUserId);
  assertCanManageTeam(actor.role);

  const parsed = updateMemberSchema.parse(input);
  const target = await getMembershipById(workspaceId, membershipId);
  if (!target) {
    throw new AppError(404, 'TEAM_MEMBER_NOT_FOUND', 'Team member was not found in this workspace.');
  }

  if (target.user_id === currentUserId) {
    throw new AppError(400, 'CANNOT_CHANGE_OWN_ROLE', 'For safety, you cannot change your own workspace role in v0.5.3.');
  }

  if (target.role === 'owner') {
    throw new AppError(403, 'OWNER_ROLE_PROTECTED', 'Owner role changes are protected in v0.5.3. Add owner transfer later as a separate audited workflow.');
  }

  if (!EDITABLE_ROLES.has(parsed.role)) {
    throw new AppError(400, 'INVALID_TEAM_ROLE', 'Allowed v0.5.3 roles are admin, member, or viewer.');
  }

  await updateMembershipRole(workspaceId, membershipId, parsed.role);
  await recordTeamEvent({
    workspaceId,
    userId: currentUserId,
    eventType: 'workspace_team_member_role_changed',
    message: `Workspace team member ${target.user_email} role was changed to ${parsed.role}.`,
    metadata: { targetUserId: target.user_id, membershipId, previousRole: target.role, newRole: parsed.role },
  });

  return responseFor(workspaceId, currentUserId);
}

export async function removeTeamMember(workspaceId: string, currentUserId: string, membershipId: string): Promise<TeamMembersResponse> {
  assertDatabaseReady();
  const actor = await requireActiveMembership(workspaceId, currentUserId);
  assertCanManageTeam(actor.role);

  const target = await getMembershipById(workspaceId, membershipId);
  if (!target) {
    throw new AppError(404, 'TEAM_MEMBER_NOT_FOUND', 'Team member was not found in this workspace.');
  }

  if (target.user_id === currentUserId) {
    throw new AppError(400, 'CANNOT_REMOVE_SELF', 'For safety, you cannot remove your own membership in v0.5.3.');
  }

  if (target.role === 'owner') {
    const ownerCount = await countActiveOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new AppError(403, 'LAST_OWNER_PROTECTED', 'The last workspace owner cannot be removed.');
    }
    throw new AppError(403, 'OWNER_ROLE_PROTECTED', 'Owner removal is protected in v0.5.3. Add owner transfer later as a separate audited workflow.');
  }

  await markMembershipRemoved(workspaceId, membershipId);
  await recordTeamEvent({
    workspaceId,
    userId: currentUserId,
    eventType: 'workspace_team_member_removed',
    message: `Workspace team member ${target.user_email} was removed from the workspace.`,
    metadata: { targetUserId: target.user_id, membershipId, previousRole: target.role },
  });

  return responseFor(workspaceId, currentUserId);
}
