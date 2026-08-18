import { getProductionSecurityChecks } from './config/production-guard.js';
import { env } from './config/env.js';

const checks = getProductionSecurityChecks();
const criticalFailures = checks.filter((check) => check.severity === 'critical' && !check.ok);
const warnings = checks.filter((check) => check.severity === 'warning' && !check.ok);

console.log(JSON.stringify({
  version: '0.7.4',
  mode: 'V2 Phase 8.10 Safe Demo QA',
  nodeEnv: env.NODE_ENV,
  productionReady: criticalFailures.length === 0,
  criticalFailures: criticalFailures.length,
  warnings: warnings.length,
  checks,
}, null, 2));

process.exitCode = env.NODE_ENV === 'production' && criticalFailures.length ? 1 : 0;
