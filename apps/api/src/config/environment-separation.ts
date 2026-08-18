import { env } from './env.js';

const devDatabaseMarkers = [
  'xrzxyvilzdjiwfmajdbo', // current LIFE.SAVER development Supabase project ref
  'lifesaver-dev',
  'dev',
];

const weakSharedValues = [
  'temporary_dev_key_change_later_32_chars',
  'dev_only_lifesaver_auth_secret_change_before_production',
  'dev_only_lifesaver_worker_secret_change_before_production',
];

function includesAny(value: string, markers: string[]) {
  return markers.some((marker) => marker && value.includes(marker));
}

function maskDatabaseUrl(url: string) {
  if (!url) return '';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

export type EnvironmentSeparationCheck = {
  key: string;
  ok: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
};

export function getEnvironmentSeparationStatus() {
  const isNodeProduction = env.NODE_ENV === 'production';
  const isDatabaseProduction = env.DATABASE_ENVIRONMENT === 'production';
  const databaseUrl = env.DATABASE_URL || '';
  const productionDatabaseUrl = env.PRODUCTION_DATABASE_URL || '';
  const databaseLooksLikeKnownDev = includesAny(databaseUrl, devDatabaseMarkers);
  const productionUrlLooksLikeDev = productionDatabaseUrl ? includesAny(productionDatabaseUrl, devDatabaseMarkers) : false;
  const environmentLockExpected = `${env.APP_ENVIRONMENT}:${env.DATABASE_ENVIRONMENT}`;

  const checks: EnvironmentSeparationCheck[] = [
    {
      key: 'app_environment_declared',
      ok: Boolean(env.APP_ENVIRONMENT),
      severity: 'info',
      message: `APP_ENVIRONMENT=${env.APP_ENVIRONMENT}`,
    },
    {
      key: 'database_environment_declared',
      ok: Boolean(env.DATABASE_ENVIRONMENT),
      severity: 'info',
      message: `DATABASE_ENVIRONMENT=${env.DATABASE_ENVIRONMENT}`,
    },
    {
      key: 'environment_lock_matches',
      ok: !env.ENVIRONMENT_LOCK || env.ENVIRONMENT_LOCK === environmentLockExpected,
      severity: isNodeProduction ? 'critical' : 'warning',
      message: env.ENVIRONMENT_LOCK
        ? `ENVIRONMENT_LOCK=${env.ENVIRONMENT_LOCK}; expected ${environmentLockExpected}.`
        : `ENVIRONMENT_LOCK is not set. Recommended value: ${environmentLockExpected}.`,
    },
    {
      key: 'production_node_uses_production_database_label',
      ok: !isNodeProduction || isDatabaseProduction,
      severity: 'critical',
      message: isNodeProduction
        ? `NODE_ENV=production and DATABASE_ENVIRONMENT=${env.DATABASE_ENVIRONMENT}.`
        : 'NODE_ENV is not production; production database enforcement is informational.',
    },
    {
      key: 'development_database_not_labelled_production',
      ok: !(env.NODE_ENV !== 'production' && isDatabaseProduction),
      severity: 'warning',
      message: env.NODE_ENV !== 'production' && isDatabaseProduction
        ? 'Local/development app is pointed at a database labelled production. Avoid testing against production data.'
        : 'Current app/database environment pairing is acceptable for local testing.',
    },
    {
      key: 'database_url_configured',
      ok: Boolean(databaseUrl),
      severity: 'critical',
      message: databaseUrl ? `DATABASE_URL configured as ${maskDatabaseUrl(databaseUrl)}` : 'DATABASE_URL is missing.',
    },
    {
      key: 'production_database_url_separate',
      ok: !isNodeProduction || Boolean(productionDatabaseUrl),
      severity: isNodeProduction ? 'critical' : 'info',
      message: productionDatabaseUrl
        ? `PRODUCTION_DATABASE_URL is configured as ${maskDatabaseUrl(productionDatabaseUrl)}.`
        : 'PRODUCTION_DATABASE_URL not configured. Required before live deployment, optional for local development.',
    },
    {
      key: 'production_database_not_current_dev_project',
      ok: !isNodeProduction || (!databaseLooksLikeKnownDev && !productionUrlLooksLikeDev),
      severity: 'critical',
      message: !isNodeProduction
        ? (databaseLooksLikeKnownDev
            ? 'Local development is using the known development Supabase project. This is acceptable locally, but do not reuse it for production.'
            : 'Local development database does not match the known development marker.')
        : (databaseLooksLikeKnownDev || productionUrlLooksLikeDev
            ? 'A production-labelled environment appears to reference the known development Supabase project. Use a separate production Supabase project.'
            : 'Production database does not match the known development database marker.'),
    },
    {
      key: 'shared_dev_secrets_not_used_in_production',
      ok: !isNodeProduction || !weakSharedValues.some((value) => [env.AUTH_TOKEN_SECRET, env.APP_ENCRYPTION_KEY, env.WORKER_SHARED_SECRET, databaseUrl].some((candidate) => candidate.includes(value))),
      severity: 'critical',
      message: isNodeProduction
        ? 'Production environment checked for known development shared secrets.'
        : 'Development shared secrets may be present locally; rotate before production.',
    },
  ];

  const criticalFailures = checks.filter((check) => check.severity === 'critical' && !check.ok);
  const warnings = checks.filter((check) => check.severity === 'warning' && !check.ok);

  return {
    version: '0.7.4',
    mode: 'V2 Phase 8.10 Safe Demo QA',
    appEnvironment: env.APP_ENVIRONMENT,
    nodeEnvironment: env.NODE_ENV,
    databaseEnvironment: env.DATABASE_ENVIRONMENT,
    environmentLock: env.ENVIRONMENT_LOCK || null,
    expectedEnvironmentLock: environmentLockExpected,
    databaseUrlConfigured: Boolean(databaseUrl),
    productionDatabaseUrlConfigured: Boolean(productionDatabaseUrl),
    developmentDatabaseMarkerDetected: databaseLooksLikeKnownDev,
    productionReady: criticalFailures.length === 0,
    criticalFailures: criticalFailures.length,
    warnings: warnings.length,
    checks,
    rules: [
      'Development and production must use separate Supabase projects/databases.',
      'Never test risky migrations against the production database first.',
      'Keep the same APP_ENCRYPTION_KEY for an environment after connected accounts are stored, unless intentionally re-encrypting keys.',
      'Do not commit .env files to GitHub. Use hosting environment variables for production.',
      'EMERGENCY_SAFE_MODE can be enabled from hosting environment variables when all autonomy must be halted immediately.',
    ],
  };
}
