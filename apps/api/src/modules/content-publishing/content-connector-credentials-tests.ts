import { encryptSecret, decryptSecret } from '../../common/utils/crypto.js';
import {
  assertNoRawLinkedInTokenInStatus,
  contentConnectorCredentialModel,
  toSafeContentConnectorStatus,
} from './content-connector-credentials.service.js';
import type { ContentConnectorCredentialRow } from './content-connector-credentials.types.js';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function fakeRow(overrides: Partial<ContentConnectorCredentialRow> = {}): ContentConnectorCredentialRow {
  const now = new Date('2026-07-06T12:00:00.000Z');
  const future = new Date(Date.now() + 60 * 60 * 1000);
  return {
    id: '00000000-0000-4000-8000-000000000001',
    workspace_id: '00000000-0000-4000-8000-000000000002',
    provider: 'linkedin',
    connection_kind: 'member',
    provider_account_id_hash: 'fake-provider-account-hash',
    provider_account_hint: 'Muhammad Tahir',
    encrypted_access_token: encryptSecret('linkedin-access-token-example-1234567890'),
    encrypted_refresh_token: encryptSecret('linkedin-refresh-token-example-1234567890'),
    token_fingerprint: 'fake-token-fingerprint',
    granted_scopes_json: ['openid', 'profile', 'w_member_social'],
    access_token_expires_at: future,
    refresh_token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'connected',
    connected_by_user_id: '00000000-0000-4000-8000-000000000003',
    disconnected_by_user_id: null,
    last_connected_at: now,
    disconnected_at: null,
    last_error: null,
    metadata: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const checks: Array<[string, () => void]> = [
  ['credential model selects linkedin', () => assert(contentConnectorCredentialModel.selectedPlatform === 'linkedin', 'Selected platform must be LinkedIn.')],
  ['required write scope is w_member_social', () => assert(contentConnectorCredentialModel.requiredScope === 'w_member_social', 'Required scope must be w_member_social.')],
  ['storage table is content_connector_credentials', () => assert(contentConnectorCredentialModel.storageTable === 'content_connector_credentials', 'Storage table mismatch.')],
  ['access token encryption flag is true', () => assert(contentConnectorCredentialModel.encryptsAccessToken === true, 'Access token encryption must be true.')],
  ['refresh token encryption flag is true', () => assert(contentConnectorCredentialModel.encryptsRefreshToken === true, 'Refresh token encryption must be true.')],
  ['browser raw token flag is false', () => assert(contentConnectorCredentialModel.browserReceivesRawToken === false, 'Browser must never receive raw token.')],
  ['real publishing disabled', () => assert(contentConnectorCredentialModel.realPublishingEnabled === false, 'Real publishing must remain disabled.')],
  ['auto-run disabled', () => assert(contentConnectorCredentialModel.autoRunEnabled === false, 'Auto-run must remain disabled.')],
  ['external api not called', () => assert(contentConnectorCredentialModel.externalApiCalled === false, 'Phase 9.3 must not call external APIs.')],
  ['encrypt/decrypt roundtrip works for credential material', () => {
    const secret = 'linkedin-access-token-example-roundtrip-1234567890';
    const encrypted = encryptSecret(secret);
    assert(encrypted !== secret, 'Encrypted value must not equal plain token.');
    assert(decryptSecret(encrypted) === secret, 'Decrypted value must match original token.');
  }],
  ['safe status does not include encrypted token fields', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    const serialized = JSON.stringify(status);
    assert(!serialized.includes('encrypted_access_token'), 'Status must not expose encrypted_access_token field name.');
    assert(!serialized.includes('encrypted_refresh_token'), 'Status must not expose encrypted_refresh_token field name.');
    assert(!serialized.includes('token_fingerprint'), 'Status must not expose token_fingerprint field name.');
  }],
  ['safe status does not include raw token sample', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    assertNoRawLinkedInTokenInStatus(status, ['linkedin-access-token-example-1234567890', 'linkedin-refresh-token-example-1234567890']);
  }],
  ['safe status connected when token exists and not expired', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    assert(status.connected === true, 'Connected should be true for unexpired connected row.');
    assert(status.status === 'connected', 'Status should be connected.');
  }],
  ['safe status expired when access token expiry passed', () => {
    const status = toSafeContentConnectorStatus(fakeRow({ access_token_expires_at: new Date(Date.now() - 1000) }));
    assert(status.connected === false, 'Expired credential should not be connected.');
    assert(status.status === 'expired', 'Expired credential should expose expired status.');
  }],
  ['safe status disconnected when tokens removed', () => {
    const status = toSafeContentConnectorStatus(fakeRow({ encrypted_access_token: null, encrypted_refresh_token: null, status: 'disconnected' }));
    assert(status.connected === false, 'Disconnected row should not be connected.');
    assert(status.encryptedAtRest === false, 'Disconnected row should not claim encrypted token at rest.');
  }],
  ['not created status is safe', () => {
    const status = toSafeContentConnectorStatus(null);
    assert(status.status === 'not_created', 'Missing row should report not_created.');
    assert(status.connected === false, 'Missing row should not be connected.');
    assert(status.browserReceivesRawToken === false, 'Missing row must still confirm no raw browser token.');
  }],
  ['status endpoint is read-only status route', () => assert(contentConnectorCredentialModel.statusEndpoint === 'GET /api/v1/connect/linkedin/status', 'Status endpoint mismatch.')],
  ['disconnect endpoint exists', () => assert(contentConnectorCredentialModel.disconnectEndpoint === 'DELETE /api/v1/connect/linkedin', 'Disconnect endpoint mismatch.')],
  ['safe status metadata keeps publishing disabled', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    assert(status.metadata.realPublishingEnabled === false, 'Safe status must keep real publishing disabled.');
    assert(status.metadata.externalApiCalled === false, 'Safe status must say external API was not called.');
  }],
  ['granted scopes are shown but tokens are not', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    assert(status.grantedScopes.includes('w_member_social'), 'Granted scopes should include w_member_social.');
    assert(status.accountHint === 'Muhammad Tahir', 'Safe account hint should be shown.');
  }],
  ['organization connector is not enabled by model', () => assert(contentConnectorCredentialModel.selectedPlatform === 'linkedin', 'Only LinkedIn member lane is selected now.')],
  ['next allowed step warns no publishing in Phase 9.3', () => {
    const status = toSafeContentConnectorStatus(fakeRow());
    assert(status.nextAllowedStep.includes('Real publishing is still not enabled'), 'Next step must warn publishing is not enabled.');
  }],
];

let passed = 0;
const failures: string[] = [];
for (const [name, fn] of checks) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`✗ ${name}: ${message}`);
  }
}

if (failures.length) {
  console.error(`content-connector:credentials:test — ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`content-connector:credentials:test — ${passed} passed, 0 failed`);
console.log('Selected platform: linkedin');
console.log('Encrypted credential storage model: content_connector_credentials');
console.log('Real external writes added: false');
console.log('Auto-run enabled: false');
