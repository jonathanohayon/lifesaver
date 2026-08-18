export type ConnectedAccountStatus = {
  provider: 'triple_whale';
  status: string;
  connected: boolean;
  keyHint: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
  persistence?: {
    encryptedKeyStored: boolean;
    decryptable: boolean;
    status: 'ok' | 'missing' | 'decrypt_failed';
    message: string;
  };
  ownership?: {
    owner: 'customer_workspace';
    managedBy: 'workspace_owner_or_admin';
    customerVisible: boolean;
    browserReceivesRawKey: boolean;
    encryptedAtRest: boolean;
    note: string;
  };
};
