export type CustomerWorkspaceProfile = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string | null;
  workspaceRole: string;
  ownerEmail: string | null;
  storeDomain: string | null;
  timezone: string | null;
  currency: string | null;
  planKey: string;
  status: string;
  onboardingStatus: string | null;
  onboardingCompletedAt: string | null;
};

export type CustomerConnectionOwnership = {
  claude: {
    owner: 'lifesaver_platform';
    managedBy: 'super_admin_backend_environment';
    customerVisible: boolean;
    browserReceivesKey: boolean;
    note: string;
  };
  tripleWhale: {
    owner: 'customer_workspace';
    managedBy: 'workspace_owner_or_admin';
    customerVisible: boolean;
    browserReceivesRawKey: boolean;
    encryptedAtRest: boolean;
    note: string;
  };
};

export type CustomerSettingsResponse = {
  version: string;
  safetyMode: 'read_advise_draft_only';
  workspaceProfile: CustomerWorkspaceProfile;
  connectionOwnership: CustomerConnectionOwnership;
  allowedSettings: string[];
};
