import { env } from '../../config/env.js';
import { getProductionSecurityChecks } from '../../config/production-guard.js';
import { getEnvironmentSeparationStatus } from '../../config/environment-separation.js';

export function getSecurityStatus() {
  const checks = getProductionSecurityChecks();
  const criticalFailures = checks.filter((check) => check.severity === 'critical' && !check.ok);
  const warnings = checks.filter((check) => check.severity === 'warning' && !check.ok);

  const environmentSeparation = getEnvironmentSeparationStatus();

  return {
    version: '0.7.5',
    mode: env.NODE_ENV,
    productionReady: criticalFailures.length === 0,
    criticalFailures: criticalFailures.length,
    warnings: warnings.length,
    checks,
    environmentSeparation,
    activeSecurityControls: {
      corsOrigins: env.ALLOWED_ORIGINS,
      dashboardRequireAuth: env.DASHBOARD_REQUIRE_AUTH,
      chatRequireAuth: env.CHAT_REQUIRE_AUTH,
      debugRoutesEnabled: env.ENABLE_DEBUG_ROUTES,
      globalRateLimitPerMinute: env.API_RATE_LIMIT_PER_MINUTE,
      chatRateLimitPerMinute: env.CHAT_RATE_LIMIT_PER_MINUTE,
      jsonBodyLimit: env.JSON_BODY_LIMIT,
      noStoreHeaders: true,
      helmetHeaders: true,
      requestIdHeader: true,
      workerSecretRequired: true,
      externalActionToolsAllowed: false,
    },
    notes: [
      'This endpoint is protected and must remain admin-only.',
      'Production should not include real .env files in GitHub or ZIP handoff packages.',
      'Production and development must use separate Supabase databases/projects.',
      'APP_ENCRYPTION_KEY must not change after provider keys are stored unless connected accounts are intentionally re-encrypted.',
    ],
  };
}
