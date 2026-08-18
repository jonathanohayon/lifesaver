export type ContentConnectorProvider = 'linkedin';
export type ContentConnectorKind = 'member' | 'organization';
export type ContentConnectorStatusValue =
  | 'connected'
  | 'expired'
  | 'disconnected'
  | 'revoked'
  | 'token_decrypt_failed'
  | 'connection_error'
  | 'not_created';

export type ContentConnectorCredentialRow = {
  id: string;
  workspace_id: string;
  provider: ContentConnectorProvider;
  connection_kind: ContentConnectorKind;
  provider_account_id_hash: string | null;
  provider_account_hint: string | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_fingerprint: string | null;
  granted_scopes_json: string[];
  access_token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  status: Exclude<ContentConnectorStatusValue, 'not_created'>;
  connected_by_user_id: string | null;
  disconnected_by_user_id: string | null;
  last_connected_at: Date | null;
  disconnected_at: Date | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type SafeContentConnectorStatus = {
  provider: ContentConnectorProvider;
  connectionKind: ContentConnectorKind;
  status: ContentConnectorStatusValue;
  connected: boolean;
  accountHint: string | null;
  grantedScopes: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastConnectedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
  browserReceivesRawToken: false;
  encryptedAtRest: boolean;
  disconnectAvailable: boolean;
  nextAllowedStep: string;
  metadata: {
    phase: string;
    selectedPlatform: 'linkedin';
    realPublishingEnabled: false;
    autoRunEnabled: false;
    externalApiCalled: false;
  };
};

export type StoreLinkedInCredentialInput = {
  accessToken: string;
  refreshToken?: string | null;
  grantedScopes: string[];
  accessTokenExpiresAt?: string | Date | null;
  refreshTokenExpiresAt?: string | Date | null;
  linkedinMemberUrn?: string | null;
  linkedinMemberNameHint?: string | null;
  metadata?: Record<string, unknown>;
};

export type ServerOnlyLinkedInCredential = {
  provider: 'linkedin';
  connectionKind: 'member';
  accessToken: string;
  refreshToken: string | null;
  grantedScopes: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
};
