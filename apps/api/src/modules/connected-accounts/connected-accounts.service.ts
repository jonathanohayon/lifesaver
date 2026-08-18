import { z } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { decryptSecret, encryptSecret, secretHint } from '../../common/utils/crypto.js';
import { getConnectionOwnership } from '../customer-settings/customer-settings.service.js';
import {
  disconnectTripleWhale,
  getConnectedAccount,
  recordConnectedAccountEvent,
  toConnectedAccountStatus,
  upsertTripleWhaleApiKey,
} from './connected-accounts.repository.js';
import type { ConnectedAccountStatus } from './connected-accounts.types.js';
import { getActiveMembership } from '../team/team.repository.js';

const connectTripleWhaleSchema = z.object({
  apiKey: z.string().min(12, 'Triple Whale API key is required.').max(5000),
});

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required before connecting Triple Whale.');
  }
}

async function getVerifiedConnectionManagerRole(workspaceId: string, userId: string): Promise<string> {
  const membership = await getActiveMembership(workspaceId, userId);
  const workspaceRole = membership?.role || '';
  if (!['owner', 'admin'].includes(String(workspaceRole || '').toLowerCase())) {
    throw new AppError(403, 'INSUFFICIENT_WORKSPACE_PERMISSION', 'Only workspace owners/admins can add, replace, or disconnect the workspace Triple Whale API key.');
  }
  return workspaceRole;
}

function buildPersistenceStatus(row: Awaited<ReturnType<typeof getConnectedAccount>>): NonNullable<ConnectedAccountStatus['persistence']> {
  if (!row || !row.encrypted_api_key) {
    return {
      encryptedKeyStored: false,
      decryptable: false,
      status: 'missing',
      message: 'No encrypted Triple Whale key is stored for this workspace yet.',
    };
  }

  try {
    const plain = decryptSecret(row.encrypted_api_key);
    if (!plain || plain.trim().length < 8) {
      return {
        encryptedKeyStored: true,
        decryptable: false,
        status: 'decrypt_failed',
        message: 'The stored Triple Whale key decrypted, but the value is not usable. Reconnect the key from Customer Settings.',
      };
    }
    return {
      encryptedKeyStored: true,
      decryptable: true,
      status: 'ok',
      message: 'Encrypted Triple Whale key is stored and decryptable with the current APP_ENCRYPTION_KEY. Raw key was not returned.',
    };
  } catch (_error) {
    return {
      encryptedKeyStored: true,
      decryptable: false,
      status: 'decrypt_failed',
      message: 'Encrypted Triple Whale key exists but cannot be decrypted. The APP_ENCRYPTION_KEY likely changed. Restore the original environment value or reconnect Triple Whale once.',
    };
  }
}

export async function getTripleWhaleConnectionStatus(workspaceId: string): Promise<ConnectedAccountStatus> {
  assertDatabaseReady();
  const row = await getConnectedAccount(workspaceId, 'triple_whale');
  const status = toConnectedAccountStatus(row);
  const persistence = buildPersistenceStatus(row);
  return {
    ...status,
    connected: status.connected && persistence.status === 'ok',
    status: persistence.status === 'decrypt_failed' ? 'key_decrypt_failed' : status.status,
    lastError: persistence.status === 'decrypt_failed' ? persistence.message : status.lastError,
    persistence,
    ownership: getConnectionOwnership().tripleWhale,
  };
}

export async function connectTripleWhale(workspaceId: string, userId: string, _workspaceRole: string, input: unknown): Promise<ConnectedAccountStatus> {
  assertDatabaseReady();
  const workspaceRole = await getVerifiedConnectionManagerRole(workspaceId, userId);
  const parsed = connectTripleWhaleSchema.parse(input);
  const apiKey = parsed.apiKey.trim();

  const encryptedApiKey = encryptSecret(apiKey);
  const keyHint = secretHint(apiKey);

  const row = await upsertTripleWhaleApiKey({
    workspaceId,
    encryptedApiKey,
    keyHint,
    metadata: {
      source: 'customer_workspace_settings',
      ownership: 'customer_workspace_owned',
      managedByRole: workspaceRole,
      version: '0.6.0',
      storedAt: new Date().toISOString(),
      verification: 'live_validation_available',
      persistence: 'encrypted_key_saved_and_reloadable_with_stable_APP_ENCRYPTION_KEY',
      safetyMode: 'read_advise_draft_only',
    },
  });

  await recordConnectedAccountEvent({
    workspaceId,
    eventType: 'customer_triple_whale_key_stored_encrypted',
    message: 'Customer-owned Triple Whale API key was encrypted and stored for this workspace. Raw key was not returned to the browser.',
    metadata: { userId, keyHint, workspaceRole, version: '0.6.0', ownership: 'customer_workspace_owned', verification: 'live_validation_available', persistence: 'encrypted_key_saved_and_reloadable_with_stable_APP_ENCRYPTION_KEY' },
  });

  const status = toConnectedAccountStatus(row);
  return {
    ...status,
    ownership: getConnectionOwnership().tripleWhale,
  };
}

export async function removeTripleWhaleConnection(workspaceId: string, userId: string, _workspaceRole: string): Promise<ConnectedAccountStatus> {
  assertDatabaseReady();
  const workspaceRole = await getVerifiedConnectionManagerRole(workspaceId, userId);
  const row = await disconnectTripleWhale(workspaceId);

  await recordConnectedAccountEvent({
    workspaceId,
    eventType: 'customer_triple_whale_disconnected',
    message: 'Customer-owned Triple Whale connection was manually disconnected and encrypted key removed for this workspace.',
    metadata: { userId, workspaceRole, version: '0.6.0', ownership: 'customer_workspace_owned' },
  });

  const status = toConnectedAccountStatus(row);
  return {
    ...status,
    ownership: getConnectionOwnership().tripleWhale,
  };
}
