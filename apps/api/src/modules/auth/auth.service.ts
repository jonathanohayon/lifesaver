import { z } from 'zod';
import { isDatabaseConfigured } from '../../db/pool.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAuthToken } from './token.js';
import { createSignupAccount, emailExists, findPrimaryWorkspaceForUser, findUserByEmail, recordLoginEvent, workspaceSlugExists } from './auth.repository.js';
import type { AuthLoginResult, AuthSignupResult, AuthTokenPayload } from './auth.types.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, 'Use at least 10 characters for the password.'),
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  workspaceName: z.string().trim().min(2, 'Business/workspace name is required.').max(120),
});



function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

async function uniqueWorkspaceSlug(workspaceName: string): Promise<string> {
  const base = slugify(workspaceName);
  let candidate = base;
  let suffix = 2;

  while (await workspaceSlugExists(candidate)) {
    candidate = `${base}-${suffix}`.slice(0, 64);
    suffix += 1;
  }

  return candidate;
}

function createAuthResultFromRows(user: { id: string; email: string; full_name: string | null; role: string; status: string }, workspace: { id: string; name: string; slug: string | null; status: string; plan_key: string; member_role: string; onboarding_status?: string | null; onboarding_completed_at?: Date | null }): AuthLoginResult {
  const token = createAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    workspaceId: workspace.id,
    workspaceRole: workspace.member_role,
  });

  return {
    token,
    expiresInSeconds: env.AUTH_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      status: user.status,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.member_role,
      planKey: workspace.plan_key,
      status: workspace.status,
      onboardingStatus: workspace.onboarding_status || null,
      onboardingCompletedAt: workspace.onboarding_completed_at ? workspace.onboarding_completed_at.toISOString() : null,
    },
  };
}

export async function signupCustomer(input: unknown): Promise<AuthSignupResult> {
  const parsed = signupSchema.parse(input);

  if (!env.SAAS_SIGNUP_ENABLED) {
    throw new AppError(403, 'SIGNUP_DISABLED', 'New workspace signup is currently disabled. Ask the Super Admin to create an account.');
  }

  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is not configured. Signup requires DATABASE_URL.');
  }

  if (await emailExists(parsed.email)) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account already exists for this email. Please log in instead.');
  }

  const passwordHash = await hashPassword(parsed.password);
  const workspaceSlug = await uniqueWorkspaceSlug(parsed.workspaceName);
  const { user, workspace } = await createSignupAccount({
    email: parsed.email,
    fullName: parsed.fullName,
    passwordHash,
    workspaceName: parsed.workspaceName,
    workspaceSlug,
  });

  const result = createAuthResultFromRows(user, workspace);

  return {
    ...result,
    onboardingUrl: './onboarding.html',
    message: 'Workspace created. Continue onboarding by connecting Triple Whale and generating the first metrics snapshot.',
  };
}

export async function loginFounder(input: unknown): Promise<AuthLoginResult> {
  const parsed = loginSchema.parse(input);

  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is not configured. Authentication requires DATABASE_URL.');
  }

  const user = await findUserByEmail(parsed.email);
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const validPassword = await verifyPassword(parsed.password, user.password_hash);
  if (!validPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const workspace = await findPrimaryWorkspaceForUser(user.id);
  if (!workspace || workspace.status !== 'active') {
    throw new AppError(403, 'NO_ACTIVE_WORKSPACE', 'No active workspace found for this user.');
  }

  await recordLoginEvent(workspace.id, user.id, user.email);

  return createAuthResultFromRows(user, workspace);
}

export function getMeFromToken(payload: AuthTokenPayload) {
  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    workspace: {
      id: payload.workspaceId,
      role: payload.workspaceRole,
    },
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}
