import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootEnvPath });
dotenv.config();

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function isSet(value: string | undefined): boolean {
  return value != null && value.trim() !== '';
}

// Historical development-only value. It is published in a public repository, so it must never
// authenticate a production worker against the API. It is kept here only so the guard can
// recognise it and refuse it, and so local development keeps working without extra setup.
export const DEV_ONLY_WORKER_SHARED_SECRET = 'dev_only_lifesaver_worker_secret_change_before_production';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const suppliedWorkerSharedSecret = process.env.WORKER_SHARED_SECRET ?? '';

// In production there is no fallback at all: an unset variable stays empty and
// apps/worker/src/config/production-guard.ts blocks startup. Outside production the historical
// dev value is still applied so `npm run dev:worker` keeps talking to a local API, but the guard
// warns loudly about it.
const resolvedWorkerSharedSecret = isSet(suppliedWorkerSharedSecret)
  ? suppliedWorkerSharedSecret
  : (isProduction ? '' : DEV_ONLY_WORKER_SHARED_SECRET);

export type WorkerSharedSecretSource = 'environment' | 'development_fallback' | 'missing';

const workerSharedSecretSource: WorkerSharedSecretSource = isSet(suppliedWorkerSharedSecret)
  ? 'environment'
  : (isProduction ? 'missing' : 'development_fallback');

export const workerEnv = {
  NODE_ENV: nodeEnv,
  WORKER_ENABLED: bool(process.env.WORKER_ENABLED, false),
  // Whether WORKER_ENABLED was actually provided by the deployment, as opposed to falling back
  // to the `false` default. A worker that silently schedules nothing is a deployment mistake we
  // want to surface at startup.
  WORKER_ENABLED_EXPLICIT: isSet(process.env.WORKER_ENABLED),
  WORKER_API_BASE_URL: process.env.WORKER_API_BASE_URL || 'http://localhost:4000',
  WORKER_SHARED_SECRET: resolvedWorkerSharedSecret,
  WORKER_SHARED_SECRET_SOURCE: workerSharedSecretSource,
  // Same escape hatch name and semantics as apps/api/src/config/production-guard.ts.
  ALLOW_INSECURE_PRODUCTION_STARTUP: bool(process.env.ALLOW_INSECURE_PRODUCTION_STARTUP, false),
  WORKER_TIMEZONE: process.env.WORKER_TIMEZONE || process.env.TRIPLE_WHALE_TIMEZONE || 'America/New_York',
  WORKER_METRICS_CRON: process.env.WORKER_METRICS_CRON || '15 * * * *',
  WORKER_DAILY_BRIEF_CRON: process.env.WORKER_DAILY_BRIEF_CRON || '30 8 * * *',
  WORKER_WEEKLY_SUMMARY_CRON: process.env.WORKER_WEEKLY_SUMMARY_CRON || '0 9 * * 1',
};
