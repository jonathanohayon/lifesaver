import { env } from './env.js';

const weakOrDefaultSecretSnippets = [
  'dev_only',
  'temporary_dev_key',
  'change_before_production',
  'change_later',
  'replace_with',
];

function looksWeak(value: string | undefined | null, minLength = 32): boolean {
  if (!value || value.length < minLength) return true;
  return weakOrDefaultSecretSnippets.some((snippet) => value.includes(snippet));
}


function isHttpsUrl(value: string): boolean {
  return value.startsWith('https://');
}

function isLocalUrl(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

function hasOrigin(origin: string): boolean {
  return env.ALLOWED_ORIGINS.includes(origin);
}

export type ProductionSecurityCheck = {
  key: string;
  ok: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
};

export function getProductionSecurityChecks(): ProductionSecurityCheck[] {
  const isProd = env.NODE_ENV === 'production';
  const checks: ProductionSecurityCheck[] = [
    {
      key: 'node_env',
      ok: isProd,
      severity: isProd ? 'info' : 'warning',
      message: isProd ? 'NODE_ENV is production.' : 'NODE_ENV is not production; production-only hardening is not fully enforced.',
    },
    {
      key: 'database_url',
      ok: Boolean(env.DATABASE_URL),
      severity: 'critical',
      message: env.DATABASE_URL ? 'DATABASE_URL is configured.' : 'DATABASE_URL is missing.',
    },
    {
      key: 'database_ssl',
      ok: Boolean(env.DATABASE_SSL),
      severity: isProd ? 'critical' : 'warning',
      message: env.DATABASE_SSL ? 'DATABASE_SSL is enabled.' : 'DATABASE_SSL is disabled.',
    },
    {
      key: 'auth_token_secret',
      ok: !looksWeak(env.AUTH_TOKEN_SECRET, 40),
      severity: 'critical',
      message: looksWeak(env.AUTH_TOKEN_SECRET, 40) ? 'AUTH_TOKEN_SECRET looks weak/default.' : 'AUTH_TOKEN_SECRET length/shape looks acceptable.',
    },
    {
      key: 'app_encryption_key',
      ok: !looksWeak(env.APP_ENCRYPTION_KEY, 32),
      severity: 'critical',
      message: looksWeak(env.APP_ENCRYPTION_KEY, 32) ? 'APP_ENCRYPTION_KEY looks weak/default. Do not rotate after keys are stored unless you re-encrypt connected accounts.' : 'APP_ENCRYPTION_KEY length/shape looks acceptable.',
    },
    {
      key: 'worker_shared_secret',
      ok: !looksWeak(env.WORKER_SHARED_SECRET, 40),
      severity: 'critical',
      message: looksWeak(env.WORKER_SHARED_SECRET, 40) ? 'WORKER_SHARED_SECRET looks weak/default.' : 'WORKER_SHARED_SECRET length/shape looks acceptable.',
    },
    {
      key: 'dashboard_require_auth',
      ok: Boolean(env.DASHBOARD_REQUIRE_AUTH),
      severity: 'critical',
      message: env.DASHBOARD_REQUIRE_AUTH ? 'Dashboard data endpoints require auth.' : 'Dashboard data endpoints do not require auth. This is acceptable only for local development.',
    },
    {
      key: 'chat_require_auth',
      ok: Boolean(env.CHAT_REQUIRE_AUTH),
      severity: 'critical',
      message: env.CHAT_REQUIRE_AUTH ? 'Chat requires auth.' : 'Chat does not require auth. This is acceptable only for local development.',
    },
    {
      key: 'debug_routes',
      ok: !env.ENABLE_DEBUG_ROUTES,
      severity: 'critical',
      message: env.ENABLE_DEBUG_ROUTES ? 'Debug routes are enabled.' : 'Debug routes are disabled.',
    },
    {
      key: 'cors_origins',
      ok: env.ALLOWED_ORIGINS.length > 0 && (!isProd || !env.ALLOWED_ORIGINS.some((origin) => origin.includes('localhost'))),
      severity: isProd ? 'critical' : 'warning',
      message: `Allowed origins: ${env.ALLOWED_ORIGINS.join(', ') || 'none'}`,
    },
    {
      key: 'product_surface_urls',
      ok: Boolean(env.PUBLIC_SITE_URL && env.APP_URL && env.ADMIN_URL && env.API_URL) && (!isProd || ![env.PUBLIC_SITE_URL, env.APP_URL, env.ADMIN_URL, env.API_URL].some(isLocalUrl)),
      severity: isProd ? 'critical' : 'info',
      message: `Surfaces: public=${env.PUBLIC_SITE_URL}; app=${env.APP_URL}; admin=${env.ADMIN_URL}; api=${env.API_URL}`,
    },
    {
      key: 'product_surface_https',
      ok: !isProd || [env.PUBLIC_SITE_URL, env.APP_URL, env.ADMIN_URL, env.API_URL].every(isHttpsUrl),
      severity: isProd ? 'critical' : 'info',
      message: isProd ? 'Production surfaces must use HTTPS.' : 'HTTPS is required for production customer traffic; local HTTP is acceptable only in development.',
    },
    {
      key: 'allowed_origins_include_surfaces',
      ok: hasOrigin(env.PUBLIC_SITE_URL) && hasOrigin(env.APP_URL) && hasOrigin(env.ADMIN_URL),
      severity: isProd ? 'critical' : 'warning',
      message: `ALLOWED_ORIGINS should include public/app/admin surfaces. Current: ${env.ALLOWED_ORIGINS.join(', ') || 'none'}`,
    },
    {
      key: 'emergency_safe_mode',
      ok: true,
      severity: env.EMERGENCY_SAFE_MODE ? 'warning' : 'info',
      message: env.EMERGENCY_SAFE_MODE
        ? 'EMERGENCY_SAFE_MODE=true. All future executor execution must be blocked and Admin warning must be visible.'
        : 'EMERGENCY_SAFE_MODE=false. Emergency override is currently inactive.',
    },
    {
      key: 'domain_deployment_mode',
      ok: !isProd || env.DOMAIN_DEPLOYMENT_MODE !== 'local-development',
      severity: isProd ? 'critical' : 'info',
      message: `DOMAIN_DEPLOYMENT_MODE=${env.DOMAIN_DEPLOYMENT_MODE}; CUSTOMER_ACCESS_MODE=${env.CUSTOMER_ACCESS_MODE}`,
    },
  ];

  return checks;
}

export function assertProductionSafeStartup() {
  if (env.NODE_ENV !== 'production') return;
  if (env.ALLOW_INSECURE_PRODUCTION_STARTUP) {
    console.warn('[LIFE.SAVER security] ALLOW_INSECURE_PRODUCTION_STARTUP=true. Production safety checks are warning-only. Do not use this for real client traffic.');
    return;
  }

  const failed = getProductionSecurityChecks().filter((check) => check.severity === 'critical' && !check.ok);
  if (failed.length) {
    const text = failed.map((check) => `- ${check.key}: ${check.message}`).join('\n');
    throw new Error(`Production startup blocked by security checks:\n${text}\nSet secure environment variables before production deployment.`);
  }
}
