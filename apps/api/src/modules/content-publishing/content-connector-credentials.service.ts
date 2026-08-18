import crypto from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getActiveMembership } from '../team/team.repository.js';
import {
  disconnectLinkedInCredential,
  getContentConnectorCredential,
  recordContentConnectorEvent,
  upsertLinkedInCredential,
} from './content-connector-credentials.repository.js';
import type {
  ContentConnectorCredentialRow,
  SafeContentConnectorStatus,
  ServerOnlyLinkedInCredential,
} from './content-connector-credentials.types.js';

const PHASE = 'v0.7.0_phase_9_3';
const SELECTED_PLATFORM = 'linkedin' as const;
const REQUIRED_SCOPE = 'w_member_social';

const storeLinkedInCredentialSchema = z.object({
  accessToken: z.string().min(20).max(10000),
  refreshToken: z.string().min(20).max(10000).optional().nullable(),
  grantedScopes: z.array(z.string().min(1).max(200)).min(1),
  accessTokenExpiresAt: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  refreshTokenExpiresAt: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  linkedinMemberUrn: z.string().min(3).max(500).optional().nullable(),
  linkedinMemberNameHint: z.string().min(1).max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

type StoreLinkedInCredentialInput = z.infer<typeof storeLinkedInCredentialSchema>;

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required before storing LinkedIn connector credentials.');
  }
}

async function assertConnectorManager(workspaceId: string, userId: string): Promise<string> {
  const membership = await getActiveMembership(workspaceId, userId);
  const role = String(membership?.role || '').toLowerCase();
  if (!['owner', 'admin'].includes(role)) {
    throw new AppError(403, 'INSUFFICIENT_WORKSPACE_PERMISSION', 'Only workspace owners/admins can connect or disconnect LinkedIn publishing credentials.');
  }
  return role;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.map((scope) => String(scope || '').trim()).filter(Boolean))).sort();
}

