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

export const workerEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  WORKER_ENABLED: bool(process.env.WORKER_ENABLED, false),
  WORKER_API_BASE_URL: process.env.WORKER_API_BASE_URL || 'http://localhost:4000',
  WORKER_SHARED_SECRET: process.env.WORKER_SHARED_SECRET || 'dev_only_lifesaver_worker_secret_change_before_production',
  WORKER_TIMEZONE: process.env.WORKER_TIMEZONE || process.env.TRIPLE_WHALE_TIMEZONE || 'America/New_York',
  WORKER_METRICS_CRON: process.env.WORKER_METRICS_CRON || '15 * * * *',
  WORKER_DAILY_BRIEF_CRON: process.env.WORKER_DAILY_BRIEF_CRON || '30 8 * * *',
  WORKER_WEEKLY_SUMMARY_CRON: process.env.WORKER_WEEKLY_SUMMARY_CRON || '0 9 * * 1',
};
