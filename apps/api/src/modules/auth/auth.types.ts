export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
};

export type AuthWorkspace = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  planKey: string;
  status: string;
};

export type AuthLoginResult = {
  token: string;
  user: AuthUser;
  workspace: AuthWorkspace & {
    onboardingStatus?: string | null;
    onboardingCompletedAt?: string | null;
  };
  expiresInSeconds: number;
};

export type AuthSignupResult = AuthLoginResult & {
  onboardingUrl: string;
  message: string;
};

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: string;
  workspaceId: string;
  workspaceRole: string;
  exp: number;
};
