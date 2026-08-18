import { env } from '../../config/env.js';
import { getProductionSecurityChecks } from '../../config/production-guard.js';
import type { LaunchCheck, LaunchReadinessPayload } from './launch-readiness.types.js';

function isHttpsUrl(value: string): boolean {
  return value.startsWith('https://');
}

function isLocalUrl(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

function addCheck(checks: LaunchCheck[], check: LaunchCheck) {
  checks.push(check);
}

export function getLaunchReadiness(): LaunchReadinessPayload {
  const isProduction = env.NODE_ENV === 'production';
  const surfaceUrls = [env.PUBLIC_SITE_URL, env.APP_URL, env.ADMIN_URL, env.API_URL];
  const allowedSurfaceOrigins = [env.PUBLIC_SITE_URL, env.APP_URL, env.ADMIN_URL];
  const securityChecks = getProductionSecurityChecks();
  const failedSecurityChecks = securityChecks.filter((check) => check.severity === 'critical' && !check.ok);

  const checklist: LaunchCheck[] = [];

  addCheck(checklist, {
    key: 'node_environment',
    label: 'Node environment',
    ok: isProduction,
    severity: isProduction ? 'info' : 'warning',
    message: isProduction ? 'NODE_ENV is production.' : 'Local/development mode is fine for testing, but not for real customer traffic.',
  });

  addCheck(checklist, {
    key: 'domain_mode',
    label: 'Domain deployment mode',
    ok: env.DOMAIN_DEPLOYMENT_MODE !== 'local-development' || !isProduction,
    severity: isProduction ? 'critical' : 'info',
    message: `DOMAIN_DEPLOYMENT_MODE=${env.DOMAIN_DEPLOYMENT_MODE}. Use split-subdomain-production for app/admin/api/public domains, or render-single-service for one hosted service.`,
  });

  addCheck(checklist, {
    key: 'customer_access_mode',
    label: 'Customer access mode',
    ok: env.CUSTOMER_ACCESS_MODE !== 'customer-ready' || isProduction,
    severity: env.CUSTOMER_ACCESS_MODE === 'customer-ready' ? 'critical' : 'info',
    message: `CUSTOMER_ACCESS_MODE=${env.CUSTOMER_ACCESS_MODE}. Keep private-beta until production security checks are clean.`,
  });

  addCheck(checklist, {
    key: 'surface_urls_present',
    label: 'Public/app/admin/api URLs',
    ok: surfaceUrls.every(Boolean),
    severity: 'critical',
    message: `Configured URLs: public=${env.PUBLIC_SITE_URL}; app=${env.APP_URL}; admin=${env.ADMIN_URL}; api=${env.API_URL}`,
  });

  addCheck(checklist, {
    key: 'surface_urls_https',
    label: 'HTTPS for production surfaces',
    ok: !isProduction || surfaceUrls.every(isHttpsUrl),
    severity: isProduction ? 'critical' : 'info',
    message: isProduction ? 'All production surfaces must use HTTPS.' : 'Local HTTP is acceptable during development. Production customer domains must use HTTPS.',
  });

  addCheck(checklist, {
    key: 'surface_urls_not_localhost',
    label: 'No localhost in production URLs',
    ok: !isProduction || !surfaceUrls.some(isLocalUrl),
    severity: isProduction ? 'critical' : 'info',
    message: isProduction ? 'Production URLs must not point to localhost/127.0.0.1.' : 'Local URLs are expected while testing on your computer.',
  });

  addCheck(checklist, {
    key: 'allowed_origins',
    label: 'CORS origins include public/app/admin',
    ok: allowedSurfaceOrigins.every((origin) => env.ALLOWED_ORIGINS.includes(origin)),
    severity: isProduction ? 'critical' : 'warning',
    message: `ALLOWED_ORIGINS=${env.ALLOWED_ORIGINS.join(', ') || 'none'}`,
  });

  addCheck(checklist, {
    key: 'database_configured',
    label: 'Database configured',
    ok: Boolean(env.DATABASE_URL),
    severity: 'critical',
    message: env.DATABASE_URL ? 'DATABASE_URL is configured.' : 'DATABASE_URL is missing.',
  });

  addCheck(checklist, {
    key: 'database_ssl',
    label: 'Database SSL',
    ok: Boolean(env.DATABASE_SSL),
    severity: isProduction ? 'critical' : 'warning',
    message: env.DATABASE_SSL ? 'DATABASE_SSL is enabled.' : 'DATABASE_SSL should be enabled for Supabase/production.',
  });

  addCheck(checklist, {
    key: 'dashboard_auth',
    label: 'Dashboard and chat auth',
    ok: Boolean(env.DASHBOARD_REQUIRE_AUTH && env.CHAT_REQUIRE_AUTH),
    severity: isProduction ? 'critical' : 'warning',
    message: `DASHBOARD_REQUIRE_AUTH=${env.DASHBOARD_REQUIRE_AUTH}; CHAT_REQUIRE_AUTH=${env.CHAT_REQUIRE_AUTH}`,
  });

  addCheck(checklist, {
    key: 'debug_routes_disabled',
    label: 'Debug routes disabled',
    ok: !env.ENABLE_DEBUG_ROUTES,
    severity: 'critical',
    message: env.ENABLE_DEBUG_ROUTES ? 'Disable ENABLE_DEBUG_ROUTES before customer access.' : 'Debug routes are disabled.',
  });

  addCheck(checklist, {
    key: 'security_checks',
    label: 'Production security checks',
    ok: failedSecurityChecks.length === 0,
    severity: 'critical',
    message: failedSecurityChecks.length ? `${failedSecurityChecks.length} critical security checks still failing.` : 'Critical security checks are clean.',
  });

  addCheck(checklist, {
    key: 'worker_private',
    label: 'Worker stays private',
    ok: Boolean(env.WORKER_SHARED_SECRET && env.WORKER_API_BASE_URL),
    severity: 'critical',
    message: `WORKER_API_BASE_URL=${env.WORKER_API_BASE_URL}. Worker has no public page and must use WORKER_SHARED_SECRET.`,
  });

  addCheck(checklist, {
    key: 'external_actions_disabled',
    label: 'External write actions disabled',
    ok: true,
    severity: 'info',
    message: 'v1 remains read + advise + draft only. No posting, email sending, refunds, campaign edits, ad spend changes, product edits, or Triple Whale write-back.',
  });

  const criticalFailures = checklist.filter((check) => check.severity === 'critical' && !check.ok).length;
  const warnings = checklist.filter((check) => check.severity === 'warning' && !check.ok).length;
  const readyForProductionCustomerTraffic = isProduction && criticalFailures === 0;
  const readyForLocalCustomerTesting = Boolean(env.DATABASE_URL) && !env.ENABLE_DEBUG_ROUTES;

  return {
    version: '0.7.5',
    mode: 'customer-ready-domain-production-prep',
    customerAccessMode: env.CUSTOMER_ACCESS_MODE,
    domainDeploymentMode: env.DOMAIN_DEPLOYMENT_MODE,
    launchDomainLabel: env.CUSTOMER_LAUNCH_DOMAIN_LABEL,
    readyForLocalCustomerTesting,
    readyForProductionCustomerTraffic,
    criticalFailures,
    warnings,
    configuredUrls: {
      publicSiteUrl: env.PUBLIC_SITE_URL,
      appUrl: env.APP_URL,
      adminUrl: env.ADMIN_URL,
      apiUrl: env.API_URL,
      workerApiBaseUrl: env.WORKER_API_BASE_URL,
    },
    productionEnvTemplate: {
      NODE_ENV: 'production',
      APP_ENVIRONMENT: 'production',
      DATABASE_ENVIRONMENT: 'production',
      ENVIRONMENT_LOCK: 'production:production',
      DOMAIN_DEPLOYMENT_MODE: 'split-subdomain-production',
      CUSTOMER_ACCESS_MODE: 'private-beta',
      PUBLIC_SITE_URL: 'https://mydomain.com',
      APP_URL: 'https://app.mydomain.com',
      ADMIN_URL: 'https://admin.mydomain.com',
      API_URL: 'https://api.mydomain.com',
      ALLOWED_ORIGINS: 'https://mydomain.com,https://app.mydomain.com,https://admin.mydomain.com',
      DASHBOARD_REQUIRE_AUTH: 'true',
      CHAT_REQUIRE_AUTH: 'true',
      DATABASE_SSL: 'true',
      ENABLE_DEBUG_ROUTES: 'false',
      SERVE_WEB_APP: 'true for single-service Render only; false for separate static app hosting',
    },
    checklist,
    customerFlow: [
      'Customer opens app domain.',
      'Customer creates account or logs in.',
      'Customer completes onboarding.',
      'Customer adds their own Triple Whale API key in Settings.',
      'Backend validates and encrypts the key per workspace.',
      'Customer refreshes metrics and views dashboard/briefs/chat/drafts.',
      'Customer can add team members according to workspace role permissions.',
    ],
    adminFlow: [
      'Admin opens admin domain.',
      'Admin logs in with protected account.',
      'Admin monitors users/workspaces, connected account status, worker health, usage, and errors.',
      'Admin never sees raw customer Triple Whale keys or platform Claude key.',
      'Admin uses logs/readiness checks before inviting a private customer.',
    ],
    blockedUntilReady: [
      'Do not invite real customer traffic until production secrets are rotated.',
      'Do not reuse development Supabase database for customer production data.',
      'Do not set CUSTOMER_ACCESS_MODE=customer-ready until HTTPS/CORS/auth checks are clean.',
      'Do not enable public signup broadly until abuse, billing, and email verification are planned.',
      'Do not expose .env, API keys, database URLs, APP_ENCRYPTION_KEY, or WORKER_SHARED_SECRET in GitHub or ZIP handoffs.',
    ],
    safetyRules: [
      'Claude API is platform-owned and server-side only.',
      'Triple Whale API is customer/workspace-owned and encrypted server-side.',
      'LIFE.SAVER v1 remains read + advise + draft only.',
      'Worker stays private and uses WORKER_SHARED_SECRET.',
      'Raw provider payloads and normalized dashboard metrics remain separate.',
      'Every customer API response must be workspace-scoped.',
    ],
  };
}