function hasRequiredLinkedInScope(scopes: string[]): boolean {
  return normalizeScopes(scopes).includes(REQUIRED_SCOPE);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildAccountHint(memberName: string | null | undefined, memberUrn: string | null | undefined): string | null {
  const cleanName = String(memberName || '').trim();
  if (cleanName) return cleanName.slice(0, 120);

  const cleanUrn = String(memberUrn || '').trim();
  if (!cleanUrn) return null;
  const suffix = cleanUrn.slice(-8);
  return `LinkedIn member ••••${suffix}`;
}

function isExpired(date: Date | null): boolean {
  return Boolean(date && date.getTime() <= Date.now());
}

export function toSafeContentConnectorStatus(row: ContentConnectorCredentialRow | null): SafeContentConnectorStatus {
  if (!row) {
    return {
      provider: SELECTED_PLATFORM,
      connectionKind: 'member',
      status: 'not_created',
      connected: false,
      accountHint: null,
      grantedScopes: [],
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastConnectedAt: null,
      disconnectedAt: null,
      lastError: null,
      updatedAt: null,
      browserReceivesRawToken: false,
      encryptedAtRest: false,
      disconnectAvailable: false,
      nextAllowedStep: 'Run LinkedIn OAuth in a later phase, then store the returned token server-side only.',
      metadata: {
        phase: PHASE,
        selectedPlatform: SELECTED_PLATFORM,
        realPublishingEnabled: false,
        autoRunEnabled: false,
        externalApiCalled: false,
      },
    };
  }

  const accessExpiry = row.access_token_expires_at;
  const tokenExpired = isExpired(accessExpiry);
  const tokenStored = Boolean(row.encrypted_access_token);
  const connected = row.status === 'connected' && tokenStored && !tokenExpired;
  const status = row.status === 'connected' && tokenExpired ? 'expired' : row.status;

  return {
    provider: row.provider,
    connectionKind: row.connection_kind,
    status,
    connected,
    accountHint: row.provider_account_hint,
    grantedScopes: Array.isArray(row.granted_scopes_json) ? row.granted_scopes_json : [],
    accessTokenExpiresAt: row.access_token_expires_at ? row.access_token_expires_at.toISOString() : null,
    refreshTokenExpiresAt: row.refresh_token_expires_at ? row.refresh_token_expires_at.toISOString() : null,
    lastConnectedAt: row.last_connected_at ? row.last_connected_at.toISOString() : null,
    disconnectedAt: row.disconnected_at ? row.disconnected_at.toISOString() : null,
    lastError: row.last_error,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    browserReceivesRawToken: false,
    encryptedAtRest: tokenStored,
    disconnectAvailable: row.status !== 'disconnected',
    nextAllowedStep: connected
      ? 'Credential is stored for a future manual-approved LinkedIn executor. Real publishing is still not enabled in Phase 9.3.'
      : 'Connect/reconnect through the future LinkedIn OAuth callback before any real executor can use this connector.',
    metadata: {
      phase: PHASE,
      selectedPlatform: SELECTED_PLATFORM,
      realPublishingEnabled: false,
      autoRunEnabled: false,
      externalApiCalled: false,
    },
  };
}

export function assertNoRawLinkedInTokenInStatus(status: SafeContentConnectorStatus, rawTokenSamples: string[]): void {
  const serialized = JSON.stringify(status);
  for (const sample of rawTokenSamples) {
    if (sample && serialized.includes(sample)) {
      throw new Error('Safe connector status leaked a raw token sample.');
    }
  }
}

export async function getLinkedInConnectorStatus(workspaceId: string): Promise<SafeContentConnectorStatus> {
  assertDatabaseReady();
  const row = await getContentConnectorCredential({ workspaceId, provider: SELECTED_PLATFORM, connectionKind: 'member' });
  return toSafeContentConnectorStatus(row);
}

export async function storeLinkedInCredentialForWorkspace(
  workspaceId: string,
  userId: string,
  input: StoreLinkedInCredentialInput
): Promise<SafeContentConnectorStatus> {
  assertDatabaseReady();
  const role = await assertConnectorManager(workspaceId, userId);
  const parsed = storeLinkedInCredentialSchema.parse(input);
  const scopes = normalizeScopes(parsed.grantedScopes);

  if (!hasRequiredLinkedInScope(scopes)) {
    throw new AppError(400, 'MISSING_LINKEDIN_WRITE_SCOPE', 'LinkedIn credential must include w_member_social before it can be stored for future content publishing.');
  }

  const accessToken = parsed.accessToken.trim();
  const refreshToken = parsed.refreshToken ? parsed.refreshToken.trim() : null;
  const providerAccountIdHash = parsed.linkedinMemberUrn ? sha256(parsed.linkedinMemberUrn.trim()) : null;
  const providerAccountHint = buildAccountHint(parsed.linkedinMemberNameHint, parsed.linkedinMemberUrn);

  const row = await upsertLinkedInCredential({
    workspaceId,
    userId,
    encryptedAccessToken: encryptSecret(accessToken),
    encryptedRefreshToken: refreshToken ? encryptSecret(refreshToken) : null,
    tokenFingerprint: sha256(accessToken),
    grantedScopes: scopes,
    accessTokenExpiresAt: parseDate(parsed.accessTokenExpiresAt),
    refreshTokenExpiresAt: parseDate(parsed.refreshTokenExpiresAt),
    providerAccountIdHash,
    providerAccountHint,
    metadata: {
      phase: PHASE,
      source: 'future_linkedin_oauth_callback',
      managedByRole: role,
      realPublishingEnabled: false,
      autoRunEnabled: false,
      externalApiCalledDuringStorage: false,
      ...parsed.metadata,
    },
  });

  await recordContentConnectorEvent({
    workspaceId,
    eventType: 'linkedin_content_connector_credentials_stored_encrypted',
    message: 'LinkedIn content connector credentials were encrypted and stored. Raw tokens were not returned to the browser.',
    metadata: {
      userId,
      role,
      phase: PHASE,
      provider: SELECTED_PLATFORM,
      scopes,
      accountHint: providerAccountHint,
      realPublishingEnabled: false,
      autoRunEnabled: false,
      externalApiCalled: false,
    },
  });

  const status = toSafeContentConnectorStatus(row);
  assertNoRawLinkedInTokenInStatus(status, [accessToken, refreshToken || '']);
  return status;
}

export async function disconnectLinkedInConnector(workspaceId: string, userId: string): Promise<SafeContentConnectorStatus> {
  assertDatabaseReady();
  const role = await assertConnectorManager(workspaceId, userId);
  const row = await disconnectLinkedInCredential({ workspaceId, userId });

  await recordContentConnectorEvent({
    workspaceId,
    eventType: 'linkedin_content_connector_disconnected',
    message: 'LinkedIn content connector was disconnected and encrypted tokens were removed.',
    metadata: {
      userId,
      role,
      phase: PHASE,
      provider: SELECTED_PLATFORM,
      realPublishingEnabled: false,
      autoRunEnabled: false,
      externalApiCalled: false,
    },
  });

  return toSafeContentConnectorStatus(row);
}

export async function getLinkedInCredentialForServerExecutorOnly(workspaceId: string): Promise<ServerOnlyLinkedInCredential> {
  assertDatabaseReady();
  const row = await getContentConnectorCredential({ workspaceId, provider: SELECTED_PLATFORM, connectionKind: 'member' });

  if (!row || row.status !== 'connected' || !row.encrypted_access_token) {
    throw new AppError(409, 'LINKEDIN_NOT_CONNECTED', 'LinkedIn content connector is not connected.');
  }

  if (isExpired(row.access_token_expires_at)) {
    throw new AppError(409, 'LINKEDIN_ACCESS_TOKEN_EXPIRED', 'LinkedIn access token is expired. Reconnect before publishing.');
  }

  const accessToken = decryptSecret(row.encrypted_access_token);
  const refreshToken = row.encrypted_refresh_token ? decryptSecret(row.encrypted_refresh_token) : null;

  return {
    provider: SELECTED_PLATFORM,
    connectionKind: 'member',
    accessToken,
    refreshToken,
    grantedScopes: Array.isArray(row.granted_scopes_json) ? row.granted_scopes_json : [],
    accessTokenExpiresAt: row.access_token_expires_at ? row.access_token_expires_at.toISOString() : null,
    refreshTokenExpiresAt: row.refresh_token_expires_at ? row.refresh_token_expires_at.toISOString() : null,
  };
}

export const contentConnectorCredentialModel = {
  phase: PHASE,
  selectedPlatform: SELECTED_PLATFORM,
  requiredScope: REQUIRED_SCOPE,
  storageTable: 'content_connector_credentials',
  encryptsAccessToken: true,
  encryptsRefreshToken: true,
  browserReceivesRawToken: false,
  statusEndpoint: 'GET /api/v1/connect/linkedin/status',
  disconnectEndpoint: 'DELETE /api/v1/connect/linkedin',
  realPublishingEnabled: false,
  autoRunEnabled: false,
  externalApiCalled: false,
};
