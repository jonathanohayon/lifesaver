export type WorkspaceTeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export type TeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  userStatus: string;
  workspaceRole: WorkspaceTeamRole | string;
  membershipStatus: string;
  joinedAt: string;
  canManageWorkspaceSettings: boolean;
  canManageTripleWhaleConnection: boolean;
  canApproveDrafts: boolean;
  readOnlyAccess: boolean;
};

export type TeamPermissions = {
  currentUserRole: WorkspaceTeamRole | string;
  canViewTeam: boolean;
  canManageTeam: boolean;
  canInvite: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  protectedRoles: string[];
  safetyNote: string;
};

export type TeamMembersResponse = {
  version: string;
  safetyMode: 'read_advise_draft_only';
  workspaceId: string;
  permissions: TeamPermissions;
  members: TeamMember[];
};
