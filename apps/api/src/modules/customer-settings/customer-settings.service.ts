import { z } from 'zod';
import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import { getCustomerWorkspaceProfile, updateCustomerWorkspaceProfile } from './customer-settings.repository.js';
import type { CustomerConnectionOwnership, CustomerSettingsResponse } from './customer-settings.types.js';

const workspaceProfileSchema = z.object({
  workspaceName: z.string().trim().min(2, 'Workspace/business name is required.').max(120),
  storeDomain: z.string().trim().max(180).optional().nullable(),
  timezone: z.string().trim().max(80).optional().nullable(),
  currency: z.string().trim().min(3).max(3).optional().nullable(),
});

function normalizeNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getConnectionOwnership(): CustomerConnectionOwnership {
  return {
    claude: {
      owner: 'lifesaver_platform',
      managedBy: 'super_admin_backend_environment',
      customerVisible: false,
      browserReceivesKey: false,
      note: 'Claude is the LIFE.SAVER intelligence engine and remains configured only in backend hosting secrets. Customers never paste or see the Claude API key.',
    },
    tripleWhale: {
      owner: 'customer_workspace',
      managedBy: 'workspace_owner_or_admin',
      customerVisible: true,
      browserReceivesRawKey: false,
      encryptedAtRest: true,
      note: 'Each customer connects their own Triple Whale API key from Customer Settings. The backend encrypts the key and scopes it to the customer workspace.',
    },
  };
}

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required for customer workspace settings.');
  }
}

export async function getCustomerSettings(workspaceId: string, userId: string): Promise<CustomerSettingsResponse> {
  assertDatabaseReady();
  const profile = await getCustomerWorkspaceProfile(workspaceId, userId);
  if (!profile) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user does not have access to the requested workspace settings.');
  }

  return {
    version: '0.5.3',
    safetyMode: 'read_advise_draft_only',
    workspaceProfile: profile,
    connectionOwnership: getConnectionOwnership(),
    allowedSettings: [
      'workspace_profile',
      'customer_owned_triple_whale_connection',
      'read_only_validation_and_metrics_refresh',
      'draft_preferences_future',
      'team_users_permissions_foundation',
    ],
  };
}

export async function updateWorkspaceProfile(workspaceId: string, userId: string, input: unknown): Promise<CustomerSettingsResponse> {
  assertDatabaseReady();
  const parsed = workspaceProfileSchema.parse(input);

  const currentProfile = await getCustomerWorkspaceProfile(workspaceId, userId);
  if (!currentProfile) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user does not have access to the requested workspace settings.');
  }

  if (!['owner', 'admin'].includes(String(currentProfile.workspaceRole || '').toLowerCase())) {
    throw new AppError(403, 'INSUFFICIENT_WORKSPACE_PERMISSION', 'Only workspace owners/admins can update workspace profile settings in v0.5.3.');
  }

  const profile = await updateCustomerWorkspaceProfile({
    workspaceId,
    userId,
    workspaceName: parsed.workspaceName.trim(),
    storeDomain: normalizeNullable(parsed.storeDomain),
    timezone: normalizeNullable(parsed.timezone),
    currency: normalizeNullable(parsed.currency)?.toUpperCase() || null,
  });

  if (!profile) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'This user does not have access to the requested workspace settings.');
  }

  return {
    version: '0.5.3',
    safetyMode: 'read_advise_draft_only',
    workspaceProfile: profile,
    connectionOwnership: getConnectionOwnership(),
    allowedSettings: [
      'workspace_profile',
      'customer_owned_triple_whale_connection',
      'read_only_validation_and_metrics_refresh',
      'draft_preferences_future',
      'team_users_permissions_foundation',
    ],
  };
}
